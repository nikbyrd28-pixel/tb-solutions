# Loop — Stripe functions (Supabase Edge Functions)

Two edge functions power Loop's self-serve subscriptions. They are **already deployed**
to the Supabase project `qgbjiqdwzgkjkmqyjsmc`. This folder documents them and holds the
source so an IT person can redeploy with the Supabase CLI if ever needed.

## 1. `loop-checkout`  (verify_jwt: true)
Called by the **Start my free month** button on tbsol.net/loyalty.
Creates a Stripe Checkout Session (subscription mode) with:
- $79.00/month recurring
- **30-day free trial** (first month free)
- no setup fee
Returns `{ url }` which the site redirects the customer to.
Your Stripe secret key stays server-side here — never in the website.

**Secret required:** `STRIPE_SECRET_KEY`

## 2. `loop-stripe-webhook`  (verify_jwt: false — authed by Stripe signature instead)
Stripe calls this after a successful checkout (`checkout.session.completed`).
It:
1. Verifies the Stripe signature (rejects anything not signed by Stripe, with replay protection).
2. Generates a unique business slug + a random 4-digit staff PIN.
3. Creates the `reward_settings` row → the business's Loop program is instantly live
   (member card, staff scanner, owner dashboard all work immediately).
4. Drops a "Loop AUTO-PROVISIONED" row into TB Command intakes so you see the new customer.
5. Emails the owner their card link, poster, staff PIN and dashboard link (if Resend is set).
De-dupes by Stripe customer id, so duplicate events never create two programs.

**Secret required:** `STRIPE_WEBHOOK_SECRET` (whsec_… from the Stripe webhook you create)
**Optional:** `RESEND_API_KEY` (to auto-email the owner their welcome details)

---

## Go-live checklist (do once)

1. **Stripe → Developers → API keys:** copy your **Secret key** (start with test mode `sk_test_…`).
2. **Supabase → Project Settings → Edge Functions → Secrets:** add `STRIPE_SECRET_KEY` = that key.
3. **Stripe → Developers → Webhooks → Add endpoint:**
   - URL: `https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/loop-stripe-webhook`
   - Events: **`checkout.session.completed`**
   - After saving, copy the **Signing secret** (`whsec_…`).
4. **Supabase → Edge Functions → Secrets:** add `STRIPE_WEBHOOK_SECRET` = that signing secret.
5. *(Optional)* add `RESEND_API_KEY` to auto-email owners (needs a verified sender domain in Resend).
6. **Test** on tbsol.net/loyalty with card `4242 4242 4242 4242`, any future date/CVC.
   You should: land on the welcome page, see the subscription in Stripe, and see a new
   `reward_settings` program + a "Loop AUTO-PROVISIONED" intake in TB Command.
7. When happy, swap `STRIPE_SECRET_KEY` for your **live** key (`sk_live_…`) and create a
   **live-mode** webhook (repeat steps 3–4 in live mode).

No Stripe products/prices to create — pricing is built inline by `loop-checkout`.
