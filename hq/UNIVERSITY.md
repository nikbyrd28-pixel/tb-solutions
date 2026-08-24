# TB University — running the campus

The public page at `/university/` sells the school. `/university/campus/` **is**
the school, and `/university/admin/` is how you run it. This is the operator's
guide: what to switch on, what one sale costs you in effort, and where each
piece lives.

**Status: live.** `hq/university.sql` and `hq/sms-consent.sql` are applied to the
Supabase project. The steps below are for a rebuild or a second environment.

## Switch it on (once, ~2 minutes)

1. Supabase → SQL Editor → paste **all** of `hq/university.sql` → Run.
   It is idempotent; running it again later to pick up changes is safe and will
   not touch student data.
2. Optional but recommended: run `hq/pin-throttle.sql` first if it has not been
   run. The campus calls `pin_gate()` when it exists and skips it when it does
   not, so the order does not matter — but until it is there, student PINs have
   no brute-force protection.
3. Run `hq/sms-consent.sql` if you want the compliant lead forms in `/kit/leadform/`.
4. Open `/university/admin/`, sign in with your HQ login, and mint a code.

Until step 1 is done the campus still runs — it falls back to storing progress
on the student's own device and says so in a banner. The first time they sign in
after the migration, their local progress is replayed into their account.

## Logging in

- **Students** — `/university/campus/`. First time: **Enrol**, an enrolment code
  (`TBU-FOUND1`…`TBU-FOUND5` are live and unused), their name, email, and a
  4-digit PIN they choose. After that it is email + PIN, and the session is
  remembered on the device for 30 days.
- **You** — `/university/admin/`, with your existing HQ Supabase email and
  password. The admin RPCs check the JWT email server-side, so nobody else's
  login opens it.
- **Resellers** — `/kit/loop-resell/`, with the reseller code and its PIN.

Every PIN check on the estate, these included, sits behind `pin_gate()`.

## Selling one seat

Applications from `/university/#apply` land in the `intakes` table with every
other lead on the estate, and appear at the top of `/university/admin/` under
**Applications** — with a flag for whether that person is already a student.

1. Take the money however you take money (Stripe payment link is fine).
2. `/university/admin/` → **Applications** → **Mint code** on their row. That
   ties the code to their email, marks the application invited, and writes the
   message to send. (For someone who never applied, **Mint enrolment codes**
   makes a loose one.)
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

- **Path** — the first screen a new student meets, before any lesson. Three
  questions (what they want in 90 days, what they already have, hours a week)
  and the campus builds their order out of the answers, drawing from any
  campus and skipping what they do not need. Rewritable any time; nothing is
  ever locked.
- **Home** — rank, XP, streak, their next three moves *on their own path*, this
  week's build brief, today's checklist, recent wins.
- **Campuses** — 8 campuses, 59 lessons, each ending in a mission that needs a
  written answer before it counts as done.
- **Daily** — six checklist items and the leaderboard. All six lifts the streak;
  a missed day sends it to zero.
- **Live** — the calls above, and the replays.
- **Wins** — the feed. Five posts a day maximum, XP for the first two.
- **Tools** — the toolstack, which is the part a course cannot give them,
  including the two generators below.

## The kits (`/kit/`)

Both are white-label: the client never sees this school.

- **`/kit/storefront/`** — the Hubs & Babydoll store with the client pulled out
  of it. Fill the form, download one self-contained HTML file, host it
  anywhere. Orders land in `client_leads` under the shop's slug, which is what
  turns a one-off build into a retainer.
- **`/kit/loop-resell/`** — Loop sold as the student's own product, not an
  affiliate link. They get a reseller code, claim the shops they set up (the
  shop's PIN is the proof), set their own price per shop, and see one honest
  book of business: shops, members managed, monthly billing. `hq/loop-reseller.sql`.
- **`/kit/leadform/`** — lead capture whose SMS opt-in passes an A2P 10DLC
  review: unticked checkbox, disclosure assembled from the shop's own facts,
  consent wording stored verbatim with every submission (`sms_consents`), and
  the registration pack — opt-in description, sample messages, HELP/STOP
  replies, and the privacy-policy clause carriers check — written for you.
  `sms_consent_check(client, phone)` answers "may we text this number".

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

## Two things that are deliberately not a syllabus

The Unschool campus is first for a reason, and the path builder runs before
lesson one for the same reason: the students who succeed here are not the ones
who complete things in order. If you add campuses, do not add gating.

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
| `university/campus/curriculum.js` | Also holds the paths, the daily list, the ranks and the weekly build briefs |
| `kit/storefront/` | The resellable ecommerce template + its builder |
| `kit/leadform/` | The A2P-compliant lead form generator |
| `hq/university.sql` | Every table and RPC behind the campus |
| `hq/sms-consent.sql` | Consent records + `lead_capture_with_consent` |
| `hq/loop-reseller.sql` | Reseller codes, claimed shops, the book of business |

## Two things not to change casually

- **Lesson ids.** They are the primary key of somebody's progress.
- **The daily checklist length.** `uni_daily_count()` in SQL and `TBU_DAILY` in
  the curriculum have to match, or the streak either never fires or fires early.
