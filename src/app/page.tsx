import Link from "next/link";
import { Flame, Play, ArrowRight, Eye, Users, Zap, Disc3 } from "lucide-react";
import { getDrop, dropLabel } from "@/lib/sleptOn";
import VideoCard from "@/components/VideoCard";
import LeadForm from "@/components/LeadForm";
import { getVideos, fmtViews, fmtDuration } from "@/lib/data";

export const revalidate = 60;

export default async function Home() {
  const [longs, shorts, slept] = await Promise.all([getVideos("long", 12), getVideos("short", 8), getDrop()]);
  const hero = longs[0];
  const totalViews = [...longs, ...shorts].reduce((a, v) => a + v.view_count, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6 md:pb-20">
      {/* hero */}
      {hero && (
        <section className="fade-up gborder relative overflow-hidden rounded-[28px] glow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hero.thumbnail_url && <img src={hero.thumbnail_url} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-50" />}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-transparent" />
          <div className="relative flex min-h-[440px] flex-col justify-end p-6 sm:min-h-[520px] sm:p-12">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
                <span className="live-dot inline-block h-2 w-2 rounded-full bg-brand-2" /> Latest drop
              </span>
              {hero.duration_seconds ? <span className="glass rounded-full px-3 py-1.5 text-xs font-medium tabular-nums">{fmtDuration(hero.duration_seconds)}</span> : null}
            </div>
            <h1 className="font-display max-w-3xl text-4xl font-800 leading-[1.02] sm:text-6xl lg:text-7xl">{hero.title}</h1>
            <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">{hero.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={`/watch/${hero.slug}`} className="btn btn-white h-12 px-6"><Play size={16} fill="currentColor" /> Watch now</Link>
              <Link href="/feed" className="btn btn-ghost h-12 px-6"><Flame size={16} className="text-brand-2" /> Chaos Feed</Link>
            </div>
          </div>
        </section>
      )}

      {/* stats strip */}
      <section className="fade-up d2 mt-5 grid grid-cols-3 gap-3">
        {[
          [Eye, fmtViews(totalViews || 362000) + "+", "views"],
          [Users, "2K+", "subscribers"],
          [Zap, "Weekly", "drops"],
        ].map(([Icon, n, l], i) => {
          const I = Icon as typeof Eye;
          return (
            <div key={i} className="card flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-brand sm:flex"><I size={17} /></span>
              <div><p className="font-display text-lg font-700 leading-none sm:text-xl">{n as string}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-muted">{l as string}</p></div>
            </div>
          );
        })}
      </section>

      {/* shorts rail */}
      {shorts.length > 0 && (
        <section className="fade-up d3 mt-12">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-2">Short form</p>
              <h2 className="font-display mt-1 text-2xl font-700">Chaos Feed</h2>
            </div>
            <Link href="/feed" className="btn btn-ghost h-9 px-4 text-sm">Swipe all <ArrowRight size={14} /></Link>
          </div>
          <div className="no-scrollbar mask-fade-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
            {shorts.map((s, i) => (
              <Link key={s.id} href={`/feed?start=${i}`} className="card card-hover group relative aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-2xl sm:w-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.thumbnail_url && <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-3 pt-10">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{s.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Eye size={11} /> {fmtViews(s.view_count)}</p>
                </div>
                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur"><Flame size={13} className="text-brand-2" /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* slept on */}
      <section className="fade-up d4 gborder relative mt-12 overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-3/15 blur-3xl" />
        <div className="relative mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-3">Underground rap</p>
            <h2 className="font-display mt-1 flex items-center gap-2 text-2xl font-700"><Disc3 size={22} className="text-brand-3" /> Slept On</h2>
            <p className="mt-1 text-sm text-muted">{slept.drop ? `${dropLabel(slept.drop.number)} — hand-picked, you haven't heard these yet` : "Hand-picked drops. First one coming soon."}</p>
          </div>
          <Link href="/slept-on" className="btn btn-ghost h-9 shrink-0 px-4 text-sm">{slept.drop ? "Full drop" : "Get in"} <ArrowRight size={14} /></Link>
        </div>
        {slept.tracks.length > 0 ? (
          <ol className="relative grid gap-2 sm:grid-cols-2">
            {slept.tracks.slice(0, 4).map((t, i) => (
              <li key={t.id}>
                <Link href="/slept-on#drop" className="card card-hover flex items-center gap-3 rounded-2xl p-2.5">
                  <span className="w-5 text-center font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-bg-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.cover_url ? <img src={t.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Disc3 size={18} className="absolute inset-0 m-auto text-muted" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                    <span className="block truncate text-xs text-muted">{t.artist}{t.city ? ` · ${t.city}` : ""}</span>
                  </span>
                  <span className="chip bg-white/8 text-muted">🔥 {t.fire_count}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="relative flex flex-wrap gap-2">
            <Link href="/slept-on" className="btn btn-primary h-10 px-5 text-sm">Get the first drop</Link>
            <Link href="/slept-on#submit" className="btn btn-ghost h-10 px-5 text-sm">I make music</Link>
          </div>
        )}
      </section>

      {/* grid */}
      <section className="mt-12">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Full episodes</p>
          <h2 className="font-display mt-1 text-2xl font-700">Latest videos</h2>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {longs.map((v, i) => <VideoCard key={v.id} v={v} delay={i * 60} />)}
        </div>
        {longs.length === 0 && <p className="text-muted">Nothing here yet. Upload from the Studio.</p>}
      </section>

      {/* funnel strip */}
      <section className="fade-up gborder relative mt-16 overflow-hidden rounded-[28px] p-6 sm:p-12">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-brand-2/20 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Road to 10K</p>
            <h2 className="font-display mt-2 text-3xl font-800 leading-tight sm:text-4xl">No algorithm.<br />Just you and me.</h2>
            <p className="mt-3 text-muted">Every drop before it hits YouTube, a vote on what I film next, and the uncut stuff that never leaves this site.</p>
          </div>
          <LeadForm source="home" />
        </div>
      </section>

      <footer className="mt-14 flex flex-col items-center gap-2 text-center text-xs text-muted">
        <p className="font-display text-sm font-700 text-fg">NICK<span className="gradient-text">BYRD</span></p>
        <p>© {new Date().getFullYear()} Nick Byrd. Built on my own platform.</p>
      </footer>
    </main>
  );
}
