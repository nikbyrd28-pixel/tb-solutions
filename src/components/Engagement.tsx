"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Share2, Check } from "lucide-react";
import { fmtViews } from "@/lib/format";

export default function Engagement({ videoId, likes, slug, loggedIn, vertical = false }:
  { videoId: string; likes: number; slug: string; loggedIn: boolean; vertical?: boolean }) {
  const router = useRouter();
  const [count, setCount] = useState(likes);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  async function like() {
    if (!loggedIn) return router.push(`/login?next=/watch/${slug}`);
    setLiked((l) => !l); setCount((c) => c + (liked ? -1 : 1));
    const r = await fetch("/api/like", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ videoId }) });
    if (!r.ok) { setLiked((l) => !l); setCount((c) => c + (liked ? 1 : -1)); }
  }
  async function share() {
    const url = `${location.origin}/watch/${slug}`;
    if (navigator.share) { try { await navigator.share({ url }); return; } catch {} }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const btn = vertical
    ? "flex flex-col items-center gap-1 text-xs"
    : "btn btn-ghost h-10 px-4 text-sm";
  const ico = vertical ? "flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10" : "";

  return (
    <div className={`flex ${vertical ? "flex-col gap-5" : "gap-2"}`}>
      <button onClick={like} className={btn}>
        <span className={ico}><Heart size={vertical ? 26 : 18} className={liked ? "fill-brand-2 text-brand-2" : ""} /></span>
        {fmtViews(count)}
      </button>
      <button onClick={share} className={btn}>
        <span className={ico}>{copied ? <Check size={vertical ? 26 : 18} /> : <Share2 size={vertical ? 26 : 18} />}</span>
        {copied ? "Copied" : "Share"}
      </button>
    </div>
  );
}
