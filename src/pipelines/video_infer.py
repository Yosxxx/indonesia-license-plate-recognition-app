# video_infer.py
import cv2, tempfile, base64
from typing import Dict, Any, List, Optional
import numpy as np
from .image_infer import run_image_pipeline

def _bgr_to_jpeg_bytes(bgr, quality=85) -> bytes:
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes() if ok else b""

def _jpeg_b64(bgr) -> str:
    data = _bgr_to_jpeg_bytes(bgr)
    return base64.b64encode(data).decode("ascii")

def run_video_pipeline(
    video_bytes: bytes,
    fps_target: int = 1,
    return_previews: bool = False,
    max_seconds: Optional[int] = None,
    dedupe: bool = True,
) -> Dict[str, Any]:

    # --- write to temp file ---
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    # --- try ffmpeg backend first (Windows-friendly), then default ---
    cap = cv2.VideoCapture(tmp_path, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        cap = cv2.VideoCapture(tmp_path)
    if not cap.isOpened():
        raise RuntimeError(
            "OpenCV could not open the uploaded video. "
            "Use an ffmpeg-enabled OpenCV or re-encode the video (H.264 MP4)."
        )

    try:
        vid_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = frame_count / vid_fps if vid_fps > 0 else 0.0
        end_sec = int(duration) if duration > 0 else 0
        if max_seconds is not None:
            end_sec = min(end_sec, int(max_seconds))

        frames: List[Dict[str, Any]] = []
        seen: Dict[str, Dict[str, Any]] = {}
        counts: Dict[str, int] = {}

        # Sample exactly at t = 0,1,2,...
        for t in range(0, end_sec + 1, max(1, int(1 / max(1e-9, fps_target)))):
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue

            frame_rec: Dict[str, Any] = {"t_sec": float(t)}

            # --- robust per-frame inference ---
            try:
                img_bytes = _bgr_to_jpeg_bytes(frame)
                image_out = run_image_pipeline(img_bytes, include_crops_base64=False)
                dets = image_out.get("detections", [])
                frame_rec["detections"] = dets
            except Exception as e:
                # record the error on this frame and continue
                frame_rec["detections"] = []
                frame_rec["error"] = f"{type(e).__name__}: {e}"

                # still append frame so UI shows timeline
                frames.append(frame_rec)
                continue

            if return_previews:
                frame_rec["preview_jpeg_base64"] = _jpeg_b64(frame)
            frames.append(frame_rec)

            # --- dedupe summary ---
            if dedupe:
                for d in dets:
                    spaced = (
                        (d.get("ocr") or {}).get("plate_spaced")
                        or (d.get("ocr") or {}).get("plate_plain")
                        or ""
                    )
                    if not spaced:
                        continue
                    conf = float(d.get("conf", 0.0))
                    if spaced not in seen:
                        seen[spaced] = {
                            "plate_spaced": spaced,
                            "best_conf": conf,
                            "first_seen_sec": float(t),
                            "last_seen_sec": float(t),
                        }
                        counts[spaced] = 1
                    else:
                        counts[spaced] += 1
                        seen[spaced]["last_seen_sec"] = float(t)
                        if conf > seen[spaced]["best_conf"]:
                            seen[spaced]["best_conf"] = conf
    finally:
        cap.release()

    plates_summary = [
        {**v, "occurrences": counts.get(k, 1)} for k, v in seen.items()
    ]

    return {
        "frames": frames,
        "summary": {"unique_count": len(plates_summary), "plates": plates_summary},
    }
