import { TvScreen } from "./TvScreen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TvScreen slug={slug} />;
}
