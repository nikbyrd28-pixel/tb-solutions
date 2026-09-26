"use client";
import { useState, useSyncExternalStore } from "react";
import { Play, X, Flame, ExternalLink, MapPin } from "lucide-react";
import { toEmbed, type Track } from "@/lib/sleptOnShared";

function sessionId() {
  try {
    let s = localStorage.getItem("nb_sid");
    if (!s) { s = crypto.randomUUID(); localStorage.setItem("nb_sid", s); }
    return s;
  } catch { return "anon-" + Math.random().toString(36).slice(2, 12); }
}

export default function TrackRow({ t, index }: { t: Track; index: number }) {
  const [open, setOpen] = useState(false);
  const [fires, setFires] = useState(t.fire_count);
  const [justFired, setJustFired] = useState(false);
  const storedFire = useSyncExternalStore(
    () => () => {},
    () => { try { return localStorage.getItem(`nb_fire_${t.id}`) === "1"; } catch { return false; } },
    () => false,
  );
  const fired = justFired || storedFire;
  const embed = toEmbed(t.link_url);

  async function fire() {
    if (fired) return;
    setJustFired(true); setFires((n) => n + 1);
    try { localStorage.setItem(`nb_fire_${t.id}`, "1"); } catch {}
    const r = await fetch("/api/slept-on/fire", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId: t.id, session: sessionId() }),
    }).catch(() => null);
    if (r?.ok) { const { count } = await r.json(); if (typeof count === "number") setFires(count); }
  }

  return (
    <li className="rounded-2xl border border-line bg-bg-2 transition hover:border-brand/50">
      <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
        <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>

        <button onClick={() => (embed ? setOpen((o) => !o) : window.open(t.link_url, "_blank", "noopener"))}
          aria-label={open ? `Close ${t.title}` : `Play ${t.title}`}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bg-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {t.cover_url && <img src={t.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            {open ? <X size={20} /> : <Play size={20} fill="currentColor" />}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{t.title}</p>
          <p className="truncate text-sm text-muted">
            {t.artist_url ? <a href={t.artist_url} target="_blank" rel="noopener noreferrer" className="hover:text-fg">{t.artist}</a> : t.artist}
          </p>
          {t.city && <span className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted"><MapPin size={11} /> {t.city}</span>}
        </div>

        <button onClick={fire} aria-pressed={fired} aria-label="Fire"
          className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-xs font-semibold transition ${fired ? "text-brand-2" : "text-muted hover:text-fg"}`}>
          <Flame size={22} className={fired ? "fill-brand-2" : ""} />
          {fires}
        </button>
        <a href={t.link_url} target="_blank" rel="noopener noreferrer" aria-label="Open original" className="hidden shrink-0 p-2 text-muted hover:text-fg sm:block">
          <ExternalLink size={16} />
        </a>
      </div>

      {t.note && !open && <p className="px-4 pb-3 pl-[4.5rem] text-sm text-muted sm:pl-[5.5rem]">&ldquo;{t.note}&rdquo;</p>}

      {open && embed && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          {embed.kind === "audio" ? (
            <audio src={embed.src} controls autoPlay className="w-full" />
          ) : (
            <iframe src={embed.src} height={embed.height} className="w-full rounded-xl border-0"
              allow="autoplay; encrypted-media; clipboard-write" loading="lazy" title={`${t.title} by ${t.artist}`} />
          )}
        </div>
      )}
    </li>
  );
}
