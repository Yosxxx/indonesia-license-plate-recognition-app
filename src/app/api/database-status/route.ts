import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Light query: only ask for one row
    const { data, error } = await supabase.from("plates").select("id").limit(1);

    if (error) return NextResponse.json({ status: "offline" });

    // If Supabase responds (even with 0 rows), it’s online
    return NextResponse.json({ status: "online" });
  } catch {
    return NextResponse.json({ status: "offline" });
  }
}
