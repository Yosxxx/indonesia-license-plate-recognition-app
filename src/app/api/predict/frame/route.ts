import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

const GRADIO_TARGET = process.env.GRADIO_TARGET ?? "http://127.0.0.1:7860/";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gradio predict_frame returns [annotated, detections]
type AnnotatedResult = string | { url?: string };
type PredictFrameResult = [AnnotatedResult, unknown[]];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const include_crops =
      (form.get("include_crops") ?? "false").toString().toLowerCase() === "true";

    const client = await Client.connect(GRADIO_TARGET);

    const result = await client.predict("/predict_frame", {
      frame: file,
      include_crops,
    });

    const [annotated, detections] = result.data as PredictFrameResult;

    // Normalize annotated image into a URL
    let annotated_url: string | null = null;
    if (typeof annotated === "string") {
      annotated_url = annotated.startsWith("data:image")
        ? annotated
        : `data:image/webp;base64,${annotated}`;
    } else if (annotated && typeof annotated === "object") {
      annotated_url = annotated.url ?? null; // no "any" needed
    }

    return NextResponse.json({ detections, annotated_url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
