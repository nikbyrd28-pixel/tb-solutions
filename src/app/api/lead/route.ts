import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { email, name, source, utm } = await req.json().catch(() => ({}));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "bad email" }, { status: 400 });
  // service role if configured, otherwise anon (RLS allows insert)
  const sb = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin() : await supabaseServer();
  const { error } = await sb.from("nb_leads").insert({ email: email.toLowerCase(), name: name || null, source, utm });
  // 23505 = already on the list — that's a success from the visitor's side
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  // fire n8n (welcome email, add to list, etc.) — non-blocking
  const hook = process.env.N8N_LEAD_WEBHOOK_URL;
  if (hook) fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name, source, utm }) }).catch(() => {});
  return NextResponse.json({ ok: true });
}
