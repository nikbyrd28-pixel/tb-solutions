import { handler, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, body, cleanName, json, normalizePhone, slugify, stationCode } from "@/lib/util";

export const dynamic = "force-dynamic";

type Body = {
  name?: string; city?: string; address?: string; prize_mode?: string; free_days?: number;
  owner_name?: string; owner_phone?: string; tables?: number; boards?: number;
};

// New bar: venue + owner login + the first stations, in one go.
export const POST = handler(async (req) => {
  await requireAdmin();
  const b = await body<Body>(req);
  const name = (b.name || "").trim().slice(0, 60);
  if (!name) return bad("Bar name?");
  const q = await db();
  let slug = slugify(name) || "bar";
  const taken = await q<{ slug: string }[]>`select slug from chalk_venues where slug like ${slug + "%"}`;
  if (taken.some((t) => t.slug === slug)) slug = `${slug}-${taken.length + 1}`;
  const freeUntil = b.free_days && b.free_days > 0 ? new Date(Date.now() + b.free_days * 86400000).toISOString().slice(0, 10) : null;
  const prize = b.prize_mode === "gift_card" ? "gift_card" : "cash";
  const ownerPhone = b.owner_phone ? normalizePhone(b.owner_phone) : null;
  if (b.owner_phone && !ownerPhone) return bad("Owner phone doesn't look right");
  const [v] = await q<{ id: string; slug: string }[]>`
    insert into chalk_venues (slug, name, city, address, prize_mode, free_until, owner_name, owner_phone)
    values (${slug}, ${name}, ${b.city || null}, ${b.address || null}, ${prize}, ${freeUntil}, ${b.owner_name || null}, ${ownerPhone})
    returning id, slug`;
  if (ownerPhone) {
    await q`insert into chalk_staff (venue_id, name, phone, role) values (${v.id}, ${cleanName(b.owner_name || "Owner") || "Owner"}, ${ownerPhone}, 'owner')`;
  }
  const tables = Math.min(12, Math.max(0, Math.round(Number(b.tables ?? 2))));
  const boards = Math.min(12, Math.max(0, Math.round(Number(b.boards ?? 0))));
  for (let i = 1; i <= tables; i++) await q`insert into chalk_stations (venue_id, code, name, game) values (${v.id}, ${stationCode()}, ${`Table ${i}`}, 'pool')`;
  for (let i = 1; i <= boards; i++) await q`insert into chalk_stations (venue_id, code, name, game) values (${v.id}, ${stationCode()}, ${`Board ${i}`}, 'darts')`;
  return json({ ok: true, id: v.id, slug: v.slug });
});
