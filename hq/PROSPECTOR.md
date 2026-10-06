# Prospector — the cold-lead agent

Daily scheduled task (6:50am ET, every morning) that tops up HQ → Call list with scored,
owner-operated plumbers / HVAC / electricians in the 422 corridor + Chester County.

**The call list is capped at 30 uncalled prospects.** Each morning the Prospector tops it
back up to 30 and stops — it never runs past the cap. Ask the database how many to add:

```sql
select hq_prospect_slots();   -- 30 minus the rows still sitting at status 'new'
```

Zero means add nothing today. That is a normal result, not a failure: it means the list is
full and the bottleneck is the phone, not the prospecting. Pick 1–2 towns and fill only the
slots you are given.

## Quality only — the floor is 50

A lead goes on the list only if it scores **50 or more**. In practice that means a small
owner-run shop (10–150 reviews) with a real gap on the phone: closed weekends, or no hours
listed, or a low star rating with few reviews (the Review Engine angle). Everything else —
big companies, "open 24 hours", the too-new — is **parked** (`status = 'parked'`): kept in the
table, never on Today, never counted toward the cap. `hq_prospect_slots()` counts only
quality rows, and the Prospector never inserts below the floor. Twenty-four good names beat
thirty names.

## Recon before listing — every kept lead gets looked at

Before a lead is inserted, the Prospector looks at it like Nick would before dialing:
1. **Website** (if any): fetch the home page and the contact/about page. Does it show hours?
   An after-hours number? "Family owned since…"? The owner's name? A booking form? Does it
   work on a phone? Two pages max.
2. **Google listing** from the places result: hours, "open 24 hours", review count and rating,
   date of the last review if present, whether the owner replies to reviews.
3. Write the findings into `audit` (jsonb: `{site: {...}, gmb: {...}, note: '…'}`), set
   `audited_at = now()`, and rewrite `why` as the **opener in spoken English** — one sentence
   Nick can say that proves he looked ("your site says 'call anytime' but the listing's closed
   weekends — which one's true?"). No shorthand. If recon finds nothing beyond the listing,
   `why` still has to be a sentence, not "614 reviews, closed weekends".
Recon takes a minute per lead; that is why the slot budget is small. Never contact anyone.

## How it scores (0–100, higher = call first)
Base 20
+25 small shop (10–150 Google reviews): owner answers the phone himself, feels every missed call
+30 listed closed Sat/Sun: every weekend call hits voicemail today
+15 no hours listed on Google: nobody's running the front office
+10 4.7★+: good shop worth sending more work
−20 "open 24 hours": probably already has an answering service (or lies — ask who picks up at 2am)
−20 500+ reviews: big company, decision isn't the owner's
−10 under 10 reviews: too new to pay

## What's in a row
`rx_prospects`: name, trade, phone, city, zip, rating, reviews, hours_note, signals, score,
**why** (the opener), **pitch** (which offer to lead with), **owner_name**, **email**,
status, notes, attempts, callback_at, last_outcome.

### owner_name and email
Google Places returns neither. The task opens the shop's own website and reads the
About / Contact / Meet the team page for an owner's name and a public business email.
Coverage is partial on purpose — plenty of small shops publish neither, and a wrong name
on a cold call is worse than no name. **Never guess, never pattern-build an address
(no `info@domain` unless the site actually prints it). Leave null.**

## The status model
`new` → `no_answer` | `voicemail` | `callback` | `talking` | `meeting` → `won` | `dead`

A dial is logged through `hq_prospect_log(id, outcome, note, callback_at)`, which bumps the
attempt count and sets when the prospect comes back. Anything you couldn't reach leaves the
Today bucket and returns when it's due: no-answer tomorrow 9am, voicemail in 3 days,
talking in 2 — always a weekday morning. **Six unanswered tries and the row retires itself
to `dead`**, so a dead number can't clog the list forever.

The Prospector only ever inserts `new` rows. It must never touch status, notes, attempts
or callback_at on a row Nick has already worked.

## Towns rotated
Phoenixville, Pottstown, West Chester, Exton, Downingtown, Royersford, Collegeville, Spring City,
Kennett Square, Coatesville, Malvern, Paoli, Limerick, Boyertown, Norristown, Conshohocken.

Pick the 1–2 towns with the fewest rows each morning. Sixteen towns at ~10/day means a town
comes back around roughly every two weeks — long enough for new shops to appear.

## Why the cap exists

A list that grows faster than it gets called is the same as no list. Thirty is roughly a
morning of dialling, so what you see on the Call list is always work you can actually finish.
Rows leaving `new` — called, booked, retired — free the slots back up automatically.

## Not detected (yet)
Google Guaranteed / LSA badge isn't in the Places data. The task also runs a web search per town
for "[trade] near [town]" and marks `signals.lsa_badge=true` when a result shows the Google
Guaranteed block for a shop already on the list. Treat it as a bonus, not ground truth.

## Manual run
Ask Claude: "run the prospector for Malvern and Paoli, HVAC only."
