"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Big, Notice, PhoneInput, fmtWhen, money, post, timeAgo, usePoll } from "@/components/ui";

type State = {
  me: { id: string; name: string; role: string; on_shift: boolean; stripe_onboarded: boolean };
  venue: { id: string; name: string; slug: string; prize_mode: string };
  tips: { today: number; week: number; all: number; unpaid: number };
  recentTips: { amount_cents: number; staff_cents: number; from_name: string | null; created_at: string }[];
  matches: { id: string; status: string; stake_cents: number; winner_cents: number; station: string; a_id: string | null; a_name: string | null; b_id: string | null; b_name: string | null; a_pick: string | null; b_pick: string | null; opened_at: string; live_at: string | null; first_pick_at: string | null }[];
  prizes: { id: string; winner: string; winner_cents: number; station: string; ended_at: string }[];
  events: { id: string; name: string; starts_at: string; status: string; entries: number; capacity: number; format: string; entry_cents: number }[];
  onShift: { id: string; name: string }[];
  payouts: { enabled: boolean };
};

export default function StaffPage() {
  const { data, error, refresh } = usePoll<State>("/api/staff/state", 5000);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const loggedOut = !!error && /log in/i.test(error);

  if (loggedOut || (!data && error)) return <Login onDone={refresh} />;
  if (!data) return <main className="shell"><div className="muted pulse py-20 text-center text-2xl font-bold">Loading…</div></main>;

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setErr(null);
    setOk(null);
    try {
      await fn();
      if (done) setOk(done);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const disputed = data.matches.filter((m) => m.status === "disputed");
  const others = data.matches.filter((m) => m.status !== "disputed");

  return (
    <main className="shell">
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow">{data.venue.name}</div>
          <div className="h1">{data.me.name}</div>
        </div>
        {(data.me.role === "owner" || data.me.role === "manager") && (
          <Link href="/owner" className="pill">Owner view</Link>
        )}
      </div>

      <Big
        kind={data.me.on_shift ? "win" : "primary"}
        className="btn-huge"
        onClick={() => act(() => post("/api/staff/shift", { on: !data.me.on_shift }))}
      >
        {data.me.on_shift ? "I'm on shift ✓" : "Start my shift"}
      </Big>
      {!data.me.on_shift && <div className="muted text-center font-bold">Players can only tip you while you&apos;re on shift.</div>}

      {err && <Notice kind="bad">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}

      <div className="card">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="eyebrow">Tips today</div><div className="h2 money">{money(data.tips.today)}</div></div>
          <div><div className="eyebrow">This week</div><div className="h2 money">{money(data.tips.week)}</div></div>
          <div><div className="eyebrow">Owed to you</div><div className="h2 money">{money(data.tips.unpaid)}</div></div>
        </div>
        {data.payouts.enabled && !data.me.stripe_onboarded && (
          <Big kind="ghost" className="mt-3" onClick={() => act(async () => {
            const r = await post<{ ready: boolean; url?: string }>("/api/staff/stripe-link");
            if (r.url) window.location.href = r.url;
          }, "Payout account is ready.")}>
            Set up where tips get paid
          </Big>
        )}
        {!data.payouts.enabled && data.tips.unpaid > 0 && <div className="muted mt-2 text-sm font-bold">Payouts switch on once the bar&apos;s Stripe is connected. Nothing&apos;s lost.</div>}
      </div>

      {disputed.length > 0 && (
        <div className="card flex flex-col gap-3" style={{ borderColor: "var(--bad)" }}>
          <div className="h2">Settle these</div>
          {disputed.map((m) => (
            <MatchCard key={m.id} m={m} act={act} />
          ))}
        </div>
      )}

      <div className="card flex flex-col gap-3">
        <div className="h2">On the tables</div>
        {others.length === 0 && <div className="muted font-bold">Nothing going right now.</div>}
        {others.map((m) => (
          <MatchCard key={m.id} m={m} act={act} />
        ))}
      </div>

      {data.prizes.length > 0 && (
        <div className="card flex flex-col gap-3">
          <div className="h2">Prizes to hand out</div>
          {data.prizes.map((z) => (
            <div key={z.id} className="flex items-center justify-between gap-2">
              <div>
                <div className="font-extrabold">{z.winner} · {money(z.winner_cents)} at the bar</div>
                <div className="muted text-sm font-bold">Code {z.id.slice(-4).toUpperCase()} · {z.station} · {timeAgo(z.ended_at)}</div>
              </div>
              <button className="btn btn-sm btn-win w-auto" onClick={() => act(() => post("/api/staff/redeem", { match_id: z.id }), "Handed out.")}>Done</button>
            </div>
          ))}
        </div>
      )}

      {data.events.length > 0 && (
        <div className="card flex flex-col gap-3">
          <div className="h2">Events</div>
          {data.events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2">
              <div>
                <div className="font-extrabold">{e.name}</div>
                <div className="muted text-sm font-bold">{fmtWhen(e.starts_at)} · {e.entries}/{e.capacity} in · {e.status}</div>
              </div>
              <Link href={`/e/${e.id}?staff=1`} className="btn btn-sm w-auto">Run it</Link>
            </div>
          ))}
        </div>
      )}

      <div className="card flex flex-col gap-2">
        <div className="h2">Recent tips</div>
        {data.recentTips.length === 0 && <div className="muted font-bold">None yet. Tell people the winner tips.</div>}
        {data.recentTips.map((t, i) => (
          <div key={i} className="flex justify-between border-b border-[var(--line)] py-1 last:border-0">
            <div className="font-bold">{t.from_name || "Someone"} <span className="muted text-sm">{timeAgo(t.created_at)}</span></div>
            <div className="money font-extrabold" style={{ color: "var(--win)" }}>+{money(t.staff_cents)}</div>
          </div>
        ))}
      </div>

      <div className="muted text-sm font-bold">On shift now: {data.onShift.map((s) => s.name).join(", ") || "nobody"}</div>
      <Big kind="ghost" onClick={() => act(() => post("/api/staff/logout"))}>Log out</Big>
    </main>
  );
}

function MatchCard({ m, act }: { m: State["matches"][number]; act: (fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), 6000);
    return () => clearTimeout(t);
  }, [confirm]);
  const pickLabel = (pick: string | null) => (!pick ? "hasn't picked" : pick === m.a_id ? `says ${m.a_name}` : `says ${m.b_name}`);
  const settle = (winner: string | null) => {
    const key = winner || "void";
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    setConfirm(null);
    return act(() => post("/api/staff/settle", { match_id: m.id, winner_id: winner }), winner ? "Settled." : "Voided, both refunded.");
  };
  return (
    <div className="rounded-2xl border border-[var(--line)] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="font-extrabold">{m.station}</div>
        <span className={`pill ${m.status === "disputed" ? "pill-bad" : m.status === "live" ? "pill-live" : "pill-warn"}`}>
          {m.status === "open" ? "waiting for a 2nd" : m.status} · {money(m.winner_cents)}
        </span>
      </div>
      <div className="text-xl font-extrabold">
        {m.a_name || "?"} vs {m.b_name || "…"}
      </div>
      {m.status !== "open" && (
        <div className="muted text-sm font-bold">
          {m.a_name} {pickLabel(m.a_pick)} · {m.b_name} {pickLabel(m.b_pick)}
        </div>
      )}
      {m.status !== "open" ? (
        <div className="grid grid-cols-2 gap-2">
          <button className={`btn btn-sm ${confirm === m.a_id ? "btn-win" : ""}`} onClick={() => settle(m.a_id)}>
            {confirm === m.a_id ? "Sure?" : `${m.a_name} won`}
          </button>
          <button className={`btn btn-sm ${confirm === m.b_id ? "btn-win" : ""}`} onClick={() => settle(m.b_id)}>
            {confirm === m.b_id ? "Sure?" : `${m.b_name} won`}
          </button>
          <button className={`btn btn-sm col-span-2 ${confirm === "void" ? "btn-warn" : "btn-danger"}`} onClick={() => settle(null)}>
            {confirm === "void" ? "Sure? Refund both" : "No game, refund both"}
          </button>
        </div>
      ) : (
        <button className={`btn btn-sm ${confirm === "void" ? "btn-warn" : "btn-danger"}`} onClick={() => settle(null)}>
          {confirm === "void" ? "Sure? Refund" : "Cancel it, refund"}
        </button>
      )}
    </div>
  );
}

function Login({ onDone }: { onDone: () => Promise<void> | void }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [venue, setVenue] = useState<string>("");
  useEffect(() => {
    setVenue(new URLSearchParams(window.location.search).get("v") || "");
  }, []);
  return (
    <main className="shell">
      <div>
        <div className="eyebrow">Chalk · staff</div>
        <div className="h1">Bartender login</div>
      </div>
      <form
        className="card flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await post("/api/staff/login", { venue, phone, pin });
            await onDone();
          } catch (er) {
            setErr((er as Error).message);
          }
        }}
      >
        <PhoneInput value={phone} onChange={setPhone} autoFocus />
        <input className="input" inputMode="numeric" placeholder="PIN (4-6 digits)" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        <div className="muted text-base font-bold">First time? Whatever PIN you type now becomes your PIN.</div>
        {err && <Notice kind="bad">{err}</Notice>}
        <Big kind="primary" type="submit" disabled={phone.length !== 10 || pin.length < 4}>Log in</Big>
      </form>
      <Link href="/" className="muted text-center text-sm font-bold">chalk</Link>
    </main>
  );
}
