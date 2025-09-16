"use client";

import { ColumnDef } from "@tanstack/react-table";

export type DisplayRow = {
  id: string;
  plate_number: string;
  exp_date: string | null;
  detected_at: string;
  created_at: string;
  plate_origin: string;
  remaining: number | null;
  status: string; // "Active" | "Expired"
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
};

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(dt);
};

export const columns: ColumnDef<DisplayRow>[] = [
  { accessorKey: "plate_number", header: "Plate Number" },
  { accessorKey: "plate_origin", header: "Origin" },
  {
    accessorKey: "exp_date",
    header: "Expiry Date",
    cell: ({ row }) => fmtDate(row.original.exp_date),
  },
  {
    accessorKey: "remaining",
    header: "Remaining",
    cell: ({ row }) => (Number.isFinite(row.original.remaining) ? `${row.original.remaining} days` : "—"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.status === "Expired" ? (
        <span className="text-red-600 font-semibold">Expired</span>
      ) : (
        <span className="text-green-600 font-semibold">Active</span>
      ),
  },
  {
    accessorKey: "detected_at",
    header: "Detected At",
    cell: ({ row }) => fmtDateTime(row.original.detected_at),
  },
];
