from __future__ import annotations

import base64
import io
from functools import lru_cache

import numpy as np

from ..config import AUTISM_DIR


AUTISM_MODEL_PATH = AUTISM_DIR / "best_model.pt"
LABELS = {0: "Non-autistic", 1: "Autistic"}
DISCLAIMER = (
    "Experimental computer-vision output only. This does not diagnose autism and must not be used as a medical decision tool."
)


class AutismModelError(RuntimeError):
    """Raised when the autism model cannot run."""


def _missing_dependency_error(package: str, install_name: str | None = None) -> AutismModelError:
    required = install_name or package
    return AutismModelError(
        f"Missing dependency '{package}'. Install backend requirements first, including '{required}'."
    )


@lru_cache(maxsize=1)
def _load_artifacts():
    try:
        import torch
        from torch import nn
        from torchvision.models import ResNet50_Weights, resnet50
    except ImportError as exc:
        missing = getattr(exc, "name", "torch")
        raise _missing_dependency_error(missing) from exc

    if not AUTISM_MODEL_PATH.exists():
        raise AutismModelError(f"Autism checkpoint not found at: {AUTISM_MODEL_PATH}")

    checkpoint = torch.load(AUTISM_MODEL_PATH, map_location="cpu")
    model = resnet50(weights=None)
    model.fc = nn.Linear(in_features=2048, out_features=1, bias=True)
    state_dict = checkpoint["model"] if isinstance(checkpoint, dict) and "model" in checkpoint else checkpoint
    model.load_state_dict(state_dict)
    model.eval()
    transforms = ResNet50_Weights.DEFAULT.transforms()
    return torch, model, transforms


def _prepare_image(image):
    grayscale = np.asarray(image.convert("L"), dtype=np.float32)
    brightness = float(grayscale.mean())
    contrast = float(grayscale.std())
    horizontal_detail = float(np.abs(np.diff(grayscale, axis=1)).mean()) if grayscale.shape[1] > 1 else 0.0
    vertical_detail = float(np.abs(np.diff(grayscale, axis=0)).mean()) if grayscale.shape[0] > 1 else 0.0
    detail_score = (horizontal_detail + vertical_detail) / 2.0
    quality_notes: list[str] = []

    if brightness < 12:
        raise AutismModelError("The image is too dark for a usable prediction. Use brighter lighting and try again.")
    if brightness < 28:
        quality_notes.append("Low lighting may reduce reliability.")
    if contrast < 10:
        quality_notes.append("Low contrast may reduce reliability.")
    if detail_score < 3:
        quality_notes.append("Blur or motion may reduce reliability.")

    return image, quality_notes


def predict_autism_from_base64(image_base64: str) -> dict:
    try:
        from PIL import Image
    except ImportError as exc:
        raise _missing_dependency_error("PIL", "pillow") from exc

    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    try:
        raw = base64.b64decode(image_base64)
    except Exception as exc:
        raise AutismModelError("Invalid image data supplied for autism inference.") from exc

    torch, model, transforms = _load_artifacts()

    with Image.open(io.BytesIO(raw)) as img:
        image, quality_notes = _prepare_image(img.convert("RGB"))

    tensor = transforms(image).unsqueeze(0)
    with torch.inference_mode():
        logits = model(tensor).squeeze()
        autistic_probability = float(torch.sigmoid(logits).item())

    predicted_index = 1 if autistic_probability >= 0.5 else 0
    label = LABELS[predicted_index]
    confidence = autistic_probability if predicted_index == 1 else 1.0 - autistic_probability

    return {
        "label": label,
        "confidence": round(confidence * 100, 2),
        "autistic_probability": round(autistic_probability * 100, 2),
        "non_autistic_probability": round((1.0 - autistic_probability) * 100, 2),
        "model": str(AUTISM_MODEL_PATH),
        "disclaimer": (
            DISCLAIMER
            if not quality_notes
            else f"{DISCLAIMER} Image quality note: {' '.join(quality_notes)}"
        ),
    }
