"""Structured logging setup."""
import logging
import sys


def setup_logging(level: str = "INFO") -> logging.Logger:
    fmt = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
    logging.basicConfig(
        level=level,
        format=fmt,
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    return logging.getLogger("tobacco-api")
