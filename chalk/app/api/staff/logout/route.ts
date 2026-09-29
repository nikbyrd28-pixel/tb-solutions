import { handler } from "@/lib/auth";
import { clearStaffSession } from "@/lib/session";
import { json } from "@/lib/util";

export const POST = handler(async () => {
  await clearStaffSession();
  return json({ ok: true });
});
