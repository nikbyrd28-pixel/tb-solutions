import { handler } from "@/lib/auth";
import { env } from "@/lib/env";
import { clearAdminSession, setAdminSession } from "@/lib/session";
import { bad, body, json, safeEqual } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { password, logout } = await body<{ password?: string; logout?: boolean }>(req);
  if (logout) {
    await clearAdminSession();
    return json({ ok: true });
  }
  if (!env.adminPassword) return bad("ADMIN_PASSWORD isn't set on the server yet", 503);
  if (!password || !safeEqual(password, env.adminPassword)) return bad("Nope", 401);
  await setAdminSession();
  return json({ ok: true });
});
