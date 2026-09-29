import QRCode from "qrcode";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { computeSplit } from "@/lib/matches";
import type { Station, Venue } from "@/lib/types";
import { money } from "@/lib/util";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

// Print one page per table: a big QR code and the three words a drunk person needs.
export default async function PrintSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminSession();
  if (!admin?.admin) return <main className="shell">Log in at /admin first.</main>;
  const q = await db();
  const [venue] = await q<Venue[]>`select * from chalk_venues where id = ${id}`;
  if (!venue) return <main className="shell">No such bar.</main>;
  const stations = await q<Station[]>`select * from chalk_stations where venue_id = ${id} and active order by name`;
  const stake = venue.stake_options_cents[0];
  const split = computeSplit(stake, venue);
  const cards = await Promise.all(
    stations.map(async (s) => ({
      s,
      url: `${env.appUrl}/t/${s.code}`,
      qr: await QRCode.toDataURL(`${env.appUrl}/t/${s.code}`, { width: 900, margin: 1, errorCorrectionLevel: "H" }),
    })),
  );
  const staffUrl = `${env.appUrl}/staff?v=${venue.slug}`;
  const staffQr = await QRCode.toDataURL(staffUrl, { width: 500, margin: 1 });

  return (
    <div className="print-root">
      <style>{`
        body { background: #fff !important; color: #000 !important; }
        .print-root { font-family: -apple-system, Helvetica, Arial, sans-serif; }
        .pg { width: 8.5in; min-height: 11in; margin: 0 auto; padding: 0.6in; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; border-bottom: 1px dashed #bbb; }
        .bar { font-size: 22px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #444; }
        .tbl { font-size: 64px; font-weight: 900; letter-spacing: -0.02em; margin: 6px 0 18px; }
        .qr { width: 5.2in; height: 5.2in; }
        .cta { font-size: 46px; font-weight: 900; margin-top: 18px; }
        .sub { font-size: 30px; font-weight: 800; color: #222; margin-top: 8px; }
        .fine { font-size: 15px; color: #666; margin-top: 28px; max-width: 6in; }
        .url { font-size: 18px; font-weight: 700; color: #333; margin-top: 8px; font-family: monospace; }
        .toolbar { padding: 14px 24px; background: #111; color: #fff; display: flex; gap: 16px; align-items: center; }
        @media print { .toolbar { display: none; } .pg { border: 0; } }
      `}</style>
      <div className="toolbar">
        <PrintButton />
        <span>{stations.length} table cards + 1 staff card. Laminate them. Tape one to each table.</span>
      </div>
      {cards.map(({ s, url, qr }) => (
        <div className="pg" key={s.id}>
          <div className="bar">{venue.name}</div>
          <div className="tbl">{s.name}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr" src={qr} alt={`QR for ${s.name}`} />
          <div className="cta">Scan to play for {money(stake)}</div>
          <div className="sub">Winner takes {money(split.winner)}</div>
          <div className="fine">No app. Scan, pay on your phone, play. Both players tap who won. Bartender settles arguments.</div>
          <div className="url">{url.replace(/^https?:\/\//, "")}</div>
        </div>
      ))}
      <div className="pg">
        <div className="bar">{venue.name} · staff only</div>
        <div className="tbl">Bartenders</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="qr" src={staffQr} alt="Staff login QR" style={{ width: "3.5in", height: "3.5in" }} />
        <div className="cta" style={{ fontSize: 36 }}>Scan at the start of your shift</div>
        <div className="sub" style={{ fontSize: 22 }}>Log in with your phone number + a PIN you pick. Tap &quot;Start my shift&quot; so players can tip you.</div>
        <div className="fine">Tips hit your phone the same night. Arguments over who won: your call is final, one tap.</div>
        <div className="url">{staffUrl.replace(/^https?:\/\//, "")}</div>
      </div>
    </div>
  );
}
