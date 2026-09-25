import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { getSession, timeAgo } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";
import { canWatch, type Tier } from "@/lib/types";

export const metadata = { title: "Community" };

type Post = { id: string; body: string; image_url: string | null; min_tier: Tier; created_at: string; nb_profiles: { display_name: string | null } | null };

export default async function Community() {
  const { user, profile } = await getSession();
  const sb = await supabaseServer();
  const { data } = await sb.from("nb_posts").select("*, nb_profiles(display_name)").order("created_at", { ascending: false }).limit(30);
  const posts = (data ?? []) as Post[];
  const tier = profile?.tier ?? "free";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <h1 className="flex items-center gap-2 text-2xl font-black"><Users className="text-brand" /> Community</h1>
      <p className="mt-1 text-sm text-muted">Where the real ones hang. Members see everything.</p>

      {!user && (
        <div className="mt-6 rounded-2xl border border-brand/40 bg-brand/10 p-4 text-sm">
          <Link href="/login?next=/community" className="font-semibold text-brand">Sign in</Link> to see and post. <Link href="/join" className="underline">Join</Link> to unlock the members wall.
        </div>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {posts.map((p) => {
          const ok = canWatch(tier, p.min_tier);
          return (
            <li key={p.id} className="rounded-2xl border border-line bg-bg-2 p-4">
              <p className="text-xs text-muted"><span className="font-semibold text-fg">{p.nb_profiles?.display_name ?? "Nick"}</span> · {timeAgo(p.created_at)}</p>
              {ok ? (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image_url && <img src={p.image_url} alt="" className="mt-3 rounded-xl" />}
                </>
              ) : (
                <div className="mt-2 flex items-center gap-3 rounded-xl bg-bg-3 p-3 text-sm">
                  <Lock size={16} className="text-brand" />
                  <span className="blur-sm select-none">{p.body.slice(0, 80)}</span>
                  <Link href={`/join?tier=${p.min_tier}`} className="ml-auto shrink-0 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">Unlock</Link>
                </div>
              )}
            </li>
          );
        })}
        {posts.length === 0 && <p className="text-sm text-muted">No posts yet — insert into nb_posts from Supabase or the admin panel.</p>}
      </ul>
    </main>
  );
}
