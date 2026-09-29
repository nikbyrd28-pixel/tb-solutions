"use client";

import { money, usePoll } from "@/components/ui";
import { Bracket, type EventViewT } from "@/components/Bracket";

type Tv = {
  venue: { name: string; slug: string; stakes: number[]; prize_mode: string };
  tippers: { first_name: string; total_cents: number; tips: number }[];
  players: { first_name: string; wins: number; played: number; won_cents: number }[];
  live: { station: string; a: string | null; b: string | null; status: string; pot_cents: number; winner_cents: number }[];
  recent: { station: string; winner: string; loser: string; winner_cents: number; ended_at: string }[];
  event: EventViewT | null;
  now: string;
};

// Meant for a TV in a browser. Big type, no scrolling, refreshes itself.
export function TvScreen({ slug }: { slug: string }) {
  const { data, error } = usePoll<Tv>(`/api/tv/${slug}`, 8000);
  if (!data) return <main style={wrap}><div className="muted pulse" style={{ fontSize: 40, fontWeight: 800 }}>{error || "Loading…"}</div></main>;

  const liveEvent = data.event && data.event.event.status === "live";

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{data.venue.name}</div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {liveEvent ? data.event!.event.name : `Play for ${money(data.venue.stakes[0])}, win ${money(Math.round(data.venue.stakes[0] * 1.2))}`}
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--muted)" }}>Scan the code on your table</div>
      </div>

      {liveEvent ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Bracket view={data.event!} big />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28, flex: 1, minHeight: 0 }}>
          <Board title="Top tippers this week" rows={data.tippers.map((t) => [t.first_name, money(t.total_cents)])} empty="Tip your bartender when you pay. Get on the board." accent="var(--win)" />
          <Board title="Most wins this month" rows={data.players.map((p) => [p.first_name, `${p.wins}W · ${money(p.won_cents)}`])} empty="Nobody's won yet. Be first." accent="var(--accent)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: 0 }}>
            <Panel title="On the tables now">
              {data.live.length === 0 && <div style={{ color: "var(--muted)", fontSize: 28, fontWeight: 700 }}>Tables are open.</div>}
              {data.live.map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 800, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span>{l.station}: {l.a || "?"} vs {l.b || "…"}</span>
                  <span style={{ color: l.status === "live" ? "var(--win)" : "var(--warn)" }}>{l.status === "open" ? "needs a 2nd" : money(l.winner_cents)}</span>
                </div>
              ))}
            </Panel>
            <Panel title="Just finished">
              {data.recent.length === 0 && <div style={{ color: "var(--muted)", fontSize: 24, fontWeight: 700 }}>—</div>}
              {data.recent.slice(0, 6).map((r, i) => (
                <div key={i} style={{ fontSize: 26, fontWeight: 800, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--win)" }}>{r.winner}</span> beat {r.loser} <span style={{ color: "var(--muted)" }}>· {r.station} · {money(r.winner_cents)}</span>
                </div>
              ))}
            </Panel>
            {data.event && !liveEvent && (
              <Panel title="Coming up">
                <div style={{ fontSize: 30, fontWeight: 900 }}>{data.event.event.name}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--muted)" }}>
                  {new Date(data.event.event.starts_at).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" })} · {money(data.event.event.entry_cents)} entry · {data.event.spots_left} spots left
                </div>
                {data.event.event.prize_text && <div style={{ fontSize: 26, fontWeight: 800, color: "var(--win)" }}>{data.event.event.prize_text}</div>}
              </Panel>
            )}
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 22, fontWeight: 800 }}>
        <span>No app. Scan, pay on your phone, play. Both players tap who won.</span>
        <span>chalk</span>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { padding: "40px 56px", minHeight: "100dvh", display: "flex", flexDirection: "column", gap: 28, background: "var(--bg)" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 24, minHeight: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Board({ title, rows, empty, accent }: { title: string; rows: string[][]; empty: string; accent: string }) {
  return (
    <div className="card" style={{ padding: 28, minHeight: 0, overflow: "hidden" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>{title}</div>
      {rows.length === 0 && <div style={{ color: "var(--muted)", fontSize: 30, fontWeight: 700 }}>{empty}</div>}
      {rows.slice(0, 10).map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: i === 0 ? 46 : 34, fontWeight: 900, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
          <span style={{ color: i === 0 ? accent : "var(--muted)", width: 56 }}>{i + 1}</span>
          <span style={{ flex: 1 }}>{r[0]}</span>
          <span style={{ color: accent }} className="money">{r[1]}</span>
        </div>
      ))}
    </div>
  );
}
