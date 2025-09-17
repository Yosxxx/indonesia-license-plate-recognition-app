"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { DataTable } from "./data-table";
import { columns, type DisplayRow } from "./columns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getOriginFromPlate } from "@/lib/plate";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const PAGE_SIZE = 15;

// Days remaining to the end of the expiry month (local/WIB)
function daysRemainingFromISO(expISO: string | null | undefined): number | null {
  if (!expISO) return null;
  const d = new Date(expISO); // stored as YYYY-MM-01
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  const endOfMonth = new Date(y, m + 1, 0);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((endOfMonth.getTime() - startOfToday.getTime()) / 86400000);
}

export default function DatabasePage() {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  async function fetchPage(opts?: { search?: string; page?: number }) {
    const search = (opts?.search ?? q).trim();
    const p = Math.max(1, opts?.page ?? page);
    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    setLoading(true);

    let query = supabase
      .from("plates")
      .select("id, plate_number, exp_date, detected_at, created_at", {
        count: "exact",
      })
      .order("detected_at", { ascending: false })
      .range(from, to);

    if (search) query = query.ilike("plate_number", `%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      console.error(error);
      setRows([]);
      setTotal(0);
    } else {
      const enriched: DisplayRow[] = (data ?? []).map((r) => {
        const expISO = r.exp_date ?? null;
        const remaining = daysRemainingFromISO(expISO);

        const status: DisplayRow["status"] =
          expISO === null ? "Unknown" : remaining !== null && remaining <= 0 ? "Expired" : "Active";

        return {
          id: String(r.id),
          plate_number: r.plate_number,
          exp_date: expISO, // can be null
          detected_at: r.detected_at,
          created_at: r.created_at,
          plate_origin: getOriginFromPlate(r.plate_number),
          remaining,
          status,
        };
      });

      setRows(enriched);
      setTotal(count ?? 0);
      setPage(p);
    }
    setLoading(false);
  }

  // initial load
  useEffect(() => {
    fetchPage({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPage({ search: q, page: 1 });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="container mx-auto p-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Database</h1>
        <div className="flex gap-2">
          <Input placeholder="Search plate number…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button onClick={() => fetchPage({ search: q, page: 1 })} disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </Button>
          <Button variant="secondary" onClick={() => fetchPage()}>
            Refresh
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={rows} />

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages} • {total} total
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => fetchPage({ search: q, page: page - 1 })}
            disabled={loading || page <= 1}
          >
            Prev
          </Button>
          <Button onClick={() => fetchPage({ search: q, page: page + 1 })} disabled={loading || page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
