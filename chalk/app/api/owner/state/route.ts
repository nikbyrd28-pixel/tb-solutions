import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { venueOwed } from "@/lib/settle";
import { stripeReady } from "@/lib/stripe";
import { json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const { staff, venue } = await requireStaff(["owner", "manager"]);
  const q = await db();
  const days = await q<{ day: string; matches: number; bar_cents: number; platform_cents: number; tips_cents: number; event_cents: number }[]>`
    select * from chalk_venue_days(${venue.id}, 30)`;
  const week = days.slice(0, 7).reduce(
    (a, d) => ({ matches: a.matches + d.matches, bar_cents: a.bar_cents + Number(d.bar_cents), tips_cents: a.tips_cents + Number(d.tips_cents), event_cents: a.event_cents + Number(d.event_cents) }),
    { matches: 0, bar_cents: 0, tips_cents: 0, event_cents: 0 },
  );
  const month = days.reduce(
    (a, d) => ({ matches: a.matches + d.matches, bar_cents: a.bar_cents + Number(d.bar_cents), tips_cents: a.tips_cents + Number(d.tips_cents), event_cents: a.event_cents + Number(d.event_cents) }),
    { matches: 0, bar_cents: 0, tips_cents: 0, event_cents: 0 },
  );
  const owed = await venueOwed(venue.id);
  const staffRows = await q<{ id: string; name: string; role: string; phone: string; on_shift: boolean; week_tips: number; stripe_onboarded: boolean; has_pin: boolean }[]>`
    select s.id, s.name, s.role, s.phone, s.on_shift, s.stripe_onboarded, (s.pin_hash is not null) as has_pin,
           coalesce((select sum(staff_cents) from chalk_tips t where t.staff_id = s.id and t.created_at > now() - interval '7 days' and t.status <> 'refunded'),0)::int as week_tips
      from chalk_staff s where s.venue_id = ${venue.id} and s.active order by s.role, s.name`;
  const events = await q<{ id: string; name: string; starts_at: string; status: string; entries: number; capacity: number; entry_cents: number; format: string; game: string }[]>`
    select e.id, e.name, e.starts_at, e.status, e.capacity, e.entry_cents, e.format, e.game,
           (select count(*)::int from chalk_event_entries ee where ee.event_id = e.id and ee.status in ('paid','checked_in')) as entries
      from chalk_events e where e.venue_id = ${venue.id} order by e.starts_at desc limit 12`;
  const settlements = await q<{ id: string; amount_cents: number; status: string; note: string | null; created_at: string; paid_at: string | null }[]>`
    select id, amount_cents, status, note, created_at, paid_at from chalk_settlements where venue_id = ${venue.id} and payee_type = 'venue' order by created_at desc limit 10`;
  const stations = await q<{ id: string; name: string; code: string; game: string }[]>`select id, name, code, game from chalk_stations where venue_id = ${venue.id} and active order by name`;

  return json({
    me: { id: staff.id, name: staff.name, role: staff.role },
    venue: { id: venue.id, name: venue.name, slug: venue.slug, prize_mode: venue.prize_mode, free_until: venue.free_until, stripe_onboarded: venue.stripe_onboarded, has_stripe: !!venue.stripe_account_id, stakes: venue.stake_options_cents },
    days: days.map((d) => ({ ...d, bar_cents: Number(d.bar_cents), platform_cents: Number(d.platform_cents), tips_cents: Number(d.tips_cents), event_cents: Number(d.event_cents) })),
    week,
    month,
    owed,
    staff: staffRows,
    events,
    settlements,
    stations,
    payouts: { enabled: stripeReady() && !env.demoPayments },
    app_url: env.appUrl,
  });
});
