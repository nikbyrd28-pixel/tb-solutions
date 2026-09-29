"use client";

import Link from "next/link";
import { useState } from "react";
import { Big, Notice, PhoneInput, money, post, usePoll } from "@/components/ui";

type State = {
  venues: { id: string; slug: string; name: string; city: string | null; status: string; prize_mode: string; free_until: string | null; stripe_onboarded: boolean; stations: number; staff: number; games_week: number; platform_week: number; bar_week: number; tips_week: number; disputes: number; owed: number }[];
  totals: { players: number; games_week: number; platform_week: number; platform_all: number; refunds_due: number };
  config: { stripe: boolean; demo: boolean; sms: boolean; otp: boolean; app_url: string };
};

export default function AdminPage() {
  const { data, error, refresh } = usePoll<State>("/api/admin/state", 20000);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (error && !data) return <AdminLogin onDone={refresh} error={error} />;
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

  return (
    <main className="shell" style={{ maxWidth: 860 }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow">Chalk · admin</div>
          <div className="h1">Bars</div>
        </div>
        <button className="pill" onClick={() => act(() => post("/api/admin/login", { logout: true }))}>log out</button>
      </div>
      {err && <Notice kind="bad">{err}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}

      <div className="card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><div className="eyebrow">Games / 7d</div><div className="h2">{data.totals.games_week}</div></div>
          <div><div className="eyebrow">Mine / 7d</div><div className="h2 money">{money(data.totals.platform_week)}</div></div>
          <div><div className="eyebrow">Mine, all time</div><div className="h2 money">{money(data.totals.platform_all)}</div></div>
          <div><div className="eyebrow">Players</div><div className="h2">{data.totals.players}</div></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`pill ${data.config.stripe && !data.config.demo ? "pill-live" : "pill-warn"}`}>payments: {data.config.demo ? "demo mode" : "stripe live"}</span>
          <span className={`pill ${data.config.sms ? "pill-live" : "pill-warn"}`}>texts: {data.config.sms ? "twilio" : data.config.otp ? "dev code" : "off"}</span>
          {data.totals.refunds_due > 0 && <span className="pill pill-bad">{data.totals.refunds_due} refunds owed (retrying)</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn btn-sm w-auto" onClick={() => act(() => post("/api/admin/settle", {}), "Settlement run finished.")}>Run Monday payouts now</button>
        </div>
      </div>

      <NewVenue act={act} />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Bar</th><th>Setup</th><th>7 days</th><th>Owed to bar</th><th></th></tr></thead>
          <tbody>
            {data.venues.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link href={`/admin/venue/${v.id}`} className="font-extrabold underline">{v.name}</Link>
                  <div className="muted text-xs font-bold">{v.city || ""} · {v.status} · {v.prize_mode === "cash" ? "cash prizes" : "bar credit prizes"}{v.free_until && new Date(v.free_until) >= new Date() ? ` · free until ${v.free_until}` : ""}</div>
                </td>
                <td className="text-sm font-bold">{v.stations} tables · {v.staff} staff{v.stripe_onboarded ? " · bank ✓" : ""}</td>
                <td className="text-sm font-bold">{v.games_week} games · me {money(v.platform_week)} · bar {money(v.bar_week)} · tips {money(v.tips_week)}{v.disputes ? <span className="pill pill-bad ml-2">{v.disputes} disputed</span> : null}</td>
                <td className="money font-extrabold">{money(v.owed)}</td>
                <td className="text-right"><Link href={`/admin/print/${v.id}`} className="text-sm font-bold underline">QR sheet</Link></td>
              </tr>
            ))}
            {data.venues.length === 0 && <tr><td colSpan={5} className="muted font-bold">No bars yet. Add the first one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function NewVenue({ act }: { act: (fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", city: "", owner_name: "", owner_phone: "", tables: "2", boards: "0", prize_mode: "cash", free_days: "30" });
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="h2">Add a bar</div>
        <button className="btn btn-sm btn-primary w-auto" onClick={() => setOpen(!open)}>{open ? "Close" : "New bar"}</button>
      </div>
      {open && (
        <form
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () => post("/api/admin/venue", { ...f, tables: Number(f.tables), boards: Number(f.boards), free_days: Number(f.free_days) }),
              "Bar added. Print the QR sheet and text the owner the login.",
            ).then(() => setOpen(false));
          }}
        >
          <input className="input input-sm" placeholder="Bar name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input input-sm" placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <input className="input input-sm" placeholder="Owner's name" value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} />
          <PhoneInput value={f.owner_phone} onChange={(v) => setF({ ...f, owner_phone: v })} />
          <label className="flex flex-col"><span className="muted text-xs font-bold">Pool tables</span><input className="input input-sm" inputMode="numeric" value={f.tables} onChange={(e) => setF({ ...f, tables: e.target.value })} /></label>
          <label className="flex flex-col"><span className="muted text-xs font-bold">Dart boards</span><input className="input input-sm" inputMode="numeric" value={f.boards} onChange={(e) => setF({ ...f, boards: e.target.value })} /></label>
          <label className="flex flex-col"><span className="muted text-xs font-bold">Prizes</span>
            <select className="input input-sm" value={f.prize_mode} onChange={(e) => setF({ ...f, prize_mode: e.target.value })}>
              <option value="cash">Cash to the winner</option><option value="gift_card">Bar credit (gift-card mode)</option>
            </select>
          </label>
          <label className="flex flex-col"><span className="muted text-xs font-bold">Bar keeps 100% of games for (days)</span><input className="input input-sm" inputMode="numeric" value={f.free_days} onChange={(e) => setF({ ...f, free_days: e.target.value })} /></label>
          <Big kind="primary" type="submit" className="btn-sm sm:col-span-2" disabled={!f.name.trim()}>Add bar</Big>
        </form>
      )}
    </div>
  );
}

function AdminLogin({ onDone, error }: { onDone: () => Promise<void> | void; error: string }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <main className="shell">
      <div className="eyebrow">Chalk</div>
      <div className="h1">Admin</div>
      {/admin_password/i.test(error) && <Notice kind="bad">{error}</Notice>}
      <form
        className="card flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await post("/api/admin/login", { password: pw });
            await onDone();
          } catch (er) {
            setErr((er as Error).message);
          }
        }}
      >
        <input className="input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <Notice kind="bad">{err}</Notice>}
        <Big kind="primary" type="submit" disabled={!pw}>Log in</Big>
      </form>
    </main>
  );
}
