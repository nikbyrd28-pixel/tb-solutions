import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
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
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-10">
      {/* step 1 — free */}
      <section className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 px-3 py-1 text-xs font-semibold text-brand"><Sparkles size={12} /> Road to 10K</span>
        <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">This is my platform.<br /><span className="gradient-text">You&apos;re early.</span></h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          YouTube decides who sees my videos. TikTok decides what I can say. Here, it&apos;s just me and the people who actually want the chaos.
          {from && " You came from a video — good, that's the whole point."}
        </p>
        <div className="mx-auto mt-8 max-w-lg rounded-3xl border border-line bg-bg-2 p-5 glow">
          <p className="mb-3 text-sm font-semibold">Step 1 — get on the list (free, forever)</p>
          <LeadForm source={from ? `join:${from}` : "join"} />
          <p className="mt-3 text-xs text-muted">No spam. One email when something drops.</p>
        </div>
      </section>

      {/* step 2 — tiers */}
      <section className="mt-16">
        <p className="text-center text-sm font-semibold text-muted">Step 2 — want in on the stuff I can&apos;t post?</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => {
            const isFree = t.id === "free";
            const selected = tier === t.id;
            const href = isFree ? "#" : links[t.id] ?? (user ? "#" : `/login?next=/join?tier=${t.id}`);
            return (
              <div key={t.id} className={`relative flex flex-col rounded-3xl border p-6 ${t.highlight || selected ? "border-brand bg-brand/10 glow" : "border-line bg-bg-2"}`}>
                {t.highlight && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">MOST POPULAR</span>}
                <p className="text-sm text-muted">{t.tagline}</p>
                <h3 className="mt-1 text-2xl font-black">{t.name}</h3>
                <p className="mt-2 text-3xl font-black">{t.price}</p>
                <ul className="mt-5 flex flex-col gap-2 text-sm">
                  {t.perks.map((p) => <li key={p} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand" /> {p}</li>)}
                </ul>
                <div className="mt-auto pt-6">
                  {isFree ? (
                    <a href="#top" className="block rounded-full border border-line py-2.5 text-center font-semibold hover:bg-bg-3">Use the form above</a>
                  ) : (
                    <Link href={href} className={`block rounded-full py-2.5 text-center font-semibold ${t.highlight ? "bg-brand text-white" : "bg-fg text-bg"}`}>
                      {links[t.id] ? `Join ${t.name}` : "Coming soon"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-muted">Cancel anytime. Payments handled by Stripe.</p>
      </section>

      {/* social proof */}
      <section className="mt-16 grid gap-4 text-center sm:grid-cols-3">
        {[["1.4K+", "YouTube subs"], ["347K", "views on one short"], ["10.8K", "views last 30 days"]].map(([n, l]) => (
          <div key={l} className="rounded-2xl border border-line bg-bg-2 p-5"><p className="text-3xl font-black gradient-text">{n}</p><p className="text-sm text-muted">{l}</p></div>
        ))}
      </section>
    </main>
  );
}
