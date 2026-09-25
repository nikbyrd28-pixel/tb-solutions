"use client";
import { useState } from "react";
import Link from "next/link";
import type { Comment } from "@/lib/types";
import { timeAgo } from "@/lib/format";

export default function Comments({ videoId, initial, loggedIn }: { videoId: string; initial: Comment[]; loggedIn: boolean }) {
  const [list, setList] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const r = await fetch("/api/comment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ videoId, body }) });
    if (r.ok) { setList([...list, await r.json()]); setBody(""); }
    setBusy(false);
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-bold">{list.length} comments</h2>
      {loggedIn ? (
        <form onSubmit={post} className="mb-5 flex gap-2">
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say something…" maxLength={2000}
            className="flex-1 rounded-full border border-line bg-bg-2 px-4 py-2.5 outline-none focus:border-brand" />
          <button disabled={busy} className="rounded-full bg-fg px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60">Post</button>
        </form>
      ) : (
        <p className="mb-5 text-sm text-muted"><Link href="/login" className="text-brand">Sign in</Link> to comment.</p>
      )}
      <ul className="flex flex-col gap-4">
        {list.map((c) => (
          <li key={c.id} className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-bg-3" style={c.nb_profiles?.avatar_url ? { backgroundImage: `url(${c.nb_profiles.avatar_url})`, backgroundSize: "cover" } : {}} />
            <div>
              <p className="text-xs text-muted"><span className="font-semibold text-fg">{c.nb_profiles?.display_name ?? "fan"}</span> · {timeAgo(c.created_at)}</p>
              <p className="mt-0.5 text-sm">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
