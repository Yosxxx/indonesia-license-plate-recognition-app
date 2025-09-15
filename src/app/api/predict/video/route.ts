import { NextRequest, NextResponse } from "next/server";

const PY_BACKEND = process.env.PY_BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const forward = new FormData();
  forward.append("file", file, file.name);

  const res = await fetch(`${PY_BACKEND}/predict-video?previews=true`, {
    method: "POST",
    body: forward,
  });

  const text = await res.text(); // <- read body regardless

  // Pass through exact backend error text + status
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
