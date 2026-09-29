export type Venue = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  timezone: string;
  prize_mode: "cash" | "gift_card";
  stake_options_cents: number[];
  winner_bps: number;
  bar_bps: number;
  platform_bps: number;
  tip_platform_fee_bps: number;
  event_platform_fee_bps: number;
  event_service_fee_cents: number;
  free_until: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  status: "active" | "paused" | "closed";
  created_at: string;
};

export type Station = {
  id: string;
  venue_id: string;
  code: string;
  name: string;
  game: string;
  active: boolean;
};

export type Player = {
  id: string;
  phone: string;
  first_name: string;
  balance_cents: number;
  verified_at: string | null;
  birthdate: string | null;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  flags: number;
  locked: boolean;
  created_at: string;
};

export type Staff = {
  id: string;
  venue_id: string;
  name: string;
  phone: string;
  role: "bartender" | "manager" | "owner";
  pin_hash: string | null;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  active: boolean;
  on_shift: boolean;
  shift_started_at: string | null;
};

export type MatchStatus = "open" | "live" | "completed" | "voided" | "disputed";

export type Match = {
  id: string;
  venue_id: string;
  station_id: string;
  game: string;
  stake_cents: number;
  pot_cents: number;
  winner_cents: number;
  bar_cents: number;
  platform_cents: number;
  prize_mode: "cash" | "gift_card";
  status: MatchStatus;
  player_a_id: string | null;
  player_b_id: string | null;
  a_paid: boolean;
  b_paid: boolean;
  a_pick: string | null;
  b_pick: string | null;
  first_pick_at: string | null;
  winner_id: string | null;
  settled_by_staff_id: string | null;
  void_reason: string | null;
  opened_at: string;
  live_at: string | null;
  ended_at: string | null;
  disputed_at: string | null;
  prize_redeemed_at: string | null;
  prize_redeemed_by: string | null;
};

export type Payment = {
  id: string;
  player_id: string | null;
  venue_id: string | null;
  kind: "entry" | "tip" | "ticket" | "load";
  match_id: string | null;
  match_slot: "a" | "b" | null;
  event_entry_id: string | null;
  amount_cents: number;
  entry_cents: number;
  tip_cents: number;
  tip_staff_id: string | null;
  fee_cents: number;
  method: "card" | "balance" | "demo";
  stripe_payment_intent_id: string | null;
  status: "pending" | "paid" | "refunded" | "failed";
  refunded_cents: number;
  stripe_refund_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export type EventRow = {
  id: string;
  venue_id: string;
  name: string;
  game: string;
  format: "single_elim" | "round_robin";
  entry_cents: number;
  service_fee_cents: number;
  capacity: number;
  starts_at: string;
  prize_text: string | null;
  status: "draft" | "open" | "live" | "done" | "cancelled";
  bracket_started_at: string | null;
};

export type EventEntry = {
  id: string;
  event_id: string;
  player_id: string | null;
  display_name: string;
  phone: string | null;
  payment_id: string | null;
  status: "pending" | "paid" | "checked_in" | "refunded" | "withdrawn";
  seed: number | null;
  wins: number;
  losses: number;
};

export type BracketMatch = {
  id: string;
  event_id: string;
  round: number;
  position: number;
  entry_a_id: string | null;
  entry_b_id: string | null;
  winner_entry_id: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
  status: "pending" | "ready" | "done" | "bye";
};
