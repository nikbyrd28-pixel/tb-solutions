-- Create plumbing leads table
CREATE TABLE IF NOT EXISTS plumbing_leads (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  address text NOT NULL,
  zip_code text NOT NULL,
  project_type text NOT NULL,
  scope text NOT NULL,
  timeline text NOT NULL,
  budget text,
  notes text,
  source text DEFAULT 'remodel-planner',
  submitted_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'new',
  contacted_at timestamp with time zone,
  conversion_status text DEFAULT 'pending'
);

-- Create index on status for quick filtering
CREATE INDEX IF NOT EXISTS idx_plumbing_leads_status ON plumbing_leads(status);
CREATE INDEX IF NOT EXISTS idx_plumbing_leads_created_at ON plumbing_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plumbing_leads_timeline ON plumbing_leads(timeline);

-- Enable RLS
ALTER TABLE plumbing_leads ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous insert (form submissions)
CREATE POLICY "Allow anonymous insert" ON plumbing_leads
  FOR INSERT WITH CHECK (true);

-- Create policy for authenticated read
CREATE POLICY "Allow authenticated read" ON plumbing_leads
  FOR SELECT USING (true);

-- Create policy for authenticated update
CREATE POLICY "Allow authenticated update" ON plumbing_leads
  FOR UPDATE USING (true);
