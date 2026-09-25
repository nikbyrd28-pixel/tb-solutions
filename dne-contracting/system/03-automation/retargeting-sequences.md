-- Retargeting Automation Sequences

-- SEQUENCE 1: 4-Hour SMS Retarget (if no video click)
-- Trigger: video_email_sent = true AND video_watched = false AND NOW() - video_sent_time >= 4 hours

SMS_RETARGET_4H = """
Hi {{firstName}}, didn't get a chance to see your personalized remodel video yet? 
Check it out → {{visualizationLink}}

Takes 2 min to explore your custom plan. Questions? We're here → {{momPhone}}
"""

-- SEQUENCE 2: 24-Hour Follow-Up Email (if no viz engagement)
-- Trigger: video_email_sent = true AND visualization_clicked = false AND NOW() - video_sent_time >= 24 hours

EMAIL_FOLLOWUP_24H_SUBJECT = "{{firstName}}, your custom remodel is waiting →"

EMAIL_FOLLOWUP_24H_BODY = """
<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e40af;">{{firstName}}, we'd love to show you something special</h2>
  
  <p style="color: #475569; line-height: 1.6;">
    We created a personalized {{projectType}} remodel plan specifically for your {{budgetRange}} budget 
    and {{timeline}} timeline. But we haven't heard from you yet!
  </p>

  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
    <p style="color: #166534; font-weight: 600; margin: 0;">3 things inside your visualization:</p>
    <ul style="color: #166534; margin: 8px 0 0 20px;">
      <li>Before & after renderings</li>
      <li>Interactive floor plan layout</li>
      <li>Estimated timeline & next steps</li>
    </ul>
  </div>

  <p style="text-align: center; margin: 24px 0;">
    <a href="{{visualizationLink}}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      View Your Custom Plan
    </a>
  </p>

  <p style="color: #999; font-size: 13px; text-align: center;">
    Our team will still call you within 24 hours whether you view it or not. Just thought you'd like to see what's possible first!
  </p>
</div>
"""

-- SEQUENCE 3: 48-Hour "Last Chance" Email + Phone Call
-- Trigger: video_email_sent = true AND contacted_at = NULL AND NOW() - video_sent_time >= 48 hours

EMAIL_FOLLOWUP_48H_SUBJECT = "Last chance: your remodel plan expires soon"

EMAIL_FOLLOWUP_48H_BODY = """
<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e40af;">{{firstName}}, just calling to make sure you're good</h2>
  
  <p style="color: #475569;">
    You requested a free remodel plan but we haven't connected yet. No pressure! 
    We just want to make sure nothing fell through the cracks.
  </p>

  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0;">
    <p style="color: #856404; font-weight: 600;">We'll call you today at {{phone}}</p>
    <p style="color: #856404; margin: 8px 0 0;">If that doesn't work, reply here with a better time.</p>
  </div>

  <p style="text-align: center; margin: 24px 0;">
    <a href="{{calendlyLink}}" style="display: inline-block; background: #10b981; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Pick a Time That Works
    </a>
  </p>
</div>
"""

-- SEQUENCE 4: 72-Hour Nurture Loop (for leads not ready yet)
-- Trigger: priority_tier = 'COLD/LEAD' AND contacted_at > 72 hours ago AND deal_status NOT 'closed'

EMAIL_NURTURE_72H_SUBJECT = "{{firstName}}, here's what to expect from a {{projectType}} remodel"

EMAIL_NURTURE_72H_BODY = """
<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e40af;">Planning a {{projectType}}? Here's the typical timeline...</h2>
  
  <p style="color: #475569;">
    Most {{projectType}} remodels follow this path:
  </p>

  <table style="width: 100%; margin: 20px 0;">
    <tr style="background: #f0f9ff; border-bottom: 1px solid #e0e7ff;">
      <td style="padding: 12px; font-weight: 600; color: #1e40af;">Week 1-2</td>
      <td style="padding: 12px; color: #475569;">Design & permit planning</td>
    </tr>
    <tr style="border-bottom: 1px solid #e0e7ff;">
      <td style="padding: 12px; font-weight: 600; color: #1e40af;">Week 3-8</td>
      <td style="padding: 12px; color: #475569;">Demolition & installation</td>
    </tr>
    <tr style="background: #f0f9ff;">
      <td style="padding: 12px; font-weight: 600; color: #1e40af;">Week 8-10</td>
      <td style="padding: 12px; color: #475569;">Finishing touches & walk-through</td>
    </tr>
  </table>

  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
    <p style="color: #92400e; margin: 0;">Ready to get started? Our team is here to walk you through it step-by-step.</p>
  </div>

  <p style="text-align: center; margin: 24px 0;">
    <a href="tel:{{momPhone}}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Call Mom: {{momPhone}}
    </a>
  </p>

  <p style="color: #999; font-size: 13px; text-align: center;">Or reply to this email and we'll reach out at a time that works for you.</p>
</div>
"""

-- N8N WORKFLOW ADDITIONS FOR RETARGETING
-- Add these nodes to n8n workflow after initial lead save:

/*
NODE 1: Wait 4 Hours
- Type: Wait
- Time: 4 hours
- Condition: video_email_sent = true AND video_watched = false

NODE 2: SMS Retarget (4h)
- Type: Twilio/SMS
- Phone: {{body.phone}}
- Message: [SMS_RETARGET_4H]
- Only send if: visualization_clicked = false

NODE 3: Wait 24 Hours  
- Type: Wait
- Time: 24 hours from initial submit
- Condition: visualization_clicked = false

NODE 4: Email Follow-up (24h)
- Type: Email Send
- To: {{body.email}}
- Subject: [EMAIL_FOLLOWUP_24H_SUBJECT]
- Body: [EMAIL_FOLLOWUP_24H_BODY]

NODE 5: Wait 48 Hours
- Type: Wait
- Time: 48 hours from initial submit
- Condition: contacted_at = NULL

NODE 6: Escalate to Mom (48h)
- Type: WhatsApp/SMS
- Message: "🔔 ESCALATION: {{firstName}} still not engaged. Viz not viewed. Send SMS + call now."
- Only if: priority_tier = 'HOT/SILVER' OR 'URGENT/GOLD'

NODE 7: Auto-SMS (48h)
- Type: Twilio/SMS  
- Phone: {{body.phone}}
- Message: [EMAIL_FOLLOWUP_48H_BODY as SMS]

NODE 8: Tag for Nurture Loop (72h+)
- Type: Update Supabase
- Set: nurture_sequence = true, last_contact_attempt = NOW()
- Only if: contacted_at > 72 hours ago AND deal_status NOT closed

NODE 9: Scheduled Nurture Email
- Type: Email Send
- Schedule: Every 3 days (Monday/Wednesday/Friday)
- To: nurture_sequence = true leads
- Rotate through educational emails
*/

-- DASHBOARD VIEW: Retargeting Effectiveness
CREATE OR REPLACE VIEW retargeting_metrics AS
SELECT
  COUNT(*) FILTER (WHERE video_email_sent AND video_watched) as "Video Watches",
  COUNT(*) FILTER (WHERE visualization_clicked) as "Viz Clicks",
  COUNT(*) FILTER (WHERE contacted_at IS NOT NULL) as "Mom Contacted",
  COUNT(*) FILTER (WHERE deal_status = 'closed') as "Closed Deals",
  ROUND(
    COUNT(*) FILTER (WHERE contacted_at IS NOT NULL) * 100.0 / 
    NULLIF(COUNT(*) FILTER (WHERE video_email_sent), 0), 1
  ) as "Contact Rate %",
  ROUND(
    COUNT(*) FILTER (WHERE deal_status = 'closed') * 100.0 / 
    NULLIF(COUNT(*) FILTER (WHERE contacted_at IS NOT NULL), 0), 1
  ) as "Close Rate %"
FROM plumbing_leads
WHERE submitted_at > NOW() - INTERVAL '90 days';
