import Link from "next/link";
import { Eye, Mail, Users, Clapperboard, Heart, ArrowRight } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtViews, timeAgo } from "@/lib/format";
import type { Video } from "@/lib/types";

export const dynamic = "force-dynamic";

type Day = { day: string; views: number; leads: number };

function Spark({ data, k, color }: { data: Day[]; k: "views" | "leads"; color: string }) {
  const w = 600, h = 120, pad = 6;
  const max = Math.max(1, ...data.map((d) => Number(d[k])));
  const pts = data.map((d, i) => [pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2), h - pad - (Number(d[k]) / max) * (h - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]?.[0] ?? 0},${h} L${pad},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id={`g-${k}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#g-${k})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default async function Overview() {
  const sb = await supabaseServer();
  const [videos, leads, members, likes, daily, recentLeads] = await Promise.all([
    sb.from("nb_videos").select("id,title,slug,kind,view_count,like_count,visibility,published_at,thumbnail_url").order("published_at", { ascending: false }),
    sb.from("nb_leads").select("id", { count: "exact", head: true }),
    sb.from("nb_profiles").select("id", { count: "exact", head: true }),
    sb.from("nb_video_likes").select("video_id", { count: "exact", head: true }),
    sb.rpc("nb_daily_stats", { p_days: 30 }),
    sb.from("nb_leads").select("email,name,source,created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  const vids = (videos.data ?? []) as Video[];
  const totalViews = vids.reduce((a, v) => a + v.view_count, 0);
  const days = (daily.data ?? []) as Day[];
  const views30 = days.reduce((a, d) => a + Number(d.views), 0);
  const leads30 = days.reduce((a, d) => a + Number(d.leads), 0);
  const top = [...vids].sort((a, b) => b.view_count - a.view_count).slice(0, 5);

  const stats = [
    { icon: Eye, label: "Total views", value: fmtViews(totalViews), sub: `${views30} in 30d` },
    { icon: Mail, label: "Leads", value: String(leads.count ?? 0), sub: `${leads30} in 30d` },
    { icon: Users, label: "Members", value: String(members.count ?? 0), sub: "signed up" },
    { icon: Heart, label: "Likes", value: String(likes.count ?? 0), sub: "all time" },
    { icon: Clapperboard, label: "Videos", value: String(vids.length), sub: `${vids.filter((v) => v.visibility === "public").length} public` },
  ];

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Studio</p><h1 className="font-display mt-1 text-3xl font-800">Overview</h1></div>
        <Link href="/studio/videos/new" className="btn btn-primary h-10 px-4 text-sm">New video</Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="card rounded-2xl p-4">
            <div className="flex items-center justify-between text-muted"><span className="text-xs font-medium">{label}</span><Icon size={15} /></div>
            <p className="font-display mt-2 text-2xl font-800">{value}</p>
            <p className="text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card rounded-2xl p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-semibold">Views · last 30 days</h2><span className="font-display text-xl font-700">{views30}</span></div>
          <div className="mt-3">{days.length ? <Spark data={days} k="views" color="#8b5cf6" /> : <p className="text-sm text-muted">No data yet.</p>}</div>
        </div>
        <div className="card rounded-2xl p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-semibold">Leads · last 30 days</h2><span className="font-display text-xl font-700">{leads30}</span></div>
          <div className="mt-3">{days.length ? <Spark data={days} k="leads" color="#f43f5e" /> : <p className="text-sm text-muted">No data yet.</p>}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between p-5 pb-3"><h2 className="font-semibold">Top videos</h2><Link href="/studio/videos" className="flex items-center gap-1 text-xs text-muted hover:text-fg">All <ArrowRight size={12} /></Link></div>
          <ul>
            {top.map((v) => (
              <li key={v.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-bg-3">{/* eslint-disable-next-line @next/next/no-img-element */}{v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><Link href={`/studio/videos/${v.id}`} className="line-clamp-1 text-sm font-medium hover:underline">{v.title}</Link><p className="text-xs text-muted">{v.kind} · {timeAgo(v.published_at)}</p></div>
                <span className="text-sm tabular-nums text-muted">{fmtViews(v.view_count)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between p-5 pb-3"><h2 className="font-semibold">Latest leads</h2><Link href="/studio/leads" className="flex items-center gap-1 text-xs text-muted hover:text-fg">All <ArrowRight size={12} /></Link></div>
          <ul>
            {(recentLeads.data ?? []).map((l) => (
              <li key={l.email} className="flex items-center gap-3 border-t border-line px-5 py-3 text-sm">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{l.email}</p><p className="text-xs text-muted">{l.name || "—"} · {l.source}</p></div>
                <span className="text-xs text-muted">{timeAgo(l.created_at)}</span>
              </li>
            ))}
            {!recentLeads.data?.length && <li className="border-t border-line px-5 py-6 text-sm text-muted">No leads yet — share the /join link.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
