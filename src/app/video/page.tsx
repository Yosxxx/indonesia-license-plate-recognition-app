// app/video/page.tsx
"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useDetectStore } from "@/lib/detectStore";
import { getOriginFromPlate, daysRemainingFromExpiry, nowTimestamp, type PlateRow } from "@/lib/plate";

type Frame = {
  t_sec: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    expiry_human?: string | null;
    expiry_month?: number | null;
    expiry_year?: number | null;
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

// Upgrade-merge helpers (prefer rows that have expiry)
const hasExpiry = (row: PlateRow | undefined) => !!row && !!row.expiryDate && row.expiryDate !== "—";

const chooseBetter = (a: PlateRow | undefined, b: PlateRow): PlateRow => {
  if (!a) return b;
  if (hasExpiry(b) && !hasExpiry(a)) return b;
  return a;
};

export default function UploadVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const addMany = useDetectStore((s) => s.addMany);

  const handleReset = () => {
    setFile(null);
    setFrames([]);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setFrames([]);
    setSummary(null);

    try {
      const form = new FormData();
      form.append("file", file);

      // Your Next.js API route that proxies to FastAPI /predict-video
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

      // Build best-per-plate from frames (upgrade when later row has expiry)
      const byPlate = new Map<string, PlateRow>();
      for (const f of framesResp) {
        for (const det of f.detections || []) {
          const row = detToPlateRow(det);
          if (!row) continue;
          const prev = byPlate.get(row.plateNumber);
          byPlate.set(row.plateNumber, chooseBetter(prev, row));
        }
      }

      // Merge in backend summary (already best-per-plate server-side)
      if (summaryResp?.plates?.length) {
        for (const p of summaryResp.plates) {
          const spaced = p?.plate_spaced;
          if (!spaced) continue;

          const sumRow: PlateRow = {
            plateNumber: spaced,
            plateOrigin: getOriginFromPlate(spaced),
            expiryDate: p.expiry_human || "—",
            remaining: daysRemainingFromExpiry(p.expiry_human || undefined),
            timestamp: nowTimestamp(),
          };

          const prev = byPlate.get(spaced);
          byPlate.set(spaced, chooseBetter(prev, sumRow));
        }
      }

      const batch = Array.from(byPlate.values());
      if (batch.length) addMany(batch);
    } catch (err) {
      console.error(err);
      alert("Video processing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen max-h-screen overflow-y-auto w-full ${frames.length > 1 ? "p-4" : ""}`}>
      {/* Upload controls */}
      <div
        className={`w-fit mx-auto flex flex-col gap-y-2 ${
          frames.length > 1 ? "" : "min-h-screen items-center justify-center"
        }`}
      >
        <Input
          ref={inputRef}
          className="w-80 mb-1"
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div className="flex justify-around gap-2 w-full">
          <Button
            className={`flex-1 ${file ? "bg-black" : "disabled bg-black/50"}`}
            disabled={!file || loading}
            onClick={handleUpload}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Process Video
          </Button>
          <Button variant="secondary" className="flex-1" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mt-6">
          <h3 className="font-semibold text-center">Summary</h3>
          <div className="text-center">Total unique plates: {summary.unique_count}</div>
          <ul className="list-disc ml-6 mt-2">
            {summary.plates.map((p, i) => (
              <li key={i}>
                {p.plate_spaced} ({p.occurrences}×, best {p.best_conf.toFixed(2)}
                {p.expiry_human ? `, exp ${p.expiry_human}` : ""})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        {/* Frames */}
        {frames.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            {frames.map((f, i) => (
              <div key={i} className="border rounded p-2">
                <div className="font-medium">t = {f.t_sec}s</div>
                {f.preview_jpeg_base64 && (
                  <div className="relative mt-2 w-full h-auto aspect-video">
                    <Image
                      src={`data:image/jpeg;base64,${f.preview_jpeg_base64}`}
                      alt={`frame-${i}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="rounded object-contain"
                    />
                  </div>
                )}
                <pre className="text-xs mt-2 overflow-x-auto">{JSON.stringify(f.detections, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
