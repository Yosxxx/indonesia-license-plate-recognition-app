from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
import base64
import traceback

from .video_infer import run_video_pipeline
from .image_infer import run_image_pipeline

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    try:
        img_bytes = await file.read()
        result = run_image_pipeline(img_bytes, include_crops_base64=False)
        ann_bytes = result.get("annotated_webp") or b""
        ann_b64 = base64.b64encode(ann_bytes).decode("ascii") if ann_bytes else ""
        return JSONResponse({"detections": result.get("detections", []),
                             "annotated_webp_b64": ann_b64})
    except Exception as e:
        tb = traceback.format_exc()
        return PlainTextResponse(f"/predict-image failed:\n{e}\n\n{tb}", status_code=500)

@app.post("/predict-video")
async def predict_video(file: UploadFile = File(...),
                        previews: bool = False,
                        max_seconds: int | None = None):
    try:
        video_bytes = await file.read()
        out = run_video_pipeline(
            video_bytes,
            fps_target=1,
            return_previews=bool(previews),
            max_seconds=max_seconds,
            dedupe=True,
        )
        return JSONResponse(out)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        return PlainTextResponse(f"/predict-video failed:\n{e}\n\n{tb}", status_code=500)
