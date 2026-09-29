"use client";

export type EventViewT = {
  event: { id: string; name: string; game: string; format: "single_elim" | "round_robin"; entry_cents: number; service_fee_cents: number; capacity: number; starts_at: string; prize_text: string | null; status: string };
  venue: { id: string; name: string; slug: string };
  entries: { id: string; name: string; seed: number | null; wins: number; losses: number; status: string }[];
  spots_left: number;
  matches: { id: string; round: number; position: number; status: string; a: { id: string; name: string } | null; b: { id: string; name: string } | null; winner_entry_id: string | null }[];
  rounds: number;
  champion: string | null;
};

// Renders a single-elimination bracket by round, or round-robin standings + matches.
export function Bracket({ view, big, onPick }: { view: EventViewT; big?: boolean; onPick?: (matchId: string, entryId: string) => void }) {
  const fs = big ? 26 : 17;
  if (view.event.format === "round_robin") {
    const standings = [...view.entries].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    return (
      <div style={{ display: "grid", gridTemplateColumns: big ? "1fr 2fr" : "1fr", gap: 20 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Standings</div>
          {standings.map((e, i) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: fs + 4, fontWeight: 800, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{i + 1}. {e.name}</span>
              <span style={{ color: "var(--win)" }}>{e.wins}-{e.losses}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Matches</div>
          <div style={{ display: "grid", gridTemplateColumns: big ? "1fr 1fr" : "1fr", gap: 8 }}>
            {view.matches.map((m) => (
              <MatchBox key={m.id} m={m} fs={fs} onPick={onPick} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  const rounds = Array.from({ length: view.rounds }, (_, i) => i + 1);
  const roundName = (r: number) => (r === view.rounds ? "Final" : r === view.rounds - 1 ? "Semis" : r === view.rounds - 2 ? "Quarters" : `Round ${r}`);
  return (
    <div style={{ display: "flex", gap: big ? 24 : 12, overflowX: "auto", paddingBottom: 8 }}>
      {rounds.map((r) => (
        <div key={r} style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 10, minWidth: big ? 300 : 200, flex: 1 }}>
          <div className="eyebrow" style={{ textAlign: "center" }}>{roundName(r)}</div>
          {view.matches.filter((m) => m.round === r).map((m) => (
            <MatchBox key={m.id} m={m} fs={fs} onPick={onPick} />
          ))}
        </div>
      ))}
      {view.champion && (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: big ? 300 : 200 }}>
          <div className="eyebrow" style={{ textAlign: "center" }}>Champion</div>
          <div style={{ textAlign: "center", fontSize: big ? 56 : 30, fontWeight: 900, color: "var(--win)" }}>{view.champion}</div>
        </div>
      )}
    </div>
  );
}

function MatchBox({ m, fs, onPick }: { m: EventViewT["matches"][number]; fs: number; onPick?: (matchId: string, entryId: string) => void }) {
  const side = (e: { id: string; name: string } | null, slot: "a" | "b") => {
    const won = e && m.winner_entry_id === e.id;
    const lost = e && m.winner_entry_id && m.winner_entry_id !== e.id;
    const clickable = onPick && e && (m.status === "ready" || m.status === "done");
    return (
      <div
        key={slot}
        onClick={() => clickable && onPick!(m.id, e!.id)}
        style={{
          display: "flex", justifyContent: "space-between", padding: "8px 12px", fontSize: fs, fontWeight: 800,
          background: won ? "#143a24" : "var(--panel-2)", color: won ? "#86efac" : lost ? "var(--muted)" : "var(--text)",
          cursor: clickable ? "pointer" : "default", borderRadius: 10,
        }}
      >
        <span>{e ? e.name : m.status === "bye" ? "bye" : "—"}</span>
        {won && <span>✓</span>}
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, border: `2px solid ${m.status === "ready" ? "var(--accent)" : "var(--line)"}`, borderRadius: 14, padding: 4 }}>
      {side(m.a, "a")}
      {side(m.b, "b")}
    </div>
  );
}
