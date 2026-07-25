# API Reference

Base URL: `http://localhost:8000` (dev) — change via `NEXT_PUBLIC_API_URL` on the frontend.

Interactive docs: `http://localhost:8000/docs` (Swagger UI) or `/redoc`.

---

## `GET /api/health`
Liveness probe + model load status.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "model_loaded": true,
  "uptime_seconds": 142.3
}
```

If `model_loaded` is `false`, the API is running in stub mode (no `.h5` files found).

---

## `GET /api/classes`
Returns all class labels — used by the frontend to render legends.

```json
{
  "diseases": ["Healthy", "Alternaria Leaf Spot", "Cercospora Leaf Spot", "Tobacco Mosaic Virus"],
  "qualities": ["Grade A", "Grade B", "Grade C"]
}
```

---

## `POST /api/predict`
Run a prediction on a single leaf image.

**Request** — `multipart/form-data`:
- `file` *(required)* — image (JPG/PNG/WebP), ≤10 MB.

**cURL example:**
```bash
curl -X POST http://localhost:8000/api/predict \
  -F "file=@leaf.jpg"
```

**Response** — `200 OK`:
```json
{
  "id": "5f4a-...",
  "timestamp": "2026-05-10T08:24:11.000Z",
  "image_url": "/uploads/5f4a.jpg",
  "disease": {
    "label": "Cercospora Leaf Spot",
    "confidence": 0.943,
    "description": "...",
    "recommendations": ["...", "..."],
    "all_probabilities": [
      {"label": "Healthy", "probability": 0.012},
      {"label": "Alternaria Leaf Spot", "probability": 0.031},
      {"label": "Cercospora Leaf Spot", "probability": 0.943},
      {"label": "Tobacco Mosaic Virus", "probability": 0.014}
    ]
  },
  "quality": {
    "grade": "Grade B",
    "confidence": 0.812,
    "description": "...",
    "market_value": "Standard market pricing",
    "all_probabilities": [...]
  },
  "processing_time_ms": 142.5
}
```

**Errors:**
- `400` — invalid extension or corrupt image
- `413` — file too large
- `500` — inference failure

---

## `GET /api/history?limit=N`
Recent predictions (most recent first). `limit` is 1–500.

```json
{
  "items": [
    {
      "id": "5f4a-...",
      "timestamp": "2026-05-10T08:24:11.000Z",
      "image_url": "/uploads/5f4a.jpg",
      "disease_label": "Cercospora Leaf Spot",
      "disease_confidence": 0.943,
      "quality_grade": "Grade B",
      "quality_confidence": 0.812
    }
  ],
  "total": 142
}
```

## `GET /api/history/{id}`
Single record. `404` if not found.

## `DELETE /api/history/{id}`
Removes from history. Returns `{"deleted": "<id>"}`.

## `GET /api/history/export/csv`
Streams a CSV download of all predictions. Use as `<a href="..." download>`.

---

## `GET /api/admin/stats`
Aggregate counts. **Requires** `x-api-key` header matching `ADMIN_API_KEY` in the backend env.

```json
{
  "total": 142,
  "by_disease": { "Healthy": 60, "Cercospora Leaf Spot": 32, ... },
  "by_grade":   { "Grade A": 45, "Grade B": 70, "Grade C": 27 }
}
```

`401` if the key is missing or wrong.

---

## Static uploads

Uploaded leaf images are served from `/uploads/<filename>` for use as image sources in the frontend. They are NOT auth-gated by default — front a CDN with signed URLs in production if uploads contain sensitive data.
