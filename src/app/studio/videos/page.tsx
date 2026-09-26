import Link from "next/link";
import { Plus, Eye, Heart } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtViews, fmtDuration, timeAgo } from "@/lib/format";
import type { Video } from "@/lib/types";
import { setVisibility } from "../actions";

export const dynamic = "force-dynamic";

const vis: Record<string, string> = { public: "bg-emerald-500/15 text-emerald-400", members: "bg-brand/15 text-brand", unlisted: "bg-white/8 text-muted", draft: "bg-amber-500/15 text-amber-400" };

export default async function Videos() {
  const sb = await supabaseServer();
  const { data } = await sb.from("nb_videos").select("*").order("published_at", { ascending: false });
  const vids = (data ?? []) as Video[];

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Studio</p><h1 className="font-display mt-1 text-3xl font-800">Videos <span className="text-muted">{vids.length}</span></h1></div>
        <Link href="/studio/videos/new" className="btn btn-primary h-10 px-4 text-sm"><Plus size={15} /> New video</Link>
      </div>

      <div className="card mt-6 overflow-x-auto rounded-2xl">
        <table className="table w-full min-w-[720px]">
          <thead><tr><th>Video</th><th>Type</th><th>Status</th><th>Access</th><th className="text-right">Stats</th><th></th></tr></thead>
          <tbody>
            {vids.map((v) => (
              <tr key={v.id} className="hover:bg-white/[.02]">
                <td>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />}
                      {v.duration_seconds ? <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px]">{fmtDuration(v.duration_seconds)}</span> : null}
                    </div>
                    <div className="min-w-0"><Link href={`/studio/videos/${v.id}`} className="line-clamp-1 font-medium hover:underline">{v.title}</Link><p className="text-xs text-muted">/{v.slug} · {timeAgo(v.published_at)}</p></div>
                  </div>
                </td>
                <td><span className="chip bg-white/8">{v.kind === "short" ? "Short" : "Long"}</span></td>
                <td>
                  <form action={async (fd) => { "use server"; await setVisibility(v.id, String(fd.get("visibility"))); }}>
                    <select name="visibility" defaultValue={v.visibility} className={`chip cursor-pointer appearance-none border-0 ${vis[v.visibility]}`}>
                      {["public", "members", "unlisted", "draft"].map((o) => <option key={o} value={o} className="bg-bg text-fg">{o}</option>)}
                    </select>
                    <button className="ml-2 text-xs text-muted hover:text-fg">save</button>
                  </form>
                </td>
                <td className="text-muted">{v.min_tier.replace("_", " ")}</td>
                <td className="text-right tabular-nums text-muted"><span className="inline-flex items-center gap-1"><Eye size={13} /> {fmtViews(v.view_count)}</span><span className="ml-3 inline-flex items-center gap-1"><Heart size={13} /> {fmtViews(v.like_count)}</span></td>
                <td className="text-right"><Link href={`/watch/${v.slug}`} className="text-xs text-muted hover:text-fg">view</Link><Link href={`/studio/videos/${v.id}`} className="ml-3 text-xs text-brand hover:underline">edit</Link></td>
              </tr>
            ))}
            {vids.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted">No videos yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
