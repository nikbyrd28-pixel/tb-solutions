import { handler, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, body, json, stationCode } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  await requireAdmin();
  const b = await body<{ venue_id?: string; name?: string; game?: string; deactivate_id?: string; rename_id?: string }>(req);
  const q = await db();
  if (b.deactivate_id) {
    await q`update chalk_stations set active = false where id = ${b.deactivate_id}`;
    return json({ ok: true });
  }
  if (b.rename_id && b.name) {
    await q`update chalk_stations set name = ${b.name.slice(0, 30)} where id = ${b.rename_id}`;
    return json({ ok: true });
  }
  if (!b.venue_id || !b.name) return bad("venue_id and name");
  const game = ["pool", "darts", "shuffleboard", "cornhole", "air_hockey", "other"].includes(b.game || "") ? b.game! : "pool";
  const [s] = await q<{ id: string; code: string }[]>`
    insert into chalk_stations (venue_id, code, name, game) values (${b.venue_id}, ${stationCode()}, ${b.name.slice(0, 30)}, ${game}) returning id, code`;
  return json({ ok: true, id: s.id, code: s.code });
});
