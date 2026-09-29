import { handler, requireStaff } from "@/lib/auth";
import { eventById, recordResult } from "@/lib/events";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req, { params }) => {
  const { id } = await params;
  const { venue } = await requireStaff();
  const e = await eventById(id);
  if (!e || e.venue_id !== venue.id) return bad("Not your event", 404);
  const { bracket_match_id, winner_entry_id } = await body<{ bracket_match_id?: string; winner_entry_id?: string }>(req);
  if (!bracket_match_id || !winner_entry_id) return bad("bracket_match_id and winner_entry_id");
  await recordResult(id, bracket_match_id, winner_entry_id);
  return json({ ok: true });
});
