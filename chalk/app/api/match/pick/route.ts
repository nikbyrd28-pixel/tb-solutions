import { handler, requirePlayer } from "@/lib/auth";
import { pickWinner } from "@/lib/matches";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { player } = await requirePlayer();
  const { match_id, winner_id } = await body<{ match_id?: string; winner_id?: string }>(req);
  if (!match_id || !winner_id) return bad("match_id and winner_id");
  const r = await pickWinner(match_id, player.id, winner_id);
  return json({ outcome: r.outcome, status: r.match.status, winner_id: r.match.winner_id });
});
