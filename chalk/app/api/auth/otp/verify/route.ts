import { handler, requirePlayer } from "@/lib/auth";
import { db } from "@/lib/db";
import { setPlayerSession } from "@/lib/session";
import { bad, body, json, sha } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { player } = await requirePlayer();
  const { code } = await body<{ code?: string }>(req);
  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return bad("Enter the 6-digit code");
  const q = await db();
  const [otp] = await q<{ id: string; code_hash: string; attempts: number }[]>`
    select id, code_hash, attempts from chalk_otp
     where phone = ${player.phone} and used_at is null and expires_at > now()
     order by created_at desc limit 1`;
  if (!otp) return bad("That code expired. Send a new one.");
  if (otp.attempts >= 5) return bad("Too many tries. Send a new code.");
  if (otp.code_hash !== sha(clean)) {
    await q`update chalk_otp set attempts = attempts + 1 where id = ${otp.id}`;
    return bad("Wrong code");
  }
  await q`update chalk_otp set used_at = now() where id = ${otp.id}`;
  await q`update chalk_players set verified_at = coalesce(verified_at, now()) where id = ${player.id}`;
  await setPlayerSession({ pid: player.id, v: 1 });
  return json({ ok: true });
});
