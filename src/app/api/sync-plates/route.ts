// src/app/api/sync-plates/route.ts
import { NextResponse } from "next/server";
import { SupabaseClient } from "@/lib/supabase";

// "05-21" => "2021-05-01" (YYYY-MM-DD)
function parseExpiry(mmDashYY: string | null | undefined): string | "" {
  if (!mmDashYY) return "";
  const m = mmDashYY.match(/^(\d{2})-(\d{2})$/);
  if (!m) return "";
  const month = Number(m[1]); // 01..12
  const year = 2000 + Number(m[2]); // 21 -> 2021
  if (month < 1 || month > 12) return "";
  // day is ALWAYS 1 as per your rule
  return `${year.toString().padStart(4, "0")}-${m[1]}-01`;
}

// "16-09-2025 | 13:15:42" (Asia/Jakarta local) -> ISO
function parseDetectedAt(ddMMyyyy_bar_time: string): string {
  // dd-MM-yyyy | HH:mm:ss
  const m = ddMMyyyy_bar_time.match(/^(\d{2})-(\d{2})-(\d{4})\s*\|\s*(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date().toISOString();
  const [, dd, MM, yyyy, HH, mm, ss] = m;
  // interpret as Asia/Jakarta (UTC+7)
  const iso = new Date(
    Date.UTC(
      Number(yyyy),
      Number(MM) - 1,
      Number(dd),
      Number(HH) - 7, // shift to UTC
      Number(mm),
      Number(ss)
    )
  ).toISOString();
  return iso;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Array<{
      plateNumber: string;
      expiryDate: string | null;
      timestamp: string;
    }>;

    // shape to the RPC payload
    const rows = body.map((p) => ({
      plate_number: p.plateNumber.trim(),
      exp_date: parseExpiry(p.expiryDate),
      detected_at: parseDetectedAt(p.timestamp),
    }));

    const supabase = SupabaseClient();
    const { error } = await supabase.rpc("sync_plates", { rows });

    if (error) {
      console.error(error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
