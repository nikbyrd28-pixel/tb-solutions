import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { staff } = await requireStaff();
  const { on } = await body<{ on?: boolean }>(req);
  const q = await db();
  await q`update chalk_staff set on_shift = ${!!on}, shift_started_at = ${on ? new Date() : null} where id = ${staff.id}`;
  return json({ ok: true, on_shift: !!on });
});
