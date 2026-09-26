import type { Metadata, Viewport } from "next";
import { Geist, Syne } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { getSession } from "@/lib/data";
import { isAdminEmail } from "@/lib/supabase/server";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const syne = Syne({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Nick Byrd TV", template: "%s · Nick Byrd TV" },
  description: "Philly suburbs chaos. POV. IRL. Funny moments. On my own platform — no algorithm.",
  openGraph: { title: "Nick Byrd TV", description: "Philly suburbs chaos, on my own platform.", type: "website" },
};
export const viewport: Viewport = { themeColor: "#050507", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  return (
    <html lang="en" className={`${geist.variable} ${syne.variable}`}>
      <body className="ambient noise min-h-dvh font-sans">
        <Nav user={user ? { email: user.email ?? "", name: profile?.display_name ?? null, tier: profile?.tier ?? "free", admin: isAdminEmail(user.email) } : null} />
        {children}
      </body>
    </html>
  );
}
