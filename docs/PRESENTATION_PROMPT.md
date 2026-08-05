# Presentation prompt — copy everything between the `=====` lines into a fresh Claude chat

The prompt is self-contained: it carries the whole project fact sheet, so the new
chat does not need access to this repository. Paste it as one message.

If you want the diagrams to match the final trained numbers, wait until the
quality model finishes and replace the accuracy placeholders at the end of the
fact sheet — nothing else changes.

=====================================================================

You are a systems architect and technical presentation designer. I am a final-year
student presenting my project. I need (1) properly worded objectives and (2) a set
of **system design diagrams as images** that I can drop straight into a PowerPoint
deck.

Everything in the FACT SHEET below is ground truth taken from my actual codebase.
Use only these facts. Do not invent features, models, datasets, cloud services or
microservices that are not listed. If something is genuinely needed for a diagram
to make sense and it is not in the fact sheet, mark it clearly as an assumption in
a short note under that diagram.

---

## PROJECT FACT SHEET

**Project name:** Folium — Tobacco Leaf Disease Detection and Quality Grading System
**Type:** Full-stack web application with an embedded deep-learning inference pipeline
**Users:** Tobacco farmers, extension/agronomy officers, grading-station staff, system administrator
**Context:** Tanzanian flue-cured tobacco production; grading currently done by eye, which is slow, subjective and inconsistent between graders. Disease is often identified too late.

### Problem it solves
1. Leaf disease is diagnosed late and inconsistently by visual inspection.
2. Quality grading is manual, subjective and varies between graders and buying stations.
3. A naive image classifier trained only on tobacco is a *closed-world* model — it has no "none of the above" option, so a photo of maize, a phone or a person still returns a confident tobacco disease class. The system must reject non-tobacco input *before* any diagnosis runs.

### Three-stage inference pipeline (the core novelty — make it the centrepiece of the design)
```
Upload
  │
  ├─ Stage 0: input validation (file type, size ≤ 10 MB, decode to RGB, resize 224×224)
  │
  ├─ Stage 1: TOBACCO VERIFICATION GATE  (binary: Tobacco / Not_Tobacco)
  │      ├─ Not Tobacco ──▶ HTTP 422 NOT_A_TOBACCO_LEAF, pipeline stops,
  │      │                  nothing written to disk, no history row, no inference
  │      └─ Tobacco ──▶ continue
  │
  ├─ Stage 2: LEAF-STATE ROUTER  (fresh green vs cured/dried, HSV band analysis)
  │      ├─ wrong section ──▶ HTTP 422 WRONG_SECTION: "this IS tobacco, but it is a
  │      │                     cured leaf — use Quality Grading" (and vice versa)
  │      └─ correct section ──▶ continue
  │
  └─ Stage 3: CLASSIFICATION
         ├─ Disease model  → Healthy | Alternaria Leaf Spot | Cercospora Leaf Spot | Tobacco Mosaic Virus
         └─ Quality model  → Grade A | Grade B | Grade C
                 ↓
         Persist to history (SQLite) + return JSON with confidences,
         description, recommendations, market value, processing time
```
Design rationale to reflect in the diagrams:
- Verification runs **before** the upload is written to disk, so a rejected image costs no file, no database row and no downstream inference.
- Rejecting a genuine leaf only costs a retake; accepting maize produces a confident wrong diagnosis. So the verification threshold is **calibrated at training time** (sweep thresholds, enforce a floor of ≥95% non-tobacco rejection recall, then maximise tobacco F1) and written to a `verification_metadata.json` sidecar that the backend reads on startup. No tuned number is hard-coded.
- Stage 2 exists because telling a farmer "this is not a tobacco leaf" when they photographed a perfectly good cured leaf and merely opened the wrong tab is wrong and infuriating.

### Architecture — three tiers
**Presentation tier — Next.js 15 (App Router), TypeScript strict, Tailwind CSS**
- Pages: Landing, Upload (drag-and-drop desktop + `capture="environment"` mobile camera), Disease, Quality, Result, Dashboard, History, Admin, About
- Zustand global state persisted to localStorage; Recharts dashboard; Framer Motion transitions; next-themes light/dark; PWA manifest; fully responsive, mobile-first

**Application tier — FastAPI (Python 3.11), Pydantic v2**
- Layered structure: `routers/` → `services/` → `utils/` + `schemas/` + `middleware/` + `core/`
- Routers: `predict`, `history`, `health`, `admin`
- Services: `model_service` (loads and holds the Keras models), `verification_service` (the gate), `prediction_service` (routing + classification + recommendations), `history_service` (persistence)
- Global exception middleware gives every rejection one consistent JSON shape
- CORS restricted to the frontend origin; admin routes require an `x-api-key` header
- **Stub-predictor fallback:** if the `.keras` files are absent the API serves deterministic stub predictions so the frontend still works
- **Colour pre-screen fallback:** if the verification model is absent, an HSV heuristic in `leaf_validator.py` stands in for Stage 1

**Data / model tier**
- SQLite (`history.db`) — prediction history, exportable to CSV; designed to swap to PostgreSQL by changing `history_service.py` only
- Local filesystem `uploads/` — accepted images, served back as `/uploads/<id>.jpg`
- `saved_models/` — three `.keras` model files plus `verification_metadata.json`

### REST API (all under `/api`, OpenAPI/Swagger at `/docs`)
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness, model-load status, which verification tier is live |
| GET | `/api/classes` | Disease, quality and verification class labels |
| POST | `/api/verify` | Image → Tobacco / Not Tobacco only |
| POST | `/api/predict` | Image → full prediction (`?mode=full\|disease\|quality`) |
| POST | `/api/predict/disease` | Verify → route → disease detection |
| POST | `/api/predict/quality` | Verify → route → quality grading |
| GET | `/api/history?limit=N` | Recent predictions |
| GET | `/api/history/{id}` | Single prediction |
| DELETE | `/api/history/{id}` | Delete a record |
| GET | `/api/history/export/csv` | Export all predictions as CSV |
| GET | `/api/admin/stats` | Aggregate counts (requires `x-api-key`) |

### Machine-learning pipeline (TensorFlow / Keras)
Three independently trained models, all **MobileNetV2 transfer learning**, input 224×224×3:

1. **Tobacco Verification Model** — binary Tobacco / Not_Tobacco.
   Positive class: the tobacco disease dataset. Negative class: Open Images V7 (downloaded via FiftyOne — people, phones, cars, desks, fruit) **plus** PlantVillage crop foliage (maize, tomato, potato, pepper), because the images users wrongly submit to a tobacco classifier are *other crop leaves*, and Open Images V7 has no Maize/Rice/Cassava/Bean/Grass class at all.
   Negative-class balancing is **round-robin across source concepts**, not uniform sampling — uniform sampling over a 54,000-image PlantVillage plus a 4,700-image Open Images pull would make the negative class ~92% crop leaves and produce a gate that rejects foliage and waves a photo of a table straight through.
   **The greyscale trap:** every image in the tobacco disease dataset is exactly greyscale (R == G == B across all 6,904 files) while the negatives are full colour. A naive binary model learns one rule — "saturated ⇒ not tobacco" — which fails both ways. The fix is a **frozen RGB→luma layer inside the model graph** that strips colour from both classes, so the conversion travels with the weights and the backend still feeds ordinary RGB.

2. **Disease Detection Model** — 4 classes: Healthy, Alternaria Leaf Spot, Cercospora Leaf Spot, Tobacco Mosaic Virus. Trained on fresh green field leaves.

3. **Quality Grading Model** — 3 classes: Grade A, Grade B, Grade C. Trained on cured (flue-cured) leaves. Dataset built automatically from **Harvard Dataverse `doi:10.7910/DVN/TTPLFT` (CC0)** — 49,778 photographs of flue-cured leaves shot on Tanzanian grading tables. Grades are **derived from the quality digit in each leaf's official Tanzanian grade code**, not guessed. The builder writes `Grade_A/ Grade_B/ Grade_C/`, a metadata CSV, a grade-mapping table and a statistics report.

Training pipeline stages: dataset build/download → reorganise + dedupe + balance → train/val/test split → preprocessing (resize 224, Rescaling 1/255 baked into the graph) → augmentation baked into the graph (RandomFlip, RandomRotation, RandomZoom, RandomContrast, RandomBrightness) → MobileNetV2 transfer learning → callbacks (ModelCheckpoint best-val-acc, EarlyStopping patience 6, ReduceLROnPlateau) → evaluation (confusion matrix PNG, training-curve PNG, per-class precision/recall/F1 JSON) → threshold calibration (verification model only) → export `.keras` + metadata sidecar → copy into `backend/saved_models/` → backend loads on startup.

### Deployment
Docker Compose stack: `frontend` container (Next.js) + `backend` container (FastAPI/TensorFlow), with a persistent volume mounted for `saved_models/` and `uploads/`. Deployable to Render / Railway / Fly.io / Cloud Run, or Vercel for the frontend with a separately hosted backend, or self-hosted on a VPS behind nginx/Caddy for HTTPS. Model weights are versioned with Git LFS.

### Non-functional targets
Inference under ~2 s per image on CPU; uploads capped at 10 MB; works on a mid-range Android phone browser; usable offline-first shell via PWA; graceful degradation when models are missing.

---

## PART 1 — Objectives (text, for the objectives slide)

Write, in the formal register expected in a final-year project report:

- **One main objective** — a single sentence, starting with "To develop…", naming the artefact and the outcome it delivers.
- **Five to seven specific objectives** — each starting with an infinitive verb (To design, To develop, To train, To evaluate, To validate, To deploy), each independently verifiable, and together covering: the verification gate, the disease model, the quality model, the web application, evaluation/testing, and deployment. Make them SMART — attach the concrete numbers from the fact sheet (class counts, dataset sizes, thresholds, latency target) rather than vague wording like "high accuracy".
- Then, in one short paragraph each: **problem statement**, **scope**, and **limitations/assumptions** (greyscale source dataset, grades derived from grade codes rather than laboratory assay, CPU-only inference, single-leaf-per-image assumption).

Give this as clean copy-paste text with no filler — I am pasting it into slides.

## PART 2 — System design diagrams (this is the main deliverable)

Produce these **nine diagrams**, each as its own image:

1. **High-level system architecture** — three tiers (client / application / data + model), showing every component named in the fact sheet and the protocol on each connector (HTTPS/REST multipart, file I/O, SQL).
2. **Three-stage inference pipeline** — the centrepiece. Show both rejection branches (422 NOT_A_TOBACCO_LEAF and 422 WRONG_SECTION) as first-class paths, and mark clearly where the image is written to disk (after Stage 1, never before).
3. **Data-flow diagram, context level (DFD Level 0)** — external entities Farmer/Officer and Administrator, one process bubble, the two data stores.
4. **Data-flow diagram, Level 1** — processes: Validate Upload, Verify Tobacco, Route Leaf State, Classify Disease, Grade Quality, Record History, Report/Export; data stores: Image Store, Prediction History, Model Store.
5. **Use-case diagram** — actors: Farmer/Field Officer, Administrator, and the ML Subsystem as a supporting actor. Use cases: capture/upload image, verify leaf, detect disease, grade quality, view result and recommendations, view dashboard, browse history, export CSV, delete record, view system health, view admin statistics. Show `<<include>>` on "Verify leaf" from both analysis use cases.
6. **Sequence diagram for `POST /api/predict/disease`** — lifelines: User, Next.js UI, FastAPI router, verification_service, model_service, leaf_validator, prediction_service, history_service, SQLite, filesystem. Include the alt/else fragments for the two rejection outcomes.
7. **ML training pipeline** — from dataset acquisition (Harvard Dataverse, Open Images V7 via FiftyOne, PlantVillage) through balancing, split, augmentation, MobileNetV2 transfer learning, callbacks, evaluation artefacts, threshold calibration, to model export and hand-off into the backend. Show the three models as three parallel tracks that converge on `saved_models/`.
8. **Deployment diagram** — Docker Compose with the two containers, the persistent volume, the exposed ports (3000, 8000), the reverse proxy for HTTPS, and the client device.
9. **Entity/data model** — the prediction history record with its fields (id, timestamp, image_url, verification verdict + confidence + method + threshold, disease label + confidence + all class probabilities, quality grade + confidence, processing_time_ms), plus the model-store artefacts.

### Output format — important
Produce a **single self-contained HTML artifact** containing all nine diagrams, where:
- Every diagram is **hand-authored inline SVG** — not a screenshot, not a canvas drawing, not an external image, no external libraries or fonts of any kind.
- Each diagram sits in its own titled card, numbered "Figure 1 … Figure 9", with a one-line caption underneath that I can reuse as the slide's figure caption.
- Each SVG uses a **16:9 viewBox (1600 × 900)** so it drops into a slide with no cropping, scales responsively to the page width, and stays sharp when I enlarge it.
- **Print/projector styling:** solid light background inside every SVG (never transparent), dark text, minimum effective font size equivalent to 16 px at full scale, strong contrast, no thin hairlines under 2 px, no reliance on colour alone to convey meaning — pair every colour with a label or a distinct shape/line style. Keep to a restrained palette of about five colours (one per tier/stage) plus grey for infrastructure. Legends where the colour coding carries meaning.
- Every arrow is **labelled** with what flows along it; every rejection path is visually distinct from the happy path (e.g. dashed + a distinct colour) and consistently so across all nine figures.
- Under each figure, put a **"Download PNG" button** that serialises that SVG and renders it to a canvas at 2× scale, then triggers a download — pure browser APIs only, no libraries. This is how I get the images into PowerPoint.
- After the nine figures, add a **"Mermaid source" appendix**: the equivalent Mermaid code for each diagram in a copyable code block, as a fallback so I can regenerate or edit them elsewhere.
- The page must render correctly in both light and dark browser themes, but the **SVG interiors stay light in both** so exported PNGs are always slide-safe.

### Style rules
- Academic/technical register — this is a defence presentation, not marketing. No emoji anywhere in the diagrams.
- Consistent shape language across all figures: rectangles for components/processes, cylinders for data stores, stadium shapes for start/end, diamonds for decisions, stick figures for actors, dashed boundary boxes for containers/tiers.
- Layout must breathe: no overlapping labels, no arrows crossing where a reroute would avoid it, aligned columns, uniform spacing. A cramped diagram is a failed diagram.
- Use exact names from the fact sheet — `verification_service`, `model_service`, `NOT_A_TOBACCO_LEAF`, `Grade A/B/C`, `MobileNetV2` — so the diagrams match my code when the panel asks.

### Do not
- Do not add a message queue, Redis, Kubernetes, load balancer, authentication service, mobile app or microservices — none exist in this system.
- Do not merge the two rejection paths into one; they are deliberately different outcomes.
- Do not simplify the three-stage pipeline into "upload → predict → result". The gate and the router are the contribution being defended.
- Do not invent accuracy figures. Where a metric belongs on a diagram, leave a clearly marked placeholder such as `[accuracy: __%]`.

Start with Part 1 as plain text, then build the artifact for Part 2.

=====================================================================
