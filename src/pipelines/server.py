from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import base64
from .image_infer import run_image_pipeline

app = FastAPI()

@app.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    img_bytes = await file.read()
    result = run_image_pipeline(img_bytes, include_crops_base64=False)
    ann_b64 = base64.b64encode(result["annotated_webp"]).decode("ascii")
    return JSONResponse({"detections": result["detections"],
                         "annotated_webp_b64": ann_b64})
