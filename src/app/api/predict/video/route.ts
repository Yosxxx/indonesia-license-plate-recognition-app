import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

// Local dev: "http://127.0.0.1:7860/"
// Hugging Face Space: "your-username/your-space"
const GRADIO_TARGET = process.env.GRADIO_TARGET ?? "http://127.0.0.1:7860/";

export const runtime = "nodejs"; // ensure Node runtime (not Edge)
export const dynamic = "force-dynamic";
export const maxDuration = 300; // allow long processing if needed

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // Optional overrides (you can POST these from the client if you add controls)
    const previews = true; // return preview_jpeg_base64 per frame
    const include_crops = false; // set true to include per-detection crops
    const max_seconds = null as number | null; // limit video length processed

    const client = await Client.connect(GRADIO_TARGET);

    const result = await client.predict("/predict_video", {
      video_file: file, // pass File/Blob directly
      previews, // boolean
      max_seconds, // number | null
      include_crops, // boolean
    });

    // Your Gradio function returns one JSON object -> lives at result.data[0]
    const payload = result.data[0];

    return NextResponse.json(payload); // { frames: [...], summary: {...} }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
