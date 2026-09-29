import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  let dbErr = "";
  try {
    const q = await db();
    await q`select 1`;
    dbOk = true;
  } catch (e) {
    dbErr = (e as Error).message;
  }
  return Response.json({
    ok: dbOk,
    db: dbOk ? "ok" : dbErr,
    payments: env.demoPayments ? "demo" : "stripe",
    sms: env.smsEnabled ? "twilio" : env.otpDevCode ? "dev-code" : "off",
    admin: !!env.adminPassword,
    at: new Date().toISOString(),
  });
}
