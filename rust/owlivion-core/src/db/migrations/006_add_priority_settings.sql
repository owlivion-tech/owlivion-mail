-- Add priority_enabled column to accounts table
-- This allows users to enable/disable priority fetching per account
ALTER TABLE accounts ADD COLUMN priority_enabled INTEGER DEFAULT 1;

-- Create index for fast filtering of priority-enabled accounts
CREATE INDEX IF NOT EXISTS idx_accounts_priority ON accounts(priority_enabled);
