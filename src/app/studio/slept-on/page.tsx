"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Disc3, Plus, Trash2, Eye, EyeOff, Check, X, ExternalLink } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dropLabel, isHttpUrl, type Drop, type Track, type Submission } from "@/lib/sleptOnShared";

const blankTrack = { title: "", artist: "", artist_url: "", city: "", link_url: "", cover_url: "", note: "", submission_id: "" };

export default function AdminSleptOn() {
  const sb = supabaseBrowser();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [active, setActive] = useState<Drop | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [t, setT] = useState(blankTrack);
  const [msg, setMsg] = useState("");

  const fetchDrops = useCallback(async () => {
    const { data, error } = await sb.from("nb_drops").select("*").order("number", { ascending: false });
    return { list: (data ?? []) as Drop[], error: error?.message };
  }, [sb]);
  const fetchTracks = useCallback(async (dropId: string) => {
    const { data } = await sb.from("nb_tracks").select("*").eq("drop_id", dropId).order("position");
    return (data ?? []) as Track[];
  }, [sb]);
  const fetchSubs = useCallback(async () => {
    const { data } = await sb.from("nb_submissions").select("*").eq("status", "new").order("created_at", { ascending: false }).limit(50);
    return (data ?? []) as Submission[];
  }, [sb]);

  const loadDrops = useCallback(() => fetchDrops().then(({ list, error }) => {
    if (error) return setMsg(error);
    setDrops(list);
    setActive((a) => list.find((d) => d.id === a?.id) ?? list[0] ?? null);
  }), [fetchDrops]);
  const loadTracks = useCallback((dropId: string) => fetchTracks(dropId).then(setTracks), [fetchTracks]);
  const loadSubs = useCallback(() => fetchSubs().then(setSubs), [fetchSubs]);

  useEffect(() => {
    let off = false;
    Promise.all([fetchDrops(), fetchSubs()]).then(([{ list, error }, s]) => {
      if (off) return;
      if (error) setMsg(error);
      setDrops(list); setActive((a) => a ?? list[0] ?? null); setSubs(s);
    });
    return () => { off = true; };
  }, [fetchDrops, fetchSubs]);

  const activeId = active?.id;
  useEffect(() => {
    let off = false;
    (activeId ? fetchTracks(activeId) : Promise.resolve([] as Track[])).then((list) => { if (!off) setTracks(list); });
    return () => { off = true; };
  }, [activeId, fetchTracks]);

  async function newDrop() {
    const number = (drops[0]?.number ?? 0) + 1;
    const { error } = await sb.from("nb_drops").insert({ number, title: `${dropLabel(number)}` });
    if (error) return setMsg(error.message);
    setMsg(`${dropLabel(number)} created as a draft.`);
    loadDrops();
  }

  async function saveDrop(patch: Partial<Drop>) {
    if (!active) return;
    const { error } = await sb.from("nb_drops").update(patch).eq("id", active.id);
    if (error) return setMsg(error.message);
    loadDrops();
  }

  async function addTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    if (!isHttpUrl(t.link_url)) return setMsg("Track link must start with http(s)://");
    const row = {
      drop_id: active.id, position: tracks.length + 1, title: t.title.trim(), artist: t.artist.trim(),
      artist_url: t.artist_url.trim() || null, city: t.city.trim() || null, link_url: t.link_url.trim(),
      cover_url: t.cover_url.trim() || null, note: t.note.trim() || null, submission_id: t.submission_id || null,
    };
    const { error } = await sb.from("nb_tracks").insert(row);
    if (error) return setMsg(error.message);
    if (t.submission_id) { await sb.from("nb_submissions").update({ status: "picked" }).eq("id", t.submission_id); loadSubs(); }
    setT(blankTrack); setMsg("Track added."); loadTracks(active.id);
  }

  async function removeTrack(id: string) {
    if (!active || !confirm("Remove this track from the drop?")) return;
    await sb.from("nb_tracks").delete().eq("id", id);
    loadTracks(active.id);
  }

  async function pass(id: string) {
    await sb.from("nb_submissions").update({ status: "pass" }).eq("id", id);
    loadSubs();
  }

  const pick = (s: Submission) => {
    setT({ ...blankTrack, artist: s.artist, city: s.city ?? "", link_url: s.link_url, note: s.note ?? "", submission_id: s.id,
      artist_url: s.handle ? `https://instagram.com/${s.handle.replace(/^@/, "")}` : "" });
    document.getElementById("track-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const input = "w-full rounded-xl border border-line bg-bg-2 px-3 py-2.5 outline-none focus:border-brand";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-black"><Disc3 className="text-brand" /> Slept On admin</h1>
        <Link href="/slept-on" className="text-sm text-muted hover:text-fg">View page →</Link>
      </div>
      {msg && <p className="mt-3 rounded-xl bg-bg-3 px-3 py-2 text-sm">{msg}</p>}

      {/* drops */}
      <section className="mt-6">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {drops.map((d) => (
            <button key={d.id} onClick={() => setActive(d)}
              className={`shrink-0 rounded-full px-3 py-1.5 font-mono text-xs ${active?.id === d.id ? "bg-brand text-white" : "border border-line text-muted"}`}>
              #{String(d.number).padStart(3, "0")} {d.status === "live" ? "● live" : "draft"}
            </button>
          ))}
          <button onClick={newDrop} className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:text-fg"><Plus size={14} /> New drop</button>
        </div>

        {active && (
          <div className="mt-4 rounded-2xl border border-line bg-bg-2 p-4">
            <div className="flex flex-col gap-2">
              <input key={`t${active.id}`} defaultValue={active.title ?? ""} placeholder="Drop title" className={input}
                onBlur={(e) => e.target.value !== (active.title ?? "") && saveDrop({ title: e.target.value })} />
              <textarea key={`b${active.id}`} defaultValue={active.blurb ?? ""} rows={2} placeholder="One line about this drop" className={input}
                onBlur={(e) => e.target.value !== (active.blurb ?? "") && saveDrop({ blurb: e.target.value })} />
            </div>
            <button onClick={() => saveDrop(active.status === "live" ? { status: "draft" } : { status: "live", published_at: active.published_at ?? new Date().toISOString() })}
              className={`mt-3 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${active.status === "live" ? "border border-line" : "bg-brand text-white"}`}>
              {active.status === "live" ? <><EyeOff size={16} /> Unpublish</> : <><Eye size={16} /> Publish {dropLabel(active.number)}</>}
            </button>

            <ol className="mt-4 flex flex-col gap-2">
              {tracks.map((tr, i) => (
                <li key={tr.id} className="flex items-center gap-3 rounded-xl bg-bg-3 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate"><b>{tr.title}</b> — {tr.artist}{tr.city && <span className="text-muted"> · {tr.city}</span>}</span>
                  <span className="text-xs text-muted">🔥 {tr.fire_count}</span>
                  <button onClick={() => removeTrack(tr.id)} aria-label="Remove" className="text-muted hover:text-brand-2"><Trash2 size={16} /></button>
                </li>
              ))}
              {tracks.length === 0 && <li className="text-sm text-muted">No tracks yet — add some below.</li>}
            </ol>
          </div>
        )}
        {drops.length === 0 && <p className="mt-4 text-sm text-muted">No drops yet. Hit <b>New drop</b> to start {dropLabel(1)}.</p>}
      </section>

      {/* add track */}
      {active && (
        <form id="track-form" onSubmit={addTrack} className="mt-8 flex scroll-mt-20 flex-col gap-2.5">
          <h2 className="font-bold">Add a track to {dropLabel(active.number)} {t.submission_id && <span className="text-xs text-brand">(from submission)</span>}</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input required placeholder="Track title" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} className={input} />
            <input required placeholder="Artist" value={t.artist} onChange={(e) => setT({ ...t, artist: e.target.value })} className={input} />
          </div>
          <input required type="url" placeholder="Track link (SoundCloud / YouTube / Audiomack / Spotify / mp3)" value={t.link_url} onChange={(e) => setT({ ...t, link_url: e.target.value })} className={input} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input placeholder="City / scene" value={t.city} onChange={(e) => setT({ ...t, city: e.target.value })} className={input} />
            <input type="url" placeholder="Artist profile link (optional)" value={t.artist_url} onChange={(e) => setT({ ...t, artist_url: e.target.value })} className={input} />
          </div>
          <input type="url" placeholder="Cover image URL (optional)" value={t.cover_url} onChange={(e) => setT({ ...t, cover_url: e.target.value })} className={input} />
          <input placeholder="Why it made the drop (optional)" value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} className={input} />
          <div className="flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold text-white"><Plus size={16} /> Add track</button>
            {t !== blankTrack && <button type="button" onClick={() => setT(blankTrack)} className="rounded-full border border-line px-4">Clear</button>}
          </div>
        </form>
      )}

      {/* submissions */}
      <section className="mt-10">
        <h2 className="font-bold">Artist submissions <span className="text-sm font-normal text-muted">({subs.length} new)</span></h2>
        <ul className="mt-3 flex flex-col gap-2">
          {subs.map((s) => (
            <li key={s.id} className="rounded-xl border border-line bg-bg-2 p-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.artist} {s.handle && <span className="font-normal text-muted">{s.handle}</span>} {s.city && <span className="font-normal text-muted">· {s.city}</span>}</p>
                  <a href={s.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-brand"><ExternalLink size={12} /> {s.link_url}</a>
                  {s.note && <p className="mt-1 text-muted">{s.note}</p>}
                  <p className="mt-1 text-xs text-muted">{s.email}</p>
                </div>
                {active && <button onClick={() => pick(s)} title="Add to drop" className="rounded-full bg-brand p-2 text-white"><Check size={16} /></button>}
                <button onClick={() => pass(s.id)} title="Pass" className="rounded-full border border-line p-2 text-muted"><X size={16} /></button>
              </div>
            </li>
          ))}
          {subs.length === 0 && <li className="text-sm text-muted">Nothing new. Share <b>/slept-on#submit</b> with artists.</li>}
        </ul>
      </section>
    </main>
  );
}
