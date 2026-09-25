import Feed from "@/components/Feed";
import { getVideos, getSession } from "@/lib/data";

export const revalidate = 60;
export const metadata = { title: "Chaos Feed" };

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const [shorts, { user }] = await Promise.all([getVideos("short", 50), getSession()]);
  const { start } = await searchParams;
  return <Feed videos={shorts} start={Number(start ?? 0)} loggedIn={!!user} />;
}
