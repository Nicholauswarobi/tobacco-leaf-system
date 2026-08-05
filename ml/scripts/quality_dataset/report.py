"""Everything the build writes for a human to read: CSVs, stats, montage, README."""
from __future__ import annotations

import csv
import json
import statistics
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw

from . import config

METADATA_FIELDS = [
    "filename",
    "source",
    "download_url",
    "original_label",
    "mapped_grade",
    "resolution",
    "image_format",
    "license",
    "date_downloaded",
    # Beyond the required fields, kept because they make the set auditable.
    "source_file_id",
    "source_checksum_md5",
    "original_filename",
    "mapping_reason",
    "sharpness_laplacian_var",
]


def write_metadata(rows: list[dict], path: Path = config.METADATA_CSV) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=METADATA_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in METADATA_FIELDS})


def write_mapping(codes: list[str], path: Path = config.MAPPING_CSV) -> None:
    """Record how every native grade code was translated, including refusals."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "original_label",
        "plant_position",
        "quality_tier",
        "quality_name",
        "colour",
        "special_factor",
        "mapped_grade",
        "mapping_reason",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for code in sorted(codes):
            decision = config.interpret_code(code)
            writer.writerow(
                {
                    "original_label": decision["code"],
                    "plant_position": decision["position"],
                    "quality_tier": decision["quality_tier"] or "",
                    "quality_name": decision["quality_name"],
                    "colour": decision["colour"],
                    "special_factor": decision.get("special_factor", ""),
                    "mapped_grade": decision["grade"] or "UNMAPPED",
                    "mapping_reason": decision["reason"],
                }
            )


def write_review_queue(rows: list[dict], path: Path = config.REVIEW_CSV) -> None:
    """Unlabelled / undecodable images, for a human to grade by hand."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "filename",
        "source",
        "download_url",
        "original_label",
        "resolution",
        "assigned_grade",  # left blank on purpose - a person fills this in
        "notes",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fields})


def build_statistics(rows: list[dict], rejects: list[dict], dupes: list[dict]) -> dict:
    per_grade: Counter[str] = Counter(row["mapped_grade"] for row in rows)
    per_label: Counter[str] = Counter(row["original_label"] for row in rows)
    label_by_grade: defaultdict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        label_by_grade[row["mapped_grade"]][row["original_label"]] += 1

    resolutions = Counter(row["resolution"] for row in rows)
    sharpness = [
        float(row["sharpness_laplacian_var"])
        for row in rows
        if row.get("sharpness_laplacian_var") not in ("", None)
    ]
    sizes = [row.get("bytes", 0) for row in rows]

    total = len(rows)
    balance = ""
    if per_grade:
        smallest, largest = min(per_grade.values()), max(per_grade.values())
        balance = f"{largest / smallest:.2f}:1 (largest:smallest class)"

    return {
        "generated": date.today().isoformat(),
        "total_images": total,
        "per_grade": dict(sorted(per_grade.items())),
        "per_grade_share": {
            grade: f"{count / total * 100:.1f}%" for grade, count in sorted(per_grade.items())
        }
        if total
        else {},
        "class_balance": balance,
        "per_original_label": dict(sorted(per_label.items())),
        "original_labels_per_grade": {
            grade: dict(sorted(counts.items()))
            for grade, counts in sorted(label_by_grade.items())
        },
        "resolutions": dict(resolutions),
        "sharpness_laplacian_var": {
            "min": round(min(sharpness), 2) if sharpness else None,
            "median": round(statistics.median(sharpness), 2) if sharpness else None,
            "max": round(max(sharpness), 2) if sharpness else None,
        },
        "bytes_on_disk_processed": sum(sizes),
        "rejected": {
            "count": len(rejects),
            "reasons": dict(Counter(r.get("category", "unknown") for r in rejects)),
        },
        "duplicates_removed": {
            "count": len(dupes),
            "kinds": dict(Counter(d["kind"] for d in dupes)),
        },
    }


def write_statistics(stats: dict) -> None:
    config.STATS_JSON.parent.mkdir(parents=True, exist_ok=True)
    config.STATS_JSON.write_text(json.dumps(stats, indent=2), encoding="utf-8")

    lines = [
        "# Tobacco quality dataset - statistics",
        "",
        f"Generated: {stats['generated']}",
        "",
        f"**Total images: {stats['total_images']:,}**",
        "",
        "## Class distribution",
        "",
        "| Grade | Images | Share |",
        "| --- | ---: | ---: |",
    ]
    for grade, count in stats["per_grade"].items():
        lines.append(f"| {grade} | {count:,} | {stats['per_grade_share'][grade]} |")
    lines += [
        "",
        f"Class balance: {stats['class_balance']}",
        "",
        "## Source grade codes feeding each class",
        "",
    ]
    for grade, counts in stats["original_labels_per_grade"].items():
        detail = ", ".join(f"{code} ({n:,})" for code, n in counts.items())
        lines.append(f"- **{grade}** &larr; {detail}")

    lines += [
        "",
        "## Resolution",
        "",
        "| Resolution | Images |",
        "| --- | ---: |",
    ]
    for res, count in sorted(stats["resolutions"].items(), key=lambda kv: -kv[1]):
        lines.append(f"| {res} | {count:,} |")

    sharp = stats["sharpness_laplacian_var"]
    lines += [
        "",
        "## Quality control",
        "",
        f"- Sharpness (variance of Laplacian): min {sharp['min']}, "
        f"median {sharp['median']}, max {sharp['max']}",
        f"- Rejected images: {stats['rejected']['count']:,}",
    ]
    for reason, count in stats["rejected"]["reasons"].items():
        lines.append(f"  - {reason}: {count:,}")
    lines.append(f"- Duplicates removed: {stats['duplicates_removed']['count']:,}")
    for kind, count in stats["duplicates_removed"]["kinds"].items():
        lines.append(f"  - {kind}: {count:,}")
    lines.append("")
    lines.append(
        f"- Processed images on disk: "
        f"{stats['bytes_on_disk_processed'] / 1e9:.2f} GB"
    )
    lines.append("")

    config.STATS_MD.write_text("\n".join(lines), encoding="utf-8")


def write_montage(
    rows: list[dict],
    per_grade: int = 8,
    thumb: int = 160,
    path: Path = config.MONTAGE_PNG,
) -> None:
    """One row of sample thumbnails per grade, for a fast eyeball check."""
    by_grade: defaultdict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_grade[row["mapped_grade"]].append(row)

    grades = [g for g in config.GRADES if by_grade.get(g)]
    if not grades:
        return

    pad, label_w = 6, 90
    width = label_w + per_grade * (thumb + pad) + pad
    height = pad + len(grades) * (thumb + pad)
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)

    for row_idx, grade in enumerate(grades):
        top = pad + row_idx * (thumb + pad)
        draw.text((pad, top + thumb // 2 - 6), grade, fill="black")
        picks = by_grade[grade]
        step = max(1, len(picks) // per_grade)
        for col, row in enumerate(picks[::step][:per_grade]):
            try:
                with Image.open(row["path"]) as image:
                    tile = image.convert("RGB").copy()
            except Exception:  # noqa: BLE001 - a bad tile must not kill the report
                continue
            tile.thumbnail((thumb, thumb), Image.LANCZOS)
            left = label_w + col * (thumb + pad)
            canvas.paste(tile, (left + (thumb - tile.width) // 2,
                                top + (thumb - tile.height) // 2))

    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)


def write_review_montage(
    rows: list[dict],
    per_code: int = 6,
    thumb: int = 150,
    path: Path | None = None,
) -> None:
    """One row of samples per ungradeable code, for whoever labels them by hand.

    Someone deciding what LG or LLV actually means needs to see the group side
    by side, which a CSV of filenames cannot give them.
    """
    path = path or config.REVIEW_DIR / "review_groups.png"
    by_code: defaultdict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_code[row["original_label"]].append(row)
    if not by_code:
        return

    codes = sorted(by_code)
    pad, label_w = 6, 70
    width = label_w + per_code * (thumb + pad) + pad
    height = pad + len(codes) * (thumb + pad)
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)

    for row_idx, code in enumerate(codes):
        top = pad + row_idx * (thumb + pad)
        draw.text((pad, top + thumb // 2 - 6), code, fill="black")
        picks = by_code[code]
        step = max(1, len(picks) // per_code)
        for col, row in enumerate(picks[::step][:per_code]):
            source = config.REVIEW_DIR / row["filename"]
            try:
                with Image.open(source) as image:
                    tile = image.convert("RGB").copy()
            except Exception:  # noqa: BLE001 - a bad tile must not kill the report
                continue
            tile.thumbnail((thumb, thumb), Image.LANCZOS)
            left = label_w + col * (thumb + pad)
            canvas.paste(tile, (left + (thumb - tile.width) // 2,
                                top + (thumb - tile.height) // 2))

    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)


def write_sources_report(
    sources_used: list[dict],
    rejected_sources: list[dict],
    stats: dict,
    path: Path = config.SOURCES_MD,
) -> None:
    lines = [
        "# Download source report",
        "",
        f"Generated: {stats['generated']}",
        "",
        "## Sources used",
        "",
    ]
    for source in sources_used:
        lines += [
            f"### {source['name']}",
            "",
            f"- Repository: {source['repository']}",
            f"- Landing page: {source['landing_page']}",
            f"- DOI: `{source['doi']}`",
            f"- License: {source['license']}",
            f"- Companion paper: {source['paper']}",
            f"- Cured / dried leaves: {'yes' if source['cured'] else 'no'}",
            f"- Notes: {source['notes']}",
            "",
            "**Required attribution**",
            "",
            f"> {source['attribution']}",
            "",
        ]

    lines += ["## Sources searched and rejected", "", "| Source | Why not used |", "| --- | --- |"]
    for entry in rejected_sources:
        lines.append(f"| {entry['name']} | {entry['reason']} |")
    lines.append("")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
