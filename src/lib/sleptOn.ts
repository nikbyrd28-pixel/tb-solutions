import { supabaseServer } from "./supabase/server";
import type { Drop, Track } from "./sleptOnShared";

export * from "./sleptOnShared";

/** Live drops, newest first. */
export async function getLiveDrops(limit = 20): Promise<Drop[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("nb_drops")
    .select("*")
    .eq("status", "live")
    .order("number", { ascending: false })
    .limit(limit);
  return (data ?? []) as Drop[];
}

export async function getTracks(dropId: string): Promise<Track[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("nb_tracks").select("*").eq("drop_id", dropId).order("position");
  return (data ?? []) as Track[];
}

/** Current (or requested) live drop + its tracks. */
export async function getDrop(number?: number) {
  const drops = await getLiveDrops();
  const drop = (number ? drops.find((d) => d.number === number) : drops[0]) ?? null;
  const tracks = drop ? await getTracks(drop.id) : [];
  return { drop, drops, tracks };
}

