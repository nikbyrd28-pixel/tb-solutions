"use client";
import { useEffect, useState } from "react";
import { Check, Send } from "lucide-react";

type Row = { email: string; artist: string; handle: string; city: string; link_url: string; note: string };
const QKEY = "nb_pending_submissions";
const empty: Row = { email: "", artist: "", handle: "", city: "", link_url: "", note: "" };

const readQ = (): Row[] => { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; } };
const writeQ = (q: Row[]) => { try { if (q.length) localStorage.setItem(QKEY, JSON.stringify(q)); else localStorage.removeItem(QKEY); } catch {} };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 'ok' | 'invalid' | 'failed' — retries network/server errors so a weak signal doesn't lose a submission. */
async function send(row: Row, tries = 4): Promise<"ok" | "invalid" | "failed"> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch("/api/slept-on/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(row), keepalive: true });
      if (r.ok) return "ok";
      if (r.status === 400) return "invalid";
    } catch {}
    if (i < tries - 1) await sleep(600 * 2 ** i);
  }
  return "failed";
}

export default function SubmitTrackForm() {
  const [f, setF] = useState<Row>(empty);
  const [state, setState] = useState<"idle" | "busy" | "done" | "queued" | "err">("idle");

  // resend anything that got stuck on a previous visit
  useEffect(() => {
    const flush = () => readQ().forEach(async (row) => {
      if ((await send(row, 2)) !== "failed") writeQ(readQ().filter((r) => r.link_url !== row.link_url));
    });
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const row = { ...f, email: f.email.trim().toLowerCase(), link_url: f.link_url.trim() };
    writeQ([...readQ().filter((r) => r.link_url !== row.link_url), row]);
    setState("busy");
    const res = await send(row);
    if (res === "failed") { setState("queued"); return; }
    writeQ(readQ().filter((r) => r.link_url !== row.link_url));
    setState(res === "ok" ? "done" : "err");
  }

  if (state === "done" || state === "queued")
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Check size={18} /></span>
        <div>
          <p className="font-semibold">{state === "done" ? "Got it. It's in the pile." : "Weak signal — saved on your phone."}</p>
          <p className="text-sm text-muted">{state === "done" ? "Every track gets a real listen. If it makes a drop, you'll hear from me." : "It'll finish sending automatically when you're back online."}</p>
          <button onClick={() => { setF(empty); setState("idle"); }} className="mt-2 text-sm font-semibold text-brand">Submit another</button>
        </div>
      </div>
    );

  const input = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus:border-brand";
  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input required maxLength={120} placeholder="Artist name" value={f.artist} onChange={(e) => setF({ ...f, artist: e.target.value })} className={input} />
        <input maxLength={80} placeholder="@handle (optional)" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} className={input} />
      </div>
      <input required type="url" maxLength={500} placeholder="Link to the track (SoundCloud, YouTube, Audiomack, Spotify)" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} className={input} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input required type="email" maxLength={254} autoCapitalize="off" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} />
        <input maxLength={80} placeholder="City / scene" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={input} />
      </div>
      <textarea maxLength={500} rows={2} placeholder="One line on the track (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={input} />
      <button disabled={state === "busy"} className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {state === "busy" ? "Sending…" : <>Submit track <Send size={16} /></>}
      </button>
      {state === "err" && <p className="text-sm text-brand-2">Check the link and email, then try again.</p>}
    </form>
  );
}
