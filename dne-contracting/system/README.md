# D N E Contracting — complete system package

Everything built for mom's business, in the order you use it.

| Folder | What's in it | Use it for |
|---|---|---|
| **01-site** | `index.html` (whole website: 12 pages, planner, portal, playbook), `SETUP.md`, screenshots | Deploy to Vercel. Edit only the config block at the top. |
| **02-database** | `dne-complete-schema.sql` (run this one), plus earlier partial SQL files for reference | Paste into Supabase SQL editor once. |
| **03-automation** | `n8n-dne-workflow.json` (intake), `n8n-nurture-and-followup.json` (hourly follow-ups), `ENV-VARIABLES.md`, Stripe + retargeting specs | Import both JSONs into n8n, set variables, add credentials. |
| **04-marketing-copy** | `FUNNELS-AND-COPY-KIT.md` (every email/text/alert/video script), `GOOGLE-BUSINESS-PROFILE-KIT.md`, `LISTINGS-AND-LEAD-PLATFORMS-KIT.md` (LSA, Yelp, Angi, Thumbtack, Nextdoor, Houzz, BBB, Apple, Bing), mom's original copy PDF | Mom's phone. Facebook posts + DMs also live in the site at `#playbook`. |
| **05-plans-and-reference** | `GAMEPLAN.md` (start here), complete system doc, week-1 launch, master gap analysis | The order to do things. |
| **06-diagrams** | 4 SVG maps + `all-diagrams.html` (printable) | Show mom / print for the wall. |
| **07-earlier-builds** | Previous landing page, 3D visualizer, standalone portal/dashboard/marketplace HTML | Superseded by 01-site but kept for parts. |

## Launch order (short)
1. `01-site` → Vercel. Fill config (HIC #, Saturday hours, photos, name). `sampleContent:false`.
2. `02-database/dne-complete-schema.sql` → Supabase.
3. `03-automation` → n8n. Test the planner; mom gets a WhatsApp.
4. `04-marketing-copy/GOOGLE-BUSINESS-PROFILE-KIT.md` → her Google profile.
5. Mom posts from `#playbook`. Leads start.
5b. `LISTINGS-AND-LEAD-PLATFORMS-KIT.md` Tier 1 (free listings) same week; LSA at 10+ reviews.
6. Week 2+: `GAMEPLAN.md`.

## Still needs a human
- PA HIC license number and Saturday hours (config)
- 20+ real project photos, her headshot, 3 real reviews (replace samples in `index.html`)
- Record the 3 videos (`FUNNELS-AND-COPY-KIT.md` Part 6)
- Stripe account + DocuSign account (links go into n8n)
- Twilio number, Resend domain verification
