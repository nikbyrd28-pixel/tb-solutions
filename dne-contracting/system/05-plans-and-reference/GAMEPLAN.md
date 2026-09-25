# D N E Contracting — the gameplan

Order matters. Each step unlocks the next. Dates assume you start Fri Sep 25.

## Week 1 (Sep 25 – Oct 1): Live, real, findable

**Fri — 1 hour, Nick**
1. Push `index.html` to `nikbyrd28-pixel/dne-contracting`, import to Vercel. Site is live.
2. Get from mom: PA HIC number, Saturday hours, 20+ job photos, her headshot, her first name. Put them in the config, set `sampleContent:false`, redeploy.

**Sat — 45 min, mom (with you on the phone)**
3. Google Business Profile: paste description, add 5 categories, turn on Women-owned, add 7 services, add website + `#planner` appointment link, enable Chat, upload photos. (`GOOGLE-BUSINESS-PROFILE-KIT.md`)
4. Copy her review short-link → site config `googleReviewUrl`.

**Sun — 30 min, Nick**
5. Point the n8n webhook at the site (`n8nWebhook` in config). Import `n8n-dne-workflow.json`, add Twilio + Resend keys, put mom's number as the alert target. Fill the planner yourself, confirm she gets the text.

**Mon — 20 min, mom**
6. Post the full Facebook group post (from `#playbook`) in 2 local groups. Post the short version on her personal profile. Link the business page in GBP.

**Tue–Thu**
7. She answers every comment and DM with the scripts. Books consultations. Every booked consult gets entered in the planner by her (or you) so it's in Supabase.

**Goal by Oct 1:** site live, GBP at 100%, first 2–3 consultations booked from Facebook.

---

## Week 2 (Oct 2 – 8): Close the loop
8. Review request text goes to her last 5 happy clients. Target: 5 Google reviews.
9. Supabase `projects` table + RLS (SQL in `SETUP.md`). Enable email auth. Create a login for her first active client → she demos the portal at the walkthrough.
10. Stripe: payment links for deposit / progress / final. Wire into the portal "Pay now" via n8n.
11. GBP posts 2 and 3. Two more Facebook group posts.

## Week 3 (Oct 9 – 15): Automate the follow-up
12. n8n: 4h SMS nudge, 24h email, 48h alert to mom (specs in `retargeting-sequences.md`).
13. n8n: quote sent → 14-day timer → reminder.
14. Weekly Monday reminder to mom: upload progress photos to the portal.

## Week 4 (Oct 16 – 22): First paid channel
14b. Free listings live (Yelp, Nextdoor, Bing, Apple, Houzz, Angi profile) — week 1, see listings kit. LSA application submitted week 3, switched on at 10+ reviews.
15. Only now: Meta ad, $15/day, one creative = her full Facebook post + a real before/after, targeted women 35–65 within 25 mi of Pottstown, landing on `#planner`. Facebook is her copy's home; Google LSA waits until she has 10+ reviews.
16. Referral page live in every invoice email and portal footer.

---

## Weekly rhythm after that (mom, ~2 hrs/week)
- Mon: 1 group post or profile post
- Every day: reply to DMs/comments within the hour
- After every job: photos → portal + GBP, review text to client
- Fri: you check Supabase leads + n8n runs, 10 min

## What "working" looks like at 60 days
- 15+ Google reviews, 4.8+
- 8–12 consultations/month, mostly Facebook + referral
- 3–4 signed projects/month
- Every client in the portal, every invoice paid through it

## Files
| File | Use |
|---|---|
| `dne-site/index.html` | The whole site — config block at top |
| `dne-site/SETUP.md` | Deploy + Supabase + webhook wiring |
| `dne-site/GOOGLE-BUSINESS-PROFILE-KIT.md` | GBP copy, posts, reviews |
| `n8n-dne-workflow.json` | Lead → score → text/email/alert |
| `TB-SOLUTIONS-COMPLETE-SYSTEM.md` | Full architecture reference |
| Site `#playbook` | Mom's Facebook posts, DMs, comment replies |
