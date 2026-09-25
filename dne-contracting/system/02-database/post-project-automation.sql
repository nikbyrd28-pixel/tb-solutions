-- Post-Project Automation & Retention

-- Add to plumbing_leads table:
ALTER TABLE plumbing_leads ADD COLUMN IF NOT EXISTS (
  project_started TIMESTAMP WITH TIME ZONE,
  project_completed TIMESTAMP WITH TIME ZONE,
  completion_email_sent BOOLEAN DEFAULT false,
  review_request_sent BOOLEAN DEFAULT false,
  google_review_link TEXT,
  yelp_review_link TEXT,
  review_received BOOLEAN DEFAULT false,
  review_rating NUMERIC(2,1),
  review_text TEXT,
  referral_code TEXT UNIQUE,
  referral_payout_amount INT DEFAULT 100,
  referral_paid BOOLEAN DEFAULT false,
  referral_referrer_lead_id BIGINT REFERENCES plumbing_leads(id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PROJECT COMPLETION EMAIL TEMPLATE
-- ═══════════════════════════════════════════════════════════════════════════

COMPLETION_EMAIL_SUBJECT = "Your remodel is complete! 🎉";

COMPLETION_EMAIL_BODY = """
<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #10b981; text-align: center;">🎉 Your {{projectType}} is Done!</h1>
  
  <p style="color: #475569; line-height: 1.8; margin: 20px 0;">
    Hi {{firstName}},<br/>
    We're thrilled to tell you that your {{projectType}} remodel is now <strong>complete</strong>!
    Our team has finished all the work and everything is ready for you to enjoy.
  </p>

  <!-- Project Summary -->
  <div style="background: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="color: #10b981; margin-bottom: 12px;">Project Summary</h3>
    <table style="width: 100%; font-size: 14px; color: #475569;">
      <tr style="border-bottom: 1px solid #dcfce7;">
        <td style="padding: 8px 0;"><strong>Project Type:</strong></td>
        <td style="text-align: right;">{{projectType}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #dcfce7;">
        <td style="padding: 8px 0;"><strong>Start Date:</strong></td>
        <td style="text-align: right;">{{projectStartDate}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #dcfce7;">
        <td style="padding: 8px 0;"><strong>Completion Date:</strong></td>
        <td style="text-align: right;">{{projectEndDate}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #dcfce7;">
        <td style="padding: 8px 0;"><strong>Total Duration:</strong></td>
        <td style="text-align: right;">{{projectDuration}} weeks</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Final Cost:</strong></td>
        <td style="text-align: right; font-weight: 600; color: #1e40af;">${{finalCost}}</td>
      </tr>
    </table>
  </div>

  <!-- Photo Gallery -->
  <div style="margin: 30px 0;">
    <h3 style="color: #1e40af; margin-bottom: 16px;">See the Transformation</h3>
    <div style="display: flex; gap: 10px; justify-content: space-around;">
      <img src="{{beforePhotoUrl}}" alt="Before" style="width: 48%; height: auto; border-radius: 6px;">
      <img src="{{afterPhotoUrl}}" alt="After" style="width: 48%; height: auto; border-radius: 6px;">
    </div>
    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 8px;">
      Before & After photos
    </p>
  </div>

  <!-- Next Steps -->
  <div style="background: #f8fafc; border-left: 4px solid #1e40af; padding: 16px; margin: 20px 0;">
    <h3 style="color: #1e40af; margin-bottom: 12px;">Next Steps</h3>
    <ol style="color: #475569; line-height: 1.8; margin: 0 0 0 20px;">
      <li>Final walk-through: Mom will call you in the next 24 hours</li>
      <li>Final payment: Please process the remaining balance (invoice attached)</li>
      <li>Warranty: Your 2-year workmanship warranty is active</li>
      <li>Maintenance: See care instructions PDF attached</li>
    </ol>
  </div>

  <!-- Review Request (Big CTA) -->
  <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 8px; padding: 24px; margin: 30px 0; text-align: center;">
    <h3 style="color: white; margin-bottom: 12px;">Love Your New Space?</h3>
    <p style="color: white; margin-bottom: 16px;">We'd love to hear about your experience!</p>
    <a href="{{googleReviewLink}}" style="display: inline-block; background: white; color: #f59e0b; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">
      Google Review
    </a>
    <a href="{{yelpReviewLink}}" style="display: inline-block; background: white; color: #f59e0b; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Yelp Review
    </a>
  </div>

  <!-- Referral Program -->
  <div style="background: #f0f9ff; border: 1px solid #0284c7; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="color: #0284c7; margin-bottom: 12px;">Refer a Friend & Earn $100</h3>
    <p style="color: #475569; margin: 0 0 12px 0;">
      Know someone who could use a remodel? Share your referral link and we'll give you $100 when they book with us.
    </p>
    <p style="background: white; padding: 12px; border-radius: 4px; font-family: 'Courier New'; color: #1e40af; word-break: break-all; margin: 0;">
      {{referralLink}}
    </p>
    <p style="color: #64748b; font-size: 12px; margin-top: 8px;">
      Share with friends, family, neighbors—anyone planning a remodel!
    </p>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
    <p style="margin: 0;">Thanks for choosing D N E Contracting!</p>
    <p style="margin: 8px 0 0 0;">📞 {{momPhone}} | ✉️ {{businessEmail}}</p>
  </div>
</div>
"""

-- ═══════════════════════════════════════════════════════════════════════════
-- REVIEW REQUEST AUTOMATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Generate Google and Yelp review links
CREATE OR REPLACE FUNCTION generate_review_links()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_completed IS NOT NULL AND OLD.project_completed IS NULL THEN
    -- Project just completed
    
    -- Generate Google review link (replace with actual business ID)
    NEW.google_review_link := 'https://search.google.com/local/writereview?placeid=ChIJ...YOUR_GOOGLE_PLACE_ID';
    
    -- Generate Yelp review link (replace with your Yelp URL)
    NEW.yelp_review_link := 'https://www.yelp.com/biz/dne-contracting-pottstown?review_type=writeone';
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_links_on_complete
BEFORE UPDATE ON plumbing_leads
FOR EACH ROW
EXECUTE FUNCTION generate_review_links();

-- ═══════════════════════════════════════════════════════════════════════════
-- REVIEW COLLECTION & REPUTATION MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lead_id BIGINT NOT NULL REFERENCES plumbing_leads(id),
  source TEXT NOT NULL, -- 'google', 'yelp', 'direct'
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  reviewer_name TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  response_text TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT true,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- View for review dashboard
CREATE OR REPLACE VIEW review_summary AS
SELECT
  COUNT(*) as total_reviews,
  ROUND(AVG(rating)::NUMERIC, 1) as avg_rating,
  COUNT(*) FILTER (WHERE rating = 5) as five_star,
  COUNT(*) FILTER (WHERE rating = 4) as four_star,
  COUNT(*) FILTER (WHERE rating = 3) as three_star,
  COUNT(*) FILTER (WHERE rating < 3) as low_rating,
  COUNT(*) FILTER (WHERE responded_at IS NULL) as unreplied
FROM reviews;

-- ═══════════════════════════════════════════════════════════════════════════
-- REFERRAL PROGRAM
-- ═══════════════════════════════════════════════════════════════════════════

-- Generate unique referral codes for each customer
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL AND NEW.deal_status = 'closed' THEN
    NEW.referral_code := 'REF-' || NEW.id || '-' || SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT), 1, 6);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_code_on_close
BEFORE UPDATE ON plumbing_leads
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- Track referral conversions
CREATE TABLE IF NOT EXISTS referral_tracking (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  referrer_lead_id BIGINT NOT NULL REFERENCES plumbing_leads(id),
  referrer_code TEXT NOT NULL,
  referred_lead_id BIGINT REFERENCES plumbing_leads(id),
  referred_name TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  referred_phone TEXT NOT NULL,
  referral_converted BOOLEAN DEFAULT false,
  referred_deal_closed BOOLEAN DEFAULT false,
  referred_deal_value INT,
  payout_status TEXT DEFAULT 'pending', -- 'pending', 'earned', 'paid'
  payout_amount INT DEFAULT 100,
  payout_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- When referred lead converts to deal, pay out referrer
CREATE OR REPLACE FUNCTION process_referral_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deal_status = 'closed' AND NEW.referral_referrer_lead_id IS NOT NULL THEN
    -- Update referrer's payout status
    UPDATE plumbing_leads
    SET
      referral_paid = true
    WHERE id = NEW.referral_referrer_lead_id;
    
    -- Log in referral tracking
    INSERT INTO referral_tracking (
      referrer_lead_id, referred_lead_id, referred_name, referred_email, referred_phone,
      referral_converted, referred_deal_closed, referred_deal_value, payout_status
    )
    VALUES (
      NEW.referral_referrer_lead_id,
      NEW.id,
      NEW.full_name,
      NEW.email,
      NEW.phone,
      true,
      true,
      NEW.closed_value,
      'earned'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_payout_trigger
AFTER UPDATE ON plumbing_leads
FOR EACH ROW
EXECUTE FUNCTION process_referral_payout();

-- ═══════════════════════════════════════════════════════════════════════════
-- N8N WORKFLOW NODES FOR POST-PROJECT
-- ═══════════════════════════════════════════════════════════════════════════

/*
WORKFLOW: Post-Project Automation

NODE 1: Project Completion Trigger
- Type: Webhook (from mom: "Project {{leadId}} is complete")
- Input: lead_id, project_end_date, final_cost, before_photos, after_photos

NODE 2: Update Supabase
- Set project_completed = NOW()
- Set completion_email_sent = false
- Generate review links

NODE 3: Wait 2 Hours
- Let things settle after completion

NODE 4: Send Completion Email
- Type: Email
- Subject: [COMPLETION_EMAIL_SUBJECT]
- Body: [COMPLETION_EMAIL_BODY]
- Include before/after photos
- Include invoice for final payment
- Set completion_email_sent = true

NODE 5: Wait 3 Days
- Give homeowner time to enjoy their new space

NODE 6: Send Review Request Email
- Type: Email
- Subject: "Share your experience - Google & Yelp reviews"
- Body: [REVIEW_REQUEST_EMAIL]
- Links to Google and Yelp review pages
- Set review_request_sent = true

NODE 7: Send SMS Review Reminder (7 days)
- Type: Twilio SMS
- Only if review_received = false
- Message: "{{firstName}}, loved working with you! Quick review helps us serve your neighbors better: {{googleReviewLink}}"

NODE 8: Generate Referral Link
- Type: Email (separate, 10 days post-complete)
- Subject: "Share D N E with friends—earn $100"
- Body: [REFERRAL_EMAIL]
- Include unique referral_code

NODE 9: Monitor Referral Conversions (Ongoing)
- Type: Scheduled
- Daily check: referral_tracking table
- If referred_deal_closed = true and payout_status = 'pending'
- Send referrer: "Your referral closed! $100 payout processing"
- Update payout_status = 'paid'
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- DASHBOARD VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

-- View for projects needing follow-up
CREATE OR REPLACE VIEW projects_pending_followup AS
SELECT
  id,
  full_name,
  email,
  phone,
  project_completed,
  completion_email_sent,
  review_request_sent,
  review_received,
  referral_code,
  CASE
    WHEN completion_email_sent = false THEN 'Send Completion Email'
    WHEN review_request_sent = false AND project_completed > NOW() - INTERVAL '3 days' THEN 'Send Review Request'
    WHEN review_received = false AND project_completed > NOW() - INTERVAL '8 days' THEN 'Send SMS Review Reminder'
    WHEN referral_code IS NOT NULL THEN 'Share Referral Program'
    ELSE 'Complete'
  END as next_action
FROM plumbing_leads
WHERE project_completed IS NOT NULL
  AND (
    completion_email_sent = false
    OR (review_request_sent = false AND project_completed > NOW() - INTERVAL '4 days')
    OR (review_received = false AND project_completed > NOW() - INTERVAL '8 days')
  )
ORDER BY project_completed DESC;

-- Referral program view
CREATE OR REPLACE VIEW referral_program_status AS
SELECT
  pl.full_name,
  pl.referral_code,
  COUNT(rt.id) as referrals_sent,
  COUNT(rt.referred_lead_id) FILTER (WHERE rt.referral_converted = true) as referrals_converted,
  COUNT(rt.referred_lead_id) FILTER (WHERE rt.referred_deal_closed = true) as referrals_closed,
  SUM(rt.payout_amount) FILTER (WHERE rt.payout_status = 'paid') as total_paid_out,
  SUM(rt.payout_amount) FILTER (WHERE rt.payout_status IN ('pending', 'earned')) as pending_payout
FROM plumbing_leads pl
LEFT JOIN referral_tracking rt ON pl.id = rt.referrer_lead_id
WHERE pl.referral_code IS NOT NULL
GROUP BY pl.id, pl.full_name, pl.referral_code
ORDER BY referrals_closed DESC;
