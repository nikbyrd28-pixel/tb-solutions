import { handler } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlayerSession, setPlayerSession } from "@/lib/session";
import type { Player } from "@/lib/types";
import { bad, body, cleanName, json, normalizePhone } from "@/lib/util";

export const dynamic = "force-dynamic";

// First screen: name + phone. No password, no code. Verification only matters for spending a balance.
export const POST = handler(async (req) => {
  const b = await body<{ first_name?: string; phone?: string }>(req);
  const name = cleanName(b.first_name || "");
  const phone = normalizePhone(b.phone || "");
  if (!name) return bad("What's your first name?");
  if (!phone) return bad("That phone number doesn't look right");

  const q = await db();
  const [p] = await q<Player[]>`
    insert into chalk_players (phone, first_name, last_seen_at) values (${phone}, ${name}, now())
    on conflict (phone) do update set last_seen_at = now()
    returning *`;

  // Keep a verified flag only if this device was already verified for this same player.
  const prev = await getPlayerSession();
  const v = prev?.pid === p.id && prev.v === 1 && p.verified_at ? 1 : 0;
  await setPlayerSession({ pid: p.id, v });
  return json({ id: p.id, first_name: p.first_name, balance_cents: p.balance_cents, verified: v === 1, returning: p.first_name !== name });
});
