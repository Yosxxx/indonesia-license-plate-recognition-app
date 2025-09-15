import os, cv2, numpy as np
from ultralytics import YOLO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]           # .../src
WEIGHTS = str(ROOT / "model" / "best.pt")
CONF    = float(os.getenv("CONF_THR", "0.25"))
IOU     = float(os.getenv("IOU_THR", "0.45"))
IMGSZ   = int(os.getenv("IMG_SIZE", "1280"))
DEVICE  = os.getenv("DEVICE", "0")                 # "cpu" or "0"

_model = YOLO(WEIGHTS)
_names = _model.model.names if hasattr(_model, "model") else {}

def _encode_webp(bgr, quality=90) -> bytes:
    ok, buf = cv2.imencode(".webp", bgr, [cv2.IMWRITE_WEBP_QUALITY, quality])
    return buf.tobytes() if ok else b""

def detect_plates_from_bytes(img_bytes: bytes):
    """Return (detections, crops[list of np.ndarray BGR], annotated_bytes)"""
    nparr = np.frombuffer(img_bytes, np.uint8)
    bgr   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Invalid image bytes")

    r = _model.predict(source=bgr, conf=CONF, iou=IOU, imgsz=IMGSZ,
                       device=DEVICE, verbose=False)[0]

    dets, crops = [], []
    for box in r.boxes:
        x1,y1,x2,y2 = map(int, box.xyxy[0].tolist())
        conf  = float(box.conf[0])
        clsid = int(box.cls[0]) if box.cls is not None else -1
        name  = _names.get(clsid, str(clsid))
        crop  = bgr[y1:y2, x1:x2].copy()
        crops.append(crop)
        dets.append({"xyxy":[x1,y1,x2,y2], "conf":conf, "cls":clsid, "cls_name":name})

    ann = bgr.copy()
    for d in dets:
        x1,y1,x2,y2 = d["xyxy"]
        cv2.rectangle(ann,(x1,y1),(x2,y2),(0,255,0),2)
    annotated_bytes = _encode_webp(ann, 90)
    return dets, crops, annotated_bytes
