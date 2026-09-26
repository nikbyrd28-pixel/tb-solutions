import { supabaseServer } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { setTier } from "../actions";

export const dynamic = "force-dynamic";
const tierCls: Record<string, string> = { free: "bg-white/8 text-muted", inner_circle: "bg-brand/15 text-brand", day_one: "bg-brand-2/15 text-brand-2" };

export default async function Members() {
  const sb = await supabaseServer();
  const { data } = await sb.from("nb_profiles").select("*").order("created_at", { ascending: false }).limit(500);
  const members = data ?? [];
  const paid = members.filter((m) => m.tier !== "free").length;

  return (
    <div className="fade-up">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Studio</p>
      <h1 className="font-display mt-1 text-3xl font-800">Members <span className="text-muted">{members.length}</span></h1>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[["Total", members.length], ["Paid", paid], ["Free", members.length - paid]].map(([l, n]) => <div key={l} className="card rounded-2xl p-4"><p className="text-xs text-muted">{l}</p><p className="font-display mt-1 text-2xl font-800">{n}</p></div>)}
      </div>
      <div className="card mt-5 overflow-x-auto rounded-2xl">
        <table className="table w-full min-w-[560px]">
          <thead><tr><th>Member</th><th>Tier</th><th>Joined</th><th>Change tier</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-white/[.02]">
                <td><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-bg-3" style={m.avatar_url ? { backgroundImage: `url(${m.avatar_url})`, backgroundSize: "cover" } : {}} /><div><p className="font-medium">{m.display_name ?? "—"}</p><p className="text-xs text-muted">{m.username ?? m.id.slice(0, 8)}</p></div></div></td>
                <td><span className={`chip ${tierCls[m.tier]}`}>{m.tier.replace("_", " ")}</span></td>
                <td className="text-muted">{timeAgo(m.created_at)}</td>
                <td>
                  <form action={async (fd) => { "use server"; await setTier(m.id, String(fd.get("tier"))); }} className="flex gap-2">
                    <select name="tier" defaultValue={m.tier} className="input rounded-lg px-2 py-1 text-xs"><option value="free">free</option><option value="inner_circle">inner circle</option><option value="day_one">day one</option></select>
                    <button className="text-xs text-brand hover:underline">save</button>
                  </form>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted">Nobody has signed in yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">When Stripe is connected, tiers flip automatically. Until then, set them here after a payment.</p>
    </div>
  );
}
