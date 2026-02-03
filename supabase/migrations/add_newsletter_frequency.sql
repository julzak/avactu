-- Migration: Add newsletter frequency support
-- Run this in Supabase Dashboard SQL Editor
-- ===========================================

-- 1. Add frequency column to subscribers table
-- Default is 'biweekly' for existing subscribers (current behavior)
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS frequency VARCHAR(10) DEFAULT 'biweekly'
CHECK (frequency IN ('daily', 'biweekly', 'weekly'));

-- 2. Create table for storing newsletter editions (for weekly aggregation)
CREATE TABLE IF NOT EXISTS newsletter_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date DATE NOT NULL UNIQUE,
  stories_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS newsletter_editions_date_idx
ON newsletter_editions (edition_date DESC);

-- 4. Enable RLS on newsletter_editions (optional - service key bypasses RLS)
ALTER TABLE newsletter_editions ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/select (for backend scripts)
CREATE POLICY IF NOT EXISTS "Service role can manage editions"
ON newsletter_editions
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Add comment for documentation
COMMENT ON COLUMN subscribers.frequency IS 'Newsletter frequency: daily, biweekly (default), weekly';
COMMENT ON TABLE newsletter_editions IS 'Stores daily newsletter editions for weekly aggregation';
