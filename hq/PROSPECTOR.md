# Prospector — the cold-lead agent

Daily scheduled task (6:50am ET, every morning) that tops up HQ → Call list with scored,
owner-operated plumbers / HVAC / electricians in the 422 corridor + Chester County.

**~10 a day from 1–2 towns**, not a weekly dump. A morning's worth, so the list stays
callable instead of piling up faster than the phone can get through it.

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

## Not detected (yet)
Google Guaranteed / LSA badge isn't in the Places data. The task also runs a web search per town
for "[trade] near [town]" and marks `signals.lsa_badge=true` when a result shows the Google
Guaranteed block for a shop already on the list. Treat it as a bonus, not ground truth.

## Manual run
Ask Claude: "run the prospector for Malvern and Paoli, HVAC only."
