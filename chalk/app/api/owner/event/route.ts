import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

type Body = { name?: string; game?: string; format?: string; entry_cents?: number; capacity?: number; starts_at?: string; prize_text?: string; cancel_id?: string };

export const POST = handler(async (req) => {
  const { venue } = await requireStaff(["owner", "manager"]);
  const b = await body<Body>(req);
  const q = await db();
  if (b.cancel_id) {
    await q`update chalk_events set status = 'cancelled' where id = ${b.cancel_id} and venue_id = ${venue.id} and status in ('draft','open')`;
    return json({ ok: true });
  }
  const name = (b.name || "").trim().slice(0, 60);
  if (!name) return bad("Give it a name");
  const starts = new Date(b.starts_at || "");
  if (isNaN(starts.getTime())) return bad("Pick a date and time");
  const entry = Math.round(Number(b.entry_cents) || 0);
  if (entry < 0 || entry > 50000) return bad("Entry fee looks off");
  const capacity = Math.min(128, Math.max(2, Math.round(Number(b.capacity) || 16)));
  const format = b.format === "round_robin" ? "round_robin" : "single_elim";
  const game = ["pool", "darts", "shuffleboard", "cornhole", "air_hockey", "other"].includes(b.game || "") ? b.game! : "pool";
  const [e] = await q<{ id: string }[]>`
    insert into chalk_events (venue_id, name, game, format, entry_cents, service_fee_cents, capacity, starts_at, prize_text, status)
    values (${venue.id}, ${name}, ${game}, ${format}, ${entry}, ${entry > 0 ? venue.event_service_fee_cents : 0}, ${capacity}, ${starts}, ${(b.prize_text || "").slice(0, 200) || null}, 'open')
    returning id`;
  return json({ ok: true, id: e.id });
});
