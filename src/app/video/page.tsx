// app/video/page.tsx (Next.js App Router)
// If you're using Pages Router, place as pages/video.tsx with default export.
"use client";
import { useState } from "react";
import { useDetectStore } from "@/lib/detectStore";
import { getOriginFromPlate, daysRemainingFromExpiry, nowTimestamp, type PlateRow } from "@/lib/plate";

type Frame = {
  t_sec: number;
  detections: any[];
  preview_jpeg_base64?: string;
};

type Summary = {
  unique_count: number;
  plates: {
    plate_spaced: string;
    best_conf: number;
    first_seen_sec: number;
    last_seen_sec: number;
    occurrences: number;
  }[];
};

// Convert a single detection JSON into a PlateRow (or null if no OCR text)
function detToPlateRow(det: any): PlateRow | null {
  const spaced =
    det?.ocr?.plate_spaced ?? det?.ocr?.plate_plain ?? det?.ocr?.canon ?? det?.plate_spaced ?? det?.plate ?? null;

  if (!spaced) return null;

  const human = det?.expiry?.human ?? det?.expiry_human ?? undefined;

  return {
    plateNumber: spaced,
    plateOrigin: getOriginFromPlate(spaced),
    expiryDate: human ?? "—",
    remaining: daysRemainingFromExpiry(human),
    timestamp: nowTimestamp(),
  };
}

export default function UploadVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Store action: append (dedup) into the Detection Result panel
  const addMany = useDetectStore((s) => s.addMany);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setFrames([]);
    setSummary(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/predict/video", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const framesResp: Frame[] = data.frames || [];
      const summaryResp: Summary | null = data.summary || null;

      setFrames(framesResp);
      setSummary(summaryResp);

      // --- Gather unique PlateRows from frames ---
      const seen = new Set<string>();
      const batch: PlateRow[] = [];

      for (const f of framesResp) {
        for (const det of f.detections || []) {
          const row = detToPlateRow(det);
          if (!row) continue;
          if (seen.has(row.plateNumber)) continue; // dedup within this batch
          seen.add(row.plateNumber);
          batch.push(row);
        }
      }

      // --- Optional: also include summary plates if any missing ---
      if (summaryResp?.plates?.length) {
        for (const p of summaryResp.plates) {
          const spaced = p?.plate_spaced;
          if (!spaced) continue;
          if (seen.has(spaced)) continue;

          const row: PlateRow = {
            plateNumber: spaced,
            plateOrigin: getOriginFromPlate(spaced),
            expiryDate: "—",
            remaining: daysRemainingFromExpiry(undefined),
            timestamp: nowTimestamp(),
          };
          seen.add(spaced);
          batch.push(row);
        }
      }

      if (batch.length) {
        addMany(batch); // prepend into the Detection Result panel; store will also dedup vs existing
      }
    } catch (err) {
      console.error(err);
      alert("Video processing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-h-screen sticky">
      <h2 className="text-xl font-bold">Upload Video</h2>

      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-2" />

      <button disabled={!file || loading} onClick={handleUpload} className="px-3 py-2 border rounded mt-3">
        {loading ? "Processing..." : "Process Video"}
      </button>

      {summary && (
        <div className="mt-4">
          <h3 className="font-semibold">Summary</h3>
          <div>Total unique plates: {summary.unique_count}</div>
          <ul className="list-disc ml-6">
            {summary.plates.map((p, i) => (
              <li key={i}>
                {p.plate_spaced} ({p.occurrences}×, best {p.best_conf.toFixed(2)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {frames.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {frames.map((f, i) => (
            <div key={i} className="border rounded p-2">
              <div className="font-medium">t = {f.t_sec}s</div>
              {f.preview_jpeg_base64 && (
                <img
                  src={`data:image/jpeg;base64,${f.preview_jpeg_base64}`}
                  alt={`frame-${i}`}
                  className="mt-2 w-full h-auto"
                />
              )}
              <pre className="text-xs mt-2 overflow-x-auto">{JSON.stringify(f.detections, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
