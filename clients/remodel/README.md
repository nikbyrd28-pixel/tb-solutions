# D&E Remodeling — consultation funnel

Standalone landing page built on the WWP strategy doc. Calm, no-pressure
positioning for a woman-owned remodeling contractor serving Philadelphia,
Chester County, Montgomery County, and the Route 422 corridor.

**Live path:** `tbsol.net/clients/remodel/`

---

## The stack

| Layer | What it is | Where |
|---|---|---|
| Front end | Single self-contained HTML page, no build step, no dependencies | `index.html` |
| Photos | Real project photos, auto-detected | `photos/` |
| CRM | Supabase `client_leads` table, `client = 'remodel'` | TB Command dashboard |
| Automation | n8n workflow: instant alert + calm 3-email follow-up | `n8n/clients/remodel-followup.json` |
| SEO | LocalBusiness + FAQPage JSON-LD | in `index.html` `<head>` |

When the form is submitted, the lead is written to Supabase **and** posted to the
n8n webhook. The two are independent — if the webhook is down, the lead is still
captured in the CRM.

---

## Go-live checklist

1. **Business name** — find/replace `D&E Remodeling`.
2. **Phone** — find/replace `(484) 841-8501` (appears in the header, footer,
   sticky mobile bar, and the automation emails).
3. **PA HIC number** — search `HIC` and replace "on request" with the real
   number. PA law requires it on advertising.
4. **Photos** — drop into `photos/` (see `photos/README.md` for sizes):
   `hero.jpg`, `kitchen.jpg`, `bathroom.jpg`, `basement.jpg`, `owner.jpg`.
   Every slot fills in automatically; missing files degrade gracefully.
5. **Owner's note** — swap "The Owner" for her real first name.
6. **Reviews** — at the bottom of `index.html`, set:
   ```js
   var REVIEWS = { score: 4.9, count: 53, url: 'https://g.page/...' };
   var TESTIMONIALS = [{ text: '...', who: 'K.M., West Chester' }];
   ```
   Both stay hidden until filled in. **Use only real numbers and real quotes.**
   Fabricated reviews are an FTC violation and a credibility risk.
7. **n8n** — import `remodel-followup.json`, replace `CLIENT_EMAIL_HERE` in the
   four email nodes, attach the email credential, activate.
8. **Remove `noindex`** — delete `<meta name="robots" content="noindex" />`
   when ready for Google.

---

## Page structure (maps to the WWP doc)

| # | Section | Job |
|---|---|---|
| — | Hero | Immediate relevance and relief |
| — | Credentials strip | Registered, insured, lead-safe, woman-owned |
| 01 | Who this is for | Self-qualification; filters price shoppers |
| 02 | The real problem | Name the fear — behavior, not construction |
| 03 | How we're different | Behavioral contrast, no hype |
| 04 | Recent work | Proof |
| 05 | Our philosophy | Clarity before commitment |
| 06 | A note from the owner | Trust, personal, woman-owned |
| 07 | The consultation | Convert without resistance |
| 08 | Before hiring anyone | Educator play for research-intent search |
| — | Verify block | PA AG registry, reviews, references |
| 09 | Common questions | FAQ + rich-result schema |
| 10 | Where we work | Local validation |
| 11 | Availability | Protect time and lead quality |
| — | Booking | The conversion |

---

## Design notes

Deliberately **not** a template landing page: upright Fraunces serif headlines,
Inter body, hairline rules instead of card grids, numbered section labels, one
muted rust accent, no emoji, no gradients, no scroll animations. The restraint
*is* the positioning — it should feel like a careful professional, not a
high-pressure contractor.

Tone rule for any future copy: **reassure > impress, explain > persuade,
process > personality.** No urgency gimmicks, ever.
