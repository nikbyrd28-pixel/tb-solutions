import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isHttpUrl } from "@/lib/sleptOnShared";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "") || null;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = clean(b.email, 254)?.toLowerCase() ?? "";
  const artist = clean(b.artist, 120);
  const link_url = clean(b.link_url, 500) ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !artist || !isHttpUrl(link_url))
    return NextResponse.json({ error: "email, artist and a track link are required" }, { status: 400 });

  const row = { email, artist, link_url, handle: clean(b.handle, 80), city: clean(b.city, 80), note: clean(b.note, 500) };
  const sb = await supabaseServer();
  const { error } = await sb.from("nb_submissions").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "23514" ? 400 : 500 });

  // artists are fans too — put them on the list (duplicates are fine)
  await sb.from("nb_leads").insert({ email, name: artist, source: "slept-on:artist" });

  const hook = process.env.N8N_LEAD_WEBHOOK_URL;
  if (hook) fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...row, source: "slept-on:artist" }) }).catch(() => {});
  return NextResponse.json({ ok: true });
}
