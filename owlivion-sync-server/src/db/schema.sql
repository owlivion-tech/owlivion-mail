-- ============================================================================
-- Owlivion Sync Server - PostgreSQL Database Schema
-- Version: 1.0.0
-- Zero-Knowledge Architecture: Server stores encrypted blobs only
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- Owlivion Account users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- Bcrypt hash
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- DEVICES TABLE
-- Registered devices per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,  -- Client-generated UUID
    device_name VARCHAR(255),
    platform VARCHAR(50) CHECK (platform IN ('windows', 'macos', 'linux')),
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(user_id, device_id)
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_active ON devices(user_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SYNC_DATA TABLE
-- Encrypted sync data blobs (Zero-Knowledge)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('accounts', 'contacts', 'preferences', 'signatures')),

    -- Encrypted payload (E2E encrypted, server cannot decrypt)
    encrypted_blob BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    checksum VARCHAR(64) NOT NULL,  -- SHA-256 hex

    -- Metadata
    version INTEGER NOT NULL DEFAULT 1,
    device_id VARCHAR(255) NOT NULL,  -- Device that last updated

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, data_type)
);

CREATE INDEX idx_sync_data_user ON sync_data(user_id);
CREATE INDEX idx_sync_data_type ON sync_data(user_id, data_type);
CREATE INDEX idx_sync_data_updated ON sync_data(updated_at DESC);

-- ============================================================================
-- SYNC_HISTORY TABLE
-- Audit log of all sync operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('upload', 'download')),
    timestamp TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    ip_address INET,  -- Client IP for security audit

    -- Optional: Store checksum for verification
    checksum VARCHAR(64)
);

CREATE INDEX idx_sync_history_user ON sync_history(user_id, timestamp DESC);
CREATE INDEX idx_sync_history_device ON sync_history(device_id, timestamp DESC);
CREATE INDEX idx_sync_history_type ON sync_history(data_type, timestamp DESC);
CREATE INDEX idx_sync_history_failed ON sync_history(success, timestamp DESC) WHERE success = FALSE;

-- ============================================================================
-- REFRESH_TOKENS TABLE
-- JWT refresh token management
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,  -- Hashed refresh token
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,

    UNIQUE(token_hash)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id, is_revoked) WHERE is_revoked = FALSE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on users table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_data_updated_at BEFORE UPDATE ON sync_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get sync status for a user (all data types)
CREATE OR REPLACE FUNCTION get_user_sync_status(p_user_id UUID)
RETURNS TABLE (
    data_type VARCHAR(50),
    version INTEGER,
    last_sync_at TIMESTAMP,
    device_id VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sd.data_type,
        sd.version,
        sd.updated_at as last_sync_at,
        sd.device_id
    FROM sync_data sd
    WHERE sd.user_id = p_user_id
    ORDER BY sd.data_type;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW() OR is_revoked = TRUE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Get user device count
CREATE OR REPLACE FUNCTION get_user_device_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM devices
        WHERE user_id = p_user_id AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active users with device count
CREATE OR REPLACE VIEW v_active_users AS
SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_login_at,
    COUNT(DISTINCT d.id) FILTER (WHERE d.is_active = TRUE) as active_devices,
    COUNT(DISTINCT sd.data_type) as synced_data_types
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
LEFT JOIN sync_data sd ON sd.user_id = u.id
WHERE u.is_active = TRUE
GROUP BY u.id, u.email, u.created_at, u.last_login_at;

-- Recent sync activity (last 24 hours)
CREATE OR REPLACE VIEW v_recent_sync_activity AS
SELECT
    sh.user_id,
    u.email,
    sh.device_id,
    d.device_name,
    sh.data_type,
    sh.action,
    sh.timestamp,
    sh.success
FROM sync_history sh
JOIN users u ON u.id = sh.user_id
LEFT JOIN devices d ON d.device_id = sh.device_id AND d.user_id = sh.user_id
WHERE sh.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY sh.timestamp DESC;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- No initial data needed (users register via API)

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'Owlivion Account users';
COMMENT ON TABLE devices IS 'Registered devices per user (multiple devices per user)';
COMMENT ON TABLE sync_data IS 'E2E encrypted sync data blobs (server cannot decrypt)';
COMMENT ON TABLE sync_history IS 'Audit log of all sync operations';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh token storage';

COMMENT ON COLUMN sync_data.encrypted_blob IS 'AES-256-GCM encrypted data (server never sees plaintext)';
COMMENT ON COLUMN sync_data.nonce IS '12-byte nonce for AES-GCM';
COMMENT ON COLUMN sync_data.checksum IS 'SHA-256 checksum for integrity verification';

-- ============================================================================
-- STATISTICS
-- ============================================================================

-- Recommended: Run ANALYZE after initial data load
-- ANALYZE users;
-- ANALYZE devices;
-- ANALYZE sync_data;
-- ANALYZE sync_history;
