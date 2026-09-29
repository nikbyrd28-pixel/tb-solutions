import { handler, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, body, cleanName, json, normalizePhone } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  await requireAdmin();
  const b = await body<{ venue_id?: string; name?: string; phone?: string; role?: string; reset_pin_id?: string; remove_id?: string }>(req);
  const q = await db();
  if (b.reset_pin_id) {
    await q`update chalk_staff set pin_hash = null where id = ${b.reset_pin_id}`;
    return json({ ok: true });
  }
  if (b.remove_id) {
    await q`update chalk_staff set active = false, on_shift = false where id = ${b.remove_id}`;
    return json({ ok: true });
  }
  const name = cleanName(b.name || "");
  const phone = normalizePhone(b.phone || "");
  if (!b.venue_id || !name || !phone) return bad("venue, name and a real phone number");
  const role = ["bartender", "manager", "owner"].includes(b.role || "") ? b.role! : "bartender";
  const [s] = await q<{ id: string }[]>`
    insert into chalk_staff (venue_id, name, phone, role) values (${b.venue_id}, ${name}, ${phone}, ${role})
    on conflict (venue_id, phone) do update set name = excluded.name, role = excluded.role, active = true
    returning id`;
  return json({ ok: true, id: s.id });
});
