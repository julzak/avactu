-- Migration: Add confirmation token support for email verification
-- Run this in Supabase Dashboard SQL Editor
-- ===========================================

-- Add columns for pending frequency change and confirmation token
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS pending_frequency VARCHAR(10),
ADD COLUMN IF NOT EXISTS confirmation_token UUID,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS subscribers_token_idx
ON subscribers (confirmation_token)
WHERE confirmation_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN subscribers.pending_frequency IS 'New frequency awaiting email confirmation';
COMMENT ON COLUMN subscribers.confirmation_token IS 'UUID token for email confirmation';
COMMENT ON COLUMN subscribers.token_expires_at IS 'Token expiration timestamp (24h validity)';
