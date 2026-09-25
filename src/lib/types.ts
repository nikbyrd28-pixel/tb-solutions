export type Tier = "free" | "inner_circle" | "day_one";

export type Video = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "long" | "short";
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  visibility: "public" | "members" | "unlisted" | "draft";
  min_tier: Tier;
  view_count: number;
  like_count: number;
  tags: string[];
  published_at: string;
};

export type Comment = {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  nb_profiles?: { display_name: string | null; avatar_url: string | null } | null;
};

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: Tier;
};

export const TIER_RANK: Record<Tier, number> = { free: 0, inner_circle: 1, day_one: 2 };
export const canWatch = (userTier: Tier, minTier: Tier) => TIER_RANK[userTier] >= TIER_RANK[minTier];

export const TIERS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    tagline: "Get on the list",
    perks: ["Every public video, no ads", "Weekly drop email", "Vote on what I film next"],
  },
  {
    id: "inner_circle" as const,
    name: "Inner Circle",
    price: "$5/mo",
    tagline: "Behind the chaos",
    perks: ["Unreleased + uncut footage", "Members-only community wall", "Early access to every drop", "Your name in the credits"],
    highlight: true,
  },
  {
    id: "day_one" as const,
    name: "Day One",
    price: "$20/mo",
    tagline: "Ride with me",
    perks: ["Everything in Inner Circle", "Monthly live hangout", "Appear in a video / collab priority", "Day One badge forever"],
  },
];
