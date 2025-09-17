from typing import List, Dict, Any
import base64

from .image_infer import run_image_pipeline

def run_live_frame(
    img_bytes: bytes,
    include_crops_base64: bool = False
) -> Dict[str, Any]:
    """
    Thin wrapper around image_infer.run_image_pipeline for a single frame.
    Returns:
      {
        "detections": [
          {
            ... existing fields from image_infer ...,
            "crop_webp_b64": str | None   # added for convenience when include_crops_base64=True
          },
          ...
        ],
        "annotated_webp": <bytes>,
        "crops_webp": [<bytes>, ...] | None
      }
    """
    # Delegate all heavy lifting (detect + plate OCR + expiry OCR)
    res = run_image_pipeline(img_bytes, include_crops_base64=include_crops_base64)

    detections: List[Dict[str, Any]] = res.get("detections", []) or []
    crops_webp = res.get("crops_webp") if include_crops_base64 else None
    
    if include_crops_base64 and isinstance(crops_webp, list):
        for i, det in enumerate(detections):
            if i < len(crops_webp) and crops_webp[i]:
                det["crop_webp_b64"] = base64.b64encode(crops_webp[i]).decode("ascii")
            else:
                det["crop_webp_b64"] = None

    return {
        "detections": detections,
        "annotated_webp": res.get("annotated_webp"),
        "crops_webp": crops_webp if include_crops_base64 else None,
    }
