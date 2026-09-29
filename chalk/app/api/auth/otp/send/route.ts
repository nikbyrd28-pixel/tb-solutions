import { handler, requirePlayer } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms";
import { bad, json, otpCode, sha } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  if (!env.otpEnabled) return bad("Verification texts aren't set up yet. Ask the bartender.", 503);
  const { player } = await requirePlayer();
  const q = await db();

  const [recent] = await q<{ n: number }[]>`
    select count(*)::int as n from chalk_otp where phone = ${player.phone} and created_at > now() - interval '10 minutes'`;
  if (recent.n >= 4) return bad("Too many codes. Wait a few minutes.", 429);

  const code = env.smsEnabled ? otpCode() : env.otpDevCode;
  await q`insert into chalk_otp (phone, code_hash, expires_at) values (${player.phone}, ${sha(code)}, now() + interval '10 minutes')`;
  if (env.smsEnabled) await sendSms(player.phone, `Chalk code: ${code}. It expires in 10 minutes.`);
  return json({ ok: true, dev: !env.smsEnabled });
});
