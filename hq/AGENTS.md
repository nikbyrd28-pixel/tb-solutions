# The fleet — every agent that runs without Nick

HQ → Agents shows eight. Each card's status is computed from what the agent left behind, never
from the agent's own report. If a card says IDLE, nothing was produced; if it says RUNNING, rows
exist; if it says NEEDS YOU, there is a draft waiting or a setting missing.

| Agent | What it leaves behind | Runs | Where it lives |
|---|---|---|---|
| **Prospector** | rows in `rx_prospects` (the Call list) | daily 6:50am ET | scheduled task · rules in `PROSPECTOR.md` |
| **SEO build** | pages under `/services/ /for/ /guides/` + `hq/agents/seo.json` | daily 7:00am ET | scheduled task · rules in `SEO.md` |
| **GBP** | 1 Google Business Profile post/week → `agent_posts` (channel `gbp`) | Mon 7:10am ET | scheduled task · rules below |
| **Meta** | 1 Facebook post + 1 Instagram caption → `agent_posts` (`facebook`, `instagram`); auto-published by edge fn `meta-publish` | writes Mon/Wed/Fri 7:15am ET · publishes every 15 min | scheduled task · rules below |
| **Content** | 1 short video script + caption/day → `agent_posts` (`script`) | daily 7:20am ET | scheduled task · rules below |
| **Review** | review-link texts to done jobs → `rx_review_asks` | hourly :15 (pg_cron) | edge fn `rx-review` · `supabase/006_hq_agents.sql` |
| **Visuals** | a thumbnail on every draft (`agent_posts.media_url`), a clip per script when video is on (`video_url`) | daily 7:40am ET | scheduled task · Higgsfield (High) tools |
| **Coach** | rewrites each brain's `learned` from Posted / Skip / Edit signals | Sun 8:00pm ET | scheduled task · rules below |

GBP and Content **cannot post for you** — there is no Google Business Profile API token, and
scripts are for you to record. They write a finished post into the inbox at the bottom of the
Agents tab. You tap Copy, paste it in the app, tap **Posted ✓**. If one is off, **Edit** it or
**Skip** it.

**Meta posts on its own.** Once a Page id + Page token are saved (Agents → Meta card → Connect,
stored in `rx_config` as `META_PAGE_ID` / `META_PAGE_TOKEN` / `META_IG_USER_ID`), every Facebook
and Instagram draft for TB Solutions sits in the inbox for `META_AUTOPOST_DELAY_MIN` minutes
(default 120 — long enough to Skip or Edit it), then the `meta-publish` edge function (pg_cron
every 15 min) posts it and marks it `posted` with the real permalink. **Post now** skips the wait.
Instagram waits until Visuals has put a picture on the draft; Facebook posts with or without one.
The picture is copied into the public `uploads` bucket first (`posts/<id>.jpg`) so Meta is never
handed an expiring CDN link. Failures land in `agent_posts.publish_error` and show on the card;
three failures and it stops trying until you tap Post now again.
Source: `receptionist/supabase/functions/meta-publish/index.ts`, `hq/supabase/011_hq_meta_publish.sql`.
Shop pages (`business_id` not null) are still copy-and-paste — no per-shop tokens yet.

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

**Scripts become explainers.** For every `agent_posts` row with `channel = 'script'`, `status =
'draft'` and `media_url is null`: turn the script into 5–7 frames in the house explainer style
(`tools/explainer/` — cream card, black-outline boxes, TB yellow, our own guy in the yellow work
shirt; never a borrowed cartoon character). Each frame is one beat of the script: a scene the
owner has lived (the quote sent Monday, the calendar going quiet, the phone under the sink), then
the one fix, then `tbsol.net`. Write the spec JSON like `tools/explainer/examples/quote-went-quiet.json`
(`stage` = the drawing in the template's classes, `caption` = the spoken line with one `<mark>`),
run `node tools/explainer/render.mjs <spec> <out>`, upload the PNGs to the `uploads` bucket under
`explainers/<post id>/01.png…` and `reel.mp4`, then
`update agent_posts set media_url = <01.png url>, video_url = <reel.mp4 url>, media_note = media_note || ' · frames: <02.png url>,<03.png url>,…'`.
Commit the spec to `tools/explainer/specs/<post id>.json` so the Coach can see what was drawn.

**Posts get one picture.** For every other draft with `media_url is null`: build an image prompt
from `media_note` + `title` + the shop's trade, generate ONE image with the High image tool (a
phone-photo look: a real truck, hands on a fixture, a job site at dusk; square for Instagram,
landscape otherwise; **no text on the image, no logos, no faces that could be mistaken for a real
person**), and `update agent_posts set media_url = … where id = …`. Skip rows whose brain
instructions say not to. Check `balance` first; if credits are short, do explainers only (they
cost nothing) and say so. Never regenerate a row that already has a url.

## Coach

Runs weekly. **Results first:** for every post with a tagged link, read `hq_post_results()` —
visits (`visitors.utm_campaign`), audit requests (`lsa_leads.utm`), intakes (`intakes.ref`) and
demo-line calls in the 48 hours after it was marked posted. A post that moved a number is the
strongest signal there is; say exactly which angle did it. Then the human signals. For each agent brain (TB and every shop): read the last 30 days of that agent's
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

**What we're selling.** The Job-Ready Website is the lead product — it's what most shops buy
first. At least **two of every three** Meta posts and **every other** GBP post lead with the
website: the quote form that texts the owner the second it's sent, the number one thumb away on
a phone, real Google reviews on the page, live in 5 days, $497 + $47/mo, no contract, the owner
keeps the domain and the site. The CTA for those is `tbsol.net/websites/`. The rest of the posts
rotate the receptionist (missed calls / weekend voicemail) and LSA. A website post still has to
pass the gate — one scene, one specific, one CTA. Scenes that work: the homeowner with water in
the basement who doesn't browse, the plumber whose "site" is a Facebook page from 2019, the quote
request that sat in an inbox until Tuesday. Never trash a competitor or another agency by name.

**One idea per post.** A post is one thing a shop owner would nod at, then one place to go.
GBP posts: under 1,500 characters, no hashtags, a plain CTA ("Call the demo line and hang up
on it — (610) 998-6138"). Facebook: 2–5 short lines, can be a little looser. Instagram caption:
hook line first, then 2–4 lines, up to 5 hashtags that a tradesman would actually follow
(#plumberlife #hvac #electrician #chestercounty #pottstown — not #digitalmarketing).
Scripts: 30–60 seconds spoken, written the way Nick talks, with `caption` = the on-screen hook
(under 8 words) and `media_note` = what to film (phone, one take, truck or job site, no slides).

**The gate — nothing reaches the inbox without passing it.** Write THREE candidates on different
angles, score each against the list, keep the single best, throw the rest away. The keeper must:

1. Open with a situation the owner has actually been in — a time, a place, a thing that happened
   ("Saturday, 4:40pm, you're under a sink and the phone rings"). Not a question, not a slogan.
2. Contain exactly one specific: a number (minutes, dollars, calls), a scene, or a real aggregate
   from this week. Zero specifics fails. Two specifics fails — it's a post, not a report.
3. Say one thing the owner can do or understand. If you need "and also", cut it.
4. End with one CTA that is a phone number or one URL, nothing else. For a shop, their own line.
5. Length: GBP ≤ 600 characters. Facebook ≤ 80 words. Instagram ≤ 60 words + hashtags.
   Script 80–150 words. Over the cap fails.
6. Zero banned words: elevate, unlock, seamless, game-changer, revolutionize, empower, leverage,
   "in today's world", "did you know", "contact us", any emoji, any exclamation mark in a GBP post.
7. Reads aloud in Nick's voice in under 25 seconds without sounding like an ad. If a plumber would
   roll his eyes, it fails.
8. Nothing invented. Every fact traces to AGENTS.md, the brain, the shop's row, or an aggregate
   you queried this run.

If none of the three passes, do not insert. Log an `agent_runs` line saying the gate failed and
why. An empty inbox beats a weak post. In `run_note`, name the angle you kept and the two you threw
away in a few words — that is what the Coach reads.

**Track every link.** The CTA URL carries the tag that lets HQ measure the post:
`?utm_source=<channel>&utm_medium=post&utm_campaign=p-<first 8 chars of the post id>`. So insert
the row first (`returning id`), then `update agent_posts set cta_url = '<url with tag>'` and put
that tagged URL in the body where the link goes. For a shop with no website, the CTA is their phone
number and there is no tag. Channel values: gbp, facebook, instagram, script.

**Do not repeat yourself.** Read the last 30 days of `agent_posts` for your channel first. A new
angle every time; if everything's been said, pick the oldest angle and say it better.

**Write the row, nothing else.** One `insert into agent_posts (agent, channel, business_id, title,
body, caption, cta_url, media_note, run_note)` per post via execute_sql, status left at `draft`.
Never update or delete existing rows — once Nick has touched a post it is his. Never touch
the repo, prices, or any other table. Report in 2–4 lines: what you wrote, the angle, and
anything you noticed that Nick should know (e.g. "the demo line had 0 calls this week").
