from typing import List, Dict, Any, Tuple, Optional
import time, base64
import numpy as np
import cv2

from .image_infer import run_image_pipeline

# ---------- tiny knobs (tune quickly) ----------
_FPS_BUDGET     = 5.0     # max heavy passes per second
_MIN_GAP_MS     = 120     # guardrail gap between heavy passes
_MOTION_GATE    = True
_MOTION_THRESH  = 5       # avg absdiff threshold to consider "motion"
_OCR_EVERY_N    = 10      # refresh OCR every N heavy frames per persisting box
_IOU_KEEP       = 0.4     # consider two boxes "same" if IoU >= this
_DOWNSCALE_MAX  = 720     # pre-downscale long side before passing to pipeline (0=off)

# ---------- tiny cache/state ----------
_STATE: Dict[str, Any] = {
    "last_ts_ms": 0.0,
    "last_gray": None,           # np.ndarray
    "last_dets": [],             # List[Dict[str, Any]]
    "heavy_count": 0,
}

BBox = Tuple[int, int, int, int]

def _iou(a: BBox, b: BBox) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_x1, inter_y1 = max(ax1, bx1), max(ay1, by1)
    inter_x2, inter_y2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, inter_x2 - inter_x1), max(0, inter_y2 - inter_y1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    return inter / float(area_a + area_b - inter + 1e-9)

def _get_box(det: Dict[str, Any]) -> Optional[BBox]:
    # Expect 'bbox_xyxy' from image_infer; fallback to 'bbox' if present.
    box = det.get("bbox_xyxy") or det.get("bbox")
    if not box or len(box) < 4:
        return None
    x1, y1, x2, y2 = map(int, box[:4])
    if x2 <= x1 or y2 <= y1:
        return None
    return (x1, y1, x2, y2)

def _should_run_heavy(bgr: np.ndarray) -> bool:
    now = time.time() * 1000.0
    if (now - _STATE["last_ts_ms"]) < _MIN_GAP_MS:
        return False

    if _FPS_BUDGET > 0:
        min_gap = max(_MIN_GAP_MS, int(1000.0 / _FPS_BUDGET))
        if (now - _STATE["last_ts_ms"]) < min_gap:
            return False

    if not _MOTION_GATE:
        return True

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    last_gray = _STATE["last_gray"]
    _STATE["last_gray"] = gray  # update regardless

    if last_gray is None:
        return True

    diff = cv2.absdiff(gray, last_gray)
    score = float(diff.mean())
    return score >= _MOTION_THRESH

def _reuse_ocr(dets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Copy OCR fields from last_dets for same boxes, refresh every _OCR_EVERY_N."""
    prevs = _STATE["last_dets"]
    out: List[Dict[str, Any]] = []
    for det in dets:
        box = _get_box(det)
        best_prev = None
        best_iou = 0.0
        if box is not None:
            for p in prevs:
                pbox = _get_box(p)
                if pbox is None:
                    continue
                iou = _iou(box, pbox)
                if iou > best_iou:
                    best_iou, best_prev = iou, p

        reused = False
        if best_prev is not None and best_iou >= _IOU_KEEP:
            ctr = int(best_prev.get("_ocr_refresh_ctr", 0)) + 1
            best_prev["_ocr_refresh_ctr"] = ctr
            if ctr % _OCR_EVERY_N != 0:
                for k in ("plate_text", "plate_conf", "expiry_text", "expiry_conf"):
                    if k in best_prev and k not in det:
                        det[k] = best_prev[k]
                reused = True

        det["_ocr_reused"] = reused
        out.append(det)
    return out

def run_live_frame(
    img_bytes: bytes,
    include_crops_base64: bool = False
) -> Dict[str, Any]:
    """
    Smart, minimal live wrapper:
      - throttles heavy calls
      - motion gate to skip static frames
      - reuses OCR for stable boxes between heavy frames
      - optionally attaches base64 crops
    """
    # Decode once to decide if we should run heavy
    nparr = np.frombuffer(img_bytes, np.uint8)
    bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        return {"detections": [], "annotated_webp": b"", "crops_webp": None}

    # Quick pre-downscale to reduce CPU + encode overhead
    if _DOWNSCALE_MAX and max(bgr.shape[:2]) > _DOWNSCALE_MAX:
        h, w = bgr.shape[:2]
        scale = _DOWNSCALE_MAX / float(max(h, w))
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    if _should_run_heavy(bgr):
        # Re-encode for your existing pipeline (which expects bytes)
        ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            return {"detections": [], "annotated_webp": b"", "crops_webp": None}
        frame_bytes = buf.tobytes()

        res = run_image_pipeline(frame_bytes, include_crops_base64=include_crops_base64)
        detections: List[Dict[str, Any]] = res.get("detections", []) or []

        # Light OCR reuse (only copies when same box persists)
        detections = _reuse_ocr(detections)

        # Update state
        _STATE["last_ts_ms"] = time.time() * 1000.0
        _STATE["heavy_count"] = int(_STATE["heavy_count"]) + 1
        _STATE["last_dets"] = detections

        # Attach base64 crops once (only when we actually ran heavy)
        crops_webp = res.get("crops_webp") if include_crops_base64 else None
        if include_crops_base64 and isinstance(crops_webp, list):
            for det, crop in zip(detections, crops_webp):
                det["crop_webp_b64"] = base64.b64encode(crop).decode("ascii") if crop else None

        return {
            "detections": detections,
            "annotated_webp": res.get("annotated_webp"),
            "crops_webp": crops_webp if include_crops_base64 else None,
        }

    # Skip path: reuse last detections, don’t waste OCR/annotate work
    return {
        "detections": _STATE["last_dets"],
        "annotated_webp": b"",          # (optional) keep last annotated bytes if you store them
        "crops_webp": None,
    }
