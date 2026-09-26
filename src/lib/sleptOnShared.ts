// Browser-safe types + helpers for Slept On (no server imports).

export type Drop = {
  id: string;
  number: number;
  title: string | null;
  blurb: string | null;
  status: "draft" | "live";
  published_at: string | null;
};

export type Track = {
  id: string;
  drop_id: string;
  position: number;
  title: string;
  artist: string;
  artist_url: string | null;
  city: string | null;
  link_url: string;
  cover_url: string | null;
  note: string | null;
  fire_count: number;
};

export type Submission = {
  id: string;
  email: string;
  artist: string;
  handle: string | null;
  city: string | null;
  link_url: string;
  note: string | null;
  status: "new" | "picked" | "pass";
  created_at: string;
};

export const dropLabel = (n: number) => `Drop #${String(n).padStart(3, "0")}`;

export type Embed = { kind: "iframe"; src: string; height: number } | { kind: "audio"; src: string } | null;

/** Turn a normal share link into an in-page player. Unknown links just open in a new tab. */
export function toEmbed(raw: string): Embed {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");

  if (/\.(mp3|m4a|wav|ogg|aac)$/i.test(u.pathname)) return { kind: "audio", src: raw };

  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") ?? u.pathname.split("/").pop();
    if (id && /^[\w-]{6,}$/.test(id)) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}?autoplay=1`, height: 220 };
  }
  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    return { kind: "iframe", src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&color=%237c3aed&auto_play=true&visual=false&show_comments=false`, height: 166 };
  }
  if (host === "open.spotify.com") {
    const m = u.pathname.match(/\/(track|album)\/([A-Za-z0-9]+)/);
    if (m) return { kind: "iframe", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: 152 };
  }
  if (host === "audiomack.com") {
    const [artist, type, slug] = u.pathname.split("/").filter(Boolean);
    if (artist && type === "song" && slug) return { kind: "iframe", src: `https://audiomack.com/embed/song/${artist}/${slug}`, height: 252 };
  }
  return null;
}

export const isHttpUrl = (s: string) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(s);
