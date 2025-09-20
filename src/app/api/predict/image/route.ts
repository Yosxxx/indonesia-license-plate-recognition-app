import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

// For local Gradio: "http://127.0.0.1:7860/"
// For Hugging Face Space: "username/space-name"
const GRADIO_TARGET = process.env.GRADIO_TARGET ?? "http://127.0.0.1:7860/";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const client = await Client.connect(GRADIO_TARGET);

    const result = await client.predict("/predict_image", {
      image: file, // pass File/Blob directly
      include_crops: true, // or false
    });

    // result.data => [annotated, detections]
    const annotated = result.data[0];
    const detections = result.data[1];

    // Normalize to URL for Next/Image
    let annotated_url: string | null = null;

    if (typeof annotated === "string") {
      // Could be data URL or raw base64. If raw base64, wrap as data URL.
      annotated_url = annotated.startsWith("data:image") ? annotated : `data:image/webp;base64,${annotated}`;
    } else if (annotated && typeof annotated === "object" && "url" in annotated) {
      annotated_url = (annotated as any).url ?? null; // Gradio returns { url: "https://..." }
    }

    return NextResponse.json({ detections, annotated_url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
