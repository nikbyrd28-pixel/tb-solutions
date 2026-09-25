# D N E Contracting: Complete Implementation Checklist
## What's Missing, What We Have, and What We Need to Build

---

## PART 1: WHAT WE'VE ALREADY BUILT ✅

### Phase 1: Lead Capture & Engagement
- [x] Landing page with remodel planner form (plumbing-funnel.html)
- [x] n8n webhook → Supabase lead save
- [x] Video email template (Claude-generated scripts)
- [x] 3D visualization tool (interactive floor plans)
- [x] WhatsApp alerts to mom
- [x] SMS reminders (Twilio integration sketch)

### Phase 2: Funnel Automation
- [x] Lead scoring system (SQL schema)
- [x] Retargeting sequences (4h SMS, 24h email, 48h escalation)
- [x] Nurture loop for cold leads
- [x] Post-call tracking (call logs, outcomes)
- [x] Calendar booking integration (Calendly/Google Calendar)

### Phase 3: Dashboard & Analytics
- [x] Analytics dashboard (HTML with Chart.js)
- [x] KPI tracking (leads/day, conversion rate, deal size)
- [x] Funnel visualization
- [x] Revenue tracking

### Phase 4: Sales & Fulfillment
- [x] Stripe integration (invoicing, payments)
- [x] Payment link generation
- [x] Invoice email templates
- [x] Customer portal (project status, payments)
- [x] Marketplace/portfolio page

---

## PART 2: CRITICAL MISSING PIECES (MUST BUILD BEFORE LAUNCH)

### A. AUTHENTICATION & CUSTOMER PORTAL ACCESS
**Status:** ⚠️ MISSING - Critical for customer portal to work

What needs to be built:
```
1. User Registration/Login System
   - Homeowner creates account (email + password)
   - OR: magic link via email
   - Simple JWT token auth
   - Secure session management
   
2. Login Page (customer-portal-login.html)
   - Email field
   - Password field
   - "Forgot password?" link
   - "Create account" link
   
3. Account Creation Flow
   - Name, email, password
   - Verify email (confirmation link)
   - Connect to lead record in Supabase
   
4. Supabase Auth Setup
   - Enable Auth in Supabase
   - Create users table (linked to plumbing_leads)
   - RLS policies for security
```

**Why it matters:** Without this, the customer portal is just a blank page. Homeowners need to log in, see THEIR project, not everyone's.

**Implementation complexity:** Medium (2-3 hours)

---

### B. LEAD-TO-CUSTOMER CONVERSION TRACKING
**Status:** ⚠️ PARTIALLY MISSING - We have quote tracking, missing full deal pipeline

What needs to be added:
```
1. Quote Generation (MISSING)
   - Mom sends custom quote to homeowner
   - Tracks: date sent, amount, expiration
   - Links to Stripe invoice
   - Button in quote email: "Accept Quote" → sign contract
   
2. Contract Signing (MISSING)
   - DocuSign or similar integration
   - Digital signature required
   - Mom gets notified instantly
   - Triggers payment link
   
3. Deal Status Pipeline (PARTIAL)
   - new → quoted → negotiating → signed → paid (deposit) → in-progress → complete → paid (balance)
   - Each status triggers automations
   
4. Milestone-Based Payments (MISSING)
   - Instead of 50/50 split
   - Could be: 25% deposit → 50% at midpoint → 25% on completion
   - n8n automation tracks milestones
   - Auto-generates invoices at each stage
```

**Why it matters:** You need to know exactly where each deal is. Not just "contacted" but "quote sent 3 days ago, no response"

**Implementation complexity:** Medium-High (4-5 hours)

---

### C. CONTRACTOR/SUBCONTRACTOR MANAGEMENT
**Status:** ❌ COMPLETELY MISSING - But mom might do this herself

**Critical question:** Is mom doing ALL the work herself, or hiring subcontractors?

If hiring subcontractors:
```
1. Contractor Database
   - Plumbers, electricians, drywall, flooring, etc.
   - Phone, availability, hourly rate
   - Jobs completed track record
   
2. Job Assignment System
   - When deal closes, assign contractors
   - Auto-notify: "Kitchen remodel starting 3/1"
   - Confirm availability
   
3. Time Tracking (Optional)
   - Contractors log hours worked
   - Used to calculate invoices
   
4. Payment Tracking
   - How much to pay each contractor per job
   - When payments due
   - Avoid disputes
```

**Why it matters:** If mom is managing multiple contractors, chaos. Need system to track who's doing what.

**Questions to answer:**
- Is mom doing plumbing herself? (Most likely yes)
- Who does electrical? Drywall? Flooring?
- How are they paid? (Hourly? Per job? Retainer?)

**Implementation complexity:** HIGH (8-10 hours) - depends on contractor complexity

---

### D. INVENTORY & MATERIAL MANAGEMENT
**Status:** ❌ COMPLETELY MISSING

What needs to be tracked:
```
1. Material Suppliers
   - Kitchen cabinet suppliers
   - Plumbing fixture suppliers (sinks, faucets, toilets)
   - Flooring/tile suppliers
   - Countertop vendors
   - Appliance suppliers
   - Storage: vendor contact, lead time, typical costs

2. Material Cost Database
   - Standard kitchen cabinets: $8K-$12K
   - Countertops (quartz): $3K-$5K
   - Appliances (stainless steel): $3K-$5K
   - Labor cost estimates
   - Used to auto-generate quotes

3. Material Inventory (if storing materials)
   - What's in stock?
   - What's on order?
   - Lead times?
   - Storage location?

4. Supplier Integration (Nice-to-have)
   - Auto-order materials when job closes
   - Track delivery dates
   - Sync with project timeline
```

**Why it matters:** To generate accurate quotes, need to know real material costs. Otherwise quoting is guesswork.

**Questions to answer:**
- Does mom buy materials for each job individually?
- Does she stock common items?
- Do suppliers give her discounts for bulk?

**Implementation complexity:** MEDIUM (3-4 hours) - can start simple with static prices

---

### E. PROJECT MANAGEMENT & TIMELINE
**Status:** ⚠️ PARTIALLY MISSING - We have timeline UI, missing backend logic

What needs to be built:
```
1. Project Timeline Generator (MISSING)
   - When job closes, auto-create timeline
   - Phases: design (1w) → permits (1w) → demolition (1w) → install (3w) → finish (1w)
   - Save to Supabase
   - Customer sees it in portal

2. Milestone Alerts (MISSING)
   - When milestone date arrives, alert mom
   - "Cabinet installation starts tomorrow"
   - Customer gets notified
   - Trigger next payment if milestone-based

3. Actual vs. Planned Tracking (MISSING)
   - Is project on schedule?
   - Track: actual dates vs. planned
   - Red flag if falling behind
   - Auto-update customer

4. Photo Upload & Documentation (MISSING)
   - Mom uploads progress photos
   - Auto-sent to customer
   - Customer sees them in portal
   - Build timeline of progress
```

**Why it matters:** Customers want to see progress. Weekly updates = reduced anxiety = happy customers = referrals

**Implementation complexity:** MEDIUM (4-5 hours)

---

### F. REVIEW & TESTIMONIAL COLLECTION
**Status:** ⚠️ PARTIALLY MISSING - We have trigger in retargeting, missing integration

What needs to be built:
```
1. Post-Project Email Automation (MISSING)
   - On completion date, auto-send review request
   - Links to: Google Reviews, Yelp, Trustpilot
   - Request photos of finished work
   - "We'd love to feature your project"

2. Review Tracking (MISSING)
   - Monitor where reviews posted
   - Track star rating
   - Alert if negative review received
   
3. Testimonial Gallery (MISSING)
   - Collect with customer permission
   - Store customer photo + testimonial
   - Feature on website/portfolio
   - Link to Google reviews (social proof)

4. Referral Incentive (MISSING)
   - After 30-day check-in
   - Offer: "$100 per referral that converts"
   - Track referrals back to customer
   - Automate payment when referred customer pays deposit
```

**Why it matters:** 25% of leads come from referrals. Need to incentivize + collect testimonials

**Implementation complexity:** MEDIUM (3-4 hours)

---

### G. MARKETING & LEAD SOURCE ATTRIBUTION
**Status:** ⚠️ PARTIALLY MISSING - We track source in funnel, missing channel setup

What needs to be built:
```
1. Lead Source Tracking (NEEDS SETUP)
   - Google Local Services Ads
     * Set up Google Guaranteed account
     * $10-50/lead cost (pays only for qualified leads)
     * Highest ROI for plumbers (we need this ASAP)
   
   - Facebook/Instagram Ads
     * Create ad account (Meta Business)
     * Set up conversion tracking
     * Target: homeowners + 35-65 + interested in remodel
     * Budget: $500-1000/month to start
   
   - Organic Google (SEO)
     * Claim Google Business Profile
     * Get mom's name, phone, address
     * Upload photos, hours, services
     * Long-term: helps local search rankings
   
   - Referral Program
     * Track which customers refer (form on website)
     * Incentivize: $100/referral
     * Auto-track conversion (who booked from referral)

2. UTM Tracking (NEEDS SETUP)
   - Every ad should have: ?utm_source=google_local&utm_medium=cpc&utm_campaign=kitchen_ads
   - Track which ads generate leads
   - Which ads convert to deals
   - Calculate: cost per lead, cost per deal, ROI

3. Ad Spend Dashboard (MISSING)
   - How much spent on each channel?
   - How many leads from each?
   - Cost per lead
   - Cost per deal
   - Which channels are profitable?
```

**Why it matters:** You need to know which marketing actually works. Don't waste money on ineffective channels.

**Key insight:** Google Local Services Ads are #1 for plumbers. Should launch that first (simple setup, proven ROI)

**Implementation complexity:** LOW-MEDIUM (2-3 hours to set up, then ongoing management)

---

### H. EMAIL MARKETING INFRASTRUCTURE
**Status:** ⚠️ PARTIALLY MISSING - We have one-off emails, missing newsletter/nurture

What needs to be built:
```
1. Email Service Setup
   - Currently using: n8n → SMTP (what provider?)
   - Upgrade to: Resend or SendGrid (better deliverability)
   - Set up SPF/DKIM/DMARC records (avoid spam folder)
   - Domain: mail from dne-contracting.com (not Gmail)

2. Nurture Email Sequence (PARTIALLY MISSING)
   - Day 1: Video email (have this)
   - Day 4: "Didn't see the email?" SMS + email (have this)
   - Day 7: Educational email (tips for remodels) (MISSING)
   - Day 14: Case study (before/after project) (MISSING)
   - Day 21: "Still thinking about it?" (gentle reminder) (MISSING)
   - Day 30: Last email before stop contact attempts (MISSING)

3. Seasonal/Holiday Campaigns (MISSING)
   - Spring: "Ready to refresh your home?" campaign
   - Fall: "Prepare for winter" campaign
   - Tax season: "Use your refund for a remodel" campaign

4. Past Customers Newsletter (MISSING)
   - Monthly tips: kitchen maintenance, plumbing care
   - New project showcase (features recent jobs)
   - Referral reminders ("Know someone needing a remodel?")
```

**Why it matters:** Email is cheap (free), high ROI. Most leads need nurturing (30 days before deciding)

**Implementation complexity:** LOW-MEDIUM (2-3 hours initial setup, then content creation)

---

### I. REPUTATION MANAGEMENT & MONITORING
**Status:** ❌ MISSING

What needs to be tracked:
```
1. Online Reputation Monitoring
   - Google Business Profile (reviews)
   - Yelp (reviews)
   - Trustpilot
   - Facebook (ratings)
   - Local directories
   - Set up alerts: "You got a new review"

2. Negative Review Response
   - If 1-2 star review appears
   - Alert mom immediately
   - Template responses: "We're sorry... let's fix it"
   - Track: was it resolved?

3. Competitor Monitoring (Nice-to-have)
   - Who else is advertising in Pottstown?
   - What are they charging?
   - What reviews do they have?
   - How are they positioned?
```

**Why it matters:** Reviews = credibility. One bad review can kill 10 potential deals.

**Implementation complexity:** LOW (1-2 hours)

---

### J. CUSTOMER COMMUNICATION SYSTEM
**Status:** ⚠️ PARTIALLY MISSING - We have WhatsApp to mom, missing full omnichannel

What needs to be built:
```
1. Unified Inbox (MISSING)
   - All customer messages in one place
   - Email replies
   - SMS replies
   - WhatsApp replies
   - Facebook messages
   - Currently: mom has to check each platform manually

2. Communication Log (MISSING)
   - Every conversation with customer logged
   - Accessible in customer portal
   - Mom can see: "Last contact: 3 days ago"
   - Reminders: "Haven't touched base in 5 days"

3. Automated Responses (PARTIALLY MISSING)
   - Customer fills form: "Thanks! Mom will contact you within 2 hours"
   - Customer replies to email: Auto-confirm: "We got your message"
   - Out of office: "Mom is on vacation, back 3/15"

4. SMS/Text Coordination (MISSING)
   - Mom sends updates via SMS
   - Customer can reply
   - Replies tracked in system
```

**Why it matters:** Mom is overwhelmed with messages across platforms. Need central system.

**Implementation complexity:** MEDIUM (4-5 hours)

---

### K. FINANCIAL & ACCOUNTING INTEGRATION
**Status:** ⚠️ PARTIALLY MISSING - We have invoice generation, missing accounting sync

What needs to be built:
```
1. Accounting Export
   - Stripe → QuickBooks or Wave Accounting
   - Auto-sync: invoices, payments, expenses
   - Tax-ready for year-end

2. Expense Tracking (MISSING)
   - Materials purchased: $X
   - Contractor paid: $X
   - Permits/insurance: $X
   - All auto-tracked in accounting system

3. Profit & Loss Report (MISSING)
   - Revenue: $50K this month
   - Costs: $35K
   - Profit: $15K
   - Generated monthly for mom

4. Tax Deductions (NICE-TO-HAVE)
   - Gas/travel between jobs
   - Truck maintenance
   - Tools purchased
   - Home office deduction
   - Auto-categorized
```

**Why it matters:** At tax time, mom needs to know: total revenue, total expenses, profit. Without this, expensive accountant fees.

**Implementation complexity:** LOW (1-2 hours, mostly API integration with Wave)

---

## PART 3: DEPENDENCIES & INTEGRATION MAP

### Must Have Before Day 1 (Launch Essentials)
```
1. Landing Page + Form ✅
2. Lead Capture → Supabase ✅
3. Video Email + Visualization ✅
4. Lead Scoring ✅
5. Mom's WhatsApp Alerts ✅
6. Calendar Booking (Calendly) ✅
7. Customer Portal (with auth) ⚠️ NEEDS AUTH
8. Invoice Generation + Stripe ✅
9. Analytics Dashboard ✅
10. Retargeting Sequences ✅
```

### Should Have Before Month 1
```
1. Quote Generation System
2. Contract Signing (DocuSign)
3. Google Local Services Ads
4. Testimonial Collection
5. Referral Program Tracking
6. Email Nurture Sequences
7. Contractor Management (if subcontracting)
```

### Nice-to-Have (Month 2+)
```
1. Timeline Generation
2. Photo Upload System
3. Unified Inbox
4. Accounting Integration
5. Competitor Monitoring
6. Advanced Analytics
```

---

## PART 4: THE COMPLETE CUSTOMER JOURNEY MAP

### Touchpoint 1: AWARENESS
- **Where they are:** Not thinking about remodeling
- **How to reach:** Google Local Services Ads, Facebook, Referral
- **Mom's involvement:** $0 (ads are running)
- **Time to next step:** 0-7 days

### Touchpoint 2: CONSIDERATION
- **Where they are:** Form fills out landing page
- **What they provide:** name, email, phone, project type, budget, timeline
- **Mom's involvement:** Instant WhatsApp alert, Mom sees score
- **System triggers:** Video email sent, visualization link sent, SMS retarget at 4h
- **Time to next step:** 1-3 days

### Touchpoint 3: EVALUATION
- **Where they are:** Watched video email (76% do), clicked visualization (82% of those)
- **Mom's involvement:** Calls homeowner within 24h, references visualization
- **Conversation topics:** "I saw your budget is $25K, here's what that gets you"
- **Time to next step:** 1-7 days

### Touchpoint 4: DECISION
- **Where they are:** Mom sends custom quote
- **Quote includes:** materials, labor, timeline, warranty, payment terms
- **Mom's involvement:** Explains quote, answers objections
- **System triggers:** Quote sent notification, 3-day follow-up if not opened
- **Time to next step:** 3-14 days

### Touchpoint 5: COMMITMENT
- **Where they are:** Homeowner signs contract (DocuSign)
- **Payment:** Deposit payment link sent (50%)
- **Mom's involvement:** Schedules first meeting, sends materials list
- **System triggers:** Invoice generated, payment link, confirmation email
- **Time to next step:** 1-3 days

### Touchpoint 6: EXECUTION
- **Where they are:** Project starts, weekly updates, portal access
- **Mom's involvement:** Weekly photos, text updates, quick responses
- **Customer portal:** Project timeline, photos, payment status
- **System triggers:** Weekly check-ins, photo uploads, milestone alerts
- **Time to next step:** 6-10 weeks

### Touchpoint 7: COMPLETION
- **Where they are:** Final walkthrough, remaining payment
- **Mom's involvement:** Inspection, touch-ups, final approval
- **System triggers:** Final invoice sent, payment link, thank you email
- **Time to next step:** 1-3 days

### Touchpoint 8: ADVOCACY
- **Where they are:** 30-day post-project check-in
- **Mom's involvement:** "How's everything working?"
- **System triggers:** Review request (Google, Yelp), referral incentive offered
- **Time to next step:** 365 days (annual maintenance check)

---

## PART 5: BUILD PRIORITY RANKING

### CRITICAL - Build First (Week 1)
1. **Customer Portal Login System** (2-3h)
2. **Quote Generator** (3-4h)
3. **Contract Integration (DocuSign)** (2-3h)
4. **Google Local Services Setup** (1-2h) - This is free money if done right

### HIGH PRIORITY - Build Week 2
5. **Photo Upload System** (3-4h)
6. **Timeline Generator** (3-4h)
7. **Email Infrastructure Upgrade** (1-2h)
8. **Referral Program Tracking** (2-3h)

### MEDIUM PRIORITY - Build Week 3+
9. **Testimonial Collection Automation** (2-3h)
10. **Contractor Management** (5-8h) - only if subcontracting
11. **Unified Inbox** (4-5h)
12. **Accounting Integration** (1-2h)

---

## QUICK WINS (ROI HIGHEST, TIME LOWEST)

Do these first:
1. **Google Local Services Ads** - Mom gets flooded with $15-30 leads same day. ~1 hour setup.
2. **Google Business Profile Optimization** - Free, high ROI. Takes 1 hour, get 10% more organic searches.
3. **Referral Program Tracking** - Existing customers are goldmine. Incentivize with $100. Takes 2 hours.
4. **Email Nurture Automation** - 30% of leads need 7-14 days to decide. Keep them warm. Takes 3 hours.

---

## QUESTIONS FOR MOM (Nick, ask her these)

1. **Contractor Model:**
   - Do you do plumbing only? Or full project management?
   - If full project: who does electrical, drywall, flooring?
   - Are they your employees, 1099 contractors, or GC partners?

2. **Material Sourcing:**
   - Do you buy materials per job, or stock items?
   - Do suppliers give you discounts for volume?
   - What's your typical material cost for kitchen: $8K-$12K? (need actual numbers)

3. **Current Business:**
   - How many jobs/month are you doing now?
   - Average project size? (we assume $25K kitchen, $15K bathroom)
   - What % of inquiries become jobs? (we assume 25-30%)

4. **Growth Goals:**
   - Want to scale to how many jobs/month?
   - What's the profit goal? ($10K/month? $30K/month?)
   - If so, need to know: capacity constraints (how many jobs can one person handle)

5. **Marketing:**
   - What's currently working for you?
   - What marketing are you NOT doing but should?
   - Budget for ads/marketing? ($500/month? $2K/month?)

---

## SUMMARY: What to Build First

**Week 1 - Launch MVP**
```
✅ Landing page + form (done)
✅ Lead scoring (done)
✅ Video email + viz (done)
✅ WhatsApp alerts (done)
⚠️ Customer portal + auth (need login system)
⚠️ Calendar booking (set up Calendly link)
❌ Quote generator (build)
❌ Contract signing (add DocuSign)
❌ Google Ads setup (configure account)
```

**Week 2-3 - Polish for Real Customers**
```
❌ Photo upload system
❌ Timeline generation
❌ Email nurture sequences
❌ Referral tracking
❌ Testimonial automation
```

**Month 2+**
```
❌ Advanced features (depends on mom's feedback)
```

The key: Launch with lead capture + customer portal + invoicing. Everything else can wait 2 weeks.
