"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Volume2, VolumeX, MessageCircle, Sparkles } from "lucide-react";
import type { Video } from "@/lib/types";
import Engagement from "./Engagement";
import LeadForm from "./LeadForm";

const HOOK_AFTER = 3; // show the join card after this many swipes

export default function Feed({ videos, start, loggedIn }: { videos: Video[]; start: number; loggedIn: boolean }) {
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(Math.min(start, Math.max(videos.length - 1, 0)));
  const [hooked, setHooked] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);

  // items = videos with a hook card spliced in at HOOK_AFTER
  const items: (Video | "hook")[] = [...videos];
  if (videos.length > HOOK_AFTER && !hooked) items.splice(HOOK_AFTER, 0, "hook");

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.children[active]?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        const i = Number((e.target as HTMLElement).dataset.i);
        if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(i);
      }),
      { root: el, threshold: [0.6] },
    );
    Array.from(el.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [items.length]);

  useEffect(() => {
    vids.current.forEach((v, i) => {
      if (!v) return;
      v.muted = muted;
      if (i === active) v.play().catch(() => {}); else { v.pause(); v.currentTime = 0; }
    });
  }, [active, muted]);

  if (videos.length === 0)
    return <main className="flex h-dvh items-center justify-center text-muted">No shorts yet. Upload one from /admin/upload.</main>;

  return (
    <main className="relative h-dvh bg-black">
      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
        <Link href="/" className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur"><ArrowLeft size={20} /></Link>
        <p className="font-display font-800 tracking-tight">CHAOS <span className="gradient-text">FEED</span></p>
        <button onClick={() => setMuted((m) => !m)} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur">
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      <div ref={container} className="snap-feed no-scrollbar h-full overflow-y-scroll">
        {items.map((it, i) =>
          it === "hook" ? (
            <section key="hook" data-i={i} className="snap-item relative flex h-dvh items-center justify-center p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/40 via-bg to-brand-2/30" />
              <div className="gborder glass relative w-full max-w-sm rounded-3xl p-6 glow fade-up">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 px-2.5 py-1 text-xs font-semibold text-brand"><Sparkles size={12} /> quick one</span>
                <h2 className="font-display mt-3 text-2xl font-800 leading-tight">You&apos;ve seen 3. There&apos;s way more I can&apos;t post on TikTok.</h2>
                <p className="mt-2 text-sm text-muted">Drop your email and I&apos;ll send the uncut stuff straight to you. No algorithm in the way.</p>
                <div className="mt-4"><LeadForm source="feed" compact onDone={() => setTimeout(() => setHooked(true), 1200)} /></div>
                <button onClick={() => setHooked(true)} className="mt-3 w-full text-xs text-muted hover:text-fg">keep swiping →</button>
              </div>
            </section>
          ) : (
            <section key={it.id} data-i={i} className="snap-item relative h-dvh">
              <video
                ref={(el) => { vids.current[i] = el; }}
                src={it.video_url} poster={it.thumbnail_url ?? undefined}
                loop playsInline muted preload={Math.abs(i - active) <= 1 ? "auto" : "none"}
                onClick={(e) => { const v = e.currentTarget; v.paused ? v.play() : v.pause(); }}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pb-8 pr-20">
                <p className="flex items-center gap-2 font-bold"><span className="h-7 w-7 rounded-full bg-gradient-to-br from-brand via-brand-2 to-brand-3 p-[2px]"><span className="block h-full w-full rounded-full bg-black" /></span>@nickbyrd</p>
                <p className="mt-1 line-clamp-2 text-sm">{it.title}</p>
                {it.tags.length > 0 && <p className="mt-1 text-xs text-brand">{it.tags.map((t) => `#${t}`).join(" ")}</p>}
              </div>
              <div className="absolute bottom-10 right-3 z-10 flex flex-col items-center gap-5">
                <Engagement videoId={it.id} likes={it.like_count} slug={it.slug} loggedIn={loggedIn} vertical />
                <Link href={`/watch/${it.slug}`} className="flex flex-col items-center gap-1 text-xs">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur-md"><MessageCircle size={26} /></span>
                  Comments
                </Link>
                <Link href="/join" className="flex flex-col items-center gap-1 text-xs">
                  <span className="btn btn-primary h-12 w-12 rounded-full"><Sparkles size={22} /></span>
                  Join
                </Link>
              </div>
            </section>
          ),
        )}
      </div>
    </main>
  );
}
