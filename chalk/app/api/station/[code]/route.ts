import { handler } from "@/lib/auth";
import { getPlayerSession } from "@/lib/session";
import { stationView } from "@/lib/matches";
import { bad, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }) => {
  const { code } = await params;
  const s = await getPlayerSession();
  const view = await stationView(code, s?.pid || null);
  if (!view) return bad("No table with that code", 404);
  return json(view);
});
