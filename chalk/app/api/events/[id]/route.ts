import { currentPlayer, handler } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { eventView } from "@/lib/events";
import { bad, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const view = await eventView(id);
  if (!view) return bad("No such event", 404);
  const c = await currentPlayer();
  let mine: { entry_id: string; status: string; payment_id: string | null } | null = null;
  if (c) {
    const q = await db();
    const [e] = await q<{ id: string; status: string; payment_id: string | null }[]>`
      select id, status, payment_id from chalk_event_entries where event_id = ${id} and player_id = ${c.player.id} and status <> 'withdrawn' order by created_at desc limit 1`;
    if (e) mine = { entry_id: e.id, status: e.status, payment_id: e.payment_id };
  }
  return json({ ...view, me: c ? { id: c.player.id, first_name: c.player.first_name } : null, mine, demo: env.demoPayments });
});
