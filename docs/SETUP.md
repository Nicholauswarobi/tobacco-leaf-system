# Setup Guide

Detailed walkthrough for getting the TobaccoScan tobacco leaf system running locally and in production.

## Prerequisites

| Tool       | Version   | Notes                                       |
| ---------- | --------- | ------------------------------------------- |
| Python     | 3.10–3.11 | TensorFlow 2.17 supports both               |
| Node.js    | 20+       | For Next.js 15                              |
| Docker     | 24+       | Optional but recommended for production     |
| GPU        | optional  | NVIDIA + CUDA 12 speeds up training ~10×    |

---

## Local development

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate                 # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Run the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify:

```bash
curl http://localhost:8000/api/health
```

> **Note:** Without trained models, the API enters **stub mode** — predictions are deterministic mocks (same image ⇒ same result). Perfect for frontend development.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### 3. Train models (optional but recommended)

See [`README.md` → Training](../README.md#-training-the-models).

---

## Docker Compose

```bash
docker compose up --build
```

Stops the stack:

```bash
docker compose down
```

Volumes are mounted from the host so trained models, uploads, and the SQLite DB survive container rebuilds.

---

## Production deployment

### Hardening checklist

- [ ] Replace `ADMIN_API_KEY` in `backend/.env` with a strong secret
- [ ] Set `DEBUG=false`
- [ ] Restrict `CORS_ORIGINS` to your real frontend domain
- [ ] Put a reverse proxy (nginx / Caddy / Cloudflare) in front for HTTPS
- [ ] Set a max upload size limit at the proxy as well as in the API
- [ ] Mount `uploads/`, `saved_models/`, and `history.db` on persistent storage
- [ ] Configure log shipping (the FastAPI logs go to stdout)
- [ ] Add rate limiting at the proxy if exposed publicly

### Suggested production stack

```
[ Cloudflare / nginx ] ──▶ [ Next.js frontend ] ──▶ [ FastAPI + models ]
                                                     │
                                                     └──▶ [ PostgreSQL ] (replace SQLite)
                                                     └──▶ [ S3 / MinIO ] (replace uploads/)
```

### Switching SQLite → PostgreSQL

Edit `backend/app/services/history_service.py`:

```python
# instead of sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
```

Replace the `_conn()` and `_init_schema()` methods with their psycopg2 equivalents — the rest of the API surface stays identical.

### Switching local uploads → S3

Replace `app/utils/image_utils.py::save_upload()` with an S3 `put_object` call and return the public URL. Mount `/uploads` is no longer needed.

---

## Troubleshooting

### "ModuleNotFoundError: tensorflow"
TF 2.17 needs Python 3.9–3.11. Check `python --version`.

### Apple Silicon (M1/M2/M3)
Use `tensorflow-macos` and `tensorflow-metal`:

```bash
pip uninstall tensorflow
pip install tensorflow-macos tensorflow-metal
```

### "CORS error" in browser
Confirm `CORS_ORIGINS` in `backend/.env` includes your frontend's exact origin (scheme + host + port).

### Out of memory during training
Reduce `--batch-size` (try 16 or 8). If still OOM, drop image size to 192 with `--image-size 192`.

### Models not loading
The API logs the exact path it's looking for. Check that `backend/saved_models/tobacco_disease_model.h5` and `tobacco_quality_model.h5` both exist after training.
