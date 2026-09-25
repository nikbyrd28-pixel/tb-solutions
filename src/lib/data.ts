import { supabaseServer } from "./supabase/server";
import type { Video, Comment, Profile } from "./types";

export async function getVideos(kind?: "long" | "short", limit = 24): Promise<Video[]> {
  const sb = await supabaseServer();
  let q = sb
    .from("nb_videos")
    .select("*")
    .in("visibility", ["public", "members"])
    .order("published_at", { ascending: false })
    .limit(limit);
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;
  return (data ?? []) as Video[];
}

export async function getVideo(slug: string): Promise<Video | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("nb_videos").select("*").eq("slug", slug).maybeSingle();
  return (data as Video) ?? null;
}

export async function getComments(videoId: string): Promise<Comment[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("nb_comments")
    .select("*, nb_profiles(display_name, avatar_url)")
    .eq("video_id", videoId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Comment[];
}

export async function getSession() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const user = data.user ?? null;
  let profile: Profile | null = null;
  if (user) {
    const { data: p } = await sb.from("nb_profiles").select("*").eq("id", user.id).maybeSingle();
    profile = (p as Profile) ?? null;
  }
  return { user, profile };
}

export { fmtViews, fmtDuration, timeAgo } from "./format";
