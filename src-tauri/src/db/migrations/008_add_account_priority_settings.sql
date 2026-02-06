-- Migration 008: Add per-account priority fetching settings
-- Allows users to enable/disable priority fetching (unread first) per account

-- Add priority fetching toggle per account (default enabled)
ALTER TABLE accounts ADD COLUMN enable_priority_fetch INTEGER DEFAULT 1;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_priority ON accounts(enable_priority_fetch);
