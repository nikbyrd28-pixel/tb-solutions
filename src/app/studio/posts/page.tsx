import { Trash2, Lock } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { createPost, deletePost } from "../actions";

export const dynamic = "force-dynamic";

export default async function Posts() {
  const sb = await supabaseServer();
  const { data } = await sb.from("nb_posts").select("*").order("created_at", { ascending: false }).limit(100);
  const posts = data ?? [];
  const input = "input w-full rounded-xl px-3.5 py-2.5 text-sm";

  return (
    <div className="fade-up mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Studio</p>
      <h1 className="font-display mt-1 text-3xl font-800">Community</h1>

      <form action={createPost} className="card mt-5 flex flex-col gap-3 rounded-2xl p-5">
        <textarea name="body" rows={4} required placeholder="Post something for the community…" className={input} />
        <input name="image_url" placeholder="Image URL (optional)" className={input} />
        <div className="flex items-center justify-between">
          <select name="min_tier" defaultValue="free" className="input rounded-lg px-3 py-2 text-sm"><option value="free">Everyone</option><option value="inner_circle">Inner Circle+</option><option value="day_one">Day One only</option></select>
          <button className="btn btn-primary h-10 px-5 text-sm">Post</button>
        </div>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id} className="card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              {timeAgo(p.created_at)}
              {p.min_tier !== "free" && <span className="chip bg-brand/15 text-brand"><Lock size={10} /> {p.min_tier.replace("_", " ")}</span>}
              <form action={async () => { "use server"; await deletePost(p.id); }} className="ml-auto"><button className="text-muted hover:text-brand-2"><Trash2 size={14} /></button></form>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image_url && <img src={p.image_url} alt="" className="mt-3 max-h-72 rounded-xl object-cover" />}
          </li>
        ))}
        {posts.length === 0 && <li className="text-sm text-muted">No posts yet.</li>}
      </ul>
    </div>
  );
}
