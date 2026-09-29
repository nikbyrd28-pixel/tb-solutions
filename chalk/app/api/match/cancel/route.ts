import { handler, requirePlayer } from "@/lib/auth";
import { cancelOpen } from "@/lib/matches";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { player } = await requirePlayer();
  const { match_id } = await body<{ match_id?: string }>(req);
  if (!match_id) return bad("match_id");
  await cancelOpen(match_id, player.id);
  return json({ ok: true });
});
