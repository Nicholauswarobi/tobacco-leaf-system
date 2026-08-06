# TobaccoScan — Tobacco Leaf Disease Detection & Quality Grading

A full-stack, production-grade system that uses deep learning to detect leaf diseases and classify quality grades for tobacco leaves from a single image.

```
┌──────────────────┐      ┌─────────────────┐      ┌──────────────────────┐
│  Next.js 15 UI   │ ───▶ │  FastAPI server │ ───▶ │  Verification gate   │
│  (Tailwind, TS)  │ ◀─── │  (Python 3.11)  │ ◀─── │  ↓ then disease/grade│
└──────────────────┘      └─────────────────┘      └──────────────────────┘
```

## ✨ What it does

- **Tobacco verification** — every upload is checked as `Tobacco` / `Not Tobacco` *before* any analysis runs
- **Disease detection** — `Healthy`, `Alternaria Leaf Spot`, `Cercospora Leaf Spot`, `Tobacco Mosaic Virus`
- **Quality grading** — `Grade A`, `Grade B`, `Grade C`
- **Confidence scores** for every class, with farmer-friendly recommendations
- **History** with SQLite persistence and CSV export
- **Dashboard** with charts (recharts) showing disease pressure and grade mix
- **Camera capture** on mobile + drag-and-drop upload on desktop
- **Light/dark themes**, fully responsive, PWA-ready

## 📁 Project structure

```
tobacco-leaf-system/
├── frontend/              Next.js 15 + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/           App Router pages
│   │   ├── components/    UI, layout, upload, results, dashboard
│   │   ├── lib/           API client, utils
│   │   ├── store/         Zustand state
│   │   └── types/         Shared TS types
│   ├── public/            Static assets, PWA manifest
│   └── Dockerfile
├── backend/               FastAPI server
│   ├── app/
│   │   ├── core/          Config, logging
│   │   ├── routers/       predict / history / health / admin
│   │   ├── services/      model_service, prediction_service, history_service
│   │   ├── schemas/       Pydantic request/response models
│   │   ├── utils/         Image validation
│   │   ├── middleware/    Error handlers
│   │   └── main.py        Entry point
│   ├── tests/
	│   ├── saved_models/      .keras files live here
│   ├── uploads/           User-uploaded images (served via /uploads)
│   └── Dockerfile
├── ml/                    Training pipeline
│   ├── notebooks/         Jupyter walkthrough
│   ├── scripts/           model.py, data.py, train.py, evaluate.py, predict.py
│   │                      download_not_tobacco.py, build_verification_dataset.py,
│   │                      train_verification.py
│   ├── requirements-verification.txt   FiftyOne, for the negative-class download
│   ├── data/raw/          ← place your dataset here
	│   ├── saved_models/      Trained .keras outputs
│   └── outputs/           Curves, confusion matrices, metrics.json
└── docker-compose.yml     One-command stack
```

## 🚀 Quick start

### Option A — Docker (recommended)

```bash
# 1. Clone and enter
git clone <your-repo> tobacco-leaf-system
cd tobacco-leaf-system

# 2. (Optional) Drop trained .keras models into backend/saved_models/
#    If absent, the API runs in stub mode — perfect for frontend dev.

# 3. Boot the stack
docker compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000  (Swagger at /docs)
```

### Option B — Local dev (three terminals)

**1. Backend**

```bash
cd backend
python -m venv .venv
# Windows alternative (recommended for this project):
py -3.11 -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd.exe):
.venv\Scripts\activate.bat
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**2. Frontend**

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
# → http://localhost:3000
```

**3. (Optional) Train the models**

See [Training](#-training-the-models) below.

## 🛡️ Tobacco Verification Pipeline

### Why it exists

The disease and quality models are **closed-world classifiers**: trained only
on tobacco leaves, they have no "none of the above" option. Hand one a photo of
maize, a phone, or a person and it does not fail — it confidently returns a
tobacco disease class. A confidence threshold cannot fix this, because a model
is frequently confident *and* wrong on inputs it has never seen.

So one question is answered first:

```
Upload ──▶ Tobacco Verification ──┬── Not Tobacco ──▶ reject, pipeline stops
                                  │
                                  └── Tobacco ──────▶ Disease Detection
                                                      or Quality Grading
```

Verification runs before the upload is even written to disk, so a rejected
image costs no file, no history row, and no downstream inference.

### The two tiers

| Tier | When it runs | What it is |
| ---- | ------------ | ---------- |
| **Tobacco Verification Model** | Whenever `tobacco_verification_model.keras` is present | Binary MobileNetV2 CNN over `Tobacco` / `Not_Tobacco` |
| **HSV colour pre-screen** | Only as a fallback, when that file is missing | Heuristic in `backend/app/utils/leaf_validator.py` |

Both return the same shape, so callers never branch on which one ran. Check
which tier is live via `GET /api/health` → `verification_method`.

### ⚠️ The greyscale trap

**Every image in `ml/data/raw/disease/` is perfectly greyscale** (R == G == B
exactly, across all 6,904 files). Open Images negatives are full colour. Train
a naive binary classifier on that pairing and it learns exactly one rule —
*"saturated ⇒ not tobacco"* — which fails in both directions in the real world:
a greyscale photo of a car passes, and an ordinary colour photo of a tobacco
leaf is rejected.

`build_verification_cnn` therefore routes input through a **frozen RGB→luma
layer** that strips colour from *both* classes inside the model graph. The
conversion travels with the weights, so the backend still feeds ordinary RGB.

Once your positives include real colour photographs, retrain with
`--keep-colour` to use colour as a genuine signal.

> The same greyscale property means the colour pre-screen scores 0% leaf
> coverage on your own dataset. It now **abstains** on greyscale images rather
> than rejecting them — a heuristic with no signal should not veto.

### Build and train it

```bash
cd ml

# 1. Negative class from Open Images V7 (FiftyOne is a heavy, one-off dep)
pip install -r requirements-verification.txt
python scripts/download_not_tobacco.py --per-class 150

# 2. Assemble Tobacco / Not_Tobacco (dedupes and balances automatically)
python scripts/build_verification_dataset.py

# 3. Train, with the decision threshold calibrated on validation data
python scripts/train_verification.py --epochs 20

# 4. Deploy
cp saved_models/tobacco_verification_model.keras ../backend/saved_models/
cp saved_models/verification_metadata.json       ../backend/saved_models/
# restart the backend — it loads the model on startup
```

### ⚠️ What Open Images cannot give you

Verified against the live V7 catalogue (601 classes): **there is no `Maize`,
`Rice`, `Cassava`, `Common bean` or `Grass`.** Those crop leaves are exactly
the images users mistakenly submit to a tobacco classifier, and exactly the
hardest negatives for it to reject. No `--per-class` value fixes this — the
data is not there.

Cover the gap with a leaf dataset. [PlantVillage on
Kaggle](https://www.kaggle.com/datasets/emmarex/plantdisease) covers maize,
tomato, potato and pepper foliage:

```bash
python scripts/build_verification_dataset.py --extra-negatives path/to/plantvillage
```

Do this **before** training rather than after — retraining costs another hour.

### How the negative class is balanced

Sources differ wildly in size — PlantVillage is ~54,000 images, an Open Images
pull is ~4,700. Sampling that pool uniformly would make the negative class
~92% crop leaves and leave roughly 300 images to represent every person,
phone, car and desk, producing a gate that rejects foliage and waves a photo
of a table straight through. Nothing in the class totals would reveal it.

So the builder **round-robins across concepts** rather than shuffling: each
class folder contributes in equal turns until its own supply runs out. Split
directories (`train/`, `val/`, `test/`) are collapsed first, so PlantVillage's
38 classes duplicated across two splits count once each rather than twice.

The result is printed every run — check it:

```
Not_Tobacco composition (staged this run):
   1736  50.9%  not_tobacco_source
   1672  49.1%  PlantVillage
```

Custom classes and dataset growth are both supported:

```bash
python scripts/download_not_tobacco.py --list-classes --filter fruit   # what's available
python scripts/download_not_tobacco.py --classes Tomato Potato Banana --per-class 200
python scripts/download_not_tobacco.py --add-classes Tractor --per-class 300 --append
python scripts/build_verification_dataset.py --append --extra-negatives ./new_photos
```

Names are resolved against the live catalogue in four passes — exact,
case-insensitive, whole-word containment (`Sunflower` → `Common sunflower`),
then a deliberately strict fuzzy match. Anything unresolvable is reported and
skipped rather than guessed at: at a looser cutoff, `Rice` matched `Dice` and
would have silently filled the negative set with photos of dice.
`ml/tests/test_class_resolution.py` pins that behaviour down.

### Threshold calibration

Rejecting a real leaf just asks the farmer to retake a photo. Letting maize
through produces a confident, wrong diagnosis. Training reflects that
asymmetry: it sweeps thresholds, requires a floor on the share of non-tobacco
caught (`--min-reject-recall`, default 0.95), and maximises tobacco F1 subject
to it. The chosen value lands in `verification_metadata.json`, which the
backend reads on startup — so no tuned number is hard-coded in the service.

If no threshold can hit the target, training says so loudly instead of
shipping a gate that does not work.

### Behaviour without a trained model

The system stays usable: verification falls back to the colour pre-screen, and
the legacy low-confidence check on the disease model stays active as a second
net. Once the real model loads, it becomes the sole authority — second-guessing
it would tell a farmer "this is not a tobacco leaf" about a genuine leaf that
merely sits between two disease classes.

Relevant settings (`backend/.env`):

```ini
VERIFICATION_ENABLED=true          # false disables the gate entirely — debugging only
VERIFICATION_THRESHOLD=0.5         # overridden by verification_metadata.json
VERIFICATION_COLOR_FALLBACK=true   # use the HSV pre-screen while untrained
```

## 🧠 Training the models

The ML pipeline is in `ml/`. Two models are trained independently — one for disease, one for quality — both built on MobileNetV2 transfer learning by default.

### 1. Prepare data

**Option A: If you already have data organized in `train/test/valid` folders:**

Your current structure:
```
ml/data/raw/
├── train/
│   ├── alternaria alternata/
│   ├── cercospora nicotianae/
│   └── no cercospora nicotianae or alternaria alternata present/
├── test/    ← same class structure
└── valid/   ← same class structure
```

The pipeline will automatically reorganize this into:
```
ml/data/raw/disease/
├── Alternaria_Leaf_Spot/
├── Cercospora_Leaf_Spot/
└── Healthy/
```

**Option B: If you're starting fresh:**

```
ml/data/raw/
├── disease/
│   ├── Healthy/
│   │   └── *.jpg
│   ├── Alternaria_Leaf_Spot/
│   ├── Cercospora_Leaf_Spot/
│   └── Tobacco_Mosaic_Virus/
└── quality/
    ├── Grade_A/
    ├── Grade_B/
    └── Grade_C/
```

Suggested public sources for tobacco leaf datasets:
- Kaggle: search "tobacco leaf disease"
- PlantVillage (general leaf disease baseline)
- Custom photos from your own crops

Aim for ≥200 images per class, balanced.

**Option C: build the quality dataset automatically.**
switcher 
`ml/scripts/quality_dataset/` downloads and curates real *cured* tobacco leaf
images graded A/B/C, so the quality model no longer has to train on the random
labels `generate_quality_data.py` produces:

```bash
cd ml
python -m scripts.quality_dataset.build --plan-only     # show the plan, download nothing
python -m scripts.quality_dataset.build --target 10000  # ~1 hour, ~7 GB
```

Images come from Harvard Dataverse [`doi:10.7910/DVN/TTPLFT`](https://doi.org/10.7910/DVN/TTPLFT)
(CC0) — 49,778 photographs of flue-cured leaves shot on Tanzanian grading
tables. Grades are derived from the quality digit in each leaf's official
Tanzanian grade code, not guessed. The build writes
`ml/data/tobacco_quality_dataset/` with `Grade_A/`, `Grade_B/`, `Grade_C/`,
a metadata CSV, a grade-mapping table and a statistics report; see that
folder's `README.md` for the mapping rationale and caveats.

### 2. Install ML deps & train

> **Retraining runbook: [`ml/TRAINING.md`](ml/TRAINING.md)** — step-by-step
> commands for the verification gate and the quality model, in the order they
> have to be run, with the checks that catch a silently broken result.

```bash
cd ml
python -m venv .venv
# Windows alternative (recommended for this project):
py -3.11 -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd.exe):
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

**Train the DISEASE DETECTION Model:**

```bash
# DISEASE ONLY - Reorganizes data and trains the disease model
python scripts/train_all.py --epochs 30 --batch-size 32
```

This script:
1. ✓ Reorganizes train/test/valid → disease/ folder structure
2. ✓ Maps class names:
   - "alternaria alternata" → Alternaria_Leaf_Spot
   - "cercospora nicotianae" → Cercospora_Leaf_Spot
   - "no cercospora nicotianae or alternaria alternata present" → Healthy
3. ✓ Converts grayscale images to RGB (MobileNetV2 requirement)
4. ✓ Trains disease detection model (~30 epochs)

**Or train manually:**

```bash
# After manual reorganization into disease/ folder:
python scripts/train.py --task disease --arch transfer --epochs 30 --grayscale
```

**Outputs:**
- `ml/saved_models/tobacco_disease_model.keras` ✓
- `ml/outputs/disease_training_curves.png`
- `ml/outputs/disease_confusion_matrix.png`
- `ml/outputs/disease_metrics.json` (precision/recall/F1)

### 3. Wire models into the backend

```bash
cp ml/saved_models/*.keras backend/saved_models/
# Restart the backend; it will detect and load them on startup.
```

### 4. Notebook walkthrough

Prefer interactive? Open `ml/notebooks/training.ipynb`.

## 🛠️ Architecture notes

### Backend
- **FastAPI** with modular routers (`predict`, `history`, `health`, `admin`).
- **Pydantic v2** schemas for typed request/response shapes.
- **TensorFlow / Keras** loads two `.keras` models on startup. If they're missing, a deterministic **stub predictor** kicks in so the frontend stays usable.
- **OpenCV / Pillow** handle preprocessing (resize → normalize → batch).
- **SQLite** persists history; swap to PostgreSQL by updating `history_service.py`.
- **CORS** is open to `localhost:3000` by default — change in `.env`.

### Frontend
- **Next.js 15 App Router** with server and client components properly split.
- **TypeScript strict mode**.
- **Tailwind CSS** with a custom `leaf` / `tobacco` / `parchment` palette.
- **Fraunces** display + **Manrope** body fonts via `next/font`.
- **Zustand** for global prediction state, persisted to localStorage.
- **react-dropzone** for drag-drop, native `capture="environment"` for mobile camera.
- **Framer Motion** for the result page reveal animations.
- **Recharts** for dashboard visualizations.
- **next-themes** for dark/light/system mode.
- **PWA-ready** via `manifest.webmanifest` (add icons in `frontend/public/icons/`).

### ML Pipeline
- **Augmentation** baked into the model graph via `RandomFlip`, `RandomRotation`, `RandomZoom`, `RandomContrast`, `RandomBrightness`.
- **Normalization** also baked in (Rescaling 1/255), so the API can feed raw `[0..255]` arrays directly.
- **Callbacks**: `ModelCheckpoint` (best-val-acc), `EarlyStopping` (patience=6), `ReduceLROnPlateau`.
- **Reports**: confusion matrix PNG, training curves PNG, full classification report JSON.

## 🔌 API reference

All routes are under `/api`. Live Swagger docs at `http://localhost:8000/docs`.

| Method | Path                       | Purpose                                     |
| ------ | -------------------------- | ------------------------------------------- |
| GET    | `/api/health`              | Liveness + model load status + verification tier |
| GET    | `/api/classes`             | Disease, quality and verification class labels |
| POST   | `/api/verify`              | Multipart image → Tobacco / Not Tobacco only |
| POST   | `/api/predict`             | Multipart image → full prediction response  |
| GET    | `/api/history?limit=N`     | Recent predictions                          |
| GET    | `/api/history/{id}`        | Single prediction                           |
| DELETE | `/api/history/{id}`        | Remove from history                         |
| GET    | `/api/history/export/csv`  | Download CSV of all predictions             |
| GET    | `/api/admin/stats`         | Aggregate counts (requires `x-api-key`)     |

### Sample `/api/predict` response

```json
{
  "id": "5f4a...",
  "timestamp": "2026-05-10T08:24:11Z",
  "image_url": "/uploads/5f4a.jpg",
  "verification": {
    "is_tobacco": true,
    "label": "Tobacco",
    "confidence": 0.991,
    "message": "Tobacco leaf detected successfully.",
    "method": "verification_model",
    "threshold": 0.5,
    "all_probabilities": [
      {"label": "Not Tobacco", "probability": 0.009},
      {"label": "Tobacco", "probability": 0.991}
    ]
  },
  "disease": {
    "label": "Cercospora Leaf Spot",
    "confidence": 0.943,
    "description": "Caused by Cercospora nicotianae...",
    "recommendations": ["Rotate crops...", "..."],
    "all_probabilities": [
      {"label": "Healthy", "probability": 0.012},
      {"label": "Cercospora Leaf Spot", "probability": 0.943},
      ...
    ]
  },
  "quality": {
    "grade": "Grade B",
    "confidence": 0.812,
    "description": "Mid-tier quality...",
    "market_value": "Standard market pricing",
    "all_probabilities": [...]
  },
  "processing_time_ms": 142.5
}
```

### Rejection response (HTTP 422)

Returned by `/api/verify` and every `/api/predict*` route when the image is not
a tobacco leaf. `message` is a plain string at the top level, so simple clients
can display it directly.

```json
{
  "error": true,
  "status": 422,
  "code": "NOT_A_TOBACCO_LEAF",
  "message": "This image is not a tobacco leaf. Please upload a valid tobacco leaf image.",
  "verification": {
    "is_tobacco": false,
    "label": "Not Tobacco",
    "confidence": 0.999,
    "method": "verification_model",
    "threshold": 0.5,
    "all_probabilities": [
      {"label": "Not Tobacco", "probability": 0.999},
      {"label": "Tobacco", "probability": 0.001}
    ],
    "detail": "The verification model scored this image 0% likely to be a tobacco leaf, below the 50% threshold required to continue."
  }
}
```

## 🔐 Environment variables

### Backend (`backend/.env`)

```ini
APP_NAME="Tobacco Leaf API"
DEBUG=true
CORS_ORIGINS=["http://localhost:3000"]
UPLOAD_DIR=uploads
DISEASE_MODEL_PATH=saved_models/tobacco_disease_model.keras
QUALITY_MODEL_PATH=saved_models/tobacco_quality_model.keras
VERIFICATION_MODEL_PATH=saved_models/tobacco_verification_model.keras
VERIFICATION_METADATA_PATH=saved_models/verification_metadata.json
VERIFICATION_ENABLED=true
VERIFICATION_THRESHOLD=0.5
VERIFICATION_COLOR_FALLBACK=true
IMAGE_SIZE=224
MAX_UPLOAD_MB=10
HISTORY_DB=history.db
ADMIN_API_KEY=change-me-in-production
```

### Frontend (`frontend/.env.local`)

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🧪 Testing

```bash
# Backend smoke tests + verification pipeline (stub predictor — no .keras needed)
cd backend
pytest -v

# ML class-resolution tests (no network, no FiftyOne needed)
cd ml
pytest -v

# Frontend type check
cd frontend
npm run type-check
```

## 🌍 Deployment

### Render / Railway / Fly.io
- Build the backend image from `backend/Dockerfile`.
- Build the frontend image from `frontend/Dockerfile`.
- Set `NEXT_PUBLIC_API_URL` to your backend's public URL.
- Mount a persistent volume on the backend for `saved_models/` and `uploads/`.

### Vercel + a separate backend
- Frontend: import the `frontend/` directory into Vercel; set `NEXT_PUBLIC_API_URL`.
- Backend: deploy to Railway / Fly.io / Cloud Run.
- Update `CORS_ORIGINS` on the backend to include your Vercel URL.

### Self-hosted
- `docker compose up -d` on any VPS with Docker.
- Put nginx / Caddy in front for HTTPS.

## 📋 Feature checklist

- [x] Tobacco Verification gate (binary) enforced ahead of every downstream model
- [x] Reusable across disease detection, quality grading, and a standalone `/api/verify`
- [x] Open Images V7 negative-class downloader with custom classes + dataset growth
- [x] Threshold calibrated at training time, read from a metadata sidecar at runtime
- [x] CNN disease + quality models (4 + 3 classes)
- [x] Full ML pipeline: load → preprocess → augment → train → eval → save
- [x] Training curves + confusion matrix + classification report
- [x] FastAPI backend with modular structure (routers/services/schemas/utils/middleware/core)
- [x] Pydantic schemas, CORS, error handlers, OpenAPI docs
- [x] Next.js 15 App Router frontend, TypeScript, Tailwind
- [x] Landing page, upload (drag-drop + camera), result, dashboard, history, admin, about
- [x] Zustand state, light/dark mode, responsive mobile-first design
- [x] Confidence visualizations (bars), recharts dashboard
- [x] CSV export, JSON export per prediction, share API
- [x] PWA manifest, SEO metadata
- [x] Dockerfiles + docker-compose
- [x] Stub-mode fallback so frontend works without trained weights

## Pushing model weights to GitHub

- **Use Git LFS**: Model files are large; track `.keras` and `.h5` with Git LFS before adding them.

Commands to run locally:

```bash
git lfs install
git lfs track "*.keras"
git lfs track "*.h5"
git add .gitattributes
# then add model files
git add backend/saved_models/*.keras ml/saved_models/*.keras
git commit -m "Add trained models via Git LFS"
git push origin <branch>
```

- **Note**: Git LFS storage/bandwidth on GitHub may be limited; consider using GitHub Releases or external storage for very large models.

## 🤝 License

MIT — use it, adapt it, ship it. Built for tobacco growers and ag-tech teams.
