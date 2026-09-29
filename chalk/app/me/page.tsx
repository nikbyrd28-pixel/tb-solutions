"use client";

import Link from "next/link";
import { useState } from "react";
import { Big, Notice, PhoneInput, money, post, timeAgo, usePoll } from "@/components/ui";

type Me = {
  player: null | { id: string; first_name: string; phone: string; balance_cents: number; verified: boolean; locked: boolean; stripe_onboarded: boolean };
  ledger: { id: string; kind: string; amount_cents: number; note: string | null; created_at: string }[];
  games: { id: string; status: string; stake_cents: number; winner_cents: number; won: boolean; opponent: string | null; venue: string; station: string; ended_at: string | null; prize_mode: string; prize_redeemed_at: string | null }[];
  prizes: { id: string; winner_cents: number; venue: string }[];
  cashout: { enabled: boolean; min_cents: number; otp: boolean };
};

export default function MePage() {
  const { data, refresh } = usePoll<Me>("/api/me", 8000);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");

  if (!data) return <main className="shell"><div className="muted pulse py-20 text-center text-2xl font-bold">Loading…</div></main>;

  if (!data.player) {
    return (
      <main className="shell">
        <div className="h1">Your account</div>
        <IdentifyInline onDone={refresh} />
      </main>
    );
  }
  const p = data.player;

  const sendCode = async () => {
    setErr(null);
    try {
      const r = await post<{ dev?: boolean }>("/api/auth/otp/send");
      setCodeSent(true);
      setOk(r.dev ? "Test mode: use the test code." : `We texted a code to ${p.phone}.`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const verify = async () => {
    setErr(null);
    try {
      await post("/api/auth/otp/verify", { code });
      setCodeSent(false);
      setCode("");
      setOk("Verified.");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const setupPayout = async () => {
    setErr(null);
    try {
      const r = await post<{ ready: boolean; url?: string }>("/api/me/stripe-link");
      if (r.ready) {
        setOk("Payout account is ready.");
        await refresh();
      } else if (r.url) window.location.href = r.url;
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const cashout = async () => {
    setErr(null);
    try {
      const r = await post<{ amount_cents: number }>("/api/me/cashout");
      setOk(`${money(r.amount_cents)} is on its way to your bank. Usually 2 business days.`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <main className="shell">
      <div>
        <div className="eyebrow">Hey {p.first_name}</div>
        <div className="h1 money">{money(p.balance_cents)}</div>
        <div className="muted font-bold">{p.phone}{p.verified ? " · verified" : ""}</div>
      </div>

      {err && <Notice kind="bad">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}
      {p.locked && <Notice kind="bad">This account is locked. Talk to the bartender.</Notice>}

      {data.prizes.length > 0 && (
        <div className="card flex flex-col gap-2">
          <div className="h2">Prizes to collect</div>
          {data.prizes.map((z) => (
            <Notice key={z.id} kind="ok">
              {money(z.winner_cents)} at {z.venue}. Show the bartender code <b>{z.id.slice(-4).toUpperCase()}</b>.
            </Notice>
          ))}
        </div>
      )}

      {!p.verified && (
        <div className="card flex flex-col gap-3">
          <div className="h2">Verify your number</div>
          <div className="muted font-bold">Needed once, to spend your balance or cash out. Playing with a card never needs it.</div>
          {!data.cashout.otp ? (
            <Notice kind="info">Verification texts aren&apos;t turned on at this bar yet. You can still play with a card, and your winnings stay in your balance.</Notice>
          ) : codeSent ? (
            <>
              <input className="input" inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
              <Big kind="primary" onClick={verify} disabled={code.length !== 6}>Verify</Big>
              <Big kind="ghost" onClick={sendCode}>Send it again</Big>
            </>
          ) : (
            <Big kind="primary" onClick={sendCode}>Text me a code</Big>
          )}
        </div>
      )}

      {p.verified && (
        <div className="card flex flex-col gap-3">
          <div className="h2">Cash out</div>
          {!data.cashout.enabled ? (
            <Notice kind="info">Cash-out isn&apos;t switched on yet. Your balance is safe here, and you can play with it any time.</Notice>
          ) : p.balance_cents < data.cashout.min_cents ? (
            <div className="muted font-bold">Win a game first. Minimum is {money(data.cashout.min_cents)}.</div>
          ) : !p.stripe_onboarded ? (
            <>
              <div className="muted font-bold">One-time setup: tell Stripe where to send the money. Takes about a minute.</div>
              <Big kind="primary" onClick={setupPayout}>Set up payouts</Big>
            </>
          ) : (
            <Big kind="win" className="btn-huge" onClick={cashout}>Cash out {money(p.balance_cents)}</Big>
          )}
        </div>
      )}

      <div className="card flex flex-col gap-2">
        <div className="h2">Games</div>
        {data.games.length === 0 && <div className="muted font-bold">None yet. Scan a table.</div>}
        {data.games.map((g) => (
          <div key={g.id} className="flex items-center justify-between border-b border-[var(--line)] py-2 last:border-0">
            <div>
              <div className="font-extrabold">
                {g.status === "completed" ? (g.won ? <span style={{ color: "var(--win)" }}>Won {money(g.winner_cents)}</span> : `Lost ${money(g.stake_cents)}`) : g.status === "voided" ? "Cancelled, refunded" : g.status === "disputed" ? "Waiting on bartender" : g.status === "live" ? "In progress" : "Waiting for opponent"}
                {g.opponent ? ` vs ${g.opponent}` : ""}
              </div>
              <div className="muted text-sm font-bold">{g.venue} · {g.station}{g.ended_at ? ` · ${timeAgo(g.ended_at)}` : ""}</div>
            </div>
          </div>
        ))}
      </div>

      {data.ledger.length > 0 && (
        <div className="card flex flex-col gap-1">
          <div className="h2">Money</div>
          {data.ledger.map((l) => (
            <div key={l.id} className="flex justify-between border-b border-[var(--line)] py-2 last:border-0">
              <div>
                <div className="font-extrabold">{l.note || l.kind.charAt(0).toUpperCase() + l.kind.slice(1)}</div>
                <div className="muted text-sm font-bold">{timeAgo(l.created_at)}</div>
              </div>
              <div className="money font-extrabold" style={{ color: l.amount_cents > 0 ? "var(--win)" : undefined }}>
                {l.amount_cents > 0 ? "+" : ""}{money(l.amount_cents)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Big
        kind="ghost"
        onClick={async () => {
          await post("/api/auth/logout");
          await refresh();
        }}
      >
        Not {p.first_name}? Switch
      </Big>
      <Link href="/" className="muted text-center text-sm font-bold">chalk</Link>
    </main>
  );
}

function IdentifyInline({ onDone }: { onDone: () => Promise<void> | void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          await post("/api/auth/identify", { first_name: name, phone });
          await onDone();
        } catch (er) {
          setErr((er as Error).message);
        }
      }}
    >
      <div className="muted font-bold">Same name and number you used at the table.</div>
      <input className="input" placeholder="First name" value={name} onChange={(e) => setName(e.target.value)} />
      <PhoneInput value={phone} onChange={setPhone} />
      {err && <Notice kind="bad">{err}</Notice>}
      <Big kind="primary" type="submit" disabled={!name.trim() || phone.length !== 10}>Show my account</Big>
    </form>
  );
}
