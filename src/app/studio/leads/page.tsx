import { Download, Trash2 } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { deleteLead } from "../actions";

export const dynamic = "force-dynamic";

export default async function Leads() {
  const sb = await supabaseServer();
  const { data } = await sb.from("nb_leads").select("*").order("created_at", { ascending: false }).limit(500);
  const leads = data ?? [];
  const bySource = leads.reduce<Record<string, number>>((a, l) => { const k = (l.source ?? "unknown").split(":")[0]; a[k] = (a[k] ?? 0) + 1; return a; }, {});

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Studio</p><h1 className="font-display mt-1 text-3xl font-800">Leads <span className="text-muted">{leads.length}</span></h1></div>
        <a href="/studio/leads/export" className="btn btn-ghost h-10 px-4 text-sm"><Download size={15} /> Export CSV</a>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(bySource).map(([k, n]) => <span key={k} className="chip bg-white/8">{k} <span className="text-muted">{n}</span></span>)}
      </div>
      <div className="card mt-5 overflow-x-auto rounded-2xl">
        <table className="table w-full min-w-[640px]">
          <thead><tr><th>Email</th><th>Name</th><th>Source</th><th>UTM</th><th>When</th><th></th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-white/[.02]">
                <td className="font-medium">{l.email}</td>
                <td className="text-muted">{l.name || "—"}</td>
                <td><span className="chip bg-white/8">{l.source ?? "—"}</span></td>
                <td className="text-xs text-muted">{l.utm && Object.keys(l.utm).length ? Object.entries(l.utm as Record<string, string>).map(([k, v]) => `${k.replace("utm_", "")}=${v}`).join(" ") : "—"}</td>
                <td className="text-muted">{timeAgo(l.created_at)}</td>
                <td className="text-right"><form action={async () => { "use server"; await deleteLead(l.id); }}><button className="text-muted hover:text-brand-2" title="Remove"><Trash2 size={14} /></button></form></td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted">No leads yet. Share nickbyrd.com/join.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
