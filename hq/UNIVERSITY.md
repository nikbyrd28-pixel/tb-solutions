# TB University — running the campus

The public page at `/university/` sells the school. `/university/campus/` **is**
the school, and `/university/admin/` is how you run it. This is the operator's
guide: what to switch on, what one sale costs you in effort, and where each
piece lives.

## Switch it on (once, ~2 minutes)

1. Supabase → SQL Editor → paste **all** of `hq/university.sql` → Run.
   It is idempotent; running it again later to pick up changes is safe and will
   not touch student data.
2. Optional but recommended: run `hq/pin-throttle.sql` first if it has not been
   run. The campus calls `pin_gate()` when it exists and skips it when it does
   not, so the order does not matter — but until it is there, student PINs have
   no brute-force protection.
3. Open `/university/admin/`, sign in with your HQ login, and mint a code.

Until step 1 is done the campus still runs — it falls back to storing progress
on the student's own device and says so in a banner. The first time they sign in
after the migration, their local progress is replayed into their account.

## Selling one seat

1. Take the money however you take money (Stripe payment link is fine).
2. `/university/admin/` → **Mint enrolment codes** → 1 → copy the block it gives
   you. It already contains the welcome message and their link.
3. Paste it into an email. That is the whole fulfilment.

The link is `/university/campus/?code=TBU-XXXXXX`. They land on the enrol form
with the code filled in, choose a 4-digit PIN, and are on lesson one about
ninety seconds later. Nothing waits on you.

**Cancelling / pausing:** admin → Students → change the dropdown. `cancelled`
locks them out at the next request; `paused` keeps their access and their
progress but flags the row. Nothing is ever deleted.

## Live calls

Admin → **Live calls** → title, start time (your local time), length. It
appears in the campus under **Live**, with an *Add to calendar* button until an
hour before, and a *Join the call* button from ten minutes before until thirty
minutes after it should have ended.

The room is a Jitsi room embedded in the page — free, no accounts, no
downloads, and the student never leaves the campus. Two things worth knowing:

- **The room name is the access control.** It is generated as
  `tbu-<32 hex chars>` and the server only sends it to the browser while the
  call is open. Do not rename rooms to something memorable, and do not paste a
  room name anywhere public.
- **Recording is not built in.** Record locally (OBS, or your phone) and paste
  the link into the *Replay link* box afterwards — it then shows under Replays
  for everyone, including the people who missed it.

If you later want waiting rooms, cloud recording or a branded domain, swap the
iframe in `openRoom()` for Daily.co, Whereby or LiveKit. Nothing else changes —
attendance, XP and the schedule are all server-side already.

## What the students see

- **Home** — rank, XP, streak, the next lesson, today's checklist, recent wins.
- **Campuses** — 7 campuses, 52 lessons, each ending in a mission that needs a
  written answer before it counts as done.
- **Daily** — six checklist items and the leaderboard. All six lifts the streak;
  a missed day sends it to zero.
- **Live** — the calls above, and the replays.
- **Wins** — the feed. Five posts a day maximum, XP for the first two.
- **Tools** — the toolstack, which is the part a course cannot give them.

## The economy

Set in two places that must agree: `TBU_XP` in
`university/campus/curriculum.js` (what the student is shown) and the
`uni_xp_*()` functions in `hq/university.sql` (what is actually paid). The
server is the only writer — if they drift, the server wins on the next render,
but fix the drift rather than living with it.

| Action | XP |
|---|---|
| Lesson read | 40 |
| Mission written up | 40 |
| Daily checklist item | 10 each |
| All six in a day | +40 |
| Every 7th consecutive day | +150 |
| Win posted (first two a day) | 30 |
| Live call attended | 60 |

Ranks: Rookie → Prospector (300) → Operator (900) → Closer (2,000) →
Rainmaker (4,000) → Operator X (7,500).

## Adding a lesson

Add an object to the relevant campus in `university/campus/curriculum.js`:
`{ id, title, min, body, mission, ask }`. The `id` must be unique and must never
change once anyone has completed it — progress is stored against that string.
Everything else — progress bars, XP totals, "lesson 4 of 7", the next-lesson
card — recalculates on its own.

## Files

| Path | What it is |
|---|---|
| `university/index.html` | The public sales page |
| `university/lessons/` | The free mini-course (the funnel) |
| `university/campus/index.html` | The app shell, styles, the enrol/sign-in gate |
| `university/campus/campus.js` | The app: auth, state, views, live calls |
| `university/campus/curriculum.js` | All 52 lessons, the daily checklist, the ranks |
| `university/admin/index.html` | Codes, students, live calls |
| `hq/university.sql` | Every table and RPC behind all of it |

## Two things not to change casually

- **Lesson ids.** They are the primary key of somebody's progress.
- **The daily checklist length.** `uni_daily_count()` in SQL and `TBU_DAILY` in
  the curriculum have to match, or the streak either never fires or fires early.
