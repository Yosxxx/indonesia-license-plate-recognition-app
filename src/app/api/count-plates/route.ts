import { NextResponse } from "next/server";
import { SupabaseClient } from "@/lib/supabase";

export async function GET() {
  const supabase = SupabaseClient();

  // Ask for exact count without fetching rows
  const { count, error } = await supabase.from("plates").select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: count ?? 0 });
}
