"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flame, Users, Sparkles, LogOut, LayoutDashboard, Disc3 } from "lucide-react";

type U = { email: string; name: string | null; tier: string; admin: boolean } | null;

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feed", label: "Chaos Feed", icon: Flame },
  { href: "/slept-on", label: "Slept On", icon: Disc3 },
  { href: "/community", label: "Community", icon: Users },
];

export default function Nav({ user }: { user: U }) {
  const path = usePathname();
  if (path.startsWith("/feed") || path.startsWith("/studio")) return null;
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-brand-2" />
            <span className="font-display text-xl font-800 tracking-tight">NICK<span className="gradient-text">BYRD</span></span>
          </Link>
          <nav className="ml-8 hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${path === href ? "bg-white/8 text-fg" : "text-muted hover:bg-white/5 hover:text-fg"}`}>
                <Icon size={15} /> {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                {user.tier !== "free" && <span className="chip bg-brand/15 text-brand">{user.tier.replace("_", " ")}</span>}
                {user.admin && (
                  <Link href="/studio" className="btn btn-ghost h-9 px-3.5 text-sm"><LayoutDashboard size={15} /> Studio</Link>
                )}
                <span className="hidden text-sm text-muted sm:inline">{user.name ?? user.email}</span>
                <form action="/api/auth/signout" method="post">
                  <button className="rounded-full p-2 text-muted transition hover:bg-white/5 hover:text-fg" title="Sign out"><LogOut size={17} /></button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm font-medium text-muted transition hover:text-fg sm:inline">Sign in</Link>
                <Link href="/join" className="btn btn-primary h-9 px-4 text-sm"><Sparkles size={14} /> Join</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* floating mobile pill */}
      <nav className="fixed inset-x-4 bottom-4 z-40 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="glass flex rounded-full p-1.5 shadow-2xl shadow-black/60">
          {[...links, { href: "/join", label: "Join", icon: Sparkles }].map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link key={href} href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10.5px] font-medium transition ${active ? "bg-white/10 text-fg" : "text-muted"}`}>
                <Icon size={19} className={active && href === "/join" ? "text-brand" : ""} /> {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
