import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <div className="mt-10">
        <div className="eyebrow">Chalk</div>
        <div className="h1">Play your buddy for the table.</div>
        <div className="muted mt-2 text-xl font-bold">Scan the code on the pool table. $5 each, winner takes $6, tip the bartender on the way in. No app.</div>
      </div>
      <div className="card flex flex-col gap-3">
        <div className="h2">Looking for something?</div>
        <Link href="/me" className="btn">My balance</Link>
        <Link href="/staff" className="btn btn-ghost">Bartender login</Link>
        <Link href="/owner" className="btn btn-ghost">Bar owner</Link>
      </div>
      <div className="muted mt-auto text-sm font-bold">Bars: want this on your tables? Text Nick.</div>
    </main>
  );
}
