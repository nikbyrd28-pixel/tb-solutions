import Link from "next/link";
import { Lock, Play } from "lucide-react";
import type { Video } from "@/lib/types";
import { fmtDuration, fmtViews, timeAgo } from "@/lib/format";

export default function VideoCard({ v, compact = false, delay = 0 }: { v: Video; compact?: boolean; delay?: number }) {
  const locked = v.min_tier !== "free";
  return (
    <Link href={`/watch/${v.slug}`} className={`group fade-up ${compact ? "flex gap-3" : "block"}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={`card card-hover relative overflow-hidden rounded-2xl ${compact ? "aspect-video w-40 shrink-0" : "aspect-video w-full"}`}>
        {v.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" />
        ) : <div className="shimmer h-full w-full" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        {!compact && (
          <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 scale-75 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-xl transition group-hover:scale-100 group-hover:opacity-100">
            <Play size={18} fill="currentColor" className="ml-0.5" />
          </span>
        )}
        {v.duration_seconds ? <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur">{fmtDuration(v.duration_seconds)}</span> : null}
        {locked && <span className="chip absolute left-2 top-2 bg-brand text-white shadow-lg shadow-brand/40"><Lock size={10} /> Members</span>}
      </div>
      <div className={compact ? "min-w-0" : "mt-3 flex gap-3"}>
        {!compact && <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-brand via-brand-2 to-brand-3 p-[2px]"><div className="h-full w-full rounded-full bg-bg" /></div>}
        <div className="min-w-0">
          <h3 className={`line-clamp-2 font-semibold leading-snug transition group-hover:text-white ${compact ? "text-sm" : "text-[15px]"}`}>{v.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{fmtViews(v.view_count)} views · {timeAgo(v.published_at)}</p>
        </div>
      </div>
    </Link>
  );
}
