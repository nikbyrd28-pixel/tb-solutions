import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin, isAdminEmail } from "@/lib/supabase/server";

/** Create a video row. Files are uploaded straight to Supabase Storage from the browser. */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json();
  const slug = (b.slug || b.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
  if (!slug || !b.video_url) return NextResponse.json({ error: "title and video required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin.from("nb_videos").insert({
    slug, title: b.title, description: b.description ?? null, kind: b.kind === "short" ? "short" : "long",
    video_url: b.video_url, thumbnail_url: b.thumbnail_url ?? null, duration_seconds: b.duration_seconds ?? null,
    visibility: b.visibility ?? "public", min_tier: b.min_tier ?? "free",
    tags: (b.tags ?? "").split(",").map((t: string) => t.trim()).filter(Boolean),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
