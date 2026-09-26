import Link from "next/link";
import { Flame, Play, ArrowRight, Disc3 } from "lucide-react";
import VideoCard from "@/components/VideoCard";
import LeadForm from "@/components/LeadForm";
import { getVideos, fmtViews } from "@/lib/data";
import { getDrop, dropLabel } from "@/lib/sleptOn";

export const revalidate = 60;

export default async function Home() {
  const [longs, shorts, slept] = await Promise.all([getVideos("long", 12), getVideos("short", 8), getDrop()]);
  const hero = longs[0];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-6">
      {/* hero */}
      {hero && (
        <section className="relative mb-10 overflow-hidden rounded-3xl glow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hero.thumbnail_url && <img src={hero.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
          <div className="relative flex min-h-[380px] flex-col justify-end p-6 sm:p-10">
            <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-bg/60 px-3 py-1 text-xs text-muted">
              <span className="relative inline-block h-2 w-2 rounded-full bg-brand-2 live-dot" /> Latest drop
            </span>
            <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl">{hero.title}</h1>
            <p className="mt-2 max-w-xl text-muted">{hero.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/watch/${hero.slug}`} className="flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 font-semibold text-bg hover:brightness-90"><Play size={16} fill="currentColor" /> Watch</Link>
              <Link href="/feed" className="flex items-center gap-2 rounded-full border border-line bg-bg/60 px-5 py-2.5 font-semibold hover:bg-bg-3"><Flame size={16} /> Chaos Feed</Link>
            </div>
          </div>
        </section>
      )}

      {/* shorts rail */}
      {shorts.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Flame className="text-brand-2" size={20} /> Chaos Feed</h2>
            <Link href="/feed" className="flex items-center gap-1 text-sm text-muted hover:text-fg">Swipe all <ArrowRight size={14} /></Link>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {shorts.map((s, i) => (
              <Link key={s.id} href={`/feed?start=${i}`} className="group relative aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-xl bg-bg-3 sm:w-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.thumbnail_url && <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <p className="line-clamp-2 text-xs font-semibold">{s.title}</p>
                  <p className="text-[11px] text-muted">{fmtViews(s.view_count)} views</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* slept on rail */}
      <section className="mb-10 rounded-3xl border border-line bg-bg-2 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold"><Disc3 className="text-brand" size={20} /> Slept On</h2>
            <p className="text-sm text-muted">{slept.drop ? `${dropLabel(slept.drop.number)} — underground rap you haven't heard yet` : "Underground rap, hand-picked. First drop coming soon."}</p>
          </div>
          <Link href="/slept-on" className="flex shrink-0 items-center gap-1 text-sm text-muted hover:text-fg">{slept.drop ? "Full drop" : "Get in"} <ArrowRight size={14} /></Link>
        </div>
        {slept.tracks.length > 0 ? (
          <ol className="grid gap-2 sm:grid-cols-2">
            {slept.tracks.slice(0, 4).map((t, i) => (
              <li key={t.id}>
                <Link href="/slept-on#drop" className="flex items-center gap-3 rounded-xl bg-bg-3 p-2.5 hover:bg-line">
                  <span className="w-5 text-center font-mono text-xs text-muted">{i + 1}</span>
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.cover_url ? <img src={t.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Disc3 size={18} className="absolute inset-0 m-auto text-muted" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                    <span className="block truncate text-xs text-muted">{t.artist}{t.city ? ` · ${t.city}` : ""}</span>
                  </span>
                  <span className="text-xs text-muted">🔥 {t.fire_count}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link href="/slept-on" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Get the first drop</Link>
            <Link href="/slept-on#submit" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-bg-3">I make music</Link>
          </div>
        )}
      </section>

      {/* grid */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Videos</h2>
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {longs.map((v) => <VideoCard key={v.id} v={v} />)}
        </div>
        {longs.length === 0 && <p className="text-muted">Nothing here yet. Run the migration and upload from /admin/upload.</p>}
      </section>

      {/* funnel strip */}
      <section className="mt-14 rounded-3xl border border-line bg-bg-2 p-6 sm:p-10">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">Road to 10K</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">No algorithm. Just you and me.</h2>
            <p className="mt-2 text-muted">Get every drop before it hits YouTube, vote on what I film next, and unlock the uncut stuff.</p>
          </div>
          <LeadForm source="home" />
        </div>
      </section>
    </main>
  );
}
