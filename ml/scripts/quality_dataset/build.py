"""Assemble a cured-tobacco-leaf quality dataset graded A / B / C.

Source
------
Harvard Dataverse doi:10.7910/DVN/TTPLFT - 49,778 photographs of *cured*
Virginia flue-cured tobacco leaves shot on Tanzanian grading tables, each
filed under its official Tanzanian grade code. Released CC0. See
``config.TZ_DATAVERSE`` for attribution and ``config`` for how the native
codes become Grade A / B / C.

Output (under ml/data/tobacco_quality_dataset/)
-----------------------------------------------
    raw_images/<CODE>/            exactly what was downloaded, untouched
    processed_images/Grade_*/     RGB, EXIF-stripped, renamed, deduplicated
    Grade_A|Grade_B|Grade_C/      the training folders (junctions to the above)
    duplicates/                   images dropped as repeats, with a manifest
    rejected_images/              images dropped by a quality gate
    needs_manual_review/          codes that cannot be graded without guessing
    reports/                      statistics, montage, source report
    metadata.csv, grade_mapping.csv

Usage
-----
    python -m scripts.quality_dataset.build --plan-only
    python -m scripts.quality_dataset.build --target 10000
    python -m scripts.quality_dataset.build --target 3000 --rate 1.0

Downloads are paced by a shared rate limiter and the build is resumable, so an
interrupted run can simply be re-issued. Do not raise --rate to hurry it along:
Dataverse's load balancer answers 403 and blocks the IP for ~10 minutes.
"""
from __future__ import annotations

import argparse
import csv
import random
import shutil
import subprocess
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

import requests

from . import config, curate, dataverse, report

GRADE_SLUG = {"Grade_A": "A", "Grade_B": "B", "Grade_C": "C"}

# Sources checked during research that did not yield usable cured-leaf,
# quality-graded images. Recorded so the search is not silently repeated.
REJECTED_SOURCES = [
    {
        "name": "Kaggle",
        "reason": "No cured-tobacco grading set. Tobacco-800/Tobacco-3482 are "
        "scanned *documents*; the tobacco leaf sets present are disease "
        "or segmentation sets of green leaves.",
    },
    {
        "name": "Roboflow Universe",
        "reason": "Tobacco projects are disease/object detection on green "
        "leaves; no public grading set. Site is behind Cloudflare, so "
        "programmatic collection would also breach its access terms.",
    },
    {
        "name": "GitHub",
        "reason": "Grading repos ship code and weights, not images "
        "(KUST-IMG Tobacco-Leaf-Grading_CDD_2023, ChenDoubleD/FDANet). The "
        "one repo with images (shreyasnnn) labels leaf *maturity* in "
        "Chinese, not grade, and carries no license.",
    },
    {
        "name": "Zenodo",
        "reason": "No tobacco leaf grading image dataset; hits are plant "
        "biology, tobacco-control policy and museum object scans.",
    },
    {
        "name": "Figshare",
        "reason": "Only journal supplementary tables (spectra, agronomy, "
        "flavour chemistry). No leaf image sets.",
    },
    {
        "name": "Mendeley Data",
        "reason": "No cured tobacco leaf grading image dataset indexed.",
    },
    {
        "name": "OpenAIRE",
        "reason": "Aggregated search surfaced the Harvard Dataverse set used "
        "here as the only matching public dataset.",
    },
    {
        "name": "Chinese university / CNTC datasets",
        "reason": "The two large flue-cured grading sets (21,113 images, 20 "
        "grades, Sci Rep 2023; hyperspectral sets) are explicitly not public "
        "- 'available from the corresponding author on reasonable request'.",
    },
    {
        "name": "ResearchGate",
        "reason": "Hosts the papers, not the image data; bulk download would "
        "breach its terms of use.",
    },
]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--target",
        type=int,
        default=10000,
        help="total graded images to collect, split evenly across A/B/C",
    )
    parser.add_argument(
        "--review-sample",
        type=int,
        default=250,
        help="images to pull from ungradeable codes for manual labelling",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="concurrent connections; the shared rate limit governs throughput",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=dataverse.DEFAULT_RATE,
        help="requests per second against Dataverse (be a good citizen)",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--plan-only",
        action="store_true",
        help="print what would be downloaded, then stop",
    )
    parser.add_argument(
        "--refresh-index",
        action="store_true",
        help="re-crawl the Dataverse file listing instead of using the cache",
    )
    parser.add_argument(
        "--keep-raw",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="keep raw_images/ after processing (default: keep)",
    )
    return parser.parse_args(argv)


# --------------------------------------------------------------------------
# Planning
# --------------------------------------------------------------------------


def group_by_code(records: list[dict]) -> dict[str, list[dict]]:
    """Bucket index records by their native grade code, images only."""
    buckets: defaultdict[str, list[dict]] = defaultdict(list)
    for record in records:
        if record.get("contentType") != "image/jpeg":
            continue
        code = (record.get("directoryLabel") or "").split("/")[0].strip()
        if code:
            buckets[code].append(record)
    return dict(buckets)


def drop_exact_duplicates(
    records: list[dict],
) -> tuple[list[dict], list[dict]]:
    """Use the checksums the repository already published, before downloading."""
    seen: dict[str, str] = {}
    kept, dropped = [], []
    for record in records:
        digest = record.get("md5")
        if digest and digest in seen:
            dropped.append({**record, "duplicate_of": seen[digest], "kind": "exact (md5)"})
            continue
        if digest:
            seen[digest] = record["filename"]
        kept.append(record)
    return kept, dropped


def allocate(buckets: dict[str, list[dict]], quota: int, rng: random.Random) -> list[dict]:
    """Pick ``quota`` records spread proportionally across a grade's codes.

    Within a code the pool is shuffled first, which spreads the pick across the
    capture batches the repository stores as numbered subfolders.
    """
    pools = {code: rows[:] for code, rows in buckets.items() if rows}
    for rows in pools.values():
        rng.shuffle(rows)

    available = sum(len(rows) for rows in pools.values())
    quota = min(quota, available)

    take = {
        code: min(len(rows), round(quota * len(rows) / available))
        for code, rows in pools.items()
    }

    # Rounding leaves a small surplus or shortfall; settle it against the
    # codes that still have images left, largest pool first.
    order = sorted(pools, key=lambda code: -len(pools[code]))
    while sum(take.values()) != quota:
        delta = 1 if sum(take.values()) < quota else -1
        moved = False
        for code in order:
            candidate = take[code] + delta
            if 0 <= candidate <= len(pools[code]):
                take[code] = candidate
                moved = True
                break
        if not moved:
            break

    picked: list[dict] = []
    for code, count in take.items():
        picked.extend(pools[code][:count])
    return picked


def build_plan(
    records: list[dict], target: int, review_sample: int, rng: random.Random
) -> tuple[dict[str, list[dict]], list[dict], list[dict], dict[str, list[dict]]]:
    """Decide which files to fetch. Returns (per grade, review, pre-dedupe drops, all buckets)."""
    buckets = group_by_code(records)

    by_grade: defaultdict[str, dict[str, list[dict]]] = defaultdict(dict)
    ungraded: dict[str, list[dict]] = {}
    for code, rows in buckets.items():
        decision = config.interpret_code(code)
        if decision["grade"]:
            by_grade[decision["grade"]][code] = rows
        else:
            ungraded[code] = rows

    per_grade_quota = target // len(config.GRADES)
    plan: dict[str, list[dict]] = {}
    predrops: list[dict] = []

    for grade in config.GRADES:
        pool = by_grade.get(grade, {})
        cleaned: dict[str, list[dict]] = {}
        for code, rows in pool.items():
            kept, dropped = drop_exact_duplicates(rows)
            cleaned[code] = kept
            predrops.extend({**d, "grade": grade} for d in dropped)
        plan[grade] = allocate(cleaned, per_grade_quota, rng)

    review: list[dict] = []
    if review_sample and ungraded:
        cleaned = {}
        for code, rows in ungraded.items():
            kept, dropped = drop_exact_duplicates(rows)
            cleaned[code] = kept
            predrops.extend({**d, "grade": "UNMAPPED"} for d in dropped)
        review = allocate(cleaned, review_sample, rng)

    return plan, review, predrops, buckets


# --------------------------------------------------------------------------
# Fetch + curate
# --------------------------------------------------------------------------


def code_of(record: dict) -> str:
    return (record.get("directoryLabel") or "").split("/")[0].strip()


def raw_path(record: dict) -> Path:
    return config.RAW_DIR / code_of(record) / f"{record['id']}_{record['filename']}"


_THREAD_LOCAL = threading.local()


def _worker_fetch(source: dict, limiter: dataverse.RateLimiter, record: dict) -> bool:
    """Fetch one record, reusing one HTTP session per worker thread."""
    session = getattr(_THREAD_LOCAL, "session", None)
    if session is None:
        session = _THREAD_LOCAL.session = requests.Session()
    return dataverse.download_file(
        session, limiter, source, record["id"], raw_path(record)
    )


def download_all(
    records: list[dict], workers: int, limiter: dataverse.RateLimiter
) -> list[dict]:
    """Fetch every planned record into raw_images/, returning those that landed.

    Throughput is governed by the shared limiter, not by ``workers``; the extra
    threads only overlap the wait on Dataverse's own response time.
    """
    source = config.TZ_DATAVERSE
    todo = [r for r in records if not raw_path(r).exists()]
    print(f"  {len(records) - len(todo):,} already on disk, {len(todo):,} to fetch")

    if todo:
        started = time.monotonic()
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for done, _ in enumerate(
                pool.map(lambda r: _worker_fetch(source, limiter, r), todo), start=1
            ):
                if done % 200 == 0 or done == len(todo):
                    elapsed = time.monotonic() - started
                    rate = done / elapsed if elapsed else 0
                    eta = (len(todo) - done) / rate / 60 if rate else 0
                    print(
                        f"    downloaded {done:,}/{len(todo):,} "
                        f"({rate:.1f}/s, ~{eta:.0f} min left)"
                    )

    landed = [r for r in records if raw_path(r).exists()]
    missing = len(records) - len(landed)
    if missing:
        print(f"  WARNING: {missing:,} files could not be downloaded")
    return landed


def downloaded_on(path: Path) -> str:
    """When this file actually arrived.

    Builds resume across days, so stamping every row with the date the *report*
    was written would misdate everything fetched on an earlier run.
    """
    return datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()


def curate_grade(
    grade: str,
    records: list[dict],
    index: curate.DuplicateIndex,
) -> tuple[list[dict], list[dict], list[dict]]:
    """Validate, deduplicate and normalise one grade's downloads."""
    source = config.TZ_DATAVERSE
    accepted: list[dict] = []
    rejected: list[dict] = []
    duplicates: list[dict] = []

    for record in records:
        src = raw_path(record)
        code = code_of(record)
        url = dataverse.access_url(source, record["id"])

        if not src.exists():
            rejected.append(
                {"filename": record["filename"], "original_label": code,
                 "category": "download_failed", "reason": "download failed",
                 "download_url": url}
            )
            continue

        try:
            facts = curate.inspect(src)
        except curate.Rejected as exc:
            dest = config.REJECTED_DIR / exc.category
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest / src.name)
            rejected.append(
                {"filename": src.name, "original_label": code,
                 "category": exc.category, "reason": exc.detail,
                 "download_url": url}
            )
            continue

        digest = record.get("md5") or ""
        clash = index.check_exact(digest) if digest else None
        kind = "exact (md5)"
        if clash is None:
            clash = index.check_near(facts["dhash"])
            kind = f"near (dhash <= {index.max_distance})"
        if clash is not None:
            config.DUPLICATES_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, config.DUPLICATES_DIR / src.name)
            duplicates.append(
                {"filename": src.name, "original_label": code,
                 "duplicate_of": clash, "kind": kind, "download_url": url}
            )
            continue

        new_name = f"{GRADE_SLUG[grade]}_{code}_{record['id']}.jpg"
        if digest:
            index.add_exact(digest, new_name)
        index.add_near(facts["dhash"], new_name)

        dest = config.PROCESSED_DIR / grade / new_name
        width, height = curate.normalise(src, dest)

        decision = config.interpret_code(code)
        accepted.append(
            {
                "filename": new_name,
                "path": dest,
                "source": source["name"],
                "download_url": url,
                "original_label": code,
                "mapped_grade": grade,
                "resolution": f"{width}x{height}",
                "image_format": "JPEG",
                "license": source["license"],
                "date_downloaded": downloaded_on(src),
                "source_file_id": record["id"],
                "source_checksum_md5": digest,
                "original_filename": record["filename"],
                "mapping_reason": decision["reason"],
                "sharpness_laplacian_var": facts["sharpness"],
                "bytes": dest.stat().st_size,
            }
        )

    return accepted, rejected, duplicates


def curate_review(records: list[dict]) -> list[dict]:
    """Ungradeable codes: normalise into per-code folders, never assign a grade."""
    source = config.TZ_DATAVERSE
    rows: list[dict] = []
    for record in records:
        src = raw_path(record)
        if not src.exists():
            continue
        code = code_of(record)
        try:
            curate.inspect(src)
        except curate.Rejected:
            continue
        name = f"review_{code}_{record['id']}.jpg"
        # Grouped by native code - that grouping is the only similarity signal
        # the source gives us, and it is a real one.
        dest = config.REVIEW_DIR / code / name
        width, height = curate.normalise(src, dest)
        rows.append(
            {
                "filename": str(Path(code) / name),
                "source": source["name"],
                "download_url": dataverse.access_url(source, record["id"]),
                "original_label": code,
                "resolution": f"{width}x{height}",
                "assigned_grade": "",
                "notes": config.interpret_code(code)["reason"],
            }
        )
    return rows


# --------------------------------------------------------------------------
# Layout
# --------------------------------------------------------------------------


def link_grade_folders() -> list[str]:
    """Expose processed_images/Grade_X at the dataset root without copying.

    Directory junctions need no elevation on Windows; symlinks do. If neither
    works we fall back to a copy so the promised folders always exist.
    """
    notes = []
    for grade in config.GRADES:
        target = config.PROCESSED_DIR / grade
        link = config.DATASET_ROOT / grade
        if not target.exists() or link.exists():
            continue
        made = False
        if sys.platform == "win32":
            made = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(link), str(target)],
                capture_output=True,
            ).returncode == 0
        else:
            try:
                link.symlink_to(target, target_is_directory=True)
                made = True
            except OSError:
                made = False
        if not made:
            shutil.copytree(target, link)
            notes.append(f"{grade}: copied (link creation failed)")
        else:
            notes.append(f"{grade}: linked to processed_images/{grade}")
    return notes


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    rng = random.Random(args.seed)
    source = config.TZ_DATAVERSE

    for folder in (config.DATASET_ROOT, config.REPORTS_DIR):
        folder.mkdir(parents=True, exist_ok=True)

    limiter = dataverse.RateLimiter(args.rate)

    print(f"Indexing {source['name']} ...")
    records = dataverse.index_dataset(
        source, config.INDEX_CACHE, refresh=args.refresh_index, limiter=limiter
    )
    print(f"  {len(records):,} files in the source dataset")

    plan, review, predrops, buckets = build_plan(
        records, args.target, args.review_sample, rng
    )

    print("\nPlan")
    for grade in config.GRADES:
        picks = plan[grade]
        codes = sorted({code_of(r) for r in picks})
        print(f"  {grade}: {len(picks):,} images from {', '.join(codes)}")
    print(f"  needs_manual_review: {len(review):,} images from "
          f"{', '.join(sorted({code_of(r) for r in review})) or '-'}")
    print(f"  dropped before download (identical checksums): {len(predrops):,}")

    if args.plan_only:
        return 0

    print(f"\nDownloading at up to {args.rate:.1f} requests/s ...")
    everything = [r for grade in config.GRADES for r in plan[grade]] + review
    if everything:
        dataverse.wait_until_available(source, everything[0]["id"], limiter)
    download_all(everything, args.workers, limiter)

    print("\nCurating ...")
    index = curate.DuplicateIndex()
    metadata: list[dict] = []
    rejected: list[dict] = []
    duplicates: list[dict] = [
        {"filename": d["filename"], "original_label": code_of(d),
         "duplicate_of": d["duplicate_of"], "kind": d["kind"], "download_url": ""}
        for d in predrops
    ]

    for grade in config.GRADES:
        accepted, rej, dup = curate_grade(grade, plan[grade], index)
        metadata.extend(accepted)
        rejected.extend(rej)
        duplicates.extend(dup)
        print(f"  {grade}: {len(accepted):,} kept, {len(rej):,} rejected, "
              f"{len(dup):,} duplicates")

    review_rows = curate_review(review) if review else []
    print(f"  needs_manual_review: {len(review_rows):,} images")

    print("\nWriting reports ...")
    report.write_metadata(metadata)
    report.write_mapping(sorted(buckets))
    if review_rows:
        report.write_review_queue(review_rows)
        report.write_review_montage(review_rows)
    if duplicates:
        _write_manifest(config.DUPLICATES_DIR / "duplicates.csv", duplicates)
    if rejected:
        _write_manifest(config.REJECTED_DIR / "rejected.csv", rejected)

    stats = report.build_statistics(metadata, rejected, duplicates)
    report.write_statistics(stats)
    report.write_montage(metadata)
    report.write_sources_report([source], REJECTED_SOURCES, stats)

    notes = link_grade_folders()
    for note in notes:
        print(f"  {note}")

    if not args.keep_raw:
        shutil.rmtree(config.RAW_DIR, ignore_errors=True)
        print("  removed raw_images/ (--no-keep-raw)")

    print(f"\nDone. {stats['total_images']:,} graded images at {config.DATASET_ROOT}")
    for grade, count in stats["per_grade"].items():
        print(f"  {grade}: {count:,}")
    return 0


def _write_manifest(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = sorted({key for row in rows for key in row})
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    raise SystemExit(main())
