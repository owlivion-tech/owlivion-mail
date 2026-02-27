-- ============================================================================
-- Delta Sync Migration - Add soft delete support
-- Version: 1.0.0
-- Date: 2026-02-06
-- ============================================================================
-- This migration adds soft delete flags to enable delta sync.
-- Updated records can be tracked via existing updated_at timestamps.
-- Deleted records are marked with deleted=1 instead of hard deletion.

-- ============================================================================
-- ACCOUNTS TABLE - Add soft delete flag
-- ============================================================================
ALTER TABLE accounts ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

-- Index for filtering non-deleted accounts
CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(deleted) WHERE deleted = 0;

-- ============================================================================
-- CONTACTS TABLE - Add soft delete flag
-- ============================================================================
ALTER TABLE contacts ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

-- Index for filtering non-deleted contacts
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted) WHERE deleted = 0;

-- ============================================================================
-- SYNC_QUEUE TABLE - Offline queue for failed sync operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Queue item metadata
    data_type TEXT NOT NULL CHECK (data_type IN ('accounts', 'contacts', 'preferences', 'signatures')),
    operation TEXT NOT NULL CHECK (operation IN ('upload', 'download', 'delete')),

    -- Payload (encrypted)
    encrypted_payload BLOB NOT NULL,

    -- Retry logic
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    next_retry_at TEXT NOT NULL,                    -- ISO 8601 timestamp
    backoff_seconds INTEGER NOT NULL DEFAULT 10,     -- Exponential backoff

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
    error_message TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_queue_data_type ON sync_queue(data_type, status);

-- ============================================================================
-- SYNC_METADATA TABLE - Track last sync timestamps per data type
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_metadata (
    data_type TEXT PRIMARY KEY CHECK (data_type IN ('accounts', 'contacts', 'preferences', 'signatures')),

    -- Last sync tracking
    last_sync_at TEXT,                              -- ISO 8601 timestamp
    last_sync_version INTEGER DEFAULT 0,            -- Server version number

    -- Statistics
    items_synced INTEGER DEFAULT 0,
    items_changed INTEGER DEFAULT 0,
    items_deleted INTEGER DEFAULT 0,

    -- Status
    sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
    error_message TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize sync metadata for each data type
INSERT OR IGNORE INTO sync_metadata (data_type, last_sync_at) VALUES
    ('accounts', NULL),
    ('contacts', NULL),
    ('preferences', NULL),
    ('signatures', NULL);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update trigger for sync_queue
CREATE TRIGGER IF NOT EXISTS sync_queue_updated_at AFTER UPDATE ON sync_queue
BEGIN
    UPDATE sync_queue SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update trigger for sync_metadata
CREATE TRIGGER IF NOT EXISTS sync_metadata_updated_at AFTER UPDATE ON sync_metadata
BEGIN
    UPDATE sync_metadata SET updated_at = datetime('now') WHERE data_type = NEW.data_type;
END;

-- ============================================================================
-- NOTES
-- ============================================================================
/*
Delta Sync Strategy:
1. Track changes via updated_at timestamps (already exists)
2. Soft delete via deleted flag (added by this migration)
3. Query: WHERE updated_at > last_sync_at AND deleted = 0
4. Deleted items: WHERE updated_at > last_sync_at AND deleted = 1

Sync Metadata Usage:
- Store last_sync_at per data type
- Compare with local updated_at to find changes
- Only upload/download delta (changed records)

Queue Usage:
- Failed sync operations go to sync_queue
- Exponential backoff retry logic
- Process pending items on next sync attempt
*/
