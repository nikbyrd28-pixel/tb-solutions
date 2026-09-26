import Link from "next/link";
import { Disc3, Headphones, Mic2, Swords, MapPin } from "lucide-react";
import TrackRow from "@/components/TrackRow";
import LeadForm from "@/components/LeadForm";
import SubmitTrackForm from "@/components/SubmitTrackForm";
import { getDrop, dropLabel } from "@/lib/sleptOn";

export const revalidate = 60;
export const metadata = {
  title: "Slept On",
  description: "Underground rap you haven't heard yet. Hand-picked weekly drops — no algorithm.",
};

export default async function SleptOn({ searchParams }: { searchParams: Promise<{ drop?: string; city?: string }> }) {
  const sp = await searchParams;
  const { drop, drops, tracks } = await getDrop(Number(sp.drop) || undefined);
  const cities = [...new Set(tracks.map((t) => t.city).filter(Boolean) as string[])].sort();
  const city = sp.city && cities.includes(sp.city) ? sp.city : null;
  const shown = city ? tracks.filter((t) => t.city === city) : tracks;
  const q = (c: string | null) => `/slept-on?${new URLSearchParams({ ...(drop ? { drop: String(drop.number) } : {}), ...(c ? { city: c } : {}) })}`;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-bg-2 p-6 glow sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-2/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-2">
          <Disc3 size={14} /> Slept On
        </span>
        <h1 className="mt-4 text-4xl font-black uppercase leading-[0.95] sm:text-6xl">
          The <span className="text-muted line-through decoration-brand-2 decoration-4">algorithm</span><br />won&apos;t play this.
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Underground rap you haven&apos;t heard yet — hand-picked every week, tagged by the scene it came from. Hit the fire on what goes crazy.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#drop" className="flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 font-semibold text-bg hover:brightness-90"><Headphones size={16} /> Listen</a>
          <a href="#submit" className="flex items-center gap-2 rounded-full border border-line bg-bg/60 px-5 py-2.5 font-semibold hover:bg-bg-3"><Mic2 size={16} /> Submit your track</a>
        </div>
      </section>

      {/* drop */}
      <section id="drop" className="mt-10 scroll-mt-20">
        {drop ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-brand">{dropLabel(drop.number)}</p>
                <h2 className="text-2xl font-black sm:text-3xl">{drop.title ?? "This week's drop"}</h2>
                {drop.blurb && <p className="mt-1 max-w-xl text-sm text-muted">{drop.blurb}</p>}
              </div>
              {drops.length > 1 && (
                <div className="no-scrollbar flex gap-2 overflow-x-auto">
                  {drops.map((d) => (
                    <Link key={d.id} href={`/slept-on?drop=${d.number}#drop`}
                      className={`shrink-0 rounded-full px-3 py-1 font-mono text-xs ${d.id === drop.id ? "bg-brand text-white" : "border border-line text-muted hover:text-fg"}`}>
                      #{String(d.number).padStart(3, "0")}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {cities.length > 1 && (
              <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
                <Link href={`${q(null)}#drop`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${!city ? "bg-bg-3 text-fg" : "text-muted hover:text-fg"}`}>All scenes</Link>
                {cities.map((c) => (
                  <Link key={c} href={`${q(c)}#drop`} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm ${city === c ? "bg-bg-3 text-fg" : "text-muted hover:text-fg"}`}>
                    <MapPin size={12} /> {c}
                  </Link>
                ))}
              </div>
            )}

            <ol className="mt-5 flex flex-col gap-3">
              {shown.map((t, i) => <TrackRow key={t.id} t={t} index={i} />)}
            </ol>
            {tracks.length === 0 && <p className="mt-5 text-sm text-muted">Tracks for this drop are still being dug up.</p>}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-line p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-brand">{dropLabel(1)}</p>
            <h2 className="mt-2 text-2xl font-black">Dropping soon.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">I&apos;m digging through the underground right now. Get on the list and it hits your inbox first.</p>
          </div>
        )}
      </section>

      {/* get it + submit */}
      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-bg-2 p-6">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand"><Headphones size={16} /> For listeners</p>
          <h2 className="mt-2 text-2xl font-black">Get every drop first.</h2>
          <p className="mt-1 mb-4 text-sm text-muted">One email a week. Just the music.</p>
          <LeadForm source="slept-on" />
        </div>
        <div id="submit" className="scroll-mt-20 rounded-3xl border border-brand/40 bg-brand/5 p-6">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-2"><Mic2 size={16} /> For artists</p>
          <h2 className="mt-2 text-2xl font-black">Make music? Send it.</h2>
          <p className="mt-1 mb-4 text-sm text-muted">No pay-for-play. Every track gets a real listen.</p>
          <SubmitTrackForm />
        </div>
      </section>

      {/* roadmap */}
      <section className="mt-14">
        <h2 className="text-lg font-bold">What&apos;s coming</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Disc3, t: "Weekly drops", d: "Hand-picked underground tracks.", now: true },
            { icon: Swords, t: "Song Wars", d: "Head-to-head battles. The crowd votes. Winners get pushed." },
            { icon: Headphones, t: "Playlists + offline", d: "Save tracks and take them with you." },
          ].map(({ icon: Icon, t, d, now }) => (
            <div key={t} className={`rounded-2xl border p-4 ${now ? "border-brand bg-brand/10" : "border-line bg-bg-2"}`}>
              <Icon size={20} className={now ? "text-brand" : "text-muted"} />
              <p className="mt-2 font-bold">{t} {now && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>}</p>
              <p className="text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
