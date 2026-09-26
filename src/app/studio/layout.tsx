import Link from "next/link";
import { LayoutDashboard, Clapperboard, Mail, Users, MessageSquare, ExternalLink, Plus } from "lucide-react";
import StudioNav from "@/components/StudioNav";

export const metadata = { title: "Studio" };

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line p-4 md:flex">
        <Link href="/studio" className="flex items-center gap-2 px-2 py-2">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-brand-2" />
          <span className="font-display text-lg font-800">NICK<span className="gradient-text">BYRD</span></span>
          <span className="chip ml-1 bg-white/8 text-muted">Studio</span>
        </Link>
        <Link href="/studio/videos/new" className="btn btn-primary mt-4 h-10 text-sm"><Plus size={15} /> New video</Link>
        <StudioNav />
        <Link href="/" className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-fg"><ExternalLink size={15} /> View site</Link>
      </aside>
      <div className="min-w-0 flex-1">
        {/* mobile top bar */}
        <div className="glass sticky top-0 z-30 flex items-center gap-2 px-4 py-3 md:hidden">
          <Link href="/studio" className="font-display font-800">Studio</Link>
          <div className="ml-auto flex gap-1 overflow-x-auto no-scrollbar text-xs">
            {[["/studio", LayoutDashboard], ["/studio/videos", Clapperboard], ["/studio/leads", Mail], ["/studio/members", Users], ["/studio/posts", MessageSquare]].map(([h, I]) => {
              const Icon = I as typeof Mail;
              return <Link key={h as string} href={h as string} className="rounded-full p-2 text-muted hover:bg-white/5 hover:text-fg"><Icon size={17} /></Link>;
            })}
            <Link href="/studio/videos/new" className="btn btn-primary h-8 w-8 rounded-full"><Plus size={15} /></Link>
          </div>
        </div>
        <main className="p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
