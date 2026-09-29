import { handler, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { settleEverything, settleVenue } from "@/lib/settle";
import type { Venue } from "@/lib/types";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// "Pay them now" button. Without a venue_id it runs the whole Monday job.
export const POST = handler(async (req) => {
  await requireAdmin();
  const { venue_id } = await body<{ venue_id?: string }>(req);
  if (venue_id) {
    const q = await db();
    const [v] = await q<Venue[]>`select * from chalk_venues where id = ${venue_id}`;
    if (!v) return bad("No such venue", 404);
    return json(await settleVenue(v));
  }
  return json(await settleEverything());
});
