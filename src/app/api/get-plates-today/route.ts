import { NextResponse } from "next/server";
import { SupabaseClient } from "@/lib/supabase";

function isoBoundsForTodayInTZ(tz = "Asia/Jakarta") {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;

  // WIB is UTC+07:00
  const start = new Date(`${y}-${m}-${d}T00:00:00+07:00`).toISOString();
  const end = new Date(`${y}-${m}-${d}T24:00:00+07:00`).toISOString();
  return { start, end };
}

export async function GET() {
  const supabase = SupabaseClient();
  const { start, end } = isoBoundsForTodayInTZ("Asia/Jakarta");

  const { data, error } = await supabase
    .from("plates")
    .select("*")
    .gte("detected_at", start)
    .lt("detected_at", end)
    .order("detected_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}
