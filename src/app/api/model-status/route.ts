import { NextResponse } from "next/server";

const HF_URL =
  process.env.HF_SPACE_URL ??
  "https://z6k-indonesia-license-plate-recognition.hf.space/";

export async function GET() {
  try {
    const res = await fetch(HF_URL, { method: "HEAD", cache: "no-store" });

    // If the Space is paused or unreachable → offline
    if (!res.ok) return NextResponse.json({ status: "offline" });

    return NextResponse.json({ status: "online" });
  } catch {
    return NextResponse.json({ status: "offline" });
  }
}
