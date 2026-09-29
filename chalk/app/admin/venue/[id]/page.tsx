"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Big, Notice, PhoneInput, money, post, timeAgo, usePoll } from "@/components/ui";

type Detail = {
  venue: { id: string; slug: string; name: string; city: string | null; status: string; prize_mode: string; free_until: string | null; stake_options_cents: number[]; stripe_onboarded: boolean; owner_name: string | null; owner_phone: string | null };
  stations: { id: string; code: string; name: string; game: string; active: boolean }[];
  staff: { id: string; name: string; phone: string; role: string; active: boolean; on_shift: boolean; stripe_onboarded: boolean; has_pin: boolean }[];
  matches: { id: string; status: string; stake_cents: number; winner_cents: number; bar_cents: number; platform_cents: number; void_reason: string | null; opened_at: string; ended_at: string | null; station: string; a_name: string | null; b_name: string | null; winner: string | null }[];
  settlements: { id: string; amount_cents: number; status: string; note: string | null; created_at: string; payee_type: string }[];
  players: { id: string; first_name: string; phone: string; balance_cents: number; locked: boolean; verified: boolean; games: number }[];
  owed: { total_cents: number; games: number; entries: number };
  app_url: string;
};

export default function VenueAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, refresh } = usePoll<Detail>(`/api/admin/venue/${id}`, 15000);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [st, setSt] = useState({ name: "", game: "pool" });
  const [sf, setSf] = useState({ name: "", phone: "", role: "bartender" });

  if (error && !data) return <main className="shell"><Notice kind="bad">{error}</Notice><Link href="/admin" className="btn">Admin</Link></main>;
  if (!data) return <main className="shell"><div className="muted pulse py-20 text-center text-2xl font-bold">Loading…</div></main>;
  const v = data.venue;
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
  const host = data.app_url.replace(/^https?:\/\//, "");

  return (
    <main className="shell" style={{ maxWidth: 860 }}>
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin" className="eyebrow underline">← all bars</Link>
          <div className="h1">{v.name}</div>
          <div className="muted font-bold">{v.city} · owner {v.owner_name || "?"} {v.owner_phone || ""}</div>
        </div>
        <Link href={`/admin/print/${v.id}`} className="btn btn-sm btn-primary w-auto">Print QR sheet</Link>
      </div>
      {err && <Notice kind="bad">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}

      <div className="card flex flex-col gap-3">
        <div className="h2">Settings</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex flex-col"><span className="muted text-xs font-bold">Prizes</span>
            <select className="input input-sm" value={v.prize_mode} onChange={(e) => act(() => post(`/api/admin/venue/${v.id}`, { prize_mode: e.target.value }), "Saved.")}>
              <option value="cash">Cash to winner</option><option value="gift_card">Bar credit (gift-card)</option>
            </select>
          </label>
          <label className="flex flex-col"><span className="muted text-xs font-bold">Status</span>
            <select className="input input-sm" value={v.status} onChange={(e) => act(() => post(`/api/admin/venue/${v.id}`, { status: e.target.value }), "Saved.")}>
              <option value="active">Active</option><option value="paused">Paused</option><option value="closed">Closed</option>
            </select>
          </label>
          <label className="flex flex-col"><span className="muted text-xs font-bold">Bar keeps 100% of games until</span>
            <input className="input input-sm" type="date" value={v.free_until || ""} onChange={(e) => act(() => post(`/api/admin/venue/${v.id}`, { free_until: e.target.value || null }), "Saved.")} />
          </label>
        </div>
        <div className="muted text-sm font-bold">Stakes: {v.stake_options_cents.map((s) => money(s)).join(", ")} · Owed to bar right now: {money(data.owed.total_cents)} ({data.owed.games} games, {data.owed.entries} entries) · bank {v.stripe_onboarded ? "connected" : "not connected"}</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm w-auto" onClick={() => act(() => post("/api/admin/settle", { venue_id: v.id }), "Settlement done.")}>Pay this bar now</button>
          <a className="btn btn-sm w-auto" href={`/tv/${v.slug}`} target="_blank">Open TV page</a>
          <a className="btn btn-sm w-auto" href={`/staff?v=${v.slug}`} target="_blank">Staff login link</a>
        </div>
        <div className="muted text-xs font-bold">Text the owner: &quot;Log in at {host}/staff with your phone number and any 4-digit PIN.&quot;</div>
      </div>

      <div className="card flex flex-col gap-2">
        <div className="h2">Tables</div>
        {data.stations.map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-[var(--line)] py-2 last:border-0">
            <div className={s.active ? "" : "opacity-50"}>
              <div className="font-extrabold">{s.name} <span className="muted text-sm">{s.game}</span></div>
              <a className="muted text-xs font-bold underline" href={`/t/${s.code}`} target="_blank">{host}/t/{s.code}</a>
            </div>
            {s.active && <button className="text-xs font-bold underline" style={{ color: "#ff8a8a" }} onClick={() => act(() => post("/api/admin/station", { deactivate_id: s.id }), "Removed.")}>remove</button>}
          </div>
        ))}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act(() => post("/api/admin/station", { venue_id: v.id, ...st }), "Table added. Reprint the QR sheet.").then(() => setSt({ name: "", game: "pool" })); }}>
          <input className="input input-sm" placeholder="Table 3" value={st.name} onChange={(e) => setSt({ ...st, name: e.target.value })} />
          <select className="input input-sm" style={{ maxWidth: 160 }} value={st.game} onChange={(e) => setSt({ ...st, game: e.target.value })}>
            <option value="pool">Pool</option><option value="darts">Darts</option><option value="shuffleboard">Shuffleboard</option><option value="cornhole">Cornhole</option><option value="air_hockey">Air hockey</option>
          </select>
          <button className="btn btn-sm btn-primary w-auto" type="submit" disabled={!st.name.trim()}>Add</button>
        </form>
      </div>

      <div className="card flex flex-col gap-2">
        <div className="h2">Staff</div>
        {data.staff.map((s) => (
          <div key={s.id} className={`flex items-center justify-between border-b border-[var(--line)] py-2 last:border-0 ${s.active ? "" : "opacity-40"}`}>
            <div>
              <div className="font-extrabold">{s.name} <span className="muted text-sm">{s.role}</span> {s.on_shift && <span className="pill pill-live">on shift</span>}</div>
              <div className="muted text-xs font-bold">{s.phone} · {s.has_pin ? "has PIN" : "never logged in"} · payouts {s.stripe_onboarded ? "✓" : "not set"}</div>
            </div>
            <div className="flex gap-3">
              {s.has_pin && <button className="muted text-xs font-bold underline" onClick={() => act(() => post("/api/admin/staff", { reset_pin_id: s.id }), "PIN reset.")}>reset PIN</button>}
              {s.active && <button className="text-xs font-bold underline" style={{ color: "#ff8a8a" }} onClick={() => act(() => post("/api/admin/staff", { remove_id: s.id }), "Removed.")}>remove</button>}
            </div>
          </div>
        ))}
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); act(() => post("/api/admin/staff", { venue_id: v.id, ...sf }), "Added.").then(() => setSf({ name: "", phone: "", role: "bartender" })); }}>
          <input className="input input-sm" placeholder="Name" value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} />
          <div className="flex-1"><PhoneInput value={sf.phone} onChange={(p) => setSf({ ...sf, phone: p })} /></div>
          <select className="input input-sm" style={{ maxWidth: 150 }} value={sf.role} onChange={(e) => setSf({ ...sf, role: e.target.value })}>
            <option value="bartender">Bartender</option><option value="manager">Manager</option><option value="owner">Owner</option>
          </select>
          <button className="btn btn-sm btn-primary sm:w-auto" type="submit" disabled={!sf.name.trim() || sf.phone.length !== 10}>Add</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <div className="h2 mb-2">Recent games</div>
        <table className="table">
          <thead><tr><th>When</th><th>Table</th><th>Players</th><th>Result</th><th>Bar / me</th></tr></thead>
          <tbody>
            {data.matches.map((m) => (
              <tr key={m.id}>
                <td className="text-sm">{timeAgo(m.ended_at || m.opened_at)}</td>
                <td className="text-sm">{m.station}</td>
                <td className="text-sm font-bold">{m.a_name || "?"} vs {m.b_name || "—"}</td>
                <td className="text-sm">{m.status === "completed" ? `${m.winner} won ${money(m.winner_cents)}` : m.status === "voided" ? `void: ${m.void_reason}` : m.status}</td>
                <td className="text-sm money">{m.status === "completed" ? `${money(m.bar_cents)} / ${money(m.platform_cents)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="h2 mb-2">Players here</div>
        <table className="table">
          <thead><tr><th>Name</th><th>Games</th><th>Balance</th><th></th></tr></thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.id}>
                <td><div className="font-bold">{p.first_name}{p.locked ? <span className="pill pill-bad ml-2">locked</span> : null}</div><div className="muted text-xs">{p.phone}{p.verified ? " · verified" : ""}</div></td>
                <td>{p.games}</td>
                <td className="money">{money(p.balance_cents)}</td>
                <td className="text-right"><button className="text-xs font-bold underline" onClick={() => act(() => post("/api/admin/player", { player_id: p.id, locked: !p.locked }), p.locked ? "Unlocked." : "Locked.")}>{p.locked ? "unlock" : "lock"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.settlements.length > 0 && (
        <div className="card">
          <div className="h2 mb-2">Payouts</div>
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {data.settlements.map((s) => (
                <tr key={s.id}><td className="text-sm">{new Date(s.created_at).toLocaleDateString()}</td><td className="text-sm">{s.payee_type}</td><td className="money">{money(s.amount_cents)}</td><td className="text-sm">{s.status}{s.note ? ` · ${s.note}` : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Big kind="ghost" onClick={refresh}>Refresh</Big>
    </main>
  );
}
