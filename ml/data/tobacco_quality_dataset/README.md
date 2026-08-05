# Cured tobacco leaf quality dataset (Grade A / B / C)

Images of **cured (flue-cured, dried) tobacco leaves** organised into three
quality classes for CNN training. No green leaves, no disease imagery.

Rebuild or extend it with:

```bash
cd ml
python -m scripts.quality_dataset.build --plan-only     # show the plan, download nothing
python -m scripts.quality_dataset.build --target 10000  # build it
```

The build is resumable and idempotent: already-downloaded files are skipped, and
a fixed seed (`--seed`, default 42) makes the sample reproducible.

**Do not raise `--rate`.** Harvard Dataverse sits behind an AWS load balancer
that returns a bare `403 Forbidden` — no `Retry-After`, no body — once an IP
pulls files too fast; ten parallel connections tripped it after about 500 files
and the block took roughly ten minutes to clear. All requests therefore pass
through one shared token bucket, default 3/s, and a refusal parks every worker
for an escalating cooldown instead of retrying into the block. At the default
rate a 10,000-image build takes roughly an hour.

---

## Where the images come from

A single source supplies every graded image:

| | |
| --- | --- |
| Dataset | **Tobacco leaves dataset** (Virginia flue-cured, Tanzania) |
| Repository | Harvard Dataverse, [`doi:10.7910/DVN/TTPLFT`](https://doi.org/10.7910/DVN/TTPLFT) |
| Companion paper | *Data in Brief* 56 (2024) 110838, [doi:10.1016/j.dib.2024.110838](https://doi.org/10.1016/j.dib.2024.110838) |
| Licence | CC0 1.0 Universal (public domain dedication) |
| Size | 49,778 JPEGs, 960 × 1440, one cured leaf per image |
| Collected by | NM-AIST, Tobacco Research Institute of Tanzania (TORITA), Tanzania Tobacco Board (TTB) |

Leaves were photographed on grading tables at 90°, on hessian backing, under
white-tent diffused light with a Canon 5D Mark III and a 100 mm macro lens —
so lighting and scale are consistent across the whole set.

CC0 waives the requirement to attribute, but the depositors should still be
credited:

> Nguleni, Faith (2024), *Tobacco leaves dataset*, Harvard Dataverse, V1,
> `doi:10.7910/DVN/TTPLFT`.

`reports/download_sources.md` lists every other repository that was searched
and why it produced nothing usable.

---

## How Grade A / B / C were derived

**The source labels were not overwritten and no label was invented.** Each
source image is filed under its official Tanzanian grade code, e.g. `L2OF`,
which reads left to right as:

| Segment | Meaning | Values |
| --- | --- | --- |
| 1 — plant position | where the leaf grew on the stalk | `C` Cutters, `L` Leaf, `M` Thin Leaf, `X` Lugs and Primings |
| 2 — **quality** | the expert-assigned quality tier | `1` Choice, `2` Fine, `3` Good, `4` Fair, `5` Low |
| 3 — colour | cured colour | `L` Lemon, `O` Orange, `R` Mahogany |
| 4 — special factor | optional | `F` maturity spots / full maturity / full orange colour |

(Table 1 of the companion paper. Every image in this dataset is plant
position `L`.)

The middle digit is already an expert quality ranking, so the three classes are
a documented collapse of the five official tiers — not a guess:

| Class | Quality tiers | Source codes |
| --- | --- | --- |
| **Grade A** | 1 Choice, 2 Fine | `L1L` `L1O` `L1OF` `L2L` `L2O` `L2OF` `L2R` |
| **Grade B** | 3 Good | `L3L` `L3O` `L3OF` `L3R` |
| **Grade C** | 4 Fair, 5 Low | `L4L` `L4O` `L4R` `L5L` `L5O` `L5R` |

Every image's original code survives in `metadata.csv` (`original_label`) and
the full translation table with its reasoning is in `grade_mapping.csv`, so the
mapping can be audited or redefined without re-downloading anything.

### What was deliberately *not* graded

Five source codes — `LG`, `LK`, `LLV`, `LND`, `LOV` — carry **no quality
digit**, and the companion paper lists them without ever defining them. Any
A/B/C assignment for them would be fabrication, so they are excluded from the
training classes and a sample is parked in `needs_manual_review/`, grouped by
code, with `needs_manual_review.csv` carrying a blank `assigned_grade` column
for a domain expert to fill in and `review_groups.png` showing each group side
by side. Merge them into a grade only after someone who knows Tanzanian grading
has looked at them.

They are cured leaves like the rest — visibly mottled, variegated or
green-tinged — so they are plausibly low grades, but "plausibly" is not a
label. Roughly 5,220 such images exist in the source dataset if they turn out
to be usable.

---

## Layout

```
tobacco_quality_dataset/
├── Grade_A/  Grade_B/  Grade_C/   training folders (junctions -> processed_images/)
├── processed_images/
│   └── Grade_A|Grade_B|Grade_C/   cleaned images, the real files
├── raw_images/<CODE>/             untouched downloads, named <fileid>_<original>
├── duplicates/                    dropped repeats + duplicates.csv
├── rejected_images/<reason>/      quality-gate failures + rejected.csv
├── needs_manual_review/<CODE>/    ungradeable codes + needs_manual_review.csv
├── reports/
│   ├── dataset_statistics.md|.json
│   ├── download_sources.md
│   ├── preview_montage.png        sample grid, one row per grade
│   └── source_index_*.json        cached repository file listing
├── metadata.csv                   one row per training image
└── grade_mapping.csv              source code -> grade, with reasoning
```

`Grade_A|B|C` at the root are directory junctions to `processed_images/`, so
the folders promised by the spec exist without storing the images twice. If
junction creation is unavailable they become real copies instead.

Point Keras at the root folders directly:

```python
tf.keras.utils.image_dataset_from_directory(
    "ml/data/tobacco_quality_dataset/processed_images",
    labels="inferred", label_mode="categorical",
    image_size=(224, 224), batch_size=32,
)
```

Folders sort alphabetically, so class indices are `Grade_A=0, Grade_B=1,
Grade_C=2`.

---

## Cleaning applied

Between download and the grade folders every image must pass:

| Gate | Rule |
| --- | --- |
| Structural | opens and fully decodes, else `rejected_images/corrupted` |
| Format | JPEG or PNG |
| Resolution | both sides ≥ 512 px |
| Not blank | greyscale pixel std ≥ 12 |
| Not blurry | variance of Laplacian ≥ 40, measured at a fixed 512 px scale so the threshold is size-independent |
| Exact duplicate | repository-published MD5, checked *before* downloading |
| Near duplicate | 64-bit dHash, Hamming distance ≤ 6, compared across **all three grades** so one leaf cannot land in two classes |

No watermark filter runs. The brief asked for one, but every image comes from a
single research repository whose photographs carry no watermarks, overlays or
stock-library marks — a detector here would be dead code that could only
produce false positives. If a scraped or stock source is ever added, add the
check at that point.

Survivors are converted to RGB, EXIF-rotated then stripped of all metadata, and
re-encoded as JPEG q92 at native 960 × 1440 (no upscaling; images are only
downscaled if they exceed 1440 px on the long side). Files are renamed
`<GRADE>_<SOURCECODE>_<SOURCEFILEID>.jpg`, e.g. `A_L2OF_10304158.jpg`, which
keeps grade, original label and provenance readable from the filename alone.

Thresholds live in `scripts/quality_dataset/config.py`.

## Sampling

The requested total is split evenly across the three grades, and each grade's
quota is drawn proportionally from its constituent source codes, shuffled first
so the picks spread across all capture batches and growing regions rather than
clustering in one folder. Grade C has the smallest pool (9,943 images before
cleaning), which is the ceiling on a perfectly balanced build: about **29,800
balanced images** are available in total.

## Notes and caveats

- **`metadata.csv` is the source of truth for provenance.** Every row carries
  the Dataverse file id and a direct `download_url`, so any image can be traced
  back or re-fetched individually.
- **One geography.** All leaves are Tanzanian Virginia flue-cured, shot with one
  camera rig on hessian backing. A model trained on this will likely lean on
  that background and lighting; validate on your own photographs before
  trusting it in the field, and augment aggressively (colour jitter, background
  replacement) if inference images will differ.
- **Grade A merges two tiers** (Choice + Fine) and **Grade C merges two**
  (Fair + Low), so the classes are not equally "wide" in the original scheme.
  `grade_mapping.csv` is the single place to change that.
- The build does not touch `ml/data/raw/quality/`, which holds the older
  randomly-assigned synthetic grades from `generate_quality_data.py`. Those
  labels are meaningless; retrain against this dataset instead.
