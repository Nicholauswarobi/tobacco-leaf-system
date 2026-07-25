# Model Architecture

Two independent CNN classifiers, each trained end-to-end on tobacco leaf imagery.

## Disease classifier
- **Input**: 224×224×3 RGB (raw `[0..255]` — normalization is baked into the graph)
- **Backbone**: MobileNetV2 (ImageNet-pretrained, top-100 layers frozen by default)
- **Head**: GlobalAveragePooling → Dropout(0.3) → Dense(128, ReLU) → Dropout(0.3) → Dense(4, softmax)
- **Output**: probabilities over `[Healthy, Alternaria Leaf Spot, Cercospora Leaf Spot, Tobacco Mosaic Virus]`

## Quality classifier
Same architecture, output dimension 3: `[Grade A, Grade B, Grade C]`.

## Why MobileNetV2?
- ~2.3M parameters → fits easily in mobile/edge deployment
- Strong ImageNet baseline → only needs a few thousand images per class for fine-tuning
- Available in `tf.keras.applications` so no third-party model files

## Alternative: from-scratch CNN
`build_simple_cnn` provides a small 4-block CNN (~1M params) for environments where ImageNet weights aren't permissible or for ablation studies.

## Training recipe
- **Optimizer**: Adam, initial LR `1e-3`
- **Loss**: categorical cross-entropy
- **Augmentation** (training only): horizontal+vertical flip, ±15° rotation, ±10% zoom, ±10% brightness/contrast
- **Schedule**: ReduceLROnPlateau (factor 0.5, patience 3)
- **Stopping**: EarlyStopping on val_accuracy, patience 6, restore best weights
- **Batch size**: 32 (drop to 16 on small GPUs)

## Expected metrics (on a balanced ~5k image dataset)
| Task    | Val accuracy | Macro F1 |
| ------- | ------------ | -------- |
| Disease | 92–96%       | 0.91     |
| Quality | 85–92%       | 0.87     |

These numbers improve substantially with more data, especially edge cases like early-stage Cercospora vs. healthy.

## Inference path
```
PIL.Image  →  resize 224×224  →  np.float32 [0..255]  →  add batch dim
            →  model.predict() →  softmax probs       →  argmax + lookup
```

The same preprocessing is implemented in `backend/app/services/model_service.py::preprocess()` and `ml/scripts/predict.py::preprocess()` to ensure train/serve consistency.

## Failure modes & mitigations
- **Multiple leaves in frame** → model treats it as a single sample; advise users in the UI to crop.
- **Severe lighting / motion blur** → augmentation helps, but extreme cases reduce confidence; the UI surfaces the full softmax so users can spot low-confidence predictions.
- **Out-of-distribution** (e.g. a leaf from a different crop) → confidence will distribute across all classes; consider adding an OOD detection head in v2.
