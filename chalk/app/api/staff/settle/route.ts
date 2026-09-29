import { handler, requireStaff } from "@/lib/auth";
import { settleByStaff } from "@/lib/matches";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// The bartender's call: winner_id, or null to void it and refund both.
export const POST = handler(async (req) => {
  const { staff } = await requireStaff();
  const { match_id, winner_id } = await body<{ match_id?: string; winner_id?: string | null }>(req);
  if (!match_id) return bad("match_id");
  const m = await settleByStaff(match_id, staff, winner_id || null);
  return json({ ok: true, status: m?.status });
});
