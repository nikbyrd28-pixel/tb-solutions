# D N E Contracting website — setup (do once, in this order)

Everything lives in `index.html`. The only block you edit to go live is `window.DNE = {...}` at the top.

## 1. Fill the config (10 min)
| Key | What to put |
|---|---|
| `phone` / `phoneE164` | Mom's business line, e.g. `(610) 555-0123` / `+16105550123` |
| `email` | Business email (set up Google Workspace: `hello@dnecontracting.com`) |
| `license` | Her PA Home Improvement Contractor number — required by PA law on ads/site |
| `ownerName` | Her first name (About page, thank-you page, FAQ) |
| `yearsInBusiness` | Real number |
| `googleReviewUrl` | Google Business Profile → "Get more reviews" → copy link |
| `facebookUrl` | Her **business page** (the credibility anchor from the copy doc) |
| `sampleContent` | Set to `false` once real reviews/photos are in |

## 2. Replace sample content
- `REVIEWS` array (JS): swap in real reviews — do not publish the samples.
- `PROJECTS` array: real jobs. Photos: put files next to index.html and change `photo()` calls to `<img>` or drop `<img src="...">` inside the `.photo` div.
- Owner photo on Home + About: same `.photo` slots.

## 3. Wire the lead pipeline (n8n)
Set `integrations.n8nWebhook`. Every form posts JSON with a `kind` field:
- `lead` — planner (fields: type, timeline, budget, name, phone, email, town, notes, contact_pref, score, score_tier, utm_*)
- `contact`, `referral`, `portal_message`
Use the existing `n8n-dne-workflow.json`; add a Switch node on `kind`. Lead scoring is already done client-side and also in the workflow (either is fine).

## 4. Client portal (Supabase)
Set `supabaseUrl` + `supabaseAnonKey` (anon key only). Enable Email auth in Supabase.
The page reads one row from `projects` matching the logged-in email. Run:
```sql
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null, customer_name text, title text,
  current_stage text, percent_complete int default 0, next_step text,
  estimated_completion text, total_cost numeric, amount_paid numeric default 0,
  next_payment_amount numeric, next_payment_due text,
  timeline jsonb default '[]', photos jsonb default '[]', invoices jsonb default '[]',
  docs jsonb default '[]', messages jsonb default '[]', created_at timestamptz default now()
);
alter table projects enable row level security;
create policy "own project" on projects for select using (auth.jwt()->>'email' = customer_email);
```
`timeline` = `[["Step","Sep 2","done|now|"]]`, `invoices` = `[["INV-1","Oct 3","$4,250","Paid|Due|Upcoming"]]`.
Create the customer in Supabase Auth → Users when the deposit clears (n8n can do this via the admin API).
Until it's connected, the portal shows an "Open sample project" button so mom can demo it.

## 5. Deploy
Push `index.html` to `nikbyrd28-pixel/dne-contracting`, import in Vercel, add the domain. Done.
Optional: `ga4Id`, `metaPixelId`, `calendlyUrl` in config — they load only when set.

## 6. Owner playbook
`yoursite.com/#playbook` is unlinked and holds all her Facebook posts, DM scripts, and comment replies — tap to copy from her phone. Don't share that URL publicly.

## Do not
- Put prices on the site (the copy strategy depends on it).
- Publish sample reviews as real.
- Use the Supabase service key in the config.

## Owner bookmark
Mom saves `yoursite.com/#planner?owner=1` on her phone. That URL shows a "How did they reach us?" dropdown (Facebook, LSA, Yelp, Nextdoor, Thumbtack, Angi, Houzz, referral, realtor, phone). She types in every lead she books by DM or phone so the nurture runs and the funnel view shows which platform pays.

## SEO files
`vercel.json`, `robots.txt`, `sitemap.xml` sit next to `index.html` in the repo root. Replace `dnecontracting.com` in the head (canonical, JSON-LD, og:image) and in `sitemap.xml`/`robots.txt` with the real domain once bought. Add an `og.jpg` (1200×630, her on site) to the repo root — it's what shows when the link is shared in a Facebook group.

## After launch: real pages
Hash routes (`#services`) are fine for launch and for the Facebook-first strategy, but Google indexes one URL. When she has reviews and you want to rank for "kitchen remodel Pottstown", split `#services`, `#projects`, `#faq` into real paths (`/services`, `/projects`, `/faq`) — the content and design are already done; it's a routing change plus `vercel.json` rewrites.

## Photos (important before launch)
The site ships with Unsplash stock photos embedded so it looks finished in preview. They are stand-ins — **the owner portrait is not mom and the projects are not her jobs.** Before the site goes public:
1. Put her real photos in `/img/` (portrait 4:5, projects 3:2, at least 1200px wide).
2. In `index.html`, replace the base64 values in `window.DNE_PHOTOS` with paths: `owner:"img/portrait.jpg"`, `kitchen1:"img/royersford-kitchen.jpg"`, etc. Keys used: owner, kitchen1, kitchen2, bath1, bath2, bath3, bathBefore, basement1, basement2, onsite. Add `before:` keys to any project that has a before shot.
3. Set `sampleContent:false` and replace the `REVIEWS` array with her real Google reviews (name, town, text).
Stock originals are in `stock-photos/` for reference only. Do not run ads to a page that shows stock work as hers.

## Ballpark estimator
Home page, after the consultation form (`#estimator`). Ranges live in the `EST` table in the JS (search `ballpark estimator`): 7 job types × 3 scopes, each `[label, low, high, note]`. Change the numbers there; nothing else needs touching. The FAQ schema answer quotes the outer ranges, so update that line too if the numbers move a lot.

## Room sketch (`#sketch`)
Canvas floor planner: kitchen / bathroom / basement presets, drag-to-place fixtures, plumbing-wall marker, live clearance and code notes, cost signals for plumbing moves, PNG download, shareable link (`#sketch?d=…`).
When the visitor taps "Send with my consultation request", the planner submission includes two extra fields: `sketch` (JSON: type, w, l, plumb, items) and `sketch_png` (data-URL PNG, ~30–80 KB). Store them: `alter table plumbing_leads add column sketch jsonb, add column sketch_png text;` — n8n can drop the PNG into the WhatsApp alert or the lead email so mom sees the room before she calls.
Cost signals and clearance rules live in the `COST` table and `check()` function (search `room sketch`).

## Sketch flow (updated)
No prices on the public site. Flow: consultation form → thank-you page → "Sketch my room" (`#sketch?type=…`). The sketch has floor plan + 3D room (three.js, vendored in `vendor/three/`, loaded only when 3D is opened), wall types (full, half, glass partition, closet), an existing/repair/replace/new status on every item, and a live estimate for what was drawn.
"Send this sketch" posts `kind: "sketch"` to the n8n webhook with: name, phone, email (from their form submission), type, `sketch` (JSON), `sketch_png` (plan), `sketch_3d_png` (if 3D was opened), `sketch_estimate` ("$2,720 – $8,475"), `sketch_lines` (one cost line per row). Match it to the lead by email/phone and store it: `alter table plumbing_leads add column if not exists sketch_estimate text, add column if not exists sketch_lines text, add column if not exists sketch_3d_png text;`
All cost ranges live in the `I` table at the top of the sketch module (`rep` repair, `rpl` replace, `rough` plumbing/electrical for new, `mv` moved off the plumbing wall, `nw`/`rm` per-foot new wall / remove wall) and `ROOM` (flooring, paint, counters, lighting per sq ft or per ft).
