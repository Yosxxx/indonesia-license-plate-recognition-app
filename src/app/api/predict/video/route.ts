import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

const GRADIO_TARGET = process.env.GRADIO_TARGET ?? "http://127.0.0.1:7860/";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type VideoPredictResult = [{ frames: unknown[]; summary: Record<string, unknown> }];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const previews = true;
    const include_crops = false;
    const max_seconds = null as number | null;

    const client = await Client.connect(GRADIO_TARGET);

    const result = await client.predict("/predict_video", {
      video_file: file,
      previews,
      max_seconds,
      include_crops,
    });

    // Cast result.data so TS knows it's an array with one object
    const [payload] = result.data as VideoPredictResult;

    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
