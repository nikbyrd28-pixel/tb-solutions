import { handler } from "@/lib/auth";
import { clearPlayerSession } from "@/lib/session";
import { json } from "@/lib/util";

export const POST = handler(async () => {
  await clearPlayerSession();
  return json({ ok: true });
});
