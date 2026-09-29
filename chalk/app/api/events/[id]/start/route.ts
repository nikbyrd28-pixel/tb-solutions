import { handler, requireStaff } from "@/lib/auth";
import { eventById, startBracket } from "@/lib/events";
import { bad, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (_req, { params }) => {
  const { id } = await params;
  const { venue } = await requireStaff();
  const e = await eventById(id);
  if (!e || e.venue_id !== venue.id) return bad("Not your event", 404);
  await startBracket(id);
  return json({ ok: true });
});
