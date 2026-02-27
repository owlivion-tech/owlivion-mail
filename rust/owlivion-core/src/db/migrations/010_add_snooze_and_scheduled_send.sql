-- Migration 010: Add snooze and scheduled send support

-- Snooze: add snooze_until column to emails table
ALTER TABLE emails ADD COLUMN snooze_until TEXT DEFAULT NULL;

-- Index for efficient snooze queries
CREATE INDEX IF NOT EXISTS idx_emails_snoozed ON emails(snooze_until) WHERE snooze_until IS NOT NULL;

-- Scheduled Send: add send_at column to outbox table
ALTER TABLE outbox ADD COLUMN send_at TEXT DEFAULT NULL;

-- Index for scheduled emails
CREATE INDEX IF NOT EXISTS idx_outbox_scheduled ON outbox(send_at) WHERE send_at IS NOT NULL AND status = 'pending';
