"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flame, Users, Sparkles, LogOut, Upload, Disc3 } from "lucide-react";

type U = { email: string; name: string | null; tier: string } | null;

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feed", label: "Chaos Feed", icon: Flame },
  { href: "/slept-on", label: "Slept On", icon: Disc3 },
  { href: "/community", label: "Community", icon: Users },
];

export default function Nav({ user }: { user: U }) {
  const path = usePathname();
  if (path.startsWith("/feed")) return null; // feed is full-screen
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
            <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-brand-2 live-dot" />
            <span className="text-lg">NICK<span className="gradient-text">BYRD</span></span>
            <span className="hidden text-xs font-medium text-muted sm:inline">TV</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${path === href ? "bg-bg-3 text-fg" : "text-muted hover:text-fg"}`}>
                <Icon size={16} /> {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                {user.tier !== "free" && <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">{user.tier.replace("_", " ")}</span>}
                <Link href="/admin/upload" className="hidden rounded-full p-2 text-muted hover:bg-bg-3 hover:text-fg sm:block" title="Upload"><Upload size={18} /></Link>
                <Link href="/admin/slept-on" className="hidden rounded-full p-2 text-muted hover:bg-bg-3 hover:text-fg sm:block" title="Slept On admin"><Disc3 size={18} /></Link>
                <span className="hidden text-sm text-muted sm:inline">{user.name ?? user.email}</span>
                <form action="/api/auth/signout" method="post">
                  <button className="rounded-full p-2 text-muted hover:bg-bg-3 hover:text-fg" title="Sign out"><LogOut size={18} /></button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-muted hover:text-fg">Sign in</Link>
                <Link href="/join" className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:brightness-110">
                  <Sparkles size={14} /> Join
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {/* mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg/95 backdrop-blur md:hidden">
        {[...links, { href: "/join", label: "Join", icon: Sparkles }].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${path === href ? "text-fg" : "text-muted"}`}>
            <Icon size={20} /> {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
