import Link from "next/link";
import { Lock } from "lucide-react";
import type { Video } from "@/lib/types";
import { fmtDuration, fmtViews, timeAgo } from "@/lib/format";

export default function VideoCard({ v, compact = false }: { v: Video; compact?: boolean }) {
  const locked = v.min_tier !== "free";
  return (
    <Link href={`/watch/${v.slug}`} className={`group ${compact ? "flex gap-3" : "block"}`}>
      <div className={`relative overflow-hidden rounded-xl bg-bg-3 ${compact ? "aspect-video w-40 shrink-0" : "aspect-video w-full"}`}>
        {v.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        )}
        {v.duration_seconds ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium">{fmtDuration(v.duration_seconds)}</span> : null}
        {locked && <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white"><Lock size={11} /> Members</span>}
      </div>
      <div className={compact ? "min-w-0" : "mt-3 flex gap-3"}>
        {!compact && <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-brand to-brand-2" />}
        <div className="min-w-0">
          <h3 className={`line-clamp-2 font-semibold leading-snug ${compact ? "text-sm" : "text-[15px]"}`}>{v.title}</h3>
          <p className="mt-0.5 text-xs text-muted">Nick Byrd · {fmtViews(v.view_count)} views · {timeAgo(v.published_at)}</p>
        </div>
      </div>
    </Link>
  );
}
