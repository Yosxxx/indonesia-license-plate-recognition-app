import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

const GRADIO_TARGET = process.env.GRADIO_TARGET ?? "http://127.0.0.1:7860/";

// Gradio predict_image returns [annotated, detections]
type AnnotatedResult = string | { url?: string };
type PredictImageResult = [AnnotatedResult, unknown[]];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const client = await Client.connect(GRADIO_TARGET);

    const result = await client.predict("/predict_image", {
      image: file,
      include_crops: true,
    });

    const [annotated, detections] = result.data as PredictImageResult;

    let annotated_url: string | null = null;
    if (typeof annotated === "string") {
      annotated_url = annotated.startsWith("data:image")
        ? annotated
        : `data:image/webp;base64,${annotated}`;
    } else {
      // now TS knows this is { url?: string }
      annotated_url = annotated.url ?? null;
    }

    return NextResponse.json({ detections, annotated_url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
