import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dedicated Supabase project for UNDRGRND — kept separate from Loop's production
// database (qgbjiqdwzgkjkmqyjsmc). This is a public anon/publishable key, safe to
// ship client-side: all access is enforced by row-level security policies.
export const supabase = createClient(
  "https://avcslzbglebvrlywnevb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Y3NsemJnbGVidnJseXduZXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDM0NzEsImV4cCI6MjEwNTExOTQ3MX0.mDS0kiE8PpvO5zxFSTvF9mmcoS8wRHMRpgaGCaxIsXA"
);

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

export function embedHtml(track) {
  const title = escapeHtml(track.title);
  if (track.source === "soundcloud") {
    return `<iframe title="${title}" width="100%" height="120" scrolling="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(track.embed_url)}&color=%23ff3b3b&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false"></iframe>`;
  }
  if (track.source === "youtube") {
    return `<iframe title="${title}" width="100%" height="200" src="${escapeHtml(track.embed_url)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  }
  if (track.source === "bandcamp") {
    return `<iframe title="${title}" style="border:0;width:100%;height:120px" src="${escapeHtml(track.embed_url)}"></iframe>`;
  }
  return `<a href="${escapeHtml(track.external_url || track.embed_url)}" target="_blank" rel="noreferrer" class="listen-link">Listen ↗</a>`;
}

// Renders the shared nav into `root` and returns { user, isCurator } so pages
// don't have to re-fetch auth state themselves.
export async function renderNav(root, active) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isCurator = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_curator")
      .eq("id", user.id)
      .single();
    isCurator = !!profile?.is_curator;
  }

  const links = [{ href: "./", label: "Feed", key: "feed" }];
  if (user) links.push({ href: "./library.html", label: "Library", key: "library" });
  if (isCurator) links.push({ href: "./admin.html", label: "Admin", key: "admin" });

  root.innerHTML = `
    <div class="navwrap">
      <a href="./" class="brand">UNDR<span>GRND</span></a>
      <nav class="navlinks">
        ${links.map((l) => `<a href="${l.href}" class="${l.key === active ? "on" : ""}">${l.label}</a>`).join("")}
        ${user ? `<button id="signout" class="linklike">Sign out</button>` : `<a href="./login.html">Sign in</a>`}
      </nav>
    </div>
  `;

  const signoutBtn = root.querySelector("#signout");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "./";
    });
  }

  return { user, isCurator };
}
