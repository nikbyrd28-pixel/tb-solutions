-- Lead Scoring System Schema (add to existing plumbing_leads table)

ALTER TABLE plumbing_leads ADD COLUMN IF NOT EXISTS (
  lead_score INT DEFAULT 0,
  score_breakdown JSONB,
  priority_tier TEXT DEFAULT 'medium',
  call_order INT
);

-- Scoring Logic:
-- Timeline Score (most important - 40 points max)
--   ASAP (This Month) = 40 points ← HOT LEADS
--   Next 1-3 Months = 20 points
--   Flexible/Planning = 0 points

-- Budget Score (30 points max)
--   Over $30K = 30 points
--   $15K - $30K = 20 points
--   $5K - $15K = 10 points
--   Under $5K = 5 points

-- Project Type Score (20 points max)
--   Kitchen = 20 points (higher value)
--   Bathroom = 15 points
--   Basement = 10 points
--   Other = 5 points

-- Engagement Score (10 points max)
--   Watched video = 5 points
--   Clicked visualization = 5 points
--   Uploaded blueprint = 5 points (can exceed 10 if engaged)

-- Final Score: 0-100
-- 80-100 = URGENT/GOLD (call immediately, within 1 hour)
-- 60-79 = HOT/SILVER (call within 4 hours)
-- 40-59 = WARM/BRONZE (call within 24 hours)
-- 0-39 = COLD/LEAD (nurture sequence, follow up in 48 hours)

-- Trigger Function to Calculate Score
CREATE OR REPLACE FUNCTION calculate_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  DECLARE
    timeline_score INT := 0;
    budget_score INT := 0;
    project_score INT := 0;
    engagement_score INT := 0;
    total_score INT := 0;
  BEGIN
    -- Timeline scoring
    CASE NEW.timeline
      WHEN 'ASAP (This Month)' THEN timeline_score := 40;
      WHEN 'Next 1-3 Months' THEN timeline_score := 20;
      WHEN 'Flexible / Planning' THEN timeline_score := 0;
      ELSE timeline_score := 10;
    END CASE;

    -- Budget scoring
    CASE NEW.budget
      WHEN 'Over $50K' THEN budget_score := 30;
      WHEN '$30K - $50K' THEN budget_score := 30;
      WHEN '$15K - $30K' THEN budget_score := 20;
      WHEN '$5K - $15K' THEN budget_score := 10;
      WHEN 'Under $5K' THEN budget_score := 5;
      WHEN 'Not Sure' THEN budget_score := 8;
      ELSE budget_score := 10;
    END CASE;

    -- Project type scoring
    CASE NEW.project_type
      WHEN 'Kitchen Remodel' THEN project_score := 20;
      WHEN 'Bathroom Remodel' THEN project_score := 15;
      WHEN 'Basement Project' THEN project_score := 10;
      ELSE project_score := 5;
    END CASE;

    -- Calculate total
    total_score := timeline_score + budget_score + project_score;

    -- Set priority tier based on total score
    CASE
      WHEN total_score >= 80 THEN NEW.priority_tier := 'URGENT/GOLD';
      WHEN total_score >= 60 THEN NEW.priority_tier := 'HOT/SILVER';
      WHEN total_score >= 40 THEN NEW.priority_tier := 'WARM/BRONZE';
      ELSE NEW.priority_tier := 'COLD/LEAD';
    END CASE;

    NEW.lead_score := total_score;
    NEW.score_breakdown := jsonb_build_object(
      'timeline', timeline_score,
      'budget', budget_score,
      'project_type', project_score,
      'engagement', engagement_score
    );

    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run on insert
CREATE TRIGGER calculate_score_on_insert
BEFORE INSERT ON plumbing_leads
FOR EACH ROW
EXECUTE FUNCTION calculate_lead_score();

-- Create trigger to run on update (if engagement updates)
CREATE TRIGGER calculate_score_on_update
BEFORE UPDATE ON plumbing_leads
FOR EACH ROW
EXECUTE FUNCTION calculate_lead_score();

-- Create view for mom's dashboard - sorted by priority
CREATE OR REPLACE VIEW leads_by_priority AS
SELECT
  id,
  full_name,
  phone,
  email,
  address,
  project_type,
  scope,
  timeline,
  budget,
  lead_score,
  priority_tier,
  status,
  submitted_at,
  created_at
FROM plumbing_leads
WHERE status = 'new' OR (status = 'contacted' AND contacted_at > NOW() - INTERVAL '48 hours')
ORDER BY
  CASE priority_tier
    WHEN 'URGENT/GOLD' THEN 1
    WHEN 'HOT/SILVER' THEN 2
    WHEN 'WARM/BRONZE' THEN 3
    WHEN 'COLD/LEAD' THEN 4
    ELSE 5
  END,
  lead_score DESC,
  submitted_at ASC;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_lead_score ON plumbing_leads(lead_score DESC, status);
CREATE INDEX IF NOT EXISTS idx_priority_tier ON plumbing_leads(priority_tier);
