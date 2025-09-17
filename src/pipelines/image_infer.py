"""
plate_pipeline.py
Simple plate pipeline:
  1) Detect plates (model gives crops)
  2) OCR plate number
  3) OCR expiry date (MM-YY) from bottom band
  4) Return JSON-friendly dict
"""

import os, re, cv2
from typing import List, Dict, Any, Tuple, Optional

# --- Engines ---
from fast_plate_ocr import LicensePlateRecognizer        # plate text OCR (letters+digits)
from .model_infer import detect_plates_from_bytes        # your detector -> detections + crops
import easyocr                                           # generic OCR for the tiny expiry string

# =========================
# Config (GPU-first)
# =========================
# Force GPU for EasyOCR unless explicitly disabled.
# If CUDA is not available, we fallback and print a warning once.
_FORCE_GPU = os.getenv("EASYOCR_FORCE_GPU", "1") in ("1","true","True","TRUE")
_USE_GPU = False
try:
    import torch
    _USE_GPU = _FORCE_GPU and torch.cuda.is_available()
    if _FORCE_GPU and not _USE_GPU:
        print("[WARN] EASYOCR_FORCE_GPU=1 but CUDA not available. Falling back to CPU.")
except Exception:
    # If torch import fails, we can't check CUDA; EasyOCR will error if gpu=True and no CUDA
    _USE_GPU = False
    if _FORCE_GPU:
        print("[WARN] Could not import torch to verify CUDA. Using CPU for EasyOCR.")

# Instantiate OCR engines
PLATE_OCR = LicensePlateRecognizer("cct-xs-v1-global-model")
_reader = easyocr.Reader(['en'], gpu=_USE_GPU)  # <- GPU-first

# =========================
# Plate ID normalizer
# Matches formats like "B1234XYZ" or "AB12C"
# =========================
PLATE_RE  = re.compile(r'^([A-Z]{1,2})(\d{1,4})([A-Z]{1,3})$')
DIGIT_FIX = str.maketrans({'O':'0','I':'1','Z':'2','S':'5','B':'8','G':'6','Q':'0'})

def _normalize(raw: Optional[str]) -> Optional[str]:
    """Return 'AA 1234 BBB' (spaced) if it matches pattern, else None."""
    if not raw:
        return None
    canon = re.sub(r'[^A-Za-z0-9]', '', raw).upper()
    m = PLATE_RE.match(canon)
    if not m:
        return None
    prefix, digits, suffix = m.groups()
    digits = digits.translate(DIGIT_FIX)
    return f"{prefix} {digits} {suffix}"

# =========================
# Expiry OCR (MM-YY) from bottom band
# =========================
EXPIRY_RE = re.compile(r'(0[1-9]|1[0-2])\s*[-./·:_,| ]\s*([0-9]{2})')

# Two reasonable EasyOCR sweeps (contrast/thresholds)
EASYOCR_CFGS = [
    dict(detail=0, paragraph=True, contrast_ths=0.1, adjust_contrast=0.7, text_threshold=0.4, low_text=0.3),
    dict(detail=0, paragraph=True, contrast_ths=0.05, adjust_contrast=0.9, text_threshold=0.3, low_text=0.2),
]

def _expiry_from_crop(bgr) -> Tuple[Optional[int], Optional[int], Optional[str]]:
    """
    Read MM-YY from the lower strip of the plate crop.
    Returns (month, year, "MM-YY") or (None, None, None) if not found.
    """
    h, _ = bgr.shape[:2]
    # Try a narrow band near bottom; upsample to help OCR
    for s in (0.55, 0.60, 0.65, 0.70):
        y1 = max(0, int(h * s) - max(2, h // 50))
        band = bgr[y1:h, :]
        big  = cv2.resize(band, (band.shape[1]*3, band.shape[0]*3), interpolation=cv2.INTER_CUBIC)

        for cfg in EASYOCR_CFGS:
            try:
                texts = _reader.readtext(big, **cfg) or []
            except Exception:
                continue

            blob = " ".join(texts)
            # Common OCR digit fixes
            blob = blob.replace("O","0").replace("o","0").replace("S","5").replace("I","1")
            m = EXPIRY_RE.search(blob)
            if m:
                mm, yy = int(m.group(1)), int(m.group(2))
                return mm, yy, f"{mm:02d}-{yy:02d}"
    return None, None, None

# =========================
# Main pipeline
# =========================
def run_image_pipeline(img_bytes: bytes, include_crops_base64: bool = False) -> Dict[str, Any]:
    """
    1) model crops plate
    2) ocr plate number (fast_plate_ocr)
    3) ocr exp date (EasyOCR bottom band)
    4) output json + optional WEBP crops
    """
    # Detect plates -> list of dets + crops + optional annotated image bytes
    dets, crops, annotated_bytes = detect_plates_from_bytes(img_bytes)

    out: List[Dict[str, Any]] = []
    crops_webp: List[bytes] = []

    for i, det in enumerate(dets):
        if i >= len(crops):
            continue
        crop = crops[i]

        # 2) OCR plate number
        texts = PLATE_OCR.run(crop) or []
        raw   = texts[0] if texts else None
        spaced = _normalize(raw)  # None if regex didn't match
        matched = spaced is not None
        canon = re.sub(r'[^A-Za-z0-9]', '', raw).upper() if (raw and matched) else None

        # 3) OCR expiry date (only if plate format matched)
        if matched:
            mm, yy, human = _expiry_from_crop(crop)
        else:
            mm = yy = None
            human = None

        # Optional: return plate crops as WEBP
        if include_crops_base64:
            ok, buf = cv2.imencode(".webp", crop, [cv2.IMWRITE_WEBP_QUALITY, 90])
            crops_webp.append(buf.tobytes() if ok else b"")

        # 4) Build one clean record for this detection
        out.append({
            "xyxy": det.get("xyxy"),
            "conf": det.get("conf"),
            "cls":  det.get("cls"),
            "cls_name": det.get("cls_name"),
            "ocr": {
                "raw": raw or None,
                "plate_spaced": spaced,        # "AB 1234 C"
                "plate_plain": canon,          # "AB1234C"
            },
            "expiry": {
                "month": mm,                   # e.g., 7
                "year": yy,                    # e.g., 25
                "human": human                 # "07-25"
            }
        })

    return {
        "detections": out,
        "annotated_webp": annotated_bytes,
        "crops_webp": crops_webp if include_crops_base64 else None
    }
