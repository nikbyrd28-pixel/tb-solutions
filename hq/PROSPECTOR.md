# Prospector — the cold-lead agent

Weekly scheduled task (Mondays 6:50am ET) that refills HQ → Call list with scored, owner-operated plumbers / HVAC / electricians in the 422 corridor + Chester County.

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
`rx_prospects`: name, trade, phone, city, zip, rating, reviews, hours_note, signals, score, **why** (the opener), **pitch** (which offer to lead with), status, notes.

## Towns rotated
Phoenixville, Pottstown, West Chester, Exton, Downingtown, Royersford, Collegeville, Spring City, Kennett Square, Coatesville, Malvern, Paoli, Limerick, Boyertown, Norristown, Conshohocken.

## Not detected (yet)
Google Guaranteed / LSA badge isn't in the Places data. The task also runs a web search per town for "[trade] near [town]" and marks `signals.lsa_badge=true` when a result shows the Google Guaranteed block for a shop already on the list. Treat it as a bonus, not ground truth.

## Manual run
Ask Claude: "run the prospector for Malvern and Paoli, HVAC only."
