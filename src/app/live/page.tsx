"use client";
import { useEffect, useRef, useState } from "react";
import { useDetectStore } from "@/lib/detectStore";
import { getOriginFromPlate, daysRemainingFromExpiry, nowTimestamp, type PlateRow } from "@/lib/plate";

type Facing = "environment" | "user";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export default function LivePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<Facing>("environment"); // NEW
  const addMany = useDetectStore((s) => s.addMany);

  // Helper to stop current stream
  const stopStream = () => {
    const v = videoRef.current;
    const src = v?.srcObject as MediaStream | null;
    src?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  };

  // Helper to (re)start stream with a given facing
  const startStream = async (facing: Facing) => {
    // iOS requires HTTPS; assume you’re already on HTTPS now
    const constraints: MediaStreamConstraints = {
      video: {
        // First try exact (some browsers support), then fall back to ideal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        facingMode: { exact: facing } as any,
      },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) videoRef.current.srcObject = stream;
      return;
    } catch {
      // Fallback: use "ideal" (broader)
      const fallback: MediaStreamConstraints = { video: { facingMode: facing }, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(fallback);
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
  };

  // Open/close webcam (and restart when facing changes)
  useEffect(() => {
    if (!running) return;
    (async () => {
      stopStream();
      try {
        await startStream(cameraFacing);
      } catch (err) {
        console.error("getUserMedia failed:", err);
        alert("Camera access failed. Ensure HTTPS and camera permissions are allowed.");
      }
    })();

    return stopStream;
  }, [running, cameraFacing]); // <-- restart when facing changes

  // Robust 1 FPS capture + upload (unchanged except refs)
  useEffect(() => {
    if (!running) return;

    let inflight = false;
    let stopped = false;

    const ensureReady = async () => {
      const v = videoRef.current!;
      if (v.readyState < 2) {
        await new Promise<void>((resolve) => {
          const onMeta = () => {
            v.removeEventListener("loadedmetadata", onMeta);
            resolve();
          };
          v.addEventListener("loadedmetadata", onMeta, { once: true });
        });
      }
    };

    const canvasToJpegBlob = async (canvas: HTMLCanvasElement, quality = 0.8): Promise<Blob> => {
      if (canvas.width === 0 || canvas.height === 0) throw new Error("canvas has zero size");
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
      if (blob) return blob;
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const res = await fetch(dataUrl);
      return await res.blob();
    };

    const tick = async () => {
      if (stopped || inflight) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        inflight = true;
        await ensureReady();

        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error("video not ready");

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);

        const blob = await canvasToJpegBlob(canvas, 0.8);

        const form = new FormData();
        form.append("file", blob, "frame.jpg");

        const res = await fetch("/api/predict/frame", { method: "POST", body: form });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`frame prediction failed (${res.status}) ${txt}`);
        }

        const data = await res.json();
        const batch: PlateRow[] = [];
        const seen = new Set<string>();

        for (const det of data.detections || []) {
          const row = detToPlateRow(det);
          if (!row) continue;
          if (seen.has(row.plateNumber)) continue;
          seen.add(row.plateNumber);
          batch.push(row);
        }
        if (batch.length) addMany(batch);
      } catch (e) {
        console.error(e);
      } finally {
        inflight = false;
      }
    };

    const id = setInterval(tick, 1000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [running, addMany]);

  return (
    <div className="p-4 flex flex-col min-h-screen justify-center items-center">
      <h2 className="text-xl font-bold mb-2">Live Recognition</h2>

      {/* Mirror preview when using front camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-[50vw] border rounded max-md:w-[90vw]"
        style={{ transform: cameraFacing === "user" ? "scaleX(-1)" : "none" }}
        // If you also want the captured frame mirrored when on front camera,
        // draw the canvas mirrored too (optional).
      />

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-2 flex gap-2">
        <button onClick={() => setRunning((r) => !r)} className="px-3 py-2 border rounded">
          {running ? "Stop" : "Start Live"}
        </button>

        {/* ROTATE button */}
        <button
          onClick={() => setCameraFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="px-3 py-2 border rounded"
          disabled={!running}
          title="Switch front/back camera"
        >
          Rotate
        </button>
      </div>
    </div>
  );
}
