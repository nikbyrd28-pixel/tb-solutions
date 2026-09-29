import { env } from "@/lib/env";
import { sweep } from "@/lib/matches";

export const dynamic = "force-dynamic";

// Expire stale games and retry owed refunds. Also runs lazily on every station/staff poll,
// so this is belt-and-suspenders (hit it from n8n every few minutes).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}` && key !== env.cronSecret) return new Response("nope", { status: 401 });
  await sweep();
  return Response.json({ ok: true, at: new Date().toISOString() });
}
