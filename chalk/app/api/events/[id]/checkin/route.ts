import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventById } from "@/lib/events";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// Staff marks a paid player as here, or adds a walk-up who paid cash at the bar.
export const POST = handler(async (req, { params }) => {
  const { id } = await params;
  const { venue } = await requireStaff();
  const e = await eventById(id);
  if (!e || e.venue_id !== venue.id) return bad("Not your event", 404);
  const b = await body<{ entry_id?: string; walkup_name?: string; withdraw_id?: string }>(req);
  const q = await db();
  if (b.entry_id) {
    await q`update chalk_event_entries set status = 'checked_in' where id = ${b.entry_id} and event_id = ${id} and status = 'paid'`;
    return json({ ok: true });
  }
  if (b.withdraw_id) {
    if (e.status !== "open") return bad("Bracket already started");
    await q`update chalk_event_entries set status = 'withdrawn' where id = ${b.withdraw_id} and event_id = ${id}`;
    return json({ ok: true });
  }
  if (b.walkup_name) {
    if (e.status !== "open") return bad("Bracket already started");
    const [count] = await q<{ n: number }[]>`select count(*)::int as n from chalk_event_entries where event_id = ${id} and status in ('paid','checked_in')`;
    if (count.n >= e.capacity) return bad("It's full");
    const [ne] = await q<{ id: string }[]>`
      insert into chalk_event_entries (event_id, display_name, status) values (${id}, ${b.walkup_name.trim().slice(0, 24)}, 'checked_in') returning id`;
    return json({ ok: true, entry_id: ne.id });
  }
  return bad("Nothing to do");
});
