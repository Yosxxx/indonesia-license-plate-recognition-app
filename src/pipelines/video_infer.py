import os
import cv2
import base64
import tempfile
from typing import Dict, Any, List, Optional, Tuple

from .image_infer import run_image_pipeline

# ------------------------
# Helpers
# ------------------------

def _bgr_to_jpeg_bytes(bgr, quality: int = 85) -> bytes:
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes() if ok else b""

def _jpeg_b64(bgr) -> str:
    data = _bgr_to_jpeg_bytes(bgr)
    return base64.b64encode(data).decode("ascii")

def _score(det: Dict[str, Any]) -> Tuple[int, float]:
    """
    Quality tuple for ranking detections of the same plate.
    Prefer those that have expiry; tie-break by higher confidence.
    """
    has_expiry = 1 if (det.get("expiry", {}).get("human")) else 0
    conf = float(det.get("conf", 0.0))
    return (has_expiry, conf)

# ------------------------
# Main pipeline
# ------------------------

def run_video_pipeline(
    video_bytes: bytes,
    fps_target: int = 1,
    return_previews: bool = False,
    max_seconds: Optional[int] = None,
    dedupe: bool = True,
    include_crops_base64: bool = False,  # NEW: expose crops toggle
) -> Dict[str, Any]:
    """
    Process a video at ~fps_target (default 1 fps), call run_image_pipeline on each frame,
    attach optional plate crops to each detection, and summarize by unique plate with the
    'best' detection (preferring ones with expiry, then higher confidence).
    """
    tmp_path = None
    try:
        # Write to temp file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        # Open video (FFMPEG backend first)
        cap = cv2.VideoCapture(tmp_path, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise RuntimeError(
                "OpenCV could not open the uploaded video. "
                "Ensure OpenCV is ffmpeg-enabled or re-encode to H.264 MP4."
            )

        try:
            vid_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            duration = (total_frames / vid_fps) if vid_fps > 0 else 0.0

            end_sec = int(duration) if duration > 0 else 0
            if max_seconds is not None:
                end_sec = min(end_sec, int(max_seconds))

            frames: List[Dict[str, Any]] = []
            seen: Dict[str, Dict[str, Any]] = {}

            # step is in seconds because we sample by timestamp
            step = max(1, int(round(1 / max(1e-9, fps_target))))
            for t in range(0, end_sec + 1, step):
                cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000.0)
                ok, frame = cap.read()
                if not ok or frame is None:
                    continue

                rec: Dict[str, Any] = {"t_sec": float(t)}

                try:
                    img_bytes = _bgr_to_jpeg_bytes(frame)
                    image_out = run_image_pipeline(
                        img_bytes,
                        include_crops_base64=include_crops_base64  # pass through
                    )
                    dets = image_out.get("detections", []) or []
                    crops_webp = image_out.get("crops_webp") if include_crops_base64 else None

                    # Attach crop bytes (as base64) back into the matching detection
                    if include_crops_base64 and isinstance(crops_webp, list):
                        for i, det in enumerate(dets):
                            if i < len(crops_webp) and crops_webp[i]:
                                det["crop_webp_b64"] = base64.b64encode(crops_webp[i]).decode("ascii")

                    rec["detections"] = dets
                except Exception as e:
                    rec["detections"] = []
                    rec["error"] = f"{type(e).__name__}: {e}"
                    frames.append(rec)
                    continue

                if return_previews:
                    rec["preview_jpeg_base64"] = _jpeg_b64(frame)

                frames.append(rec)

                if not dedupe:
                    continue

                # Dedupe with upgrade on better frames
                for d in dets:
                    ocr = d.get("ocr") or {}
                    key = ocr.get("plate_plain")  # None if regex didn't match
                    if not key:
                        continue

                    conf = float(d.get("conf", 0.0))
                    sc = _score(d)

                    # Save representative (and keep the best crop if available)
                    if key not in seen:
                        seen[key] = {
                            "plate_spaced": ocr.get("plate_spaced") or key,
                            "best_conf": conf,
                            "first_seen_sec": float(t),
                            "last_seen_sec": float(t),
                            "occurrences": 1,
                            "best_det": d,
                            "best_score": sc,
                            "best_crop_webp_b64": d.get("crop_webp_b64") if include_crops_base64 else None,
                        }
                    else:
                        recp = seen[key]
                        recp["last_seen_sec"] = float(t)
                        recp["occurrences"] += 1
                        recp["best_conf"] = max(recp["best_conf"], conf)

                        if sc > recp["best_score"]:
                            recp["best_det"] = d
                            recp["best_score"] = sc
                            if ocr.get("plate_spaced"):
                                recp["plate_spaced"] = ocr["plate_spaced"]
                            if include_crops_base64 and d.get("crop_webp_b64"):
                                recp["best_crop_webp_b64"] = d["crop_webp_b64"]

        finally:
            cap.release()

        # Build summary
        plates_summary: List[Dict[str, Any]] = []
        for key, recp in seen.items():
            best = recp.get("best_det") or {}
            best_exp = best.get("expiry", {}) if best else {}
            plates_summary.append({
                "plate_spaced": recp["plate_spaced"],
                "best_conf": recp["best_conf"],
                "first_seen_sec": recp["first_seen_sec"],
                "last_seen_sec": recp["last_seen_sec"],
                "occurrences": recp["occurrences"],
                "expiry_human": best_exp.get("human"),
                "expiry_month": best_exp.get("month"),
                "expiry_year": best_exp.get("year"),
                "xyxy": best.get("xyxy"),
                # Include the best crop we saw for this plate (if requested)
                "best_crop_webp_b64": recp.get("best_crop_webp_b64"),
            })

        return {
            "frames": frames,
            "summary": {
                "unique_count": len(plates_summary),
                "plates": plates_summary,
            },
        }

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
