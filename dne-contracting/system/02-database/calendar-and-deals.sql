-- Calendar Booking Integration (Calendly or Google Calendar)

-- Add to plumbing_leads table:
ALTER TABLE plumbing_leads ADD COLUMN IF NOT EXISTS (
  calendly_link TEXT,
  call_booked BOOLEAN DEFAULT false,
  call_scheduled_time TIMESTAMP WITH TIME ZONE,
  call_completed BOOLEAN DEFAULT false,
  call_notes TEXT,
  call_outcome TEXT, -- 'interested', 'quote_sent', 'declined', 'rescheduled'
  quote_sent BOOLEAN DEFAULT false,
  quote_amount INT,
  quote_sent_date TIMESTAMP WITH TIME ZONE,
  decision_date TIMESTAMP WITH TIME ZONE,
  deal_status TEXT DEFAULT 'new', -- 'new', 'quoted', 'negotiating', 'closed', 'lost'
  closed_value INT,
  closed_date TIMESTAMP WITH TIME ZONE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTION A: CALENDLY INTEGRATION (Recommended - Easiest Setup)
-- ═══════════════════════════════════════════════════════════════════════════

/*
Setup in Calendly:
1. Create a 30-min meeting type called "D N E Remodel Consultation"
2. Set availability: Mom's work hours (e.g., Mon-Fri 9am-5pm Eastern)
3. Go to Settings → Integrations → Zapier
4. Create Zap:
   - Trigger: Calendly Meeting Scheduled
   - Action: POST to n8n webhook with:
     * attendee.name
     * attendee.email
     * attendee.phone (if available)
     * event_time
     * scheduled_url

5. In n8n, add webhook node to capture booking:
   - Match calendly email to plumbing_leads by email
   - Update lead: call_booked = true, call_scheduled_time = event_time
   - Send confirmation email to homeowner
   - Send alert to mom
*/

CALENDLY_SETUP_SQL = """
-- Store mom's Calendly link (update with your actual link)
INSERT INTO settings (key, value) VALUES 
('calendly_link', 'https://calendly.com/dne-contracting/remodel-consultation');

-- Create view for upcoming booked calls
CREATE OR REPLACE VIEW upcoming_booked_calls AS
SELECT
  id,
  full_name,
  phone,
  email,
  project_type,
  lead_score,
  call_scheduled_time,
  EXTRACT(EPOCH FROM (call_scheduled_time - NOW())) / 3600 as hours_until_call
FROM plumbing_leads
WHERE call_booked = true 
  AND call_completed = false
  AND call_scheduled_time > NOW()
ORDER BY call_scheduled_time ASC;
""";

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTION B: GOOGLE CALENDAR INTEGRATION (For existing G Suite)
-- ═══════════════════════════════════════════════════════════════════════════

/*
Setup in Google Calendar:
1. Create calendar "D N E Consultations" 
2. Share with mom (read-write)
3. Get Calendar ID from Settings
4. In n8n:
   - Add Google Calendar node
   - Create event with:
     * Title: "Consultation - {{fullName}}"
     * Time: homeowner selected time
     * Description: lead details + project info
     * Attendee: mom@email.com + homeowner email
     * Alert: 30 min before

5. When event created, auto-send:
   - Confirmation email to homeowner with Zoom link (optional)
   - Reminder SMS to mom 1 hour before
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-CALL TRACKING SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- Table for storing call logs
CREATE TABLE IF NOT EXISTS call_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lead_id BIGINT NOT NULL REFERENCES plumbing_leads(id),
  call_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  call_end_time TIMESTAMP WITH TIME ZONE,
  call_duration_minutes INT,
  call_notes TEXT,
  outcome TEXT NOT NULL, -- 'interested', 'declined', 'rescheduled', 'no_answer'
  next_action TEXT,
  next_action_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'mom' -- who logged this
);

-- Update plumbing_leads when call completes
CREATE OR REPLACE FUNCTION log_call_outcome()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE plumbing_leads
  SET
    call_completed = true,
    call_notes = NEW.call_notes,
    call_outcome = NEW.outcome,
    status = CASE 
      WHEN NEW.outcome = 'interested' THEN 'quoted'
      WHEN NEW.outcome = 'declined' THEN 'lost'
      WHEN NEW.outcome = 'rescheduled' THEN 'contacted'
      ELSE 'contacted'
    END,
    contacted_at = NEW.call_start_time
  WHERE id = NEW.lead_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_log_update
AFTER INSERT ON call_logs
FOR EACH ROW
EXECUTE FUNCTION log_call_outcome();

-- ═══════════════════════════════════════════════════════════════════════════
-- QUOTE & DEAL TRACKING
-- ═══════════════════════════════════════════════════════════════════════════

-- Table for quotes/proposals
CREATE TABLE IF NOT EXISTS quotes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lead_id BIGINT NOT NULL REFERENCES plumbing_leads(id),
  quote_number TEXT UNIQUE NOT NULL, -- e.g., "DNE-2024-001"
  scope_of_work TEXT NOT NULL,
  estimated_cost INT NOT NULL,
  materials_cost INT,
  labor_cost INT,
  timeline_weeks INT,
  payment_terms TEXT, -- "50% deposit, 50% on completion"
  valid_until TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'sent', -- 'sent', 'accepted', 'rejected', 'expired'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update lead status when quote accepted
CREATE OR REPLACE FUNCTION quote_accepted_workflow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
    -- Quote just got accepted
    UPDATE plumbing_leads
    SET
      deal_status = 'closed',
      closed_value = NEW.estimated_cost,
      closed_date = NOW(),
      quote_sent = true,
      quote_amount = NEW.estimated_cost,
      quote_sent_date = NEW.sent_at
    WHERE id = NEW.lead_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_quote_accepted
AFTER UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION quote_accepted_workflow();

-- ═══════════════════════════════════════════════════════════════════════════
-- MOM'S DASHBOARD QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

-- View: Today's Schedule
CREATE OR REPLACE VIEW todays_schedule AS
SELECT
  id,
  full_name,
  phone,
  email,
  project_type,
  budget,
  lead_score,
  call_scheduled_time,
  EXTRACT(HOUR FROM call_scheduled_time) as hour,
  EXTRACT(MINUTE FROM call_scheduled_time) as minute
FROM plumbing_leads
WHERE DATE(call_scheduled_time) = CURRENT_DATE
  AND call_completed = false
  AND call_booked = true
ORDER BY call_scheduled_time ASC;

-- View: Hot Leads Needing Follow-Up
CREATE OR REPLACE VIEW hot_leads_waiting AS
SELECT
  id,
  full_name,
  phone,
  email,
  project_type,
  budget,
  timeline,
  lead_score,
  priority_tier,
  status,
  submitted_at,
  EXTRACT(HOUR FROM (NOW() - submitted_at)) as hours_since_submission
FROM plumbing_leads
WHERE priority_tier IN ('URGENT/GOLD', 'HOT/SILVER')
  AND status IN ('new', 'contacted')
  AND call_completed = false
ORDER BY lead_score DESC, submitted_at ASC;

-- View: Conversion Funnel (Last 30 Days)
CREATE OR REPLACE VIEW conversion_funnel_30d AS
SELECT
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE video_email_sent) as videos_sent,
  COUNT(*) FILTER (WHERE visualization_clicked) as viz_clicked,
  COUNT(*) FILTER (WHERE contacted_at IS NOT NULL) as contacted,
  COUNT(*) FILTER (WHERE quote_sent) as quotes_sent,
  COUNT(*) FILTER (WHERE deal_status = 'closed') as closed,
  ROUND(COUNT(*) FILTER (WHERE deal_status = 'closed')::numeric / 
        NULLIF(COUNT(*), 0) * 100, 1) as close_rate_pct,
  ROUND(AVG(CASE WHEN deal_status = 'closed' THEN closed_value END)) as avg_deal_value
FROM plumbing_leads
WHERE submitted_at > NOW() - INTERVAL '30 days';

-- View: Revenue Tracking
CREATE OR REPLACE VIEW revenue_tracking AS
SELECT
  DATE_TRUNC('week', closed_date)::DATE as week,
  COUNT(*) as deals_closed,
  SUM(closed_value) as weekly_revenue,
  AVG(closed_value) as avg_deal_value,
  MAX(closed_value) as largest_deal
FROM plumbing_leads
WHERE deal_status = 'closed'
GROUP BY DATE_TRUNC('week', closed_date)
ORDER BY week DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_call_scheduled ON plumbing_leads(call_scheduled_time) 
  WHERE call_scheduled_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_status ON plumbing_leads(deal_status);
CREATE INDEX IF NOT EXISTS idx_closed_date ON plumbing_leads(closed_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON call_logs(lead_id);
