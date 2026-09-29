import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, body, cleanName, json, normalizePhone } from "@/lib/util";

export const dynamic = "force-dynamic";

// Owner/manager adds a bartender, resets a PIN, or removes someone.
export const POST = handler(async (req) => {
  const { venue, staff: me } = await requireStaff(["owner", "manager"]);
  const b = await body<{ name?: string; phone?: string; role?: string; reset_pin_id?: string; remove_id?: string }>(req);
  const q = await db();
  if (b.reset_pin_id) {
    await q`update chalk_staff set pin_hash = null where id = ${b.reset_pin_id} and venue_id = ${venue.id}`;
    return json({ ok: true });
  }
  if (b.remove_id) {
    if (b.remove_id === me.id) return bad("You can't remove yourself");
    await q`update chalk_staff set active = false, on_shift = false where id = ${b.remove_id} and venue_id = ${venue.id} and role <> 'owner'`;
    return json({ ok: true });
  }
  const name = cleanName(b.name || "");
  const phone = normalizePhone(b.phone || "");
  if (!name) return bad("Name?");
  if (!phone) return bad("Phone number doesn't look right");
  const role = b.role === "manager" && me.role === "owner" ? "manager" : "bartender";
  const [s] = await q<{ id: string }[]>`
    insert into chalk_staff (venue_id, name, phone, role) values (${venue.id}, ${name}, ${phone}, ${role})
    on conflict (venue_id, phone) do update set name = excluded.name, active = true, role = excluded.role
    returning id`;
  return json({ ok: true, id: s.id });
});
