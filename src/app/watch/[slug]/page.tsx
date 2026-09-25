import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import VideoCard from "@/components/VideoCard";
import Player from "@/components/Player";
import Engagement from "@/components/Engagement";
import Comments from "@/components/Comments";
import { getVideo, getVideos, getComments, getSession, fmtViews, timeAgo } from "@/lib/data";
import { canWatch } from "@/lib/types";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await getVideo((await params).slug);
  return v ? { title: v.title, description: v.description ?? undefined, openGraph: { images: v.thumbnail_url ? [v.thumbnail_url] : [] } } : {};
}

export default async function Watch({ params }: Props) {
  const { slug } = await params;
  const v = await getVideo(slug);
  if (!v || v.visibility === "draft") notFound();

  const [{ user, profile }, comments, more] = await Promise.all([getSession(), getComments(v.id), getVideos("long", 10)]);
  const allowed = canWatch(profile?.tier ?? "free", v.min_tier);
  const upNext = more.filter((m) => m.id !== v.id).slice(0, 8);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
      <div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
          {allowed ? (
            <Player src={v.video_url} poster={v.thumbnail_url ?? undefined} videoId={v.id} />
          ) : (
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover blur-md opacity-40" />}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white"><Lock /></span>
                <h2 className="text-xl font-bold">This one&apos;s for the {v.min_tier.replace("_", " ")}</h2>
                <p className="max-w-sm text-sm text-muted">Uncut, unreleased, and not going on YouTube. Unlock it and everything else behind the wall.</p>
                <Link href={`/join?tier=${v.min_tier}&from=${v.slug}`} className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white">Unlock for $5/mo</Link>
              </div>
            </div>
          )}
        </div>

        <h1 className="mt-4 text-xl font-bold sm:text-2xl">{v.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand to-brand-2" />
            <div>
              <p className="font-semibold leading-tight">Nick Byrd</p>
              <p className="text-xs text-muted">Philly Suburbs Chaos</p>
            </div>
            <Link href="/join" className="ml-2 rounded-full bg-fg px-4 py-1.5 text-sm font-semibold text-bg">Join</Link>
          </div>
          <Engagement videoId={v.id} likes={v.like_count} slug={v.slug} loggedIn={!!user} />
        </div>

        <div className="mt-4 rounded-2xl bg-bg-2 p-4 text-sm">
          <p className="font-semibold">{fmtViews(v.view_count)} views · {timeAgo(v.published_at)}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted">{v.description}</p>
          {v.tags.length > 0 && <p className="mt-2 text-brand">{v.tags.map((t) => `#${t}`).join(" ")}</p>}
        </div>

        <Comments videoId={v.id} initial={comments} loggedIn={!!user} />
      </div>

      <aside className="mt-8 lg:mt-0">
        <h2 className="mb-3 font-bold">Up next</h2>
        <div className="flex flex-col gap-3">{upNext.map((m) => <VideoCard key={m.id} v={m} compact />)}</div>
        <div className="mt-6 rounded-2xl border border-brand/40 bg-brand/10 p-4">
          <p className="font-bold">Want the uncut version?</p>
          <p className="mt-1 text-sm text-muted">Inner Circle gets everything I can&apos;t post on YouTube.</p>
          <Link href={`/join?from=${v.slug}`} className="mt-3 block rounded-full bg-brand py-2 text-center text-sm font-semibold text-white">See what&apos;s inside</Link>
        </div>
      </aside>
    </main>
  );
}
