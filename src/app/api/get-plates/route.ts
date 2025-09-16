import { NextResponse } from "next/server";
import { SupabaseClient } from "@/lib/supabase";

export async function GET() {
  const supabase = SupabaseClient();
  const { data, error } = await supabase
    .from("plates")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(50); // adjust as needed

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}
