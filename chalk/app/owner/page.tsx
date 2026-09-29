"use client";

import Link from "next/link";
import { useState } from "react";
import { Big, Notice, PhoneInput, fmtWhen, money, post, usePoll } from "@/components/ui";

type State = {
  me: { id: string; name: string; role: string };
  venue: { id: string; name: string; slug: string; prize_mode: string; free_until: string | null; stripe_onboarded: boolean; has_stripe: boolean; stakes: number[] };
  days: { day: string; matches: number; bar_cents: number; platform_cents: number; tips_cents: number; event_cents: number }[];
  week: { matches: number; bar_cents: number; tips_cents: number; event_cents: number };
  month: { matches: number; bar_cents: number; tips_cents: number; event_cents: number };
  owed: { games_cents: number; games: number; events_cents: number; entries: number; pending_cents: number; total_cents: number };
  staff: { id: string; name: string; role: string; phone: string; on_shift: boolean; week_tips: number; stripe_onboarded: boolean; has_pin: boolean }[];
  events: { id: string; name: string; starts_at: string; status: string; entries: number; capacity: number; entry_cents: number; format: string; game: string }[];
  settlements: { id: string; amount_cents: number; status: string; note: string | null; created_at: string; paid_at: string | null }[];
  stations: { id: string; name: string; code: string; game: string }[];
  payouts: { enabled: boolean };
  app_url: string;
};

export default function OwnerPage() {
  const { data, error, refresh } = usePoll<State>("/api/owner/state", 15000);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (error && !data) {
    return (
      <main className="shell">
        <div className="h1">Owner view</div>
        <Notice kind="bad">{error}</Notice>
        <Link href="/staff" className="btn btn-primary">Log in as owner</Link>
      </main>
    );
  }
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
  const max = Math.max(1, ...data.days.map((d) => d.bar_cents + d.event_cents));
  const last14 = [...data.days].slice(0, 14).reverse();

  return (
    <main className="shell" style={{ maxWidth: 720 }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow">Owner · {data.me.name}</div>
          <div className="h1">{data.venue.name}</div>
        </div>
        <Link href="/staff" className="pill">Bar view</Link>
      </div>
      {err && <Notice kind="bad">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}
      {data.venue.free_until && new Date(data.venue.free_until) >= new Date() && (
        <Notice kind="ok">Launch deal: you keep 100% of game money through {new Date(data.venue.free_until).toLocaleDateString()}.</Notice>
      )}

      <div className="card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Games this week" v={String(data.week.matches)} />
          <Stat label="Your cut, games" v={money(data.week.bar_cents)} />
          <Stat label="Tips to staff" v={money(data.week.tips_cents)} />
          <Stat label="Events" v={money(data.week.event_cents)} />
        </div>
        <div className="muted mt-3 text-sm font-bold">Last 30 days: {data.month.matches} game{data.month.matches === 1 ? "" : "s"} · {money(data.month.bar_cents + data.month.event_cents)} to you · {money(data.month.tips_cents)} in tips to your staff</div>
        <div className="mt-4 flex h-24 items-end gap-1">
          {last14.map((d) => (
            <div key={d.day} title={`${d.day}: ${money(d.bar_cents + d.event_cents)}`} className="flex-1 rounded-t" style={{ height: `${Math.max(3, ((d.bar_cents + d.event_cents) / max) * 100)}%`, background: "var(--accent)" }} />
          ))}
        </div>
        <div className="muted mt-1 flex justify-between text-xs font-bold"><span>2 weeks ago</span><span>today</span></div>
      </div>

      <div className="card flex flex-col gap-2">
        <div className="h2">Next payout: {money(data.owed.total_cents)}</div>
        <div className="muted font-bold">{data.owed.games} game{data.owed.games === 1 ? "" : "s"} ({money(data.owed.games_cents)}) + {data.owed.entries} event entr{data.owed.entries === 1 ? "y" : "ies"} ({money(data.owed.events_cents)}){data.owed.pending_cents ? ` + ${money(data.owed.pending_cents)} from earlier` : ""}. Paid out every Monday.</div>
        {data.payouts.enabled ? (
          data.venue.stripe_onboarded ? (
            <div className="pill pill-live w-fit">Bank connected</div>
          ) : (
            <>
              <Notice kind="info">Connect the bar&apos;s bank so Monday payouts can land. You type it straight into Stripe; we never see it.</Notice>
              {data.me.role === "owner" && (
                <Big kind="primary" onClick={() => act(async () => {
                  const r = await post<{ ready: boolean; url?: string }>("/api/owner/stripe-link");
                  if (r.url) window.location.href = r.url;
                }, "Bank connected.")}>
                  {data.venue.has_stripe ? "Finish bank setup" : "Connect bank for payouts"}
                </Big>
              )}
            </>
          )
        ) : (
          <div className="muted text-sm font-bold">Payouts go live once card payments are switched on. Everything&apos;s being tracked in the meantime.</div>
        )}
        {data.settlements.length > 0 && (
          <table className="table mt-2">
            <thead><tr><th>When</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {data.settlements.map((s) => (
                <tr key={s.id}><td>{new Date(s.created_at).toLocaleDateString()}</td><td className="money">{money(s.amount_cents)}</td><td>{s.status}{s.note ? ` · ${s.note}` : ""}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EventsCard data={data} act={act} />

      <div className="card flex flex-col gap-3">
        <div className="h2">Staff</div>
        <table className="table">
          <thead><tr><th>Name</th><th>Tips (7d)</th><th></th></tr></thead>
          <tbody>
            {data.staff.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-extrabold">{s.name} {s.on_shift && <span className="pill pill-live">on shift</span>}</div>
                  <div className="muted text-xs font-bold">{s.role} · {s.phone}{!s.has_pin ? " · hasn't logged in yet" : ""}</div>
                </td>
                <td className="money font-extrabold">{money(s.week_tips)}</td>
                <td className="text-right">
                  {s.has_pin && <button className="muted text-xs font-bold underline" onClick={() => act(() => post("/api/owner/staff", { reset_pin_id: s.id }), "PIN reset. Next login sets a new one.")}>reset PIN</button>}
                  {s.role !== "owner" && s.id !== data.me.id && (
                    <button className="ml-3 text-xs font-bold underline" style={{ color: "#ff8a8a" }} onClick={() => act(() => post("/api/owner/staff", { remove_id: s.id }), "Removed.")}>remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddStaff act={act} isOwner={data.me.role === "owner"} />
        <div className="muted text-sm font-bold">Bartenders log in at <span className="underline">{data.app_url.replace(/^https?:\/\//, "")}/staff</span> with their phone and any PIN they pick.</div>
      </div>

      <div className="card flex flex-col gap-2">
        <div className="h2">Your tables</div>
        {data.stations.map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-[var(--line)] py-2 last:border-0">
            <div className="font-extrabold">{s.name} <span className="muted text-sm">{s.game}</span></div>
            <a className="muted text-sm font-bold underline" href={`/t/${s.code}`} target="_blank">/t/{s.code}</a>
          </div>
        ))}
        <div className="muted text-sm font-bold">TV screen: open <a className="underline" href={`/tv/${data.venue.slug}`} target="_blank">{data.app_url.replace(/^https?:\/\//, "")}/tv/{data.venue.slug}</a> on the bar&apos;s TV browser.</div>
      </div>
    </main>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="h2 money">{v}</div>
    </div>
  );
}

function AddStaff({ act, isOwner }: { act: (fn: () => Promise<unknown>, done?: string) => Promise<void>; isOwner: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("bartender");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => post("/api/owner/staff", { name, phone, role }), `${name} added. They log in with their phone + a PIN.`).then(() => {
          setName("");
          setPhone("");
        });
      }}
    >
      <input className="input input-sm" placeholder="Bartender's name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex-1"><PhoneInput value={phone} onChange={setPhone} /></div>
      {isOwner && (
        <select className="input input-sm" value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="bartender">Bartender</option>
          <option value="manager">Manager</option>
        </select>
      )}
      <button className="btn btn-sm btn-primary sm:w-auto" type="submit" disabled={!name.trim() || phone.length !== 10}>Add</button>
    </form>
  );
}

function EventsCard({ data, act }: { data: State; act: (fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", game: "pool", format: "single_elim", entry: "15", capacity: "16", when: "", prize: "" });
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="h2">Events</div>
        <button className="btn btn-sm btn-primary w-auto" onClick={() => setOpen(!open)}>{open ? "Close" : "New event"}</button>
      </div>
      {open && (
        <form
          className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () => post("/api/owner/event", { name: f.name, game: f.game, format: f.format, entry_cents: Math.round(Number(f.entry) * 100), capacity: Number(f.capacity), starts_at: new Date(f.when).toISOString(), prize_text: f.prize }),
              "Event's up. Share the link or print the poster.",
            ).then(() => setOpen(false));
          }}
        >
          <input className="input input-sm" placeholder="Thursday 8-ball tournament" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input input-sm" value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })}>
              <option value="pool">Pool</option><option value="darts">Darts</option><option value="shuffleboard">Shuffleboard</option><option value="cornhole">Cornhole</option><option value="other">Trivia / karaoke / other</option>
            </select>
            <select className="input input-sm" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>
              <option value="single_elim">Single elimination</option><option value="round_robin">Round robin</option>
            </select>
            <label className="flex flex-col"><span className="muted text-xs font-bold">Entry $</span><input className="input input-sm" inputMode="decimal" value={f.entry} onChange={(e) => setF({ ...f, entry: e.target.value })} /></label>
            <label className="flex flex-col"><span className="muted text-xs font-bold">Max players</span><input className="input input-sm" inputMode="numeric" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></label>
          </div>
          <label className="flex flex-col"><span className="muted text-xs font-bold">When</span><input className="input input-sm" type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></label>
          <input className="input input-sm" placeholder="Prize: $100 bar tab + trophy" value={f.prize} onChange={(e) => setF({ ...f, prize: e.target.value })} />
          <div className="muted text-xs font-bold">You keep 90% of entries. Players pay a small service fee on top; that covers card costs.</div>
          <button className="btn btn-sm btn-primary" type="submit" disabled={!f.name || !f.when}>Create</button>
        </form>
      )}
      {data.events.length === 0 && !open && <div className="muted font-bold">Put something on your deadest night. Signups and the bracket run themselves.</div>}
      {data.events.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2 last:border-0">
          <div>
            <div className="font-extrabold">{e.name} <span className="muted text-sm">{e.status}</span></div>
            <div className="muted text-sm font-bold">{fmtWhen(e.starts_at)} · {money(e.entry_cents)} · {e.entries}/{e.capacity}</div>
          </div>
          <div className="flex gap-2">
            <Link className="btn btn-sm w-auto" href={`/e/${e.id}`}>Page</Link>
            {["draft", "open"].includes(e.status) && (
              <button className="btn btn-sm btn-danger w-auto" onClick={() => act(() => post("/api/owner/event", { cancel_id: e.id }), "Cancelled.")}>Cancel</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
