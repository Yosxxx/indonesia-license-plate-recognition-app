// lib/detectStore.ts
import { create } from "zustand";
import type { PlateRow } from "./plate";

type DetectState = {
  results: PlateRow[];
  addMany: (rows: PlateRow[]) => void; // append with de-dup
  clear: () => void;
};

export const useDetectStore = create<DetectState>((set, get) => ({
  results: [],
  addMany: (rows) => {
    const current = get().results;
    const seen = new Set(current.map((r) => r.plateNumber));
    const dedupedToAdd: PlateRow[] = [];

    for (const r of rows) {
      if (!seen.has(r.plateNumber)) {
        dedupedToAdd.push(r);
        seen.add(r.plateNumber);
      }
    }

    // Newest first (prepend), keep list reasonably small if you want
    const next = [...dedupedToAdd, ...current];
    set({ results: next });
  },
  clear: () => set({ results: [] }),
}));
