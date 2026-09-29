import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// Gift-card mode: bartender hands over the prize and marks it done.
export const POST = handler(async (req) => {
  const { staff, venue } = await requireStaff();
  const { match_id } = await body<{ match_id?: string }>(req);
  if (!match_id) return bad("match_id");
  const q = await db();
  const rows = await q`
    update chalk_matches set prize_redeemed_at = now(), prize_redeemed_by = ${staff.id}
     where id = ${match_id} and venue_id = ${venue.id} and status = 'completed' and prize_mode = 'gift_card' and prize_redeemed_at is null
     returning id`;
  if (!rows.length) return bad("Already handed out, or not a prize");
  return json({ ok: true });
});
