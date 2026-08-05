"""Regression tests for the Dataverse rate limiter.

Run with:  python -m pytest tests/ -q      (from the ml/ directory)

WHY THIS FILE EXISTS
--------------------
Harvard Dataverse sits behind an AWS load balancer that answers a bare
'403 Forbidden' - no Retry-After, no body - when an IP pulls files too fast.
Ten parallel connections tripped it after ~500 files.

The subtle bug is in the recovery, not the detection. A block hits every worker
at once, so four workers report four refusals for one block. Counting each as
its own strike escalates the backoff four steps in a single event, turning a
60-second pause into a 15-minute stall. Nothing errors; the build just appears
to hang, and the obvious 'fix' is to raise the request rate, which makes it
worse.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.quality_dataset.dataverse import (  # noqa: E402
    CLEAN_STREAK_TO_FORGIVE,
    COOLDOWN_SECONDS,
    RateLimiter,
)


def test_concurrent_refusals_count_as_one_block():
    """Four workers, one block: the second through fourth refusals must not
    each bump the backoff another step."""
    limiter = RateLimiter(rate_per_second=1000)
    first = limiter.trip("HTTP 403")
    echoes = [limiter.trip("HTTP 403") for _ in range(3)]

    assert first == COOLDOWN_SECONDS[0]
    # Echoes report the remaining wait, never a fresh escalated one.
    assert all(echo <= first for echo in echoes)
    assert limiter._strikes == 1


def test_separate_blocks_do_escalate():
    limiter = RateLimiter(rate_per_second=1000)
    first = limiter.trip("HTTP 403")
    limiter._cooldown_until = 0.0  # pretend the first cooldown elapsed
    second = limiter.trip("HTTP 403")
    assert (first, second) == (COOLDOWN_SECONDS[0], COOLDOWN_SECONDS[1])


def test_escalation_is_capped():
    limiter = RateLimiter(rate_per_second=1000)
    waits = []
    for _ in range(len(COOLDOWN_SECONDS) + 3):
        limiter._cooldown_until = 0.0
        waits.append(limiter.trip("HTTP 403"))
    assert max(waits) == COOLDOWN_SECONDS[-1]
    assert waits[-1] == COOLDOWN_SECONDS[-1]


def test_one_lucky_success_does_not_reset_escalation():
    """Otherwise the first response after a cooldown restarts backoff at 60s
    and the build oscillates instead of backing off."""
    limiter = RateLimiter(rate_per_second=1000)
    limiter.trip("HTTP 403")
    limiter.succeeded()
    assert limiter._strikes == 1


def test_a_sustained_clean_run_steps_escalation_back():
    limiter = RateLimiter(rate_per_second=1000)
    limiter.trip("HTTP 403")
    for _ in range(CLEAN_STREAK_TO_FORGIVE):
        limiter.succeeded()
    assert limiter._strikes == 0


def test_wait_turn_paces_requests():
    import time

    limiter = RateLimiter(rate_per_second=20)  # 50 ms apart
    started = time.monotonic()
    for _ in range(5):
        limiter.wait_turn()
    elapsed = time.monotonic() - started
    assert elapsed >= 0.15  # 4 gaps of 50 ms, allowing the first to be free
