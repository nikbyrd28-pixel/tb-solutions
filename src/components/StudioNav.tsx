"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clapperboard, Mail, Users, MessageSquare, Disc3 } from "lucide-react";

const items = [
  { href: "/studio", label: "Overview", icon: LayoutDashboard },
  { href: "/studio/videos", label: "Videos", icon: Clapperboard },
  { href: "/studio/leads", label: "Leads", icon: Mail },
  { href: "/studio/members", label: "Members", icon: Users },
  { href: "/studio/posts", label: "Community", icon: MessageSquare },
  { href: "/studio/slept-on", label: "Slept On", icon: Disc3 },
];

export default function StudioNav() {
  const path = usePathname();
  return (
    <nav className="mt-6 flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/studio" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-white/8 text-fg" : "text-muted hover:bg-white/5 hover:text-fg"}`}>
            <Icon size={16} className={active ? "text-brand" : ""} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
