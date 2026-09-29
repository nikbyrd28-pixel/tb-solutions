import { handler, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripeReady } from "@/lib/stripe";
import { json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  const q = await db();
  const venues = await q<{
    id: string; slug: string; name: string; city: string | null; status: string; prize_mode: string; free_until: string | null;
    stripe_onboarded: boolean; stations: number; staff: number; games_week: number; platform_week: number; bar_week: number; tips_week: number; disputes: number; owed: number;
  }[]>`
    select v.id, v.slug, v.name, v.city, v.status, v.prize_mode, v.free_until, v.stripe_onboarded,
           (select count(*)::int from chalk_stations s where s.venue_id = v.id and s.active) as stations,
           (select count(*)::int from chalk_staff s where s.venue_id = v.id and s.active) as staff,
           (select count(*)::int from chalk_matches m where m.venue_id = v.id and m.status = 'completed' and m.ended_at > now() - interval '7 days') as games_week,
           (select coalesce(sum(platform_cents),0)::int from chalk_matches m where m.venue_id = v.id and m.status = 'completed' and m.ended_at > now() - interval '7 days') as platform_week,
           (select coalesce(sum(bar_cents),0)::int from chalk_matches m where m.venue_id = v.id and m.status = 'completed' and m.ended_at > now() - interval '7 days') as bar_week,
           (select coalesce(sum(amount_cents),0)::int from chalk_tips t where t.venue_id = v.id and t.created_at > now() - interval '7 days' and t.status <> 'refunded') as tips_week,
           (select count(*)::int from chalk_matches m where m.venue_id = v.id and m.status = 'disputed') as disputes,
           (select coalesce(sum(bar_cents),0)::int from chalk_matches m where m.venue_id = v.id and m.status = 'completed' and m.venue_settlement_id is null)
             + (select coalesce(sum(amount_cents),0)::int from chalk_settlements s where s.venue_id = v.id and s.payee_type = 'venue' and s.status = 'pending') as owed
      from chalk_venues v order by v.created_at desc`;
  const [totals] = await q<{ players: number; games_week: number; platform_week: number; platform_all: number; refunds_due: number }[]>`
    select (select count(*)::int from chalk_players) as players,
           (select count(*)::int from chalk_matches where status = 'completed' and ended_at > now() - interval '7 days') as games_week,
           (select coalesce(sum(platform_cents),0)::int from chalk_matches where status = 'completed' and ended_at > now() - interval '7 days') as platform_week,
           (select coalesce(sum(platform_cents),0)::int from chalk_matches where status = 'completed') as platform_all,
           (select count(*)::int from chalk_payments where refund_due and status = 'paid') as refunds_due`;
  return json({
    venues,
    totals,
    config: { stripe: stripeReady(), demo: env.demoPayments, sms: env.smsEnabled, otp: env.otpEnabled, app_url: env.appUrl },
  });
});
