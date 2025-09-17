import { create } from "zustand";
import type { PlateRow } from "./plate";

const hasExpiry = (r?: PlateRow) => !!r && !!r.expiryDate && r.expiryDate !== "—";

// Prefer b over a if b has expiry and a doesn't; otherwise keep a
const chooseBetter = (a: PlateRow | undefined, b: PlateRow): PlateRow => {
  if (!a) return b;
  if (hasExpiry(b) && !hasExpiry(a)) return b;
  return a;
};

type DetectState = {
  results: PlateRow[];
  addMany: (rows: PlateRow[]) => void; // append/upgrade with de-dup
  clear: () => void;
};

export const useDetectStore = create<DetectState>((set, get) => ({
  results: [],
  addMany: (rows) => {
    const current = get().results;
    const map = new Map<string, PlateRow>();

    // seed with current results
    for (const r of current) {
      map.set(r.plateNumber, r);
    }

    // merge new rows with upgrade rule
    for (const r of rows) {
      const prev = map.get(r.plateNumber);
      map.set(r.plateNumber, chooseBetter(prev, r));
    }

    // newest first (prepend semantics)
    const next = Array.from(map.values()).reverse();
    set({ results: next });
  },
  clear: () => set({ results: [] }),
}));
