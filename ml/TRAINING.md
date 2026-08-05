# Training runbook

Run everything from the `ml/` directory with the venv active:

```bat
cd ml
.venv\Scripts\activate
```

> **These commands are written for Windows `cmd.exe`.** Two things that bite:
>
> * `cp` does not exist — use `copy`.
> * A trailing `\` does **not** continue a line. Every command below is a
>   single line; do not wrap them.
>
> PowerShell also accepts `copy` (it aliases `Copy-Item`). In Git Bash, use
> `cp` and forward slashes instead.

Two models need retraining, in this order. The verification gate comes first,
because until it is retrained **every upload to Quality Grading is rejected as
"not a tobacco leaf"**.

---

## 1. Verification gate (do this first)

### Why it must be retrained

The gate shipped in `saved_models/` was trained only on the green field leaves
in `data/raw/disease/`. It had never seen a cured leaf, and it showed:

| Input | P(tobacco) before | P(tobacco) after |
| --- | ---: | ---: |
| Green leaf (disease set) | 0.98 — passes | 0.97 — passes |
| **Cured leaf (quality set)** | **0.003 — rejected, 100% of the time** | **0.97 — passes** |
| Not tobacco | — | 0.02 — rejected |

`build_verification_dataset.py` stages the cured images into the `Tobacco`
class alongside the green ones, which is what fixes this.

### Commands

```bat
python scripts\build_verification_dataset.py --max-per-class 3500
python scripts\train_verification.py --epochs 20
```

Check the staged counts it prints before training. The `Tobacco` class must
contain **both** green and cured images — if the cured ones are missing,
confirm `data\tobacco_quality_dataset\raw_images\` exists and is populated.

Do **not** pass `--keep-colour`. The disease images are grayscale and the
not-tobacco negatives are colour, so with colour left in, the network learns
"saturated = not tobacco" and nothing else. The default strips colour inside
the graph, which is what you want.

### Then deploy it

Two separate lines:

```bat
copy saved_models\tobacco_verification_model.keras ..\backend\saved_models\
copy saved_models\verification_metadata.json ..\backend\saved_models\
```

### Verify it worked

```bat
python scripts\check_verification_gate.py
```

Cured and green must both show a high pass rate, and not-tobacco must show a
low one. If `cured` is still near zero, the cured images did not make it into
the training set.

---

## 2. Quality grading model

### Check the data first

Quality training is only meaningful on balanced classes:

```bat
python scripts\check_quality_dataset.py
```

If one class is far smaller than the others, stop and top the dataset up:

```bat
python -m scripts.quality_dataset.build --target 3000
```

A model trained on 2,616 / 20 / 20 will predict "Grade A" for everything and
report ~98% accuracy. It will look like it works and be worthless.

### Train

One line — `cmd.exe` will not accept it split across lines:

```bat
python scripts\train.py --task quality --data-dir data\tobacco_quality_dataset\processed_images --arch transfer --epochs 30
```

Class indices follow the alphabetical folder sort — `Grade_A=0, Grade_B=1,
Grade_C=2` — which is the order the backend's `QUALITY_CLASSES` assumes. Do not
rename the folders.

Outputs:

```
saved_models\tobacco_quality_model.keras
outputs\quality_training_curves.png
outputs\quality_confusion_matrix.png
outputs\quality_metrics.json
```

### Read the confusion matrix, not the accuracy

Grade A and Grade B are adjacent quality tiers that genuinely look similar, so
A/B confusion is expected and tolerable. What matters:

- **A confused with C** means the model has not learned quality at all.
- **Every prediction landing in one class** means the classes were imbalanced.
- **Accuracy above ~99%** on this data is a warning sign, not a triumph —
  check that duplicates did not leak across the train/val split.

### Deploy

```bat
copy saved_models\tobacco_quality_model.keras ..\backend\saved_models\
```

Restart the backend. `model_service` logs which models it loaded on startup;
if the file is missing it silently falls back to a **stub that returns random
grades**, so check the log line rather than assuming.

---

## Known limitation, worth knowing before you trust the numbers

Every cured leaf in this dataset is Tanzanian, shot with one camera rig on
hessian sacking under a white tent. A CNN will happily learn the background and
the lighting instead of the leaf.

So a high validation score here does **not** mean the model will grade your own
photographs correctly. Before relying on it:

1. Photograph a few dozen leaves of known grade yourself.
2. Run them through and compare against the grader's opinion.
3. If accuracy collapses, that is the domain gap, not a bug — augment harder
   (colour jitter, background replacement) or add your own images to training.

The same caveat applies to the disease model, whose training images are all
grayscale.
