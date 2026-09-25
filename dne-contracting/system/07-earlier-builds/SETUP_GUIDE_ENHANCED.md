# D N E Contracting - Advanced Lead Funnel with Video & Visualization

## Overview
This is a **complete lead-to-close funnel** with three key stages:
1. **Landing page** — captures qualified leads
2. **Video email + visualization** — builds trust & engagement
3. **Phone call** — closes the deal

The automation handles everything between stages.

---

## Architecture

```
Landing Page → Form Submitted → n8n Webhook → Supabase Save
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
            Video Email to Lead  SMS Alert      WhatsApp to Mom
                    ↓               ↓               ↓
            Visualization Link  Confirmation  Visualization Link
                    ↓
                Mom Calls Lead
```

---

## Files You Have

1. **enhanced-funnel.html** — Landing page with form (includes visualization in benefits)
2. **remodel-visualizer.html** — Interactive 3D/floor plan viewer that loads after lead submits
3. **n8n-workflow-enhanced.json** — Full automation workflow with video email support
4. **n8n-supabase-setup.sql** — Database schema (same as before)

---

## Step 1: Deploy Landing Page to Vercel

### 1.1 Push to GitHub
```bash
cd /path/to/tb-solutions
cp enhanced-funnel.html index.html
git add index.html
git commit -m "Add enhanced plumbing funnel with video email"
git push origin main
```

### 1.2 Deploy
- Go to **vercel.com** → Import project
- Select `nikbyrd28-pixel/tb-solutions`
- Framework: None (Static)
- Deploy

Get your Vercel URL: `https://dne-contracting.vercel.app`

### 1.3 Deploy Visualization Tool
Also push the visualizer as a separate route:
```bash
cp remodel-visualizer.html visualizer.html
git add visualizer.html
git commit -m "Add remodel visualization tool"
git push
```

Then in Vercel, add a redirect or use a path-based route to serve it at `/visualizer`

---

## Step 2: Set Up Supabase Database

(Same as before)

1. Go to your Supabase project
2. Open SQL Editor
3. Paste the entire SQL from `n8n-supabase-setup.sql`
4. Run it

This creates the `plumbing_leads` table.

---

## Step 3: Set Up n8n Workflow (Enhanced)

### 3.1 Create Webhook Trigger
1. New workflow: "D N E Contracting - Lead Capture + Video Email"
2. Add **Webhook** node
   - Method: `POST`
   - Path: `plumbing-leads`
   - Save to get webhook URL

### 3.2 Add Supabase Save Node
Same as basic version — inserts lead into `plumbing_leads` table.

### 3.3 Add Claude API Node (NEW!)
This generates a personalized video script for each lead.

1. Add **HTTP Request** node (for Claude API call)
2. Method: `POST`
3. URL: `https://api.anthropic.com/v1/messages`
4. Headers:
   ```
   Authorization: Bearer YOUR_ANTHROPIC_API_KEY
   Content-Type: application/json
   ```
5. Body (JSON):
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 300,
  "system": "You are a warm, professional video script writer for a plumbing company. Write brief, engaging welcome scripts.",
  "messages": [
    {
      "role": "user",
      "content": "Write a 30-45 second video script welcoming {{$json.body.fullName}} to D N E Contracting. Their project is: {{$json.body.projectType}}, starting {{$json.body.timeline}}, budget {{$json.body.budget}}. Make it warm, professional, and personalized. Format as plain text."
    }
  ]
}
```

Store the response in a variable for later (extract from `content[0].text`).

### 3.4 Add Video Email Node (NEW!)
1. Add **Send Email** node
2. To: `body.email`
3. Subject: `"Your Free Remodel Plan + Personalized Video - D N E Contracting"`
4. HTML Body (use the template below, or customize):

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1e40af; margin-bottom: 8px;">Your Personalized Remodel Plan</h1>
    <p style="color: #64748b; font-size: 14px;">{{$json.body.fullName}}, we're excited to show you what's possible!</p>
  </div>

  <!-- Video Embed or Link -->
  <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <p style="color: #475569; margin-bottom: 16px; font-size: 14px;">Watch our personalized welcome video:</p>
    <!-- Option A: Embed YouTube -->
    <div style="position: relative; background: #000; border-radius: 8px; overflow: hidden; padding-bottom: 56.25%; height: 0;">
      <iframe 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
        src="https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=0"
        allowfullscreen="true"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
    </div>
    <!-- Option B: Or link to video -->
    <p style="margin-top: 12px;"><a href="https://YOUR_VIDEO_LINK" style="color: #1e40af; text-decoration: none; font-weight: 600;">Watch Video →</a></p>
  </div>

  <!-- Project Summary Table -->
  <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #1e293b; font-size: 16px; margin-bottom: 12px;">Your Project Summary</h2>
    <table style="width: 100%; font-size: 14px;">
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 0; color: #64748b;"><strong>Project Type:</strong></td>
        <td style="padding: 10px 0; text-align: right;">{{$json.body.projectType}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 0; color: #64748b;"><strong>Scope:</strong></td>
        <td style="padding: 10px 0; text-align: right;">{{$json.body.scope}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 0; color: #64748b;"><strong>Timeline:</strong></td>
        <td style="padding: 10px 0; text-align: right;">{{$json.body.timeline}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #64748b;"><strong>Budget Range:</strong></td>
        <td style="padding: 10px 0; text-align: right;">{{$json.body.budget}}</td>
      </tr>
    </table>
  </div>

  <!-- Visualization CTA -->
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; text-align: center;">
    <h2 style="margin-bottom: 12px; font-size: 18px;">View Your Interactive Remodel</h2>
    <p style="margin-bottom: 16px; font-size: 14px; opacity: 0.95;">Explore 3D visualizations, floor plans, and before/after renderings customized for your project.</p>
    <a href="https://YOUR_DOMAIN.com/visualizer?projectType={{$json.body.projectType}}&budget={{$json.body.budget}}&phone={{$json.body.phone}}" style="display: inline-block; background: white; color: #1e40af; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">
      See Your Visualization
    </a>
  </div>

  <!-- Next Steps -->
  <div style="background: #ecf9ff; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h3 style="color: #0c447c; margin-bottom: 8px; font-size: 14px;">What Happens Next</h3>
    <ol style="color: #0c7a8f; font-size: 13px; margin-left: 20px; line-height: 1.8;">
      <li>Review your personalized visualization above</li>
      <li>Our team will call you within 24 hours</li>
      <li>We'll discuss your project in detail</li>
      <li>Receive a custom estimate and timeline</li>
    </ol>
  </div>

  <!-- Footer -->
  <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 12px;">
    <p>Have questions? Reply to this email or call us anytime.</p>
    <p style="margin-top: 8px;"><strong>D N E Contracting</strong><br>Pottstown, PA</p>
  </div>
</div>
```

**Replace these:**
- `YOUR_VIDEO_ID` — YouTube video ID (if using embedded video)
- `YOUR_VIDEO_LINK` — Direct link to video
- `YOUR_DOMAIN.com` — Your Vercel domain
- `{{$json.body.*}}` — Lead data (these stay as template variables)

### 3.5 Add WhatsApp Node (Stays Same)
Send alert to mom with visualization link included:

```
🔔 NEW LEAD

Name: {{$json.body.fullName}}
Phone: {{$json.body.phone}}
Project: {{$json.body.projectType}} ({{$json.body.scope}})
Timeline: {{$json.body.timeline}}
Budget: {{$json.body.budget}}
Address: {{$json.body.address}}, {{$json.body.zipCode}}

✅ Video email sent
✅ Visualization link generated

Visualization: https://YOUR_DOMAIN.com/visualizer?projectType={{$json.body.projectType}}&budget={{$json.body.budget}}&phone={{$json.body.phone}}

→ Ready to call!
```

### 3.6 End with Success Response
```
Status Code: 200
Response Body:
{
  "success": true,
  "message": "Lead received, video email queued, visualizer link generated"
}
```

### 3.7 Activate
Save and activate the workflow.

---

## Step 4: Connect Landing Page to n8n

Update the webhook URL in `enhanced-funnel.html`:

```javascript
const response = await fetch('YOUR_N8N_WEBHOOK_URL_HERE', {
```

Replace with your n8n webhook URL from Step 3.1.

```bash
git add enhanced-funnel.html
git commit -m "Connect funnel to n8n webhook with video email"
git push
```

---

## Step 5: Video Setup Options

You have two ways to deliver video:

### Option A: YouTube Embeds (Recommended)
1. Record a personalized 30-45 second welcome video
2. Upload to YouTube (unlisted or public)
3. Get the video ID from the URL: `youtube.com/watch?v=**VIDEO_ID**`
4. Embed in the email template
5. Same video plays for all leads (or record multiple and conditionally embed)

### Option B: Automated Video Generation (Advanced)
Use a service like **HeyGen** or **Synthesia** to auto-generate personalized videos with AI:
1. API call generates script (you're already doing this with Claude)
2. Another API call auto-generates video with avatar + script
3. Embed video URL in email

For now, **start with Option A** (one template video, personal welcome message via WhatsApp).

---

## Step 6: Test the Full Funnel

1. Fill out landing page form
2. Check:
   - ✅ Lead appears in Supabase
   - ✅ Video email received (check inbox + spam)
   - ✅ Visualization link works (click it from email)
   - ✅ WhatsApp alert to mom with link
   - ✅ Mom can click visualization and see interactive floor plan
3. Visualization should show:
   - Project type selected
   - Before/after preview
   - Interactive grid to place fixtures
   - Blueprint upload button
   - Call-to-action button

---

## Step 7: Optimize & Scale

Once live:

1. **Track conversion** — Update Supabase `conversion_status` when someone books a call or becomes a customer
2. **A/B test emails** — Try different subject lines, CTA copy
3. **Customize visualizations** — Start with templates, build custom ones per project type
4. **Record more videos** — Different videos per project type (kitchen vs. bathroom vs. basement)
5. **Iterate copy** — Update landing page headline and benefits based on what converts

---

## The Full Flow (Now)

1. **Homeowner** lands on funnel → fills form
2. **n8n triggers** instantly:
   - Saves to Supabase
   - Generates personalized video script (Claude)
   - Sends video email with visualization link
   - Sends WhatsApp to mom
3. **Homeowner** watches video, explores interactive visualization
4. **Mom** gets alert + visualization link, calls within 24 hours
5. **Mom** closes deal → marks lead as converted in Supabase

---

## Setup Checklist

- [ ] Enhanced landing page deployed to Vercel
- [ ] Remodel visualizer HTML deployed to Vercel
- [ ] Supabase table created
- [ ] n8n workflow built (webhook + Supabase + Claude + email + WhatsApp)
- [ ] Webhook URL connected to landing page
- [ ] Video/video link added to email template
- [ ] Visualization URL parameterized in email
- [ ] Test form submission
- [ ] Lead in Supabase ✓
- [ ] Video email received ✓
- [ ] Visualization opens & works ✓
- [ ] WhatsApp alert with link ✓
- [ ] Go live

---

## Troubleshooting

**Email not sending?**
- Check SMTP credentials in n8n
- Verify email is not going to spam
- Test with a real email address

**Video email not showing video?**
- Some email clients block embedded iframes
- Fallback to text link (included in template)
- Test across Gmail, Outlook, Apple Mail

**Visualization not loading?**
- Check Vercel deployment includes visualizer.html
- Verify URL params pass correctly
- Open browser console for JS errors

**n8n webhook timing out?**
- Claude API call might be slow
- Add timeout/retry logic
- Consider moving video generation to a separate async step

---

## Next Level: Make It Even Better

Once this is working:

1. **Dynamic video generation** — Use HeyGen API to generate unique AI avatar videos per lead
2. **3D rendering** — Integrate with Spline or Three.js for true 3D visualization
3. **Lead scoring** — Auto-prioritize urgent leads in WhatsApp
4. **Calendar integration** — Auto-book calls based on mom's availability
5. **Tracking pixels** — See which leads click visualization, how long they spend, what they interact with

---

**You've got this. Deploy it this week, get your mom calling leads by next week.**
