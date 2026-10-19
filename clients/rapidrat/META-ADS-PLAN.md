# Rapid Rat Junk Removal - Funnel + Meta Ads Plan

**Client:** Rapid Rat Junk Removal · Coatesville, PA (Western Chester County)
**What we know:** opened 2026 · 5.0★, 64 Google reviews · Google-verified · open 24 hrs · runs a Google sponsored (LSA) listing · black Chevy Silverado pickup · mascot + "Got crap? Call the Rat!" · $25 off Neighborhood Special · services: general junk, furniture & appliances, yard waste, garage & attic cleanouts, construction debris.
**Funnel:** `tbsol.net/clients/rapidrat/` (noindex) → leads land in `client_leads` (client = `rapidrat`), visible in HQ → Leads.
**Sources:** benchmarks and competitor data are in `MARKET-RESEARCH.md`. Anything marked **ASSUMPTION** is unsourced and should be replaced with his real numbers.

---

## 0. Fix first (before spending $1)

| # | Problem | Fix |
|---|---|---|
| 1 | **Two phone numbers.** Banner says 484-245-4967. Google listing says (484) 209-9585. | If 209-9585 is the Google LSA call-tracking number, fine. If not, pick one and make it match everywhere (Google, Facebook page, site, banner). Mismatched numbers cost map rankings and trust. The funnel uses 245-4967, so change it in one place if needed. |
| 2 | **Banner QR goes to `rapidratjunkremoval.com/quote`.** | Scan it on a phone over cell data and confirm the page loads and the form works. On the next print run, point the QR to `tbsol.net/clients/rapidrat/?utm_source=banner` so every banner scan is tracked and gets the $25 flow. |
| 3 | **Speed to lead.** Junk removal goes to whoever answers first. | Every form lead must hit his phone in under 1 minute, and he replies within 5. Right now `client_leads` only shows in HQ. Wire a text alert to the owner (edge fn/n8n on insert) before ads go live. |
| 4 | **His own Meta Pixel.** | Create a Pixel in his Business Manager and paste the ID into `PIXEL_ID` at the bottom of the funnel. Events already wired: `PageView`, `ViewContent` (quote started), `Contact` (call/text tap), `Lead` (form sent). |
| 5 | **Facebook Page.** | Profile pic = mascot, cover = the truck + banner photo, CTA button = "Get Quote" → funnel URL, phone matches #1, 6+ before/after posts so ad clickers don't land on an empty page. |

---

## 1. The funnel (what's built)

Mobile-first, one page, every tap is a conversion path:

1. **Hero:** "Got crap? Call the Rat." + 5.0★/64 reviews badge + $25 off card + real truck photo (not stock).
2. **4-tap quote:** what's going (multi-select) → how much (1-2 items / small load / full truck / cleanout) → when (ASAP / this week / flexible) → name, mobile, zip. Single-choice steps auto-advance. Short steps get far more completions than one long form.
3. **Success screen** pushes "Text a photo now". The photo is what gets him a fast, accurate price.
4. How it works · What we take (+ what we don't) · Google reviews proof · service-area towns · FAQ · final CTA.
5. **Sticky bottom bar** on phones: Call · Text photo · Free quote.
6. UTMs + fbclid are saved for 30 days and written onto the lead, so every booked job traces back to the ad that produced it.

**Ask the owner for:** 6-10 real before/after photos, a 20-sec selfie video, his dump fee per load, his LSA cost per lead, and sign-off on a price anchor. Suggested test: **"Single items from $79. Full pickup load from $229."** Local market is $65-$90 per single item and $120-$250 per pickup load. None of the franchises covering Coatesville publish prices (see MARKET-RESEARCH §2-3).

---

## 2. Unit economics (fill in his real numbers)

| Input | Planning number | Source | His number |
|---|---|---|---|
| Average job ticket | $200 | **ASSUMPTION** based on the market range for pickup loads ($120-$250: Junk Removal Taxi, Angi, Liberty) | |
| Lead → booked job | 40% (if he answers in 5 min) | **ASSUMPTION** | |
| Cost per lead (CPL) | $25-$41 | $41.26 = Meta lead campaigns, Home & Home Improvement (LocaliQ/WordStream 2025). $27.66 = all-industry. Junk-specific $8-$25 claims are unverified vendor numbers | |
| Benchmark CTR / CPC | 1.94% / $2.23 | LocaliQ/WordStream 2025, Home & Home Improvement leads | |
| CPM | expect $15-$60 | Agency estimate for US traffic-to-lead objectives (Affect Group). Small radius may run higher | |
| **Cost per booked job** | CPL ÷ close rate ≈ **$63-$103** | math | |
| Return on ad spend | $200 ÷ $63-$103 ≈ **1.9-3.2×** | math | |
| Google LSA comparison | $19.85 (2025) to $33.14 (2026) per charged lead | 99 Calls data via LeadSmart press release | |

**Starting budget: $20/day (~$600/mo).** At a $41 CPL that's ~15 leads → ~6 jobs → ~$1,200. At $25 it's ~24 leads → ~10 jobs → ~$2,000. If Meta can't beat his own LSA cost per booked job by week 4, put the money into LSA instead. Don't scale until cost per *booked job* is known for 2 straight weeks. Then add $5-10/day per week while it holds.

---

## 3. Campaign structure

Not a Special Ad Category (no housing, credit or employment), so full local targeting is allowed.

### Campaign A: "Quotes" (Prospecting) · 70% of budget · $14/day
- **Objective:** Leads → Website, optimize for the `Lead` event. (Weeks 1-2, if the Pixel has no data yet, optimize for `ViewContent`, then switch to `Lead` once there are ~15 leads.)
- **Location:** 15-mile radius around Coatesville (19320), "people living in this location". Exclude anywhere he won't drive. ZIP 19320 alone has 54,149 people in 19,973 households (2020 Census). Use Ads Manager's audience estimate for the full radius.
- **Audience:** Advantage+ audience, age 28-65+. No interest stacking. The creative does the targeting.
- **Placements:** Advantage+ (FB + IG feeds, Reels, Stories).
- **One ad set, 4-5 ads** (below). Let Meta pick winners.

### Campaign B: "On Your Street" (Neighborhood blitz) · $5/day, on and off
The banner is already called the *Neighborhood Special*. Make the ads match it:
- After every job, drop a **1-mile pin** on that street and run a 3-day ad: *"We're hauling junk on your street this week. Neighbors get $25 off. Want us to grab yours while the truck's here?"*
- Pair with 20-30 door hangers on the same street (QR → funnel `?utm_source=doorhanger`).
- Cheapest jobs he'll ever book: the truck's already there, zero drive time.

### Campaign C: Retargeting · $3-5/day (start week 3)
- Audience: funnel visitors 30d who didn't `Lead` + IG/FB engagers 60d + 50% video viewers.
- Ad: reviews proof + "Your $25 off is still good this week."

---

## 4. Ads to launch (week 1)

| # | Format | Hook (first 2 sec / headline) | Body angle |
|---|---|---|---|
| 1 | **Owner selfie video**, 20-30s, standing at the truck | "I'm [name]. I'm the Rat. Got crap?" | Local guy, 64 five-star reviews in year one, upfront price, $25 off. Built for Reels. Usually the top performer for local service businesses. |
| 2 | **Before/after carousel** (real jobs) | "Garage: before / 2 hours later" | Each card = one job + town name ("Caln garage cleanout"). |
| 3 | **Static: banner + truck photo** | "Got crap? Call the Rat. $25 off" | Matches what neighbors have already seen on the street. |
| 4 | **Seasonal (Oct-Dec)** | "Leaves, branches, that dead shed. Gone before the snow." | Fall yard cleanup, then "Make room before the in-laws show up" (Nov) and "New couch for the holidays? We'll take the old one" (late Nov/Dec). |
| 5 | **Single item / price anchor** | "One couch? One truck. From $79." | Big franchise trucks hold ~7 pickup loads and charge a 1/8-truck minimum. A one-item job is his sweet spot. |

**Primary text template:**
> Got crap? Call the Rat. 🐀
> Furniture, appliances, yard waste, garage & attic cleanouts. You point, we lift, it's gone.
> ⭐ 5.0 from 64 neighbors on Google
> 📸 Snap a photo → get an upfront price
> 💸 $25 off this week, Coatesville & nearby
> 👉 Tap "Get Quote"

**Headline:** $25 Off Junk Removal · **CTA button:** Get Quote
**URL:** `https://tbsol.net/clients/rapidrat/?utm_source=facebook&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`

---

## 5. Rules for the money

Review every Monday:

- **Kill an ad** after ~$50 spent with no lead (about 1.2× the $41 benchmark CPL), or CTR under 1.0% after 2,000 impressions (benchmark is 1.94%).
- **Kill or rework the ad set** if CPL is over $60 (about 1.5× benchmark) after $150 spent.
- **Winner** = lowest cost per *booked job*, not per lead. Ask the owner which leads booked and mark them in HQ.
- **Refresh creative** every 3-4 weeks or when frequency goes over 3 in this small radius.
- **Scale** +$5-10/day per week only while cost per booked job holds.

**Weekly scorecard:** spend · leads · CPL · calls/texts from the page · jobs booked · revenue · cost per job · ROAS · new Google reviews (target 5+/month, since recent reviews count most).

---

## 6. 30-day rollout

| Week | Do |
|---|---|
| 0 | Section 0 fixes, Pixel ID in the funnel, lead text-alert wired, FB Page cleaned up, collect photos + selfie video, owner signs off on the price anchor |
| 1 | Launch Campaign A with ads 1-5 at $14/day. Start the Campaign B street blitz after every job |
| 2 | Cut losers, switch optimization to `Lead`, ask every finished job for a Google review (text link same day) |
| 3 | Launch retargeting (C). New seasonal creative. Owner shares a job video weekly |
| 4 | Read the numbers. Cost per booked job ≤ $80 (40% of a $200 ticket, **ASSUMPTION**) and at or below his LSA cost → scale to $30-35/day. Above that → fix the offer/creative before adding spend |

**Low-cost extras that pay off locally:** post every job in local Facebook groups (Coatesville / Downingtown community pages), set up a Nextdoor business page with the same $25 offer, and send a realtor/property-manager referral text for move-out cleanouts.
