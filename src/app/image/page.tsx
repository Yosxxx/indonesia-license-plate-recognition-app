"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileJson2, ScrollText, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRef, useState } from "react";
import { Client } from "@gradio/client";
import Image from "next/image";

type DetailView = "General" | "JSON";
type GradioFileData = {
  url?: string;
  path?: string;
  name?: string | null;
  size?: number | null;
  meta?: any;
};

export default function UploadImagePage() {
  const [details, setDetails] = useState<DetailView>("General");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [detections, setDetections] = useState<any[] | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setFile(null);
    setDetections(null);
    setAnnotatedUrl(null);
    setDetails("General");
    if (inputRef.current) inputRef.current.value = "";
  };

  const predict = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const client = await Client.connect("z6k/indonesia-license-plate-recognition");
      // Blocks endpoint with 1 image input and 2 outputs: [annotated_img, json]
      const res = await client.predict("/predict", [file]);

      const img: GradioFileData | null = (res.data?.[0] as any) ?? null;
      const json = (res.data?.[1] as any[]) ?? null;

      setAnnotatedUrl(img?.url ?? null);
      setDetections(json);
      console.log(detections);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // convenience helpers (first detection)
  const first = detections?.[0];
  const plateSpaced: string | undefined = first?.ocr?.plate_spaced ?? first?.ocr?.canon;
  const expiryHuman: string | undefined = first?.expiry?.human;

  return (
    <div className="flex min-h-screen justify-center items-center flex-col max-h-screen gap-y-5">
      {/* Upload Section */}
      <div className="w-fit flex flex-col gap-y-2">
        <Input
          ref={inputRef}
          className="w-80 mb-1"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex justify-around gap-2">
          <Button
            className={`flex-1 ${file ? "bg-black" : "disabled bg-black/50"}`}
            disabled={!file || loading}
            onClick={predict}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyze
          </Button>
          <Button variant="secondary" className="flex-1" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Preview & Details */}
      {annotatedUrl && detections && (
        <div className="mt-4">
          <div className="flex gap-x-5">
            {/* Annotated image */}
            <div className="h-[300px] w-[400px] bg-muted flex items-center justify-center rounded overflow-hidden">
              <Image src={annotatedUrl} alt="Annotated result" width={400} height={300} unoptimized />
            </div>
          </div>

          {/* Toggle Buttons */}
          <div>
            <div className="flex gap-x-2 w-80 m-auto mt-5">
              <Button
                className={`flex-1 ${details === "General" ? "bg-primary text-white" : "bg-white text-black"}`}
                onClick={() => setDetails("General")}
              >
                <ScrollText className="mr-2 h-4 w-4" />
                General
              </Button>
              <Button
                className={`flex-1 ${details === "JSON" ? "bg-primary text-white" : "bg-white text-black"}`}
                onClick={() => setDetails("JSON")}
              >
                <FileJson2 className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>

          {/* Conditional Content */}
          <div className="flex justify-center mt-5">
            {details === "General" && (
              <div className="border-2 w-fit rounded-md">
                <Separator className="mt-4" />
                <div className="p-4 text-center">
                  <div className="font-bold text-2xl">{plateSpaced ?? "—"}</div>
                  <div className="text-lg">{expiryHuman ?? "—"}</div>
                </div>
                <Separator className="mb-4" />
              </div>
            )}

            {details === "JSON" && (
              <div className="border-2 w-80 rounded-md h-60 p-4 overflow-auto overflow-y-auto">
                <pre className="text-sm">{JSON.stringify(detections, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
