import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { trackId, session } = await req.json().catch(() => ({}));
  if (!trackId || typeof session !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("nb_fire_track", { p_track_id: trackId, p_session: session });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: data });
}
