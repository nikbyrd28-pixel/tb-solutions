import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { getSession } from "@/lib/data";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Nick Byrd TV", template: "%s · Nick Byrd TV" },
  description: "Philly suburbs chaos. POV. IRL. Funny moments. On my own platform — no algorithm.",
  openGraph: { title: "Nick Byrd TV", description: "Philly suburbs chaos, on my own platform.", type: "website" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-dvh font-sans">
        <Nav user={user ? { email: user.email ?? "", name: profile?.display_name ?? null, tier: profile?.tier ?? "free" } : null} />
        {children}
      </body>
    </html>
  );
}
