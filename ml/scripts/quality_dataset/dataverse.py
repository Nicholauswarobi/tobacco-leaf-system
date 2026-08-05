"""Minimal, deliberately polite Harvard Dataverse client.

Only the two endpoints this pipeline needs are implemented. Both are public, so
no API token is involved.

Rate limiting is not optional here. Harvard Dataverse sits behind an AWS load
balancer that starts returning bare ``403 Forbidden`` (no ``Retry-After``, no
body) once an IP asks for files too quickly - roughly 500 files at ten parallel
connections is enough to trip it. Retrying hard against that block only extends
it, so every request goes through one shared token bucket, and a refusal parks
*all* workers for an escalating cooldown rather than spinning.
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import requests

PAGE_SIZE = 1000
TIMEOUT = 180

#: Requests per second across all worker threads. Well under the observed
#: threshold, and still fast enough to pull 10k files in well under an hour.
DEFAULT_RATE = 3.0

#: How long everyone waits after a refusal, growing on repeats.
COOLDOWN_SECONDS = [60, 180, 420, 900]

#: Clean responses needed before the cooldown escalation steps back down.
CLEAN_STREAK_TO_FORGIVE = 200

RETRYABLE = {403, 429, 500, 502, 503, 504}


class RateLimiter:
    """Shared token bucket plus a global cooldown gate."""

    def __init__(self, rate_per_second: float = DEFAULT_RATE) -> None:
        self._interval = 1.0 / rate_per_second
        self._lock = threading.Lock()
        self._next_slot = 0.0
        self._cooldown_until = 0.0
        self._strikes = 0
        self._clean_streak = 0

    def wait_turn(self) -> None:
        with self._lock:
            start = max(time.monotonic(), self._next_slot, self._cooldown_until)
            self._next_slot = start + self._interval
        delay = start - time.monotonic()
        if delay > 0:
            time.sleep(delay)

    def trip(self, status: str) -> float:
        """Register a refusal and park every worker. Returns the wait length.

        A block hits every worker at once, so the refusals arrive in a clump.
        Counting each one as its own strike escalates the cooldown by a full
        step per worker - four workers turned one block into a 15-minute stall.
        Refusals that land while a cooldown is already running are therefore
        treated as echoes of the block being served, not as new blocks.
        """
        with self._lock:
            now = time.monotonic()
            if now < self._cooldown_until:
                return self._cooldown_until - now

            idx = min(self._strikes, len(COOLDOWN_SECONDS) - 1)
            seconds = COOLDOWN_SECONDS[idx]
            self._strikes += 1
            self._cooldown_until = now + seconds
            print(
                f"    rate limited ({status}); pausing all downloads "
                f"for {seconds}s"
            )
        return seconds

    def succeeded(self) -> None:
        """Sustained clean responses mean the block lifted; step escalation back.

        One lucky response is not proof the block is gone, so forgiveness needs
        a run of them - otherwise the first success after a cooldown resets the
        escalation and the next block starts from 60s again.
        """
        with self._lock:
            if not self._strikes:
                return
            self._clean_streak += 1
            if self._clean_streak >= CLEAN_STREAK_TO_FORGIVE:
                self._strikes -= 1
                self._clean_streak = 0


def _request(
    session: requests.Session,
    limiter: RateLimiter,
    url: str,
    retries: int = 8,
    **kwargs,
) -> requests.Response:
    last = None
    for _ in range(retries):
        limiter.wait_turn()
        try:
            resp = session.get(url, timeout=TIMEOUT, **kwargs)
            if resp.status_code == 200:
                limiter.succeeded()
                return resp
            last = f"HTTP {resp.status_code}"
            if resp.status_code in RETRYABLE:
                limiter.trip(last)
                continue
            resp.raise_for_status()
        except requests.RequestException as exc:
            last = exc.__class__.__name__
            limiter.trip(last)
    raise RuntimeError(f"giving up on {url}: {last}")


def index_dataset(
    source: dict,
    cache: Path,
    refresh: bool = False,
    limiter: RateLimiter | None = None,
) -> list[dict]:
    """Return one record per file in the dataset, caching the crawl to disk.

    Each record carries ``id``, ``filename``, ``directoryLabel``, ``filesize``,
    ``contentType`` and ``md5`` - enough to plan a download and to drop exact
    duplicates before spending bandwidth on them.
    """
    if cache.exists() and not refresh:
        return json.loads(cache.read_text(encoding="utf-8"))

    limiter = limiter or RateLimiter()
    rows: list[dict] = []
    offset = 0
    session = requests.Session()

    while True:
        resp = _request(
            session,
            limiter,
            source["api_files"],
            params={
                "persistentId": source["doi"],
                "limit": PAGE_SIZE,
                "offset": offset,
            },
        )
        batch = resp.json()["data"]
        if not batch:
            break
        for entry in batch:
            data_file = entry["dataFile"]
            rows.append(
                {
                    "id": data_file["id"],
                    "filename": data_file.get("filename"),
                    "directoryLabel": entry.get("directoryLabel", ""),
                    "filesize": data_file.get("filesize"),
                    "contentType": data_file.get("contentType"),
                    "md5": data_file.get("md5")
                    or (data_file.get("checksum") or {}).get("value"),
                }
            )
        offset += len(batch)
        print(f"    indexed {offset} files")
        if len(batch) < PAGE_SIZE:
            break

    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(rows), encoding="utf-8")
    return rows


def access_url(source: dict, file_id: int) -> str:
    return source["api_access"].format(file_id=file_id)


def download_file(
    session: requests.Session,
    limiter: RateLimiter,
    source: dict,
    file_id: int,
    dest: Path,
) -> bool:
    """Fetch one datafile to ``dest``. Returns False if every retry failed."""
    if dest.exists() and dest.stat().st_size > 0:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        resp = _request(session, limiter, access_url(source, file_id), stream=True)
        with tmp.open("wb") as handle:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                handle.write(chunk)
        tmp.replace(dest)
        return True
    except (RuntimeError, OSError, requests.RequestException):
        tmp.unlink(missing_ok=True)
        return False


def wait_until_available(source: dict, probe_file_id: int, limiter: RateLimiter) -> None:
    """Block until the access endpoint answers, for resuming after a block."""
    session = requests.Session()
    url = access_url(source, probe_file_id)
    while True:
        try:
            resp = session.get(url, timeout=60, stream=True)
            resp.close()
            if resp.status_code == 200:
                return
            print(f"    still blocked (HTTP {resp.status_code}); waiting 120s")
        except requests.RequestException as exc:
            print(f"    probe failed ({exc.__class__.__name__}); waiting 120s")
        time.sleep(120)
