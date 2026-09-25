import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { videoId, body, parentId } = await req.json().catch(() => ({}));
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  if (!body?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  const { data, error } = await sb
    .from("nb_comments")
    .insert({ video_id: videoId, user_id: user.id, body: body.trim(), parent_id: parentId ?? null })
    .select("*, nb_profiles(display_name, avatar_url)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
