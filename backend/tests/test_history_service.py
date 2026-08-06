"""History persistence tests.

These exist because a positional INSERT once wrote every value into the wrong
column: `mode` is appended to the end of the table by the ALTER TABLE
migration, so the physical column order does not match the logical one. Rows
came back with a disease label sitting in a float field, which made the whole
history endpoint fail to serialize and left the dashboard and history page
permanently empty.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime

import pytest

from app.schemas.prediction import (
    ClassProbability,
    DiseaseResult,
    PredictionResponse,
    QualityResult,
)
from app.services.history_service import HistoryService


def _prediction(**overrides) -> PredictionResponse:
    data = dict(
        id="test-id-1",
        timestamp=datetime(2026, 8, 6, 12, 30),
        image_url="/uploads/leaf.jpg",
        mode="disease",
        disease=DiseaseResult(
            label="Alternaria Leaf Spot",
            confidence=0.87,
            description="d",
            recommendations=[],
            all_probabilities=[ClassProbability(label="Healthy", probability=0.13)],
        ),
        quality=QualityResult(
            grade="Grade B",
            confidence=0.62,
            description="q",
            market_value="Standard",
            all_probabilities=[ClassProbability(label="Grade B", probability=0.62)],
        ),
        processing_time_ms=12.0,
    )
    data.update(overrides)
    return PredictionResponse(**data)


@pytest.fixture
def service(tmp_path) -> HistoryService:
    return HistoryService(str(tmp_path / "history.db"))


def test_saved_prediction_round_trips_into_the_right_columns(service):
    service.save(_prediction())

    (item,) = service.list_recent()
    assert item.mode == "disease"
    assert item.disease_label == "Alternaria Leaf Spot"
    assert item.disease_confidence == pytest.approx(0.87)
    assert item.quality_grade == "Grade B"
    assert item.quality_confidence == pytest.approx(0.62)


def test_mode_is_stored_even_though_it_is_the_last_physical_column(service):
    """A positional INSERT would put the mode in `disease_label` instead."""
    service.save(_prediction(id="a", mode="quality"))
    service.save(_prediction(id="b", mode="full"))

    assert {i.mode for i in service.list_recent()} == {"quality", "full"}


def test_rows_written_with_the_old_shifted_layout_are_repaired(tmp_path):
    db = str(tmp_path / "history.db")
    HistoryService(db)  # create the schema

    # Exactly what the old positional INSERT produced: every value one column
    # to the left of where it belongs.
    conn = sqlite3.connect(db)
    conn.execute(
        "INSERT INTO predictions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "shifted-1",
            "2026-08-06T05:35:26",
            "/uploads/x.jpg",
            "disease",               # -> disease_label
            "Alternaria Leaf Spot",  # -> disease_confidence
            0.9999,                  # -> quality_grade
            "Grade A",               # -> quality_confidence
            1.0,                     # -> mode
        ),
    )
    conn.commit()
    conn.close()

    repaired = HistoryService(db).list_recent()

    assert len(repaired) == 1
    item = repaired[0]
    assert item.mode == "disease"
    assert item.disease_label == "Alternaria Leaf Spot"
    assert item.disease_confidence == pytest.approx(0.9999)
    assert item.quality_grade == "Grade A"
    assert item.quality_confidence == pytest.approx(1.0)


def test_repair_leaves_correctly_written_rows_alone(service):
    service.save(_prediction(id="good", mode="quality"))

    assert service._repair_shifted_rows() == 0

    (item,) = service.list_recent()
    assert item.mode == "quality"
    assert item.disease_label == "Alternaria Leaf Spot"
    assert item.disease_confidence == pytest.approx(0.87)
