-- ============================================================================
-- Delta Sync Migration
-- Version: 2.0.0
-- Description: Add change tracking and deleted records support
-- ============================================================================

-- ============================================================================
-- SYNC_DATA_CHANGES TABLE
-- Track individual record changes for delta sync
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_data_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('accounts', 'contacts', 'preferences', 'signatures')),

    -- Change tracking
    record_id VARCHAR(255) NOT NULL,  -- Client-side record ID (email, contact_id, pref_key, etc.)
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('insert', 'update', 'delete')),

    -- Encrypted record data (for insert/update only, NULL for delete)
    encrypted_record BYTEA,
    record_nonce BYTEA,
    record_checksum VARCHAR(64),

    -- Metadata
    device_id VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW(),

    -- For conflict resolution
    client_timestamp TIMESTAMP,

    CONSTRAINT valid_record_data CHECK (
        (change_type = 'delete' AND encrypted_record IS NULL) OR
        (change_type IN ('insert', 'update') AND encrypted_record IS NOT NULL)
    )
);

CREATE INDEX idx_sync_changes_user_type ON sync_data_changes(user_id, data_type);
CREATE INDEX idx_sync_changes_timestamp ON sync_data_changes(user_id, data_type, changed_at DESC);
CREATE INDEX idx_sync_changes_record ON sync_data_changes(user_id, data_type, record_id);
CREATE INDEX idx_sync_changes_device ON sync_data_changes(device_id, changed_at DESC);

-- ============================================================================
-- DELETED_RECORDS TABLE
-- Track deleted records for delta sync (tombstones)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deleted_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('accounts', 'contacts', 'preferences', 'signatures')),

    record_id VARCHAR(255) NOT NULL,
    deleted_at TIMESTAMP DEFAULT NOW(),
    deleted_by_device_id VARCHAR(255) NOT NULL,

    -- Keep for 90 days then clean up
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '90 days'),

    UNIQUE(user_id, data_type, record_id)
);

CREATE INDEX idx_deleted_records_user_type ON deleted_records(user_id, data_type);
CREATE INDEX idx_deleted_records_timestamp ON deleted_records(user_id, data_type, deleted_at DESC);
CREATE INDEX idx_deleted_records_expires ON deleted_records(expires_at) WHERE expires_at < NOW();

-- ============================================================================
-- SYNC_DATA TABLE ENHANCEMENTS
-- Add metadata for delta sync
-- ============================================================================

-- Add last_delta_sync_at to track when client last synced
ALTER TABLE sync_data ADD COLUMN IF NOT EXISTS last_delta_sync_at TIMESTAMP;

-- Add record_count to track number of records (for validation)
ALTER TABLE sync_data ADD COLUMN IF NOT EXISTS record_count INTEGER DEFAULT 0;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get changes since timestamp
CREATE OR REPLACE FUNCTION get_changes_since(
    p_user_id UUID,
    p_data_type VARCHAR(50),
    p_since TIMESTAMP,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    record_id VARCHAR(255),
    change_type VARCHAR(20),
    encrypted_record BYTEA,
    record_nonce BYTEA,
    record_checksum VARCHAR(64),
    changed_at TIMESTAMP,
    version INTEGER,
    device_id VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sdc.record_id,
        sdc.change_type,
        sdc.encrypted_record,
        sdc.record_nonce,
        sdc.record_checksum,
        sdc.changed_at,
        sdc.version,
        sdc.device_id
    FROM sync_data_changes sdc
    WHERE sdc.user_id = p_user_id
      AND sdc.data_type = p_data_type
      AND sdc.changed_at > p_since
    ORDER BY sdc.changed_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Get deleted records since timestamp
CREATE OR REPLACE FUNCTION get_deleted_since(
    p_user_id UUID,
    p_data_type VARCHAR(50),
    p_since TIMESTAMP,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    record_id VARCHAR(255),
    deleted_at TIMESTAMP,
    deleted_by_device_id VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dr.record_id,
        dr.deleted_at,
        dr.deleted_by_device_id
    FROM deleted_records dr
    WHERE dr.user_id = p_user_id
      AND dr.data_type = p_data_type
      AND dr.deleted_at > p_since
      AND dr.expires_at > NOW()
    ORDER BY dr.deleted_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Count changes since timestamp
CREATE OR REPLACE FUNCTION count_changes_since(
    p_user_id UUID,
    p_data_type VARCHAR(50),
    p_since TIMESTAMP
)
RETURNS TABLE (
    change_count BIGINT,
    deleted_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM sync_data_changes
         WHERE user_id = p_user_id
           AND data_type = p_data_type
           AND changed_at > p_since) as change_count,
        (SELECT COUNT(*) FROM deleted_records
         WHERE user_id = p_user_id
           AND data_type = p_data_type
           AND deleted_at > p_since
           AND expires_at > NOW()) as deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired deleted records (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_deleted_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM deleted_records
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Clean up old change records (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_changes(p_retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sync_data_changes
    WHERE changed_at < NOW() - (p_retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Recent changes activity
CREATE OR REPLACE VIEW v_recent_changes AS
SELECT
    sdc.user_id,
    u.email,
    sdc.data_type,
    sdc.record_id,
    sdc.change_type,
    sdc.changed_at,
    sdc.device_id,
    d.device_name,
    sdc.version
FROM sync_data_changes sdc
JOIN users u ON u.id = sdc.user_id
LEFT JOIN devices d ON d.device_id = sdc.device_id AND d.user_id = sdc.user_id
WHERE sdc.changed_at > NOW() - INTERVAL '24 hours'
ORDER BY sdc.changed_at DESC
LIMIT 100;

-- Delta sync statistics
CREATE OR REPLACE VIEW v_delta_sync_stats AS
SELECT
    sd.user_id,
    u.email,
    sd.data_type,
    sd.version,
    sd.updated_at as last_full_sync,
    sd.last_delta_sync_at,
    (SELECT COUNT(*) FROM sync_data_changes sdc
     WHERE sdc.user_id = sd.user_id AND sdc.data_type = sd.data_type
     AND sdc.changed_at > COALESCE(sd.last_delta_sync_at, sd.updated_at)) as pending_changes,
    (SELECT COUNT(*) FROM deleted_records dr
     WHERE dr.user_id = sd.user_id AND dr.data_type = sd.data_type
     AND dr.deleted_at > COALESCE(sd.last_delta_sync_at, sd.updated_at)
     AND dr.expires_at > NOW()) as pending_deletes
FROM sync_data sd
JOIN users u ON u.id = sd.user_id;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-track changes when sync_data is updated
CREATE OR REPLACE FUNCTION track_sync_data_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- This is for full sync uploads, we don't track individual record changes here
    -- Individual record changes are tracked via delta sync endpoint
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (Optional) We could add a trigger here if we wanted to auto-track full sync as changes
-- But for now, delta sync will be explicitly tracked via the delta endpoint

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sync_data_changes IS 'Record-level change tracking for delta sync';
COMMENT ON TABLE deleted_records IS 'Tombstone records for deleted items (90-day retention)';

COMMENT ON COLUMN sync_data_changes.record_id IS 'Client-side record ID (email, contact_id, preference_key, etc.)';
COMMENT ON COLUMN sync_data_changes.change_type IS 'Type of change: insert, update, or delete';
COMMENT ON COLUMN sync_data_changes.encrypted_record IS 'Encrypted record data (NULL for deletes)';

COMMENT ON COLUMN deleted_records.record_id IS 'ID of deleted record';
COMMENT ON COLUMN deleted_records.expires_at IS 'Tombstone expiration (90 days from deletion)';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite index for common delta sync query pattern
CREATE INDEX idx_sync_changes_delta_query
ON sync_data_changes(user_id, data_type, changed_at)
WHERE change_type IN ('insert', 'update');

-- Index for pagination
CREATE INDEX idx_sync_changes_id_timestamp
ON sync_data_changes(id, changed_at);

-- ============================================================================
-- STATISTICS
-- ============================================================================

ANALYZE sync_data_changes;
ANALYZE deleted_records;
ANALYZE sync_data;
