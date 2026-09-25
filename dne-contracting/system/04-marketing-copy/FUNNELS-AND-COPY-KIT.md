# D N E Contracting — Funnels + Copy Kit

Every path a homeowner can take, and every word she reads or hears along the way. All copy is in mom's voice from her doc: calm, plain, no pressure, never a price online. Replace `[Name]` with the first name; n8n fills it automatically from the lead record.

---

# PART 1 — THE FUNNELS

## Funnel A: Facebook (primary, ~60% of leads)

```
Group post / profile post
   → comment or DM
   → DM scripts 1–4 (playbook)
   → consultation booked
   → mom enters her in the website planner (so she's in Supabase)
   → Nurture sequence starts (Part 2)
   → consultation → quote → contract → portal
```
Copy: group posts, DM scripts and comment replies are already in the site at `#playbook`. Nothing else is needed for this funnel. One rule: once a consult is booked, she types the person into the planner herself so the automation picks up. Takes 40 seconds.

## Funnel B: Google (search + profile, ~25%)

```
"plumber near me" / "bathroom remodel Pottstown"
   → Google Business Profile (women-owned badge, reviews, photos)
   → one of: Call / Chat / Website / Book
       Call → she answers → books consult → enters planner
       Chat → Google Messages auto-welcome → DM scripts
       Website → planner (Funnel C)
       Book → planner (Funnel C)
```
Copy: GBP description, services, posts, Q&A, Chat welcome are in `GOOGLE-BUSINESS-PROFILE-KIT.md`.

## Funnel C: Website planner (all sources land here)

```
Landing (#home or #planner)
   → Q1 What space  → Q2 Where are you with it  → Q3 Budget  → Q4 Contact
   → Thank-you page (what happens next + Calendly if set)
   → n8n: save + score → welcome email + text to her + WhatsApp to mom
   → Nurture sequence (Part 2)
```
Copy is already in the site. Scoring: ready soon 40 / few months 30 / this year 20 / thinking 10; $50k+ 30 / 25–50k 25 / 10–25k 15 / under 10k 5 / not sure 8; kitchen 20 / bath 15 / basement 10 / repair 5. URGENT 80+, HOT 60+, WARM 40+, COLD below.

## Funnel D: Quote → signed

```
Consultation done
   → Quote email + text (Day 0)
   → Reminder text (Day 3) → Reminder email (Day 7) → Last note (Day 13)
   → Accepts → contract email (DocuSign) → deposit email (Stripe) → portal invite
```

## Funnel E: During the job (retention)

```
Deposit paid → portal welcome email
   → Weekly photo update email (Mondays)
   → Milestone invoice emails
   → Final walkthrough email
```

## Funnel F: After the job (amplify)

```
Day 2   → review request text
Day 14  → referral email
Day 90  → check-in text
Day 365 → anniversary email
```

---

# PART 2 — NURTURE SEQUENCE (after planner or booked consult)

### Instant — Welcome email
**Subject:** Thanks, [Name] — here's what happens next
**Preheader:** A short hello from me, and no, nobody's going to pressure you.

Hi [Name],

Thanks for telling me a little about your [kitchen]. I know reaching out to a contractor can feel like the hardest part, so I wanted to say hello properly.

[Embedded video: "Meet me" — 45 sec]

Here's what happens next:
1. I'll text or call you within one business day to find a time that suits you.
2. The visit is calm and takes about an hour. We walk through the space together, at your pace.
3. You'll get honest numbers in writing a few days after. You never decide on the spot.

If you'd rather just talk first without scheduling anything, that's completely fine. Reply to this email or text me at (484) 939-8535.

Talk soon,
[Owner first name]
D N E Contracting · Pottstown, PA

*P.S. If you're curious, here are a few recent projects: [link #projects]*

### Instant — Text to lead
> Hi [Name], it's [Owner] from D N E Contracting. Got your note about your [kitchen] — thank you. I just sent you a short email with a hello video. I'll reach out within a day to find a time that works. No pressure at all 🤍

### Instant — WhatsApp alert to mom
> 🔔 New lead — [SCORE_TIER]
> [Name] · [kitchen] · [ready soon] · [$25–50k]
> [town] · prefers [text]
> Notes: "[notes]"
> 📞 [phone]  ✉️ [email]
> Reply here with "booked [day]" once you've set a time.

### 4 hours — Text (only if she hasn't opened the email)
> Hi [Name], quick one — the email might have landed in promotions or spam. It has a short video from me and what to expect. Here it is again: [link]. Any questions, just text back.

### 24 hours — Email #2 (if no consult booked)
**Subject:** What a [bathroom] visit actually looks like

Hi [Name],

A lot of women tell me they put off a remodel because they dreaded the consultation more than the work. So here's exactly what mine looks like, so there are no surprises:

- I come at a time you choose. I take my shoes off.
- We walk through the [bathroom] and you tell me what bothers you and what you're hoping for. I listen before I say anything.
- I explain your options in plain language. No jargon, no ego.
- We talk honestly about cost and timeline. Then I leave, and you get numbers in writing.
- You ask as many questions as you want. You never decide that day.

If that sounds okay, reply with a day that works or text me at (484) 939-8535. If you'd rather wait, that's okay too.

[Owner]

### 48 hours — WhatsApp to mom
> ⏰ [Name] ([kitchen], [SCORE_TIER]) hasn't booked yet. Email opened: [yes/no]. Worth a personal text from your phone today.

### Day 3 — Text
> Hi [Name], [Owner] here. No rush at all — just checking whether you'd like to set up that walk-through, or whether you'd rather talk things through by text first. Either is fine 🤍

### Day 7 — Email #3
**Subject:** From one homeowner in [Royersford]

Hi [Name],

I asked a recent client if I could share what she said, because it's the thing I hear most:

> "I had two other contractors in before her. Both talked over me. She asked what I wanted and then actually listened. I hired her that week."

I'm not sharing that to push you. I'm sharing it because if you've had a bad experience before, it doesn't have to go that way.

[Before/after photo of a similar project]

Whenever you're ready: reply, or text (484) 939-8535.

[Owner]

### Day 14 — Text (last automated touch)
> Hi [Name], last note from me so I'm not cluttering your phone. If a remodel is still on your mind this year, I'm here. If not, no hard feelings at all. Thanks for reaching out 🤍

After Day 14: lead marked COLD. Mom gets a monthly list of cold leads for a one-line personal text.

---

# PART 3 — QUOTE TO SIGNED

### Day 0 — Quote email
**Subject:** Your [bathroom] estimate, [Name]

Hi [Name],

Thank you for having me over. Attached is the estimate we talked about, laid out the way I promised: what's included, what it costs, and how long it takes. Nothing hidden.

A few things worth repeating:
- This is good for 14 days, only because material prices move. It's not a pressure tactic.
- If anything is unclear, I'd rather you ask than guess. Reply or text.
- If you want to change scope — smaller, bigger, different — just say so and I'll redo it.

If you'd like to go ahead, tap "Accept estimate" and I'll send the agreement and deposit details. If not, thank you for the conversation either way.

[Owner]

### Day 0 — Text
> Hi [Name], your estimate just landed in your email. Take your time with it. If you'd rather go over it together by phone, tell me a good time.

### Day 3 — Text
> Hi [Name], did the estimate come through okay? Happy to answer anything, including "can we do this for less" — that's a normal question.

### Day 7 — Email
**Subject:** Any questions on the estimate?

Hi [Name],

Just checking in. If you're weighing it, here's what usually helps:
- I can split it into phases if the timing or budget works better that way.
- I can walk you through which items are must-do and which are nice-to-have.
- Payment is a deposit to reserve your start date, then milestones. Nothing all at once.

Reply with what's on your mind. No pressure on the answer.

[Owner]

### Day 13 — Text
> Hi [Name], the estimate expires tomorrow because of material pricing, not because I'm rushing you. If you want it refreshed or want more time, say the word and I'll extend it.

### Accepted — Agreement email
**Subject:** Your agreement — read it, sign when you're ready

Hi [Name],

Thank you. Here's the agreement: [DocuSign link]. It's the same scope, price, and timeline as the estimate, plus the warranty and how payments work. Read it at your own pace; call me if a line makes no sense — contracts are written badly on purpose and I hate that.

Once it's signed, you'll get a link to pay the deposit and a login to your project page where you'll see the schedule, photos, and invoices as we go.

[Owner]

### Signed — Deposit email
**Subject:** Deposit link + your project page

Hi [Name],

Signed — thank you. Two links:
1. Deposit ([amount]): [Stripe link]. Card or bank transfer, your choice.
2. Your project page: [portal link]. Your login is this email; set your password with the link in the next message.

As soon as the deposit clears, your start date ([date]) is locked.

[Owner]

### Deposit paid — Text
> Hi [Name], deposit received — thank you. Your start date is [date]. Your project page is live at [portal link]. I'll post photos every week. See you soon 🤍

---

# PART 4 — DURING THE JOB

### Portal welcome email (auto, after deposit)
**Subject:** Your project page is ready
Hi [Name], your private project page is live: [link]. Schedule, photos, documents, and payments are all there so you never have to wonder where things stand. Message me from it anytime. [Owner]

### Monday photo update email
**Subject:** This week on your [bathroom]
Hi [Name], new photos are up on your project page: [link]. This week: [what's happening]. Next week: [what's next]. Questions about anything you see, message me on the page or text. [Owner]

### Milestone invoice email
**Subject:** Invoice [number] — [milestone]
Hi [Name], we've reached [milestone], so here's the progress invoice we agreed on: [amount], due [date]. Pay from your project page or here: [Stripe link]. Thank you. [Owner]

### Final walkthrough text
> Hi [Name], we're nearly there. Can we walk through together on [day] so you can point at anything that isn't right? Final invoice only goes out once you're happy.

---

# PART 5 — AFTER THE JOB

### Day 2 — Review text
> Hi [Name], it was a pleasure working in your home. If you have two minutes, a Google review really helps other women find someone they can trust with a remodel: [review link]. And if anything isn't right, tell me first and I'll fix it 🤍

### Day 14 — Referral email
**Subject:** Know someone who's been putting it off?
Hi [Name], most of my work comes from people like you telling a friend. If you know someone who's been dreading the contractor part, send them here: [refer link] — or just give them my number. When they book a consultation I'll send you $100 as a thank you, and $250 if they go ahead with a project. No pressure to do this. [Owner]

### Day 90 — Check-in text
> Hi [Name], it's been about three months. How's the [bathroom] holding up? If anything's loose, drippy, or not quite right, tell me and I'll come sort it — it's under warranty.

### Day 365 — Anniversary email
**Subject:** One year
Hi [Name], one year since your [bathroom]. I hope it still feels like yours. If there's a next project on the list — a kitchen, a basement, a water heater on its last legs — you know where I am. And thank you again for the trust. [Owner]

---

# PART 6 — VIDEO SCRIPTS + HOW TO RECORD

Three videos. All shot on her phone, vertical, no editing beyond trimming the start and end. The whole point is that she looks like herself.

## Recording setup (same for all three)
- **Phone:** vertical, rear camera if someone else films, front camera if she's alone. 1080p is fine.
- **Where:** a finished job she's proud of (bathroom or kitchen), or her own kitchen. Not the truck, not a blank wall.
- **Light:** face a window. Never have the window behind her.
- **Sound:** quiet room, phone within arm's length. If it echoes, stand near soft things (towels, curtains).
- **Framing:** head and shoulders, eyes at the top third of the frame. Leave a hand's width above her head.
- **Delivery:** talk to one person, not "everyone." Slow down 20% more than feels natural. Smile before the first word. Pause after each sentence — trimming is easy.
- **Takes:** record the whole thing three times start to finish. Use the third. Don't stitch takes.
- **Do not:** read from the phone. Learn the shape of it, then say it her way. If she stumbles, keep going — a real stumble beats a polished redo.

## Video 1 — "Meet me" (45 sec) — welcome email, GBP, Facebook page pinned

> Hi, I'm [Owner]. I'm a plumber, and I've been doing this for [X] years around Pottstown.
>
> I started D N E Contracting because I kept hearing the same thing from women I met on jobs: they'd put off a kitchen or a bathroom for years, not because of the work, but because they dreaded having a contractor in their home. Rushed. Talked over. Pressured.
>
> So I do it differently. The consultation is free, it's in your home, and we go at your pace. I listen first. I explain things plainly. You get honest numbers in writing, and you never decide on the spot.
>
> If that sounds like what you've been waiting for, I'd love to meet you. And if you're not ready, that's okay too.

## Video 2 — "The process" (60–75 sec) — website home, planner page, Email #2

Film this walking through a finished bathroom, pointing at things as she goes.

> People ask me what actually happens after they reach out, so here it is.
>
> First, I come to you. You pick the time. I take my shoes off, we walk through the space, and you tell me what's bugging you and what you've been picturing. I mostly listen.
>
> Then I talk you through what's possible — the layout, the plumbing, what's easy and what's not — in plain language. If something's a bad idea for your house, I'll say so.
>
> A few days later you get an estimate in writing. What's included, what it costs, how long. Nothing hidden.
>
> If you go ahead, you get your own project page. Schedule, photos every week, every invoice, so you always know where things stand. And I'm the one on the job.
>
> That's it. No surprises. That's the whole point.

## Video 3 — Client testimonial (30–60 sec each) — reviews page, Facebook, Email #3

Film the client, not mom. Mom holds the phone. In the finished room. Ask these questions off camera and cut her voice out; the client's answers become the video. Don't script them.

Questions to ask, in order:
1. "Before we met, what were you worried about?"
2. "What was the first visit like?"
3. "What surprised you?"
4. "What would you say to a friend who's been putting off a remodel?"

Get a signed one-line release: *"I give D N E Contracting permission to use this video and my first name and town online."* Keep it in Drive.

## Where each video goes
| Video | Where |
|---|---|
| Meet me | Welcome email (auto), GBP cover video, Facebook page pinned post, site hero (swap the photo slot) |
| The process | Site `#planner` page, Email #2, GBP post, Facebook group post #3 |
| Testimonials | Site `#reviews`, Email #3, Facebook page, Meta ad creative (week 4) |

Upload to YouTube as unlisted, paste the embed into the email template and the site.

---

# PART 7 — WHICH FILE HOLDS WHAT

| Copy | Lives in |
|---|---|
| Facebook posts, DMs, comment replies | Site `#playbook` |
| GBP description, services, Q&A, posts, chat welcome | `GOOGLE-BUSINESS-PROFILE-KIT.md` |
| Site pages, planner, thank-you, FAQ | `index.html` |
| Everything in this file (emails, texts, alerts, videos) | n8n templates — one node per message, keyed by day |
