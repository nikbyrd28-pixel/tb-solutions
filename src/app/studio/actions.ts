"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer, isAdminEmail } from "@/lib/supabase/server";

async function admin() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!isAdminEmail(user?.email)) throw new Error("forbidden");
  return { sb, user: user! };
}
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
const tags = (s: FormDataEntryValue | null) => String(s ?? "").split(",").map((t) => t.trim()).filter(Boolean);

export async function createVideo(fd: FormData) {
  const { sb } = await admin();
  const title = String(fd.get("title") ?? "").trim();
  const video_url = String(fd.get("video_url") ?? "").trim();
  if (!title || !video_url) throw new Error("title and video required");
  const { data, error } = await sb.from("nb_videos").insert({
    slug: slugify(String(fd.get("slug") || title)), title,
    description: String(fd.get("description") ?? "") || null,
    kind: fd.get("kind") === "short" ? "short" : "long",
    video_url, thumbnail_url: String(fd.get("thumbnail_url") ?? "") || null,
    duration_seconds: Number(fd.get("duration_seconds")) || null,
    visibility: String(fd.get("visibility") ?? "public"), min_tier: String(fd.get("min_tier") ?? "free"),
    tags: tags(fd.get("tags")),
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/"); revalidatePath("/feed"); revalidatePath("/studio/videos");
  redirect(`/studio/videos/${data.id}`);
}

export async function updateVideo(id: string, fd: FormData) {
  const { sb } = await admin();
  const { error } = await sb.from("nb_videos").update({
    title: String(fd.get("title") ?? "").trim(), slug: slugify(String(fd.get("slug") ?? "")),
    description: String(fd.get("description") ?? "") || null,
    kind: fd.get("kind") === "short" ? "short" : "long",
    thumbnail_url: String(fd.get("thumbnail_url") ?? "") || null,
    visibility: String(fd.get("visibility") ?? "public"), min_tier: String(fd.get("min_tier") ?? "free"),
    tags: tags(fd.get("tags")),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/"); revalidatePath("/feed"); revalidatePath(`/studio/videos/${id}`); revalidatePath("/studio/videos");
}

export async function setVisibility(id: string, visibility: string) {
  const { sb } = await admin();
  await sb.from("nb_videos").update({ visibility }).eq("id", id);
  revalidatePath("/"); revalidatePath("/feed"); revalidatePath("/studio/videos");
}

export async function deleteVideo(id: string) {
  const { sb } = await admin();
  await sb.from("nb_videos").delete().eq("id", id);
  revalidatePath("/"); revalidatePath("/feed"); revalidatePath("/studio/videos");
  redirect("/studio/videos");
}

export async function deleteLead(id: string) {
  const { sb } = await admin();
  await sb.from("nb_leads").delete().eq("id", id);
  revalidatePath("/studio/leads");
}

export async function setTier(userId: string, tier: string) {
  const { sb } = await admin();
  await sb.from("nb_profiles").update({ tier }).eq("id", userId);
  revalidatePath("/studio/members");
}

export async function createPost(fd: FormData) {
  const { sb, user } = await admin();
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return;
  await sb.from("nb_posts").insert({ user_id: user.id, body, image_url: String(fd.get("image_url") ?? "") || null, min_tier: String(fd.get("min_tier") ?? "free") });
  revalidatePath("/community"); revalidatePath("/studio/posts");
}

export async function deletePost(id: string) {
  const { sb } = await admin();
  await sb.from("nb_posts").delete().eq("id", id);
  revalidatePath("/community"); revalidatePath("/studio/posts");
}
