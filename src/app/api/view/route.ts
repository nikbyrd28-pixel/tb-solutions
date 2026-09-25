import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { videoId, session } = await req.json().catch(() => ({}));
  if (!videoId) return NextResponse.json({ error: "videoId" }, { status: 400 });
  const sb = await supabaseServer();
  await sb.rpc("nb_increment_view", { p_video_id: videoId, p_session: session ?? "anon" });
  return NextResponse.json({ ok: true });
}
