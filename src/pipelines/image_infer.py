import re, cv2, os
from typing import List, Dict, Any, Tuple, Optional
from fast_plate_ocr import LicensePlateRecognizer
import easyocr

from .model_infer import detect_plates_from_bytes

PLATE_OCR = LicensePlateRecognizer("cct-xs-v1-global-model")

# e.g. "B1234XYZ" or "AB12C" → adapt as needed
PLATE_RE  = re.compile(r'^([A-Z]{1,2})(\d{1,4})([A-Z]{1,3})$')
DIGIT_FIX = str.maketrans({'O':'0','I':'1','Z':'2','S':'5','B':'8','G':'6','Q':'0'})

EASYOCR_GPU = os.getenv("EASYOCR_GPU", "0") in ("1","true","True","TRUE")  # default CPU
reader = easyocr.Reader(['en'], gpu=EASYOCR_GPU)

EXPIRY_RE = re.compile(r'(0[1-9]|1[0-2])\s*[-./·:_,| ]\s*([0-9]{2})')
EASYOCR_CFGS = [
    dict(detail=0, paragraph=True, contrast_ths=0.1, adjust_contrast=0.7, text_threshold=0.4, low_text=0.3),
    dict(detail=0, paragraph=True, contrast_ths=0.05, adjust_contrast=0.9, text_threshold=0.3, low_text=0.2),
]

def _normalize(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    canon = re.sub(r'[^A-Za-z0-9]', '', raw).upper()
    m = PLATE_RE.match(canon)
    if not m:
        # reject non-matching plates entirely
        return None
    prefix, digits, suffix = m.groups()
    digits = digits.translate(DIGIT_FIX)
    return f"{prefix} {digits} {suffix}"

def _expiry_from_crop(bgr) -> Tuple[Optional[int], Optional[int], Optional[str]]:
    h, w = bgr.shape[:2]
    for s in (0.55, 0.60, 0.65, 0.70):
        y1 = max(0, int(h*s) - max(2, h//50))
        band = bgr[y1:h, :]
        big  = cv2.resize(band, (band.shape[1]*3, band.shape[0]*3), interpolation=cv2.INTER_CUBIC)
        for cfg in EASYOCR_CFGS:
            try:
                texts = reader.readtext(big, **cfg) or []
            except Exception:
                continue
            blob = " ".join(texts).replace("O","0").replace("o","0").replace("S","5").replace("I","1")
            m = EXPIRY_RE.search(blob)
            if m:
                mm, yy = int(m.group(1)), int(m.group(2))
                return mm, yy, f"{mm:02d}-{yy:02d}"
    return None, None, None

def run_image_pipeline(img_bytes: bytes, include_crops_base64: bool = False) -> Dict[str, Any]:
    dets, crops, annotated_bytes = detect_plates_from_bytes(img_bytes)

    out: List[Dict[str, Any]] = []
    crops_webp: List[bytes] = []

    for i, d in enumerate(dets):
        if i >= len(crops):
            continue
        crop = crops[i]

        # plate OCR
        texts = PLATE_OCR.run(crop) or []
        raw   = texts[0] if texts else None
        spaced = _normalize(raw)  # None if regex didn't match
        matched = spaced is not None

        # only compute canon if matched
        canon = re.sub(r'[^A-Za-z0-9]', '', raw).upper() if (raw and matched) else None

        # expiry only if matched
        if matched:
            mm, yy, human = _expiry_from_crop(crop)
        else:
            mm = yy = None
            human = None

        if include_crops_base64:
            ok, buf = cv2.imencode(".webp", crop, [cv2.IMWRITE_WEBP_QUALITY, 90])
            crops_webp.append(buf.tobytes() if ok else b"")

        out.append({
            "xyxy": d.get("xyxy"),
            "conf": d.get("conf"),
            "cls":  d.get("cls"),
            "cls_name": d.get("cls_name"),
            "ocr": {
                "raw": raw or None,
                "canon": canon,               # None if no regex match
                "plate_plain": canon,         # None if no regex match
                "plate_spaced": spaced,       # None if no regex match
            },
            "expiry": {"month": mm, "year": yy, "human": human}
        })

    return {
        "detections": out,
        "annotated_webp": annotated_bytes,
        "crops_webp": crops_webp if include_crops_base64 else None
    }
