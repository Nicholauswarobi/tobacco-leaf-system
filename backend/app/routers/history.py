"""History endpoints: list, get, delete, CSV export."""
from io import StringIO
import csv

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.prediction import HistoryResponse
from app.services.history_service import history_service

router = APIRouter()


@router.get("/history", response_model=HistoryResponse)
async def list_history(limit: int = Query(50, ge=1, le=500)):
    items = history_service.list_recent(limit=limit)
    return HistoryResponse(items=items, total=history_service.count())


@router.get("/history/{item_id}")
async def get_item(item_id: str):
    item = history_service.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@router.delete("/history/{item_id}")
async def delete_item(item_id: str):
    if not history_service.delete(item_id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": item_id}


@router.get("/history/export/csv")
async def export_csv():
    """Stream all history rows as a CSV download."""
    rows = history_service.list_recent(limit=10_000)

    def generate():
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "id",
                "timestamp",
                "disease_label",
                "disease_confidence",
                "quality_grade",
                "quality_confidence",
                "image_url",
            ]
        )
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate()

        for r in rows:
            writer.writerow(
                [
                    r.id,
                    r.timestamp,
                    r.disease_label,
                    f"{r.disease_confidence:.4f}",
                    r.quality_grade,
                    f"{r.quality_confidence:.4f}",
                    r.image_url or "",
                ]
            )
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="predictions.csv"'},
    )
