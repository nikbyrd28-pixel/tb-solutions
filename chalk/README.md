# Chalk

Pay-to-play bar games, bartender tips, and ticketed events. One QR code per table, no app.

- Player scans the table, pays $5, plays their buddy, winner takes $6, bar and platform get $2 each.
- Tip line on the way in; tips go straight to the bartender on shift.
- Owners run tournaments; signups, payment and the bracket on the TV are handled.

## Screens

| Path | Who | What |
| --- | --- | --- |
| `/t/<code>` | player | the table (this is what the QR opens) |
| `/me` | player | balance, verify number, cash out |
| `/staff` | bartender | shift on/off, tips, settle arguments, run events |
| `/owner` | owner/manager | revenue, payouts, staff, events (log in at `/staff` first) |
| `/tv/<bar-slug>` | the bar's TV | leaderboards, live tables, bracket |
| `/e/<event-id>` | anyone | event signup; `?staff=1` runs it |
| `/admin` | Nick | bars, tables, staff, payouts, QR print sheets |

## Run it locally

```
cp .env.example .env.local   # point DATABASE_URL at a Postgres with supabase/*.sql applied
npm install
npm run dev
```

`node scripts/e2e.mjs` walks every money path against a running server (demo payments).
`node scripts/shots.mjs` screenshots every screen with a headless phone.

## Going live, in order

1. Deploy (Vercel, root directory `chalk`). Without Stripe keys it runs in demo mode: everything works, no card is charged.
2. Stripe: turn on Connect in the dashboard, then set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and a webhook to `/api/stripe/webhook` (events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`) with its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Until then, players can play with a card but can't spend a balance or cash out.
4. Add the bar in `/admin`, print the QR sheet, text the owner the `/staff` login.

Money never sits in the app: Stripe holds it, Monday's cron pays bars and bartenders by transfer, players cash out on demand.
