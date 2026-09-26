import Link from "next/link";
import { Check, Sparkles, ShieldCheck } from "lucide-react";
import LeadForm from "@/components/LeadForm";
import { TIERS } from "@/lib/types";
import { getSession } from "@/lib/data";

export const metadata = { title: "Join" };

export default async function Join({ searchParams }: { searchParams: Promise<{ tier?: string; from?: string }> }) {
  const { tier, from } = await searchParams;
  const { user } = await getSession();
  const links: Record<string, string | undefined> = {
    inner_circle: process.env.NEXT_PUBLIC_STRIPE_LINK_INNER_CIRCLE,
    day_one: process.env.NEXT_PUBLIC_STRIPE_LINK_DAY_ONE,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-32 pt-12 sm:px-6 md:pb-20">
      <section className="fade-up text-center">
        <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-brand"><Sparkles size={12} /> Road to 10K</span>
        <h1 className="font-display mt-5 text-5xl font-800 leading-[.98] sm:text-7xl">This is my platform.<br /><span className="gradient-text">You&apos;re early.</span></h1>
        <p className="mx-auto mt-5 max-w-xl text-muted sm:text-lg">
          YouTube decides who sees my videos. TikTok decides what I can say. Here it&apos;s just me and the people who actually want the chaos.
          {from && " You came from a video — that's the whole point."}
        </p>
        <div className="gborder mx-auto mt-9 max-w-lg rounded-3xl bg-bg-2/70 p-5 glow backdrop-blur">
          <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold"><span className="chip bg-brand/20 text-brand">Step 1</span> Get on the list — free, forever</p>
          <LeadForm source={from ? `join:${from}` : "join"} />
          <p className="mt-3 text-xs text-muted">No spam. One email when something drops.</p>
        </div>
      </section>

      <section className="fade-up d3 mt-20">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted"><span className="chip bg-white/8 text-fg">Step 2</span> Want in on the stuff I can&apos;t post?</p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => {
            const isFree = t.id === "free";
            const selected = tier === t.id;
            const hot = t.highlight || selected;
            const href = isFree ? "#" : links[t.id] ?? (user ? "#" : `/login?next=/join?tier=${t.id}`);
            return (
              <div key={t.id} className={`relative flex flex-col rounded-3xl p-6 card-hover ${hot ? "gborder bg-brand/10 glow" : "card"}`}>
                {t.highlight && <span className="chip absolute -top-3 left-6 bg-gradient-to-r from-brand to-brand-2 text-white shadow-lg shadow-brand/40">MOST POPULAR</span>}
                <p className="text-sm text-muted">{t.tagline}</p>
                <h3 className="font-display mt-1 text-2xl font-800">{t.name}</h3>
                <p className="font-display mt-3 text-4xl font-800">{t.price.replace("/mo", "")}<span className="text-base font-500 text-muted">{t.price.includes("/mo") ? "/mo" : ""}</span></p>
                <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                  {t.perks.map((p) => <li key={p} className="flex gap-2.5"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/25 text-brand"><Check size={11} strokeWidth={3} /></span> {p}</li>)}
                </ul>
                <div className="mt-auto pt-7">
                  {isFree ? (
                    <a href="#top" className="btn btn-ghost w-full py-2.5">Use the form above</a>
                  ) : (
                    <Link href={href} className={`btn w-full py-2.5 ${hot ? "btn-primary" : "btn-white"}`}>
                      {links[t.id] ? `Join ${t.name}` : "Coming soon"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted"><ShieldCheck size={13} /> Cancel anytime. Payments handled by Stripe.</p>
      </section>

      <section className="fade-up d4 mt-20 grid gap-4 text-center sm:grid-cols-3">
        {[["1.4K+", "YouTube subs"], ["347K", "views on one short"], ["10.8K", "views last 30 days"]].map(([n, l]) => (
          <div key={l} className="card rounded-2xl p-6"><p className="font-display gradient-text text-4xl font-800">{n}</p><p className="mt-1 text-sm text-muted">{l}</p></div>
        ))}
      </section>
    </main>
  );
}
