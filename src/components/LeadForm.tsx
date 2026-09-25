"use client";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export default function LeadForm({ source, compact = false, onDone }: { source: string; compact?: boolean; onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const utm: Record<string, string> = {};
    if (typeof window !== "undefined") new URLSearchParams(window.location.search).forEach((v, k) => { if (k.startsWith("utm_")) utm[k] = v; });
    const r = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name, source, utm }) });
    if (r.ok) { setState("done"); onDone?.(); } else setState("err");
  }

  if (state === "done")
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white"><Check size={18} /></span>
        <div><p className="font-semibold">You&apos;re in.</p><p className="text-sm text-muted">Check your inbox — first drop lands this week.</p></div>
      </div>
    );

  return (
    <form onSubmit={submit} className={`flex ${compact ? "flex-row" : "flex-col sm:flex-row"} gap-2`}>
      {!compact && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name"
          className="rounded-full border border-line bg-bg px-4 py-3 outline-none focus:border-brand sm:w-36" />
      )}
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
        className="flex-1 rounded-full border border-line bg-bg px-4 py-3 outline-none focus:border-brand" />
      <button disabled={state === "busy"} className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {state === "busy" ? "…" : <>Get in <ArrowRight size={16} /></>}
      </button>
      {state === "err" && <p className="text-sm text-brand-2">Something broke. Try again.</p>}
    </form>
  );
}
