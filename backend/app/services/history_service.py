"""
Lightweight SQLite-backed history service.

Storing predictions for the dashboard, history page, and CSV export.
For production, swap to PostgreSQL — schema is intentionally portable.
"""
from __future__ import annotations
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import List, Optional

from app.core.config import settings
from app.schemas.prediction import HistoryItem, PredictionResponse


_lock = threading.Lock()  # SQLite is fine across threads with serialization


class HistoryService:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _conn(self):
        with _lock:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            finally:
                conn.close()

    def _init_schema(self) -> None:
        with self._conn() as c:
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS predictions (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    image_url TEXT,
                    mode TEXT NOT NULL DEFAULT 'disease',
                    disease_label TEXT NOT NULL,
                    disease_confidence REAL NOT NULL,
                    quality_grade TEXT NOT NULL,
                    quality_confidence REAL NOT NULL
                )
                """
            )
            # Migrate existing databases that don't have the mode column yet.
            # NOTE: this appends `mode` as the LAST column, so physical column
            # order differs from the logical order used elsewhere. Every
            # statement must therefore name its columns explicitly.
            try:
                c.execute("ALTER TABLE predictions ADD COLUMN mode TEXT NOT NULL DEFAULT 'disease'")
            except Exception:
                pass  # Column already exists — safe to ignore

        self._repair_shifted_rows()

    # Valid values of the `mode` column; also the fingerprint of a shifted row,
    # since a corrupted row has one of these sitting in `disease_label`.
    _MODES = ("disease", "quality", "full")

    def _repair_shifted_rows(self) -> int:
        """Undo the column shift left behind by the old positional INSERT.

        Rows written before `save()` named its columns had every value stored
        one position to the left of where it belonged, which made the whole
        history endpoint fail to serialize. The original values are all still
        present, just in the wrong columns, so they can be moved back:

            disease_label      held the mode
            disease_confidence held the disease label
            quality_grade      held the disease confidence
            quality_confidence held the quality grade
            mode               held the quality confidence

        A row is only rewritten when it carries that exact fingerprint — a
        mode name in `disease_label` *and* a number in `mode`. A correctly
        written row can never match both, so this is safe to run on every
        startup and does nothing once the data is clean.

        Returns the number of rows repaired.
        """
        repaired = 0
        with self._conn() as c:
            rows = c.execute("SELECT * FROM predictions").fetchall()
            for row in rows:
                if row["disease_label"] not in self._MODES:
                    continue
                try:
                    disease_confidence = float(row["quality_grade"])
                    quality_confidence = float(row["mode"])
                except (TypeError, ValueError):
                    continue  # not the shifted pattern — leave it alone

                c.execute(
                    """
                    UPDATE predictions
                       SET mode = ?,
                           disease_label = ?,
                           disease_confidence = ?,
                           quality_grade = ?,
                           quality_confidence = ?
                     WHERE id = ?
                    """,
                    (
                        row["disease_label"],
                        row["disease_confidence"],
                        disease_confidence,
                        row["quality_confidence"],
                        quality_confidence,
                        row["id"],
                    ),
                )
                repaired += 1
        return repaired

    def save(self, p: PredictionResponse) -> None:
        # Columns are named explicitly. A positional INSERT used to be used here
        # and silently wrote every value into the wrong column, because `mode`
        # is appended to the end of the table by the ALTER TABLE migration above
        # rather than sitting where the tuple put it. Naming the columns makes
        # the statement independent of physical column order.
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO predictions (
                    id, timestamp, image_url, mode,
                    disease_label, disease_confidence,
                    quality_grade, quality_confidence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    p.id,
                    p.timestamp.isoformat(),
                    p.image_url,
                    p.mode,
                    p.disease.label,
                    p.disease.confidence,
                    p.quality.grade,
                    p.quality.confidence,
                ),
            )

    def list_recent(self, limit: int = 50) -> List[HistoryItem]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM predictions ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [self._row_to_item(r) for r in rows]

    def count(self) -> int:
        with self._conn() as c:
            return c.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]

    def stats(self) -> dict:
        """Aggregate counts for the admin dashboard."""
        with self._conn() as c:
            total = c.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
            by_disease = {
                r["disease_label"]: r["n"]
                for r in c.execute(
                    "SELECT disease_label, COUNT(*) AS n FROM predictions GROUP BY disease_label"
                )
            }
            by_grade = {
                r["quality_grade"]: r["n"]
                for r in c.execute(
                    "SELECT quality_grade, COUNT(*) AS n FROM predictions GROUP BY quality_grade"
                )
            }
        return {"total": total, "by_disease": by_disease, "by_grade": by_grade}

    def get(self, item_id: str) -> Optional[HistoryItem]:
        with self._conn() as c:
            row = c.execute(
                "SELECT * FROM predictions WHERE id = ?", (item_id,)
            ).fetchone()
        return self._row_to_item(row) if row else None

    def delete(self, item_id: str) -> bool:
        with self._conn() as c:
            cur = c.execute("DELETE FROM predictions WHERE id = ?", (item_id,))
            return cur.rowcount > 0

    @staticmethod
    def _row_to_item(row: sqlite3.Row) -> HistoryItem:
        return HistoryItem(
            id=row["id"],
            timestamp=row["timestamp"],
            image_url=row["image_url"],
            mode=row["mode"] if "mode" in row.keys() else "disease",
            disease_label=row["disease_label"],
            disease_confidence=row["disease_confidence"],
            quality_grade=row["quality_grade"],
            quality_confidence=row["quality_confidence"],
        )


history_service = HistoryService(settings.HISTORY_DB)
