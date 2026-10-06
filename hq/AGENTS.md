# The fleet — every agent that runs without Nick

HQ → Agents shows eight. Each card's status is computed from what the agent left behind, never
from the agent's own report. If a card says IDLE, nothing was produced; if it says RUNNING, rows
exist; if it says NEEDS YOU, there is a draft waiting or a setting missing.

| Agent | What it leaves behind | Runs | Where it lives |
|---|---|---|---|
| **Prospector** | rows in `rx_prospects` (the Call list) | daily 6:50am ET | scheduled task · rules in `PROSPECTOR.md` |
| **SEO build** | pages under `/services/ /for/ /guides/` + `hq/agents/seo.json` | daily 7:00am ET | scheduled task · rules in `SEO.md` |
| **GBP** | 1 Google Business Profile post/week → `agent_posts` (channel `gbp`) | Mon 7:10am ET | scheduled task · rules below |
| **Meta** | 1 Facebook post + 1 Instagram caption → `agent_posts` (`facebook`, `instagram`) | Mon/Wed/Fri 7:15am ET | scheduled task · rules below |
| **Content** | 1 short video script + caption/day → `agent_posts` (`script`) | daily 7:20am ET | scheduled task · rules below |
| **Review** | review-link texts to done jobs → `rx_review_asks` | hourly :15 (pg_cron) | edge fn `rx-review` · `supabase/006_hq_agents.sql` |
| **Visuals** | a thumbnail on every draft (`agent_posts.media_url`), a clip per script when video is on (`video_url`) | daily 7:40am ET | scheduled task · Higgsfield (High) tools |
| **Coach** | rewrites each brain's `learned` from Posted / Skip / Edit signals | Sun 8:00pm ET | scheduled task · rules below |

The three writers **cannot post for you**: there is no Google Business Profile or Meta API token
on file. They write a finished post into the inbox at the bottom of the Agents tab. You tap Copy,
paste it in the app, tap **Posted ✓**. If one is off, **Edit** it or **Skip** it. That is the whole
workflow, and the paste takes less time than reading this sentence.

To let Meta post on its own later: a Facebook Page access token + the Page id. Then `agent_posts`
rows with status `draft` can be pushed by a small edge function instead of by hand. Not built yet.

## Brains — every agent is editable, and every shop can have its own

`agent_brains` has one row per agent for TB Solutions (`business_id` null) and one per shop with
`rx_businesses.marketing = true` (the paid add-on; the switch is in RX Clients → Edit brain).
Two text fields:

- `instructions` — Nick's standing orders (or the shop owner's, from their app). **Read it at the
  top of every run and obey it**, as long as it doesn't ask you to break a rule below (prices,
  invented facts, contacting anyone). An instruction that conflicts with a rule loses; say so in
  your report.
- `learned` — the Coach's notes on what has worked and what got skipped. Read it; let it steer
  angle, tone and length. Only the Coach writes it.
- `settings` — switches, e.g. Visuals `{"video": true}`.

**Per-shop runs.** The GBP, Meta, Visuals and Review agents run once for TB (null) and once for
every shop with `marketing = true`. For a shop, everything is about that shop: its name, trade,
towns (`service_zips` / `service_area_note`), its review link, its own `knowledge` text — and the
CTA is the shop's own phone line, never TB's. Never mention TB Solutions in a shop's post. Rows
carry that shop's `business_id`. Content (the personal-brand scripts) is TB-only.

**Leave a line.** Every run inserts one plain-English row into `agent_runs (agent, business_id,
note)` per business it worked for — "Wrote a Google post about weekend voicemail", "Nothing to do:
list is full". That is what the owner reads in their app under *What they did*. No jargon.

## Visuals

For every `agent_posts` row with `status = 'draft'` and `media_url is null`: build an image prompt
from `media_note` + `title` + the shop's trade, generate ONE image with the High image tool (a
phone-photo look: a real truck, hands on a fixture, a job site at dusk; square for Instagram,
landscape otherwise; **no text on the image, no logos, no faces that could be mistaken for a real
person**), and `update agent_posts set media_url = … where id = …`. Skip rows whose brain
instructions say not to. If `settings.video` is true on the Visuals brain for that business, also
make ONE clip of 5–8 seconds for each `script` row with `video_url is null` (b-roll that matches
`media_note`, no speech, no on-screen text) and set `video_url`. Check `balance` first; if credits
are short, do images only and say so. Never regenerate a row that already has a url.

## Coach

Runs weekly. For each agent brain (TB and every shop): read the last 30 days of that agent's
`agent_posts` — which were `posted`, which `skipped`, which `edited` (compare `original_body` to
`body`: what did Nick or the owner change? shorter? cut the price? different opener?) — and for
Review, the `rx_review_asks` sent vs skipped reasons. Write a new `learned` (under 1,200 chars):
concrete, in plain words, things the next run can act on ("Skipped 3 of 4 scripts that opened with
a question; posted all 3 that opened with a number." "Owner cut every mention of the dispatch fee —
stop mentioning it."). `update agent_brains set learned = …, updated_at = now(), updated_by =
'coach'`. Never touch `instructions`, `settings`, prices or any other table. If fewer than 3
signals exist, leave `learned` unchanged and say so. Leave one `agent_runs` line per brain touched.

## Backend

`supabase/006_hq_agents.sql` — `agent_posts`, `rx_review_asks`, `rx_businesses.review_url`, the
`hq_agent_*` / `hq_review_asks` RPCs (admin-only, SECURITY DEFINER, same `is_hq_admin()` gate as
everything else) and the pg_cron job that fires `rx-review`.

Review texts need two things per shop, both set in RX Clients → Edit brain → Business:
the **Google review link** (Business Profile → Ask for reviews → copy link), and the customer
having said yes to texts on the call (stored in `rx_sms_optins` / `[sms consent: yes]` on the job).
No link → every done job is logged `skipped: no_review_url` and the card turns yellow. Never
more than one text per job; the unique index on `job_id` makes a double-send impossible.

## Rules for the writers (the scheduled-task prompts point here)

**Who is talking.** Nick Byrd, out of Pottstown PA, young, sells "the front office for the trades"
to plumbers, HVAC and electricians around Chester County and the 422 corridor. Plain, local,
blue-collar. Short sentences. No corporate filler, no "elevate", no "unlock", no "🚀", no
"contact us to learn more". Reads like a text from a guy who knows the trade, not an agency.

**What is true.** Only these facts, and only these prices:

- Never Miss a Call — AI receptionist that answers when the owner can't, books the job into the
  calendar, texts the owner. $497 setup, $197/mo. First 5 shops: $297 setup.
- Lead Engine — Google Local Services Ads set-up and management. $497 setup, $147/mo. First 5: $297.
- Review Engine — texts the review link after the job. $97/mo, no setup.
- Job-Ready Website — $497 build, $47/mo.
- Remodel Planner — $697 build, $67/mo, or $297 added to a website.
- Full Front Office — all of it. $797 setup, $297/mo.
- Demo line callers can try: (610) 998-6138. Site: tbsol.net. Offers: tbsol.net/offers/.

Numbers you may use are the ones you can read from Supabase on the run (aggregate only — calls
answered this week across `rx_calls`, jobs booked in `rx_jobs`, prospects audited). Never a
customer name, never a transcript, never a dollar figure from a job, never a shop's name unless
it is TB Solutions itself. **No invented clients, reviews, results, awards or "a plumber in
Phoenixville told me…" stories.** If the week produced nothing worth citing, write an evergreen
post about the problem (missed calls, weekend voicemail, LSA migration) and say so in `run_note`.

**One idea per post.** A post is one thing a shop owner would nod at, then one place to go.
GBP posts: under 1,500 characters, no hashtags, a plain CTA ("Call the demo line and hang up
on it — (610) 998-6138"). Facebook: 2–5 short lines, can be a little looser. Instagram caption:
hook line first, then 2–4 lines, up to 5 hashtags that a tradesman would actually follow
(#plumberlife #hvac #electrician #chestercounty #pottstown — not #digitalmarketing).
Scripts: 30–60 seconds spoken, written the way Nick talks, with `caption` = the on-screen hook
(under 8 words) and `media_note` = what to film (phone, one take, truck or job site, no slides).

**Do not repeat yourself.** Read the last 30 days of `agent_posts` for your channel first. A new
angle every time; if everything's been said, pick the oldest angle and say it better.

**Write the row, nothing else.** One `insert into agent_posts (agent, channel, business_id, title,
body, caption, cta_url, media_note, run_note)` per post via execute_sql, status left at `draft`.
Never update or delete existing rows — once Nick has touched a post it is his. Never touch
the repo, prices, or any other table. Report in 2–4 lines: what you wrote, the angle, and
anything you noticed that Nick should know (e.g. "the demo line had 0 calls this week").
