import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, ExternalLink, Eye, Heart, MessageSquare } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtViews, timeAgo } from "@/lib/format";
import type { Video } from "@/lib/types";
import { updateVideo, deleteVideo } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditVideo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const [{ data }, { count }] = await Promise.all([
    sb.from("nb_videos").select("*").eq("id", id).maybeSingle(),
    sb.from("nb_comments").select("id", { count: "exact", head: true }).eq("video_id", id),
  ]);
  const v = data as Video | null;
  if (!v) notFound();
  const input = "input w-full rounded-xl px-3.5 py-2.5 text-sm";
  const update = updateVideo.bind(null, v.id);
  const del = deleteVideo.bind(null, v.id);

  return (
    <div className="fade-up mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand"><Link href="/studio/videos" className="hover:underline">Videos</Link> / edit</p><h1 className="font-display mt-1 line-clamp-1 text-3xl font-800">{v.title}</h1></div>
        <Link href={`/watch/${v.slug}`} className="btn btn-ghost h-9 px-3 text-sm"><ExternalLink size={14} /> View</Link>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[[Eye, fmtViews(v.view_count), "views"], [Heart, fmtViews(v.like_count), "likes"], [MessageSquare, String(count ?? 0), "comments"]].map(([I, n, l]) => {
          const Icon = I as typeof Eye;
          return <div key={l as string} className="card flex items-center gap-3 rounded-2xl px-4 py-3"><Icon size={16} className="text-muted" /><div><p className="font-display text-lg font-700 leading-none">{n as string}</p><p className="text-[11px] uppercase tracking-wider text-muted">{l as string}</p></div></div>;
        })}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[240px_1fr]">
        <div className="card overflow-hidden rounded-2xl">
          <div className="aspect-video bg-bg-3">{/* eslint-disable-next-line @next/next/no-img-element */}{v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />}</div>
          <div className="p-3 text-xs text-muted">Published {timeAgo(v.published_at)}<br /><a href={v.video_url} className="truncate text-brand hover:underline" target="_blank">source file ↗</a></div>
        </div>

        <form action={update} className="card flex flex-col gap-4 rounded-2xl p-5">
          <input name="title" defaultValue={v.title} required className={input} />
          <label className="text-xs text-muted">Slug<input name="slug" defaultValue={v.slug} className={`${input} mt-1`} /></label>
          <textarea name="description" rows={4} defaultValue={v.description ?? ""} className={input} />
          <input name="tags" defaultValue={v.tags.join(", ")} placeholder="tags" className={input} />
          <label className="text-xs text-muted">Thumbnail URL<input name="thumbnail_url" defaultValue={v.thumbnail_url ?? ""} className={`${input} mt-1`} /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-muted">Type<select name="kind" defaultValue={v.kind} className={`${input} mt-1`}><option value="long">Long</option><option value="short">Short</option></select></label>
            <label className="text-xs text-muted">Status<select name="visibility" defaultValue={v.visibility} className={`${input} mt-1`}>{["public", "members", "unlisted", "draft"].map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="text-xs text-muted">Access<select name="min_tier" defaultValue={v.min_tier} className={`${input} mt-1`}><option value="free">Free</option><option value="inner_circle">Inner Circle</option><option value="day_one">Day One</option></select></label>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button formAction={del} className="flex items-center gap-1.5 text-sm text-brand-2 hover:underline"><Trash2 size={14} /> Delete</button>
            <button className="btn btn-primary h-10 px-5 text-sm">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
