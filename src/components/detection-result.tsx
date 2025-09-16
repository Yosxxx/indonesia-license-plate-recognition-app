"use client";
import { ChartColumnDecreasing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useDetectStore } from "@/lib/detectStore";
import { useMemo, useState } from "react";

export default function DetectionResult() {
  const results = useDetectStore((s) => s.results);
  const clear = useDetectStore((s) => s.clear);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return results;
    const needle = q.toLowerCase();
    return results.filter((r) => r.plateNumber.toLowerCase().includes(needle));
  }, [results, q]);

  return (
    <div className="h-screen flex flex-col border-l bg-white w-80 max-md:w-[90vw] items-center max-md:m-auto max-md:border-0 max-md:mt-3">
      {/* Header */}
      <div className="p-3 border-b flex items-center font-bold gap-x-2">
        <ChartColumnDecreasing />
        Detection Result
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-y-2 w-full">
        {filtered.map((plate) => (
          <div
            key={plate.plateNumber}
            className="border border-border/50 p-2 rounded-md bg-muted/50 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow transition-all hover:cursor-pointer"
          >
            <div className="font-bold">{plate.plateNumber}</div>
            <div className="text-muted-foreground text-sm">
              <div>Plate Origin: {plate.plateOrigin}</div>
              <div>Expiry Date: {plate.expiryDate}</div>
              <div>Remaining: {Number.isFinite(plate.remaining) ? `${plate.remaining} days` : "—"}</div>
            </div>
            <Separator className="my-1" />
            <div className="text-muted-foreground text-sm">{plate.timestamp}</div>
          </div>
        ))}

        {filtered.length === 0 && <div className="text-sm text-muted-foreground">No results.</div>}
      </div>

      {/* Footer */}
      <div className="p-5 border-t flex flex-col gap-2 justify-center items-center">
        <Input placeholder="Search plate..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2 w-full">
          {/* “Sync” button is optional; you’re already pushing on predict */}
          <Button
            className="flex-1"
            onClick={() => {
              /* optional re-fetch */
            }}
          >
            Sync
          </Button>
          <Button variant="secondary" className="flex-1" onClick={clear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
