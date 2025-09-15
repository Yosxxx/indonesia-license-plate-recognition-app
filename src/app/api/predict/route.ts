// src/app/api/predict/route.ts (your image proxy)
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData(); // must contain "file"
  const r = await fetch("http://127.0.0.1:8000/predict-image", {
    method: "POST",
    body: form,
  });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}
