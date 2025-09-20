import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

// Local dev: "http://127.0.0.1:7860/"
// Hugging Face Space: "your-username/your-space"
const GRADIO_TARGET = process.env.GRADIO_TARGET ?? "http://127.0.0.1:7860/";

export const runtime = "nodejs"; // ensure Node runtime
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const include_crops = (form.get("include_crops") ?? "false").toString().toLowerCase() === "true";

    const client = await Client.connect(GRADIO_TARGET);

    const result = await client.predict("/predict_frame", {
      frame: file, // pass Blob/File directly
      include_crops, // boolean
    });

    // Gradio returns [annotated, detections]
    const annotated = result.data[0];
    const detections = result.data[1];

    // Optional: normalize annotated image into a URL (if you want to show it)
    let annotated_url: string | null = null;
    if (typeof annotated === "string") {
      annotated_url = annotated.startsWith("data:image") ? annotated : `data:image/webp;base64,${annotated}`;
    } else if (annotated && typeof annotated === "object" && "url" in annotated) {
      annotated_url = (annotated as any).url ?? null;
    }

    return NextResponse.json({ detections, annotated_url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
