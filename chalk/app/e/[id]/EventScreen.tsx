"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PayBox } from "@/components/PayBox";
import { Bracket, type EventViewT } from "@/components/Bracket";
import { Big, Notice, PhoneInput, fmtWhen, money, post, usePoll } from "@/components/ui";

type View = EventViewT & {
  me: { id: string; first_name: string } | null;
  mine: { entry_id: string; status: string; payment_id: string | null } | null;
  demo: boolean;
};
type PayState = { payment_id: string; client_secret: string; publishable_key: string; amount_cents: number };

export function EventScreen({ id }: { id: string }) {
  const { data: v, error, refresh } = usePoll<View>(`/api/events/${id}`, 6000);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pay, setPay] = useState<PayState | null>(null);
  const [staffMode, setStaffMode] = useState(false);
  const [walkup, setWalkup] = useState("");

  useEffect(() => {
    const u = new URL(window.location.href);
    setStaffMode(u.searchParams.get("staff") === "1");
    const pid = u.searchParams.get("pay");
    if (pid) {
      post("/api/pay/confirm", { payment_id: pid }).catch(() => {}).finally(() => {
        u.searchParams.delete("pay");
        window.history.replaceState({}, "", u.toString());
        refresh();
      });
    }
  }, [refresh]);

  if (error && !v) return <main className="shell"><Notice kind="bad">{error}</Notice></main>;
  if (!v) return <main className="shell"><div className="muted pulse py-20 text-center text-2xl font-bold">Loading…</div></main>;
  const e = v.event;
  const total = e.entry_cents + e.service_fee_cents;

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setErr(null);
    setOk(null);
    try {
      await fn();
      if (done) setOk(done);
      await refresh();
    } catch (er) {
      setErr((er as Error).message);
    }
  };

  const enter = async () => {
    setErr(null);
    try {
      const r = await post<{ entry_id: string; payment_id?: string; paid: boolean; client_secret?: string; publishable_key?: string; amount_cents?: number }>(`/api/events/${id}/enter`, {});
      if (r.paid) {
        setOk("You're in.");
        await refresh();
        return;
      }
      setPay({ payment_id: r.payment_id!, client_secret: r.client_secret!, publishable_key: r.publishable_key!, amount_cents: r.amount_cents! });
    } catch (er) {
      setErr((er as Error).message);
    }
  };

  return (
    <main className="shell" style={{ maxWidth: staffMode || e.status !== "open" ? 900 : 520 }}>
      <div>
        <div className="eyebrow">{v.venue.name}</div>
        <div className="h1">{e.name}</div>
        <div className="muted font-bold">{fmtWhen(e.starts_at)} · {e.format === "single_elim" ? "single elimination" : "round robin"} · {v.entries.length}/{e.capacity} in</div>
        {e.prize_text && <div className="mt-1 font-extrabold" style={{ color: "var(--win)" }}>Prize: {e.prize_text}</div>}
      </div>
      {err && <Notice kind="bad">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}

      {e.status === "open" && !staffMode && (
        <div className="card flex flex-col gap-3">
          {v.mine && v.mine.status !== "pending" ? (
            <Notice kind="ok">You&apos;re in, {v.me?.first_name}. Show up {fmtWhen(e.starts_at)}.</Notice>
          ) : pay ? (
            <>
              <div className="h2">{money(e.entry_cents)} entry + {money(e.service_fee_cents)} fee</div>
              <PayBox clientSecret={pay.client_secret} publishableKey={pay.publishable_key} amountCents={pay.amount_cents} returnUrl={`${window.location.origin}/e/${id}?pay=${pay.payment_id}`}
                onPaid={async () => { await post("/api/pay/confirm", { payment_id: pay.payment_id }).catch(() => {}); setPay(null); setOk("You're in."); await refresh(); }}
                onCancel={() => setPay(null)} />
            </>
          ) : !v.me ? (
            <Identify onDone={refresh} />
          ) : v.spots_left <= 0 ? (
            <Notice kind="bad">It&apos;s full. Ask the bartender about the next one.</Notice>
          ) : (
            <>
              <div className="h2">{e.entry_cents > 0 ? `${money(e.entry_cents)} to enter` : "Free to enter"}</div>
              {e.entry_cents > 0 && <div className="muted font-bold">Plus a {money(e.service_fee_cents)} service fee. {v.spots_left} spots left.</div>}
              <Big kind="primary" className="btn-huge" onClick={enter}>{e.entry_cents > 0 ? `I'm in · ${money(total)}${v.demo ? " (test)" : ""}` : "I'm in"}</Big>
            </>
          )}
        </div>
      )}

      {staffMode && (
        <div className="card flex flex-col gap-3">
          <div className="h2">Run the event</div>
          {e.status === "open" && (
            <>
              <div className="muted font-bold">{v.entries.length} paid. Check people in as they show up, add walk-ups who paid at the bar, then start the bracket.</div>
              <div className="flex flex-col gap-1">
                {v.entries.map((en) => (
                  <div key={en.id} className="flex items-center justify-between border-b border-[var(--line)] py-1">
                    <span className="font-extrabold">{en.name} {en.status === "checked_in" && <span className="pill pill-live">here</span>}</span>
                    <div className="flex gap-2">
                      {en.status === "paid" && <button className="btn btn-sm w-auto" onClick={() => act(() => post(`/api/events/${id}/checkin`, { entry_id: en.id }))}>Here</button>}
                      <button className="text-xs font-bold underline" style={{ color: "#ff8a8a" }} onClick={() => act(() => post(`/api/events/${id}/checkin`, { withdraw_id: en.id }))}>drop</button>
                    </div>
                  </div>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); act(() => post(`/api/events/${id}/checkin`, { walkup_name: walkup }), "Added.").then(() => setWalkup("")); }}>
                <input className="input input-sm" placeholder="Walk-up name (paid cash)" value={walkup} onChange={(ev) => setWalkup(ev.target.value)} />
                <button className="btn btn-sm w-auto" type="submit" disabled={!walkup.trim()}>Add</button>
              </form>
              <Big kind="primary" onClick={() => act(() => post(`/api/events/${id}/start`), "Bracket's live on the TV.")} disabled={v.entries.length < 2}>Start the bracket ({v.entries.length} players)</Big>
            </>
          )}
          {e.status === "live" && <div className="muted font-bold">Tap the winner of each match. Tap again to change it before the next round is played.</div>}
          {e.status === "done" && <Notice kind="ok">Done. {v.champion ? `${v.champion} takes it.` : ""}</Notice>}
        </div>
      )}

      {(e.status === "live" || e.status === "done") && (
        <Bracket view={v} onPick={staffMode ? (mid, eid) => act(() => post(`/api/events/${id}/result`, { bracket_match_id: mid, winner_entry_id: eid })) : undefined} />
      )}

      {e.status === "open" && v.entries.length > 0 && !staffMode && (
        <div className="card">
          <div className="eyebrow mb-2">Who&apos;s in</div>
          <div className="flex flex-wrap gap-2">{v.entries.map((en) => <span key={en.id} className="pill">{en.name}</span>)}</div>
        </div>
      )}
      {e.status === "cancelled" && <Notice kind="bad">This one got cancelled.</Notice>}
      <Link href="/me" className="muted text-center text-sm font-bold underline">my account</Link>
    </main>
  );
}

function Identify({ onDone }: { onDone: () => Promise<void> | void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setErr(null); try { await post("/api/auth/identify", { first_name: name, phone }); await onDone(); } catch (er) { setErr((er as Error).message); } }}>
      <div className="h2">Who&apos;s signing up?</div>
      <input className="input" placeholder="First name" value={name} onChange={(e) => setName(e.target.value)} />
      <PhoneInput value={phone} onChange={setPhone} />
      {err && <Notice kind="bad">{err}</Notice>}
      <Big kind="primary" type="submit" disabled={!name.trim() || phone.length !== 10}>Next</Big>
    </form>
  );
}
