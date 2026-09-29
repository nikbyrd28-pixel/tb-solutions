import { env } from "@/lib/env";
import { settleEverything } from "@/lib/settle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Monday morning: roll up last week, pay every bar and bartender with a payout account.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}` && key !== env.cronSecret) return new Response("nope", { status: 401 });
  const result = await settleEverything();
  return Response.json({ ok: true, at: new Date().toISOString(), result });
}
