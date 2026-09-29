import { handler } from "@/lib/auth";
import { db } from "@/lib/db";
import { setStaffSession } from "@/lib/session";
import type { Staff } from "@/lib/types";
import { bad, body, json, normalizePhone, safeEqual, sha } from "@/lib/util";

export const dynamic = "force-dynamic";

// Phone + PIN. The first time a bartender logs in there's no PIN yet, so the one they type becomes it.
export const POST = handler(async (req) => {
  const b = await body<{ venue?: string; phone?: string; pin?: string }>(req);
  const phone = normalizePhone(b.phone || "");
  const pin = (b.pin || "").replace(/\D/g, "");
  if (!phone) return bad("That phone number doesn't look right");
  if (pin.length < 4 || pin.length > 6) return bad("PIN is 4 to 6 digits");
  const q = await db();
  const rows = await q<(Staff & { venue_slug: string; venue_name: string })[]>`
    select st.*, v.slug as venue_slug, v.name as venue_name from chalk_staff st join chalk_venues v on v.id = st.venue_id
     where st.phone = ${phone} and st.active ${b.venue ? q`and v.slug = ${b.venue}` : q``}
     order by st.created_at asc`;
  if (!rows.length) return bad("We don't have you down as staff here. Ask the manager to add you.", 404);
  const st = rows[0];
  if (!st.pin_hash) {
    await q`update chalk_staff set pin_hash = ${sha(`${st.id}:${pin}`)} where id = ${st.id}`;
  } else if (!safeEqual(st.pin_hash, sha(`${st.id}:${pin}`))) {
    return bad("Wrong PIN", 401);
  }
  await setStaffSession({ sid: st.id, vid: st.venue_id, role: st.role });
  return json({ ok: true, name: st.name, role: st.role, venue: st.venue_name, first_login: !st.pin_hash });
});
