# TB SOLUTIONS: WEEK 1 RAPID LAUNCH PLAN
## Exact Actions to Complete by End of Friday

---

## DAY 1 (Monday): SETUP FOUNDATIONS

### Action 1: Google Local Services Ads (30 mins)
**THE MOST IMPORTANT THING YOU'LL DO THIS WEEK**

Step 1: Call Google Guaranteed Hotline
```
Phone: 1-844-249-5505
Hours: 8am-8pm ET, Mon-Fri
Say: "I want to set up a Google Guaranteed account for my plumbing business"
Have ready:
  - Business license (PDF)
  - Insurance policy (PDF)
  - Email address
  - Business phone number
  - Service areas (cities where you work)
```

Step 2: Google will ask:
- "What services do you offer?" → "Plumbing, kitchen remodeling, bathroom remodeling"
- "Where do you serve?" → "Pottstown, King of Prussia, Collegeville, Chester County"
- "When can you start?" → "Immediately"
- "Budget?" → "I want to start with $1,500/month"

Step 3: After call
- They'll email you a setup link
- You'll set your service areas on a map (draw 5-mile radius around Pottstown)
- You'll set your bid: start with $30/lead
- You'll verify your phone number (they'll call to confirm you're real)
- You'll activate → leads start flowing within 2-24 hours

**Expected outcome:** 2-5 qualified leads by end of day

---

### Action 2: Google Business Profile (20 mins)
**Free. Shows up in "plumber near me" searches.**

1. Go to: https://business.google.com
2. Click "Create or claim your business"
3. Enter:
   - Business name: "D N E Contracting" (exact name)
   - Business address: [mom's address or service address]
   - Phone: (610) 555-XXXX
   - Category: "Plumber" (search for it)
   - Description: 
     ```
     D N E Contracting is a licensed plumbing and remodeling company 
     serving Pottstown and surrounding areas. We specialize in kitchen, 
     bathroom, and basement remodels. Family-owned since [YEAR]. 
     Licensed, insured, and dedicated to quality.
     ```
   - Website: [your website URL - leave blank for now]
   - Hours: Mon-Fri 8am-6pm, Sat 9am-4pm, Sun closed

4. Click "Verify your business"
   - Google will mail a postcard (7-10 days)
   - Or you can verify by phone (instant)
   - Choose phone verification

5. Once verified, add:
   - 5 photos (before/after projects)
   - Hours + contact
   - Wait for approval (usually 24 hours)

**Expected outcome:** Profile live, shows in maps/search by tomorrow

---

### Action 3: Create Supabase Project (15 mins)
**The database that stores all lead data**

1. Go to: https://supabase.com
2. Sign up (GitHub recommended)
3. Create project:
   - Project name: "dne-base" or "plumbing-leads"
   - Database password: [make it strong]
   - Region: "us-east-1" (closest to Pennsylvania)
   - Click "Create new project" (waits 1-2 mins)

4. Once created, click "SQL Editor"
   - Paste this code to create lead table:

```sql
-- Create plumbing_leads table
create table if not exists plumbing_leads (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  email text not null,
  name text not null,
  project_type text,
  budget text,
  timeline text,
  score integer default 0,
  score_tier text,
  status text default 'new',
  source text,
  created_at timestamp default now(),
  notes text
);

-- Create index for fast queries
create index idx_leads_status on plumbing_leads(status);
create index idx_leads_created on plumbing_leads(created_at desc);

-- Enable RLS (security)
alter table plumbing_leads enable row level security;
```

5. Click "Run" → table created ✓

**Expected outcome:** Database ready to receive leads

---

### Action 4: Create Vercel Account (10 mins)
**Where your website will live**

1. Go to: https://vercel.com
2. Sign up with GitHub
3. Create team: "TB Solutions" or "D N E Contracting"
4. No action needed today beyond signup
   - You'll deploy landing page tomorrow

**Expected outcome:** Account ready

---

### Action 5: Collect First 10-15 Project Photos (20 mins)
**Send to Nick via Slack/email**

Ask mom to send:
- 5 before/after pairs (kitchen, bathroom, basement)
- 2-3 team photos (mom working, smiling)
- 1-2 testimonial videos (30 sec each, phone video OK, say: "I'm [name], we did a [project] on my [kitchen/bathroom], it looks amazing, I'd definitely recommend")

Save all to: `/home/claude/dne-photos/` folder

**Expected outcome:** Photo library starts

---

## DAY 2 (Tuesday): WEBSITE & LANDING PAGE

### Action 6: Create Simple Landing Page (2-3 hours)
**This is what Google Ads will send people to**

Create file: `/home/claude/dne-landing-page.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Free Kitchen Remodel Estimate | D N E Contracting</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    
    header {
      background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    
    header h1 { font-size: 28px; margin-bottom: 10px; }
    header p { font-size: 16px; opacity: 0.9; }
    
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    
    .form-section {
      background: #f8fafc;
      padding: 30px;
      border-radius: 8px;
      margin: 30px 0;
      border: 2px solid #e2e8f0;
    }
    
    .form-group { margin-bottom: 20px; }
    label { display: block; font-weight: 600; margin-bottom: 5px; color: #1e293b; }
    input, select, textarea { 
      width: 100%; 
      padding: 10px; 
      border: 1px solid #cbd5e1; 
      border-radius: 4px; 
      font-size: 16px;
    }
    
    button {
      width: 100%;
      padding: 14px;
      background: #1e40af;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    
    button:hover { background: #1e3a8a; }
    
    .video-section {
      background: #f1f5f9;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
      border-radius: 8px;
    }
    
    .video-section h2 { margin-bottom: 15px; }
    .video-section p { color: #64748b; margin-bottom: 15px; }
    
    .testimonial { 
      background: white; 
      padding: 20px; 
      margin: 15px 0; 
      border-left: 4px solid #1e40af;
      border-radius: 4px;
    }
    
    .testimonial-author { font-weight: 600; color: #1e40af; }
    .testimonial-text { color: #64748b; margin-top: 5px; }
    
    .success-message {
      display: none;
      background: #dcfce7;
      color: #166534;
      padding: 20px;
      border-radius: 4px;
      margin: 20px 0;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <h1>🏠 Plan Your Perfect Remodel</h1>
    <p>Answer 3 quick questions. Get a custom estimate + design ideas.</p>
  </header>
  
  <div class="container">
    <div class="form-section">
      <form id="estimateForm">
        <div class="form-group">
          <label for="name">Your Name *</label>
          <input type="text" id="name" name="name" required>
        </div>
        
        <div class="form-group">
          <label for="phone">Phone Number *</label>
          <input type="tel" id="phone" name="phone" placeholder="(610) 555-0123" required>
        </div>
        
        <div class="form-group">
          <label for="email">Email Address *</label>
          <input type="email" id="email" name="email" required>
        </div>
        
        <div class="form-group">
          <label for="projectType">What are you remodeling? *</label>
          <select id="projectType" name="projectType" required>
            <option value="">-- Select --</option>
            <option value="kitchen">Kitchen</option>
            <option value="bathroom">Bathroom</option>
            <option value="basement">Basement</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="budget">Budget Range *</label>
          <select id="budget" name="budget" required>
            <option value="">-- Select --</option>
            <option value="5-10k">$5,000 - $10,000</option>
            <option value="10-25k">$10,000 - $25,000</option>
            <option value="25-50k">$25,000 - $50,000</option>
            <option value="50k+">$50,000+</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="timeline">When do you want to start? *</label>
          <select id="timeline" name="timeline" required>
            <option value="">-- Select --</option>
            <option value="asap">ASAP (Next 2 weeks)</option>
            <option value="3months">Within 3 months</option>
            <option value="thisyear">This year</option>
            <option value="unsure">Not sure yet</option>
          </select>
        </div>
        
        <button type="submit">Get My Free Estimate →</button>
      </form>
      
      <div class="success-message" id="successMessage">
        ✓ Thanks! Check your email for a special video from mom. She'll call you within 24 hours!
      </div>
    </div>
    
    <div class="video-section">
      <h2>📽️ See Your Remodel Come to Life</h2>
      <p>Watch a quick video from mom, then explore 3D designs of projects just like yours.</p>
      <!-- Placeholder for video embed -->
      <p style="background: #cbd5e1; padding: 100px 20px; border-radius: 4px; color: #64748b;">
        [Video will be embedded here]
      </p>
    </div>
    
    <h2 style="text-align: center; margin-top: 40px;">Why Choose D N E Contracting?</h2>
    
    <div class="testimonial">
      <div class="testimonial-author">⭐⭐⭐⭐⭐ Sarah M., Pottstown</div>
      <div class="testimonial-text">"Mom was professional, on-time, and the results are stunning. Highly recommend!"</div>
    </div>
    
    <div class="testimonial">
      <div class="testimonial-author">⭐⭐⭐⭐⭐ John D., King of Prussia</div>
      <div class="testimonial-text">"Best decision we made. The whole team was respectful and quality was top-notch."</div>
    </div>
  </div>
  
  <script>
    document.getElementById('estimateForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        project_type: document.getElementById('projectType').value,
        budget: document.getElementById('budget').value,
        timeline: document.getElementById('timeline').value,
      };
      
      // Send to n8n webhook (you'll set this up later)
      const webhookUrl = 'https://your-n8n-url/webhook/dne-leads';
      
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (response.ok) {
          document.getElementById('estimateForm').style.display = 'none';
          document.getElementById('successMessage').style.display = 'block';
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Error submitting form. Please try again or call us directly.');
      }
    });
  </script>
</body>
</html>
```

Deploy to Vercel:
1. Save as `index.html` in repo folder
2. Push to GitHub
3. In Vercel, click "Import Project" → select repo
4. Deploy (auto)
5. Get URL: `https://dne-contracting.vercel.app`

**Expected outcome:** Landing page live and collecting submissions

---

### Action 7: Setup Resend Email (20 mins)
**For sending emails to leads**

1. Go to: https://resend.com
2. Sign up (email: hello@dne-contracting.com)
3. Verify email domain (they'll email you instructions)
4. Once verified, note your API key (starts with `re_`)
5. Save for later: you'll use this in n8n

**Expected outcome:** Email sending ready

---

### Action 8: Setup Twilio SMS (20 mins)
**For SMS alerts to mom + leads**

1. Go to: https://www.twilio.com
2. Sign up (free trial $15 credit)
3. Buy a phone number (search "Pottstown" or just get any number)
   - Cost: $1/month
   - Example: (267) 555-XXXX
4. Note:
   - Account SID
   - Auth Token
   - Phone number

5. Save for n8n setup

**Expected outcome:** SMS sending ready

---

## DAY 3 (Wednesday): AUTOMATION SETUP

### Action 9: Setup n8n Workflows (2-3 hours)
**The automation engine**

Option A: Cloud (easier)
- Go to: https://n8n.cloud
- Sign up (free trial)
- Create workflow → "Start from blank"

Option B: Self-hosted (on Vercel, more control)
- Skip for now, do cloud first

**Workflow #1: Form Submission → Email**

Steps:
1. Start: Webhook trigger (form post)
2. Add: Filter node (validate email/phone)
3. Add: Supabase node (insert row)
4. Add: Resend node (send email)
5. Add: Twilio node (send SMS to mom)

I'll write the full workflow JSON for you in a separate file.

---

## DAY 4 (Thursday): TESTING & OPTIMIZATION

### Action 10: Test Full Funnel (1 hour)
1. Fill out landing page form yourself
2. Confirm you receive:
   - Email ✓
   - SMS to mom ✓
   - Data in Supabase ✓
3. Fix any errors
4. Do it 2-3 times to make sure

### Action 11: Launch First Ad (1 hour)
1. Go to Google Ads Manager
2. Create campaign:
   - Type: "Search"
   - Keywords: "kitchen remodel pottstown", "plumber near me"
   - Budget: $20/day
   - Landing page: your Vercel URL
   - Ad copy: "Free Kitchen Remodel Estimate | Licensed Contractor"

3. Go to Meta Ads Manager
4. Create campaign:
   - Type: "Conversion"
   - Audience: 35-65, homeowners, interests: home improvement
   - Budget: $15/day
   - Landing page: Vercel URL
   - Ad creative: 3-4 project photos

**Expected outcome:** First leads trickling in

---

## DAY 5 (FRIDAY): SCALE & DOCUMENT

### Action 12: Track Results (1 hour)
Create a Google Sheet:
| Date | Leads | Emails Sent | SMS Sent | Opened | Clicked | Form Type |

Track daily for rest of week.

### Action 13: List Building (1 hour)
Ask mom for:
- 10-15 customer phone numbers (for testimonial calls)
- 20-30 project photos (for portfolio/ads)
- List of current jobs + timeline
- List of competitors (who she competes with)

### Action 14: Early Optimizations (1 hour)
Check:
- Landing page load time (should be <2s)
- Form mobile view (test on phone)
- Email delivery (check spam folder)
- SMS delivery (call number, confirm SMS received)
- Supabase data (verify leads saved)

---

## END OF WEEK 1 CHECKLIST

- [ ] Google Local Services Ads live (leads should be coming in)
- [ ] Google Business Profile verified
- [ ] Supabase project created + leads table
- [ ] Vercel account setup
- [ ] Landing page deployed
- [ ] Resend email configured
- [ ] Twilio SMS configured
- [ ] n8n workflow basic setup
- [ ] First test leads submitted
- [ ] First Google/Meta ads running
- [ ] Results being tracked

**Expected Week 1 Outcome:**
- 5-15 leads submitted
- 2-5 of those contacted by mom
- 1-2 qualified for quote
- System working end-to-end ✓

---

## EXACT BUDGET FOR WEEK 1

| Item | Cost | Notes |
|------|------|-------|
| Google Local Services Ads | $0 (setup free, bid starts tomorrow) | You'll set bid = $30/lead |
| Vercel hosting | $0 | Free tier |
| Supabase | $0 | Free tier |
| Resend email | $0 | Free tier (100 emails/day) |
| Twilio SMS | $1 | Phone number purchase |
| n8n cloud | $0 | Free tier |
| Google Ads testing | $20 | Minimal spend to test |
| Meta Ads testing | $15 | Minimal spend to test |
| **TOTAL** | **~$36** | Incredibly cheap |

**Week 2:** Increase to $500-1000 ad spend once system is proven

---

## IF YOU GET STUCK

**Problem:** Form not submitting
- Check: browser console (F12 → console tab)
- Solution: webhook URL wrong, fix it in form JavaScript

**Problem:** Emails not sending
- Check: Resend API key copied correctly
- Solution: verify email domain in Resend dashboard

**Problem:** SMS not received
- Check: Twilio phone number active
- Solution: check Twilio logs (twilio.com → logs)

**Problem:** Leads not showing in Supabase
- Check: Supabase table exists (SQL editor)
- Solution: check n8n workflow ran (n8n.cloud → execution logs)

**Problem:** Landing page slow
- Check: image file size (should be <200KB each)
- Solution: compress images, use Vercel image optimization

---

## NEXT: SEND DETAILED TECH SETUP GUIDE

Once Week 1 is running, I'll send:
1. Complete n8n workflow JSON (copy/paste ready)
2. Customer portal setup guide
3. Full email sequence templates
4. Advanced analytics dashboard
5. Referral program setup

**Start small. Measure everything. Scale what works.**

You've got this! 🚀
