"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PayBox } from "@/components/PayBox";
import { Big, Notice, PhoneInput, money, post, usePoll } from "@/components/ui";

type Staff = { id: string; name: string; role: string };
type View = {
  venue: { id: string; name: string; slug: string; prize_mode: "cash" | "gift_card"; stakes: number[]; free: boolean };
  station: { id: string; code: string; name: string; game: string };
  split: Record<string, { pot: number; winner: number; bar: number; platform: number }>;
  match: null | {
    id: string; status: "open" | "live" | "disputed"; stake_cents: number; pot_cents: number; winner_cents: number; prize_mode: "cash" | "gift_card";
    a: { id: string; name: string } | null; b: { id: string; name: string } | null; a_pick: string | null; b_pick: string | null;
    winner_id: string | null; opened_at: string; live_at: string | null;
  };
  last: null | { id: string; winner: string | null; loser: string | null; winner_id: string | null; winner_cents: number; prize_mode: string; prize_redeemed: boolean; player_ids: (string | null)[] };
  staff: Staff[];
  me: null | { id: string; first_name: string; balance_cents: number; verified: boolean; locked: boolean };
  myPending: null | { paymentId: string; matchId: string };
  demo: boolean;
  otp: boolean;
  now: string;
};

type PayState = { payment_id: string; client_secret: string; publishable_key: string; amount_cents: number };

const GAME_LABEL: Record<string, string> = { pool: "8-ball", darts: "Darts", shuffleboard: "Shuffleboard", cornhole: "Cornhole", air_hockey: "Air hockey", other: "Game" };

export function StationScreen({ code }: { code: string }) {
  const { data: v, error, refresh } = usePoll<View>(`/api/station/${code}`, 3000);
  const [err, setErr] = useState<string | null>(null);

  // local flow: choosing stake -> tip -> paying
  const [stake, setStake] = useState<number | null>(null);
  const [joinId, setJoinId] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "tip" | "pay">("idle");
  const [tip, setTip] = useState<{ cents: number; staffId: string | null }>({ cents: 0, staffId: null });
  const [pay, setPay] = useState<PayState | null>(null);
  const [dismissedLast, setDismissedLast] = useState<string | null>(null);

  // came back from a card redirect?
  const confirmedRef = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const pid = url.searchParams.get("pay");
    if (pid && !confirmedRef.current) {
      confirmedRef.current = true;
      post("/api/pay/confirm", { payment_id: pid })
        .catch(() => {})
        .finally(() => {
          url.searchParams.delete("pay");
          window.history.replaceState({}, "", url.toString());
          refresh();
        });
    }
  }, [refresh]);

  const me = v?.me;
  const m = v?.match;
  const inMatch = !!(me && m && (m.a?.id === me.id || m.b?.id === me.id));

  // If the match moved on while we were mid-flow, drop the local flow.
  useEffect(() => {
    if (!v) return;
    if (step !== "idle" && v.match && !(v.match.status === "open" && v.match.a?.id !== v.me?.id) && !inMatch) {
      setStep("idle");
      setPay(null);
    }
    if (inMatch && step !== "idle") {
      setStep("idle");
      setPay(null);
    }
  }, [v, step, inMatch]);

  const startFlow = (stakeCents: number | null, join: string | null) => {
    setErr(null);
    setStake(stakeCents);
    setJoinId(join);
    setTip({ cents: 0, staffId: v && v.staff.length === 1 ? v.staff[0].id : null });
    setStep(v && v.staff.length > 0 ? "tip" : "pay");
  };

  const doEnter = async (method: "card" | "balance" | "demo") => {
    if (!v) return;
    setErr(null);
    try {
      const r = await post<{ payment_id: string; paid: boolean; match_id: string; client_secret?: string; publishable_key?: string; amount_cents?: number }>(
        "/api/match/enter",
        { code, stake_cents: stake, join_match_id: joinId, tip_cents: tip.cents, tip_staff_id: tip.staffId, method },
      );
      if (r.paid) {
        setStep("idle");
        setPay(null);
        await refresh();
        return;
      }
      setPay({ payment_id: r.payment_id, client_secret: r.client_secret!, publishable_key: r.publishable_key!, amount_cents: r.amount_cents! });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const onPaid = async () => {
    if (!pay) return;
    try {
      await post("/api/pay/confirm", { payment_id: pay.payment_id });
    } catch {
      /* webhook will land it */
    }
    setPay(null);
    setStep("idle");
    await refresh();
  };

  if (error && !v) return <Shell code={code}><Notice kind="bad">{error}</Notice></Shell>;
  if (!v) return <Shell code={code}><div className="muted pulse text-center py-20 text-2xl font-bold">Loading the table…</div></Shell>;

  const head = (
    <div>
      <div className="eyebrow">{v.venue.name}</div>
      <div className="h1">{v.station.name}</div>
      <div className="muted font-bold">{GAME_LABEL[v.station.game] || "Game"} · {v.venue.stakes.map((s) => money(s)).join(" or ")} a game</div>
    </div>
  );

  // ---- 1. who are you
  if (!me) {
    return (
      <Shell code={code}>
        {head}
        <Identify onDone={refresh} />
      </Shell>
    );
  }

  if (me.locked) {
    return (
      <Shell code={code}>
        {head}
        <Notice kind="bad">This account is locked. Grab the bartender.</Notice>
      </Shell>
    );
  }

  const amount = (stake ?? m?.stake_cents ?? 0) + tip.cents;

  // ---- 2. paying
  if (step === "pay" || pay) {
    const entry = joinId ? m?.stake_cents ?? 0 : stake ?? 0;
    return (
      <Shell code={code}>
        {head}
        <div className="card flex flex-col gap-3">
          <div className="h2">
            {money(entry)} to play{tip.cents ? ` + ${money(tip.cents)} tip` : ""}
          </div>
          <div className="muted font-bold">
            Winner takes {money(v.split[String(entry)]?.winner ?? m?.winner_cents ?? 0)}.{tip.cents ? " Tip goes to the bartender either way." : ""}
          </div>
          {err && <Notice kind="bad">{err}</Notice>}
          {pay ? (
            <PayBox
              clientSecret={pay.client_secret}
              publishableKey={pay.publishable_key}
              amountCents={pay.amount_cents}
              returnUrl={`${window.location.origin}/t/${code}?pay=${pay.payment_id}`}
              onPaid={onPaid}
              onCancel={() => {
                setPay(null);
                setStep("idle");
              }}
            />
          ) : (
            <>
              {v.demo ? (
                <Big kind="primary" className="btn-huge" onClick={() => doEnter("demo")}>
                  Pay {money(amount)} <span className="ml-2 text-base opacity-70">(test mode)</span>
                </Big>
              ) : (
                <>
                  {me.balance_cents >= amount && me.verified && (
                    <Big kind="win" className="btn-huge" onClick={() => doEnter("balance")}>
                      Use my balance ({money(me.balance_cents)})
                    </Big>
                  )}
                  {me.balance_cents >= amount && !me.verified && (
                    <Notice kind="info">
                      You have {money(me.balance_cents)} in winnings. <Link className="underline" href="/me">Verify your number</Link> to play with it.
                    </Notice>
                  )}
                  <Big kind="primary" className="btn-huge" onClick={() => doEnter("card")}>
                    Pay {money(amount)}
                  </Big>
                </>
              )}
              <Big kind="ghost" onClick={() => setStep("idle")}>
                Never mind
              </Big>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ---- 3. tip
  if (step === "tip") {
    return (
      <Shell code={code}>
        {head}
        <div className="card flex flex-col gap-3">
          <div className="h2">Tip your bartender?</div>
          {v.staff.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {v.staff.map((s) => (
                <button key={s.id} className={`choice ${tip.staffId === s.id ? "choice-on" : ""}`} onClick={() => setTip({ ...tip, staffId: s.id })}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {v.staff.length === 1 && <div className="muted font-bold">{v.staff[0].name} is behind the bar.</div>}
          <div className="grid grid-cols-3 gap-2">
            {[100, 200, 500].map((c) => (
              <button
                key={c}
                className="choice"
                style={{ minHeight: 80, fontSize: 28 }}
                disabled={v.staff.length > 1 && !tip.staffId}
                onClick={() => {
                  setTip({ cents: c, staffId: tip.staffId });
                  setStep("pay");
                }}
              >
                {money(c)}
              </button>
            ))}
          </div>
          {v.staff.length > 1 && !tip.staffId && <div className="muted text-center font-bold">Pick who first</div>}
          <Big
            kind="ghost"
            onClick={() => {
              setTip({ cents: 0, staffId: null });
              setStep("pay");
            }}
          >
            No tip, just play
          </Big>
        </div>
      </Shell>
    );
  }

  // ---- 4. a game is going on this table
  if (m) {
    const iAmA = m.a?.id === me.id;
    const opp = iAmA ? m.b : m.a;
    const myPick = iAmA ? m.a_pick : m.b_pick;
    const theirPick = iAmA ? m.b_pick : m.a_pick;

    if (m.status === "open") {
      if (inMatch) {
        return (
          <Shell code={code}>
            {head}
            <div className="card flex flex-col gap-3">
              <div className="pill pill-live pulse w-fit">You&apos;re in for {money(m.stake_cents)}</div>
              <div className="h2">Waiting on your opponent</div>
              <div className="muted font-bold">Have them scan this table&apos;s code and tap Join. Winner takes {money(m.winner_cents)}.</div>
              <Big
                kind="danger"
                onClick={async () => {
                  try {
                    await post("/api/match/cancel", { match_id: m.id });
                    await refresh();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                Cancel, refund me
              </Big>
              {err && <Notice kind="bad">{err}</Notice>}
            </div>
          </Shell>
        );
      }
      return (
        <Shell code={code}>
          {head}
          <div className="card flex flex-col gap-3">
            <div className="pill pill-live pulse w-fit">{m.a?.name} is waiting</div>
            <div className="h2">Play {m.a?.name} for {money(m.stake_cents)}?</div>
            <div className="muted font-bold">Winner takes {money(m.winner_cents)}.</div>
            <Big kind="primary" className="btn-huge" onClick={() => startFlow(null, m.id)}>
              Join for {money(m.stake_cents)}
            </Big>
          </div>
        </Shell>
      );
    }

    if (!inMatch) {
      return (
        <Shell code={code}>
          {head}
          <div className="card flex flex-col gap-3">
            <div className="pill pill-warn w-fit">Table&apos;s busy</div>
            <div className="h2">{m.a?.name} vs {m.b?.name}</div>
            <div className="muted font-bold">{money(m.winner_cents)} to the winner. Come back when they&apos;re done.</div>
          </div>
        </Shell>
      );
    }

    // live or disputed, and I'm playing
    return (
      <Shell code={code}>
        {head}
        <div className="card flex flex-col gap-3">
          {m.status === "disputed" ? (
            <div className="pill pill-bad w-fit">Needs the bartender</div>
          ) : (
            <div className="pill pill-live w-fit">Game on · {money(m.winner_cents)} to the winner</div>
          )}
          <div className="h2">{m.a?.name} vs {m.b?.name}</div>
          {m.status === "disputed" && (
            <Notice kind="bad">You two picked different winners. Grab the bartender, they settle it from their phone.</Notice>
          )}
          {myPick ? (
            <>
              <Notice kind={theirPick ? "info" : "ok"}>
                You said <b>{myPick === me.id ? "you" : opp?.name}</b> won.{" "}
                {theirPick ? "" : `Waiting on ${opp?.name} to tap the same on their phone.`}
              </Notice>
              <PickButtons me={me} opp={opp} matchId={m.id} onDone={refresh} setErr={setErr} label="Change my answer" small />
            </>
          ) : (
            <>
              <div className="muted font-bold">Game over? Both of you tap who won.</div>
              <PickButtons me={me} opp={opp} matchId={m.id} onDone={refresh} setErr={setErr} />
            </>
          )}
          {err && <Notice kind="bad">{err}</Notice>}
        </div>
      </Shell>
    );
  }

  // ---- 5. the last game just ended and I was in it
  const last = v.last;
  if (last && last.player_ids.includes(me.id) && dismissedLast !== last.id) {
    const won = last.winner_id === me.id;
    return (
      <Shell code={code}>
        {head}
        <div className="card flex flex-col gap-3">
          {won ? (
            <>
              <div className="h1" style={{ color: "var(--win)" }}>You won {money(last.winner_cents)}</div>
              {last.prize_mode === "cash" ? (
                <div className="muted font-bold">
                  It&apos;s in your balance. Play again with it, or <Link className="underline" href="/me">cash it out</Link>.
                </div>
              ) : (
                <Notice kind="ok">Show this screen to the bartender for {money(last.winner_cents)} at the bar. Code <b>{last.id.slice(-4).toUpperCase()}</b></Notice>
              )}
            </>
          ) : (
            <>
              <div className="h1">{last.winner} won that one</div>
              <div className="muted font-bold">Run it back?</div>
            </>
          )}
          <StakeButtons v={v} onPick={(s) => startFlow(s, null)} />
          <Big kind="ghost" onClick={() => setDismissedLast(last.id)}>
            I&apos;m done
          </Big>
        </div>
      </Shell>
    );
  }

  // ---- 6. idle: start a game
  return (
    <Shell code={code}>
      {head}
      <div className="card flex flex-col gap-3">
        <div className="h2">Play someone for the table</div>
        <div className="muted font-bold">
          You both pay, winner takes {money(v.split[String(v.venue.stakes[0])]?.winner ?? 0)}
          {v.venue.stakes[1] ? ` (or ${money(v.split[String(v.venue.stakes[1])]?.winner ?? 0)} on a ${money(v.venue.stakes[1])} game)` : ""}.
        </div>
        {v.myPending && <Notice kind="info">You started a game but didn&apos;t finish paying. Pick a stake to try again.</Notice>}
        <StakeButtons v={v} onPick={(s) => startFlow(s, null)} />
        {me.balance_cents > 0 && (
          <div className="muted text-center font-bold">
            Balance {money(me.balance_cents)} · <Link className="underline" href="/me">your account</Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

function StakeButtons({ v, onPick }: { v: View; onPick: (s: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {v.venue.stakes.map((s, i) => (
        <Big key={s} kind={i === 0 ? "primary" : ""} className={i === 0 ? "btn-huge" : ""} onClick={() => onPick(s)}>
          Play for {money(s)}
          <span className="ml-3 text-base opacity-70">win {money(v.split[String(s)]?.winner ?? 0)}</span>
        </Big>
      ))}
    </div>
  );
}

function PickButtons({
  me, opp, matchId, onDone, setErr, label, small,
}: {
  me: { id: string; first_name: string };
  opp: { id: string; name: string } | null;
  matchId: string;
  onDone: () => Promise<void> | void;
  setErr: (s: string | null) => void;
  label?: string;
  small?: boolean;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const [open, setOpen] = useState(!label);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 6000);
    return () => clearTimeout(t);
  }, [armed]);

  if (label && !open) {
    return (
      <Big kind="ghost" onClick={() => setOpen(true)}>
        {label}
      </Big>
    );
  }
  const pick = async (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setErr(null);
    try {
      await post("/api/match/pick", { match_id: matchId, winner_id: id });
      setArmed(null);
      setOpen(!label);
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const options = [
    { id: me.id, text: "I won" },
    { id: opp?.id || "", text: `${opp?.name || "They"} won` },
  ];
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <Big key={o.id} kind={armed === o.id ? "win" : ""} className={small ? "" : "btn-huge"} onClick={() => pick(o.id)} disabled={!o.id}>
          {armed === o.id ? `Tap again: ${o.text}` : o.text}
        </Big>
      ))}
    </div>
  );
}

function Identify({ onDone }: { onDone: () => Promise<void> | void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setErr(null);
    try {
      await post("/api/auth/identify", { first_name: name, phone });
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="h2">Who&apos;s playing?</div>
      <input className="input" placeholder="First name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <PhoneInput value={phone} onChange={setPhone} />
      <div className="muted text-base font-bold">Your number is how you get your winnings. No spam, no app.</div>
      {err && <Notice kind="bad">{err}</Notice>}
      <Big kind="primary" type="submit" disabled={!name.trim() || phone.length !== 10}>
        Let&apos;s go
      </Big>
    </form>
  );
}

function Shell({ children, code }: { children: React.ReactNode; code: string }) {
  const _ = useMemo(() => code, [code]);
  void _;
  return (
    <main className="shell">
      {children}
      <div className="mt-auto flex items-center justify-between pt-2">
        <Link href="/me" className="muted text-base font-bold underline">
          My balance
        </Link>
        <span className="muted text-sm font-bold">chalk</span>
      </div>
    </main>
  );
}
