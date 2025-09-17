const PY_BACKEND = process.env.PY_BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const inForm = await req.formData();
    const outForm = new FormData();

    // Pass through the file and any extra fields (e.g., include_crops)
    for (const [key, val] of inForm.entries()) {
      if (val instanceof File) {
        // Re-wrap to be safe in Node
        outForm.append(key, new File([val], val.name, { type: val.type }));
      } else {
        outForm.append(key, String(val));
      }
    }

    const res = await fetch(`${PY_BACKEND}/predict-frame`, {
      method: "POST",
      body: outForm,
      // Let fetch set the correct multipart boundary
    });

    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();

    if (!res.ok) {
      return new Response(bodyText || "Upstream error", {
        status: res.status,
        headers: { "content-type": "text/plain" },
      });
    }

    // return JSON from FastAPI
    if (contentType.includes("application/json")) {
      return new Response(bodyText, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // Fallback: treat as text
    return new Response(bodyText, { status: 200 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return new Response(`route error: ${e?.message || e}`, { status: 500 });
  }
}
