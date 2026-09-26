import { supabaseServer, isAdminEmail } from "@/lib/supabase/server";

export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!isAdminEmail(user?.email)) return new Response("forbidden", { status: 403 });
  const { data } = await sb.from("nb_leads").select("email,name,source,created_at").order("created_at", { ascending: false });
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = ["email,name,source,created_at", ...(data ?? []).map((l) => [l.email, l.name, l.source, l.created_at].map(esc).join(","))].join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
