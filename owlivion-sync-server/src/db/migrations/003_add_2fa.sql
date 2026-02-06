-- Migration: Two-Factor Authentication (2FA)
-- Description: Add TOTP-based 2FA support with backup codes
-- Version: 003
-- Date: 2026-02-06

-- ============================================================================
-- 2FA Support for Users
-- ============================================================================

-- Add 2FA columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32), -- Base32 encoded TOTP secret
  ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT, -- JSON array of hashed backup codes
  ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMPTZ;

-- Add 2FA verification status to refresh_tokens
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS two_factor_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Index for performance (find users with 2FA enabled)
CREATE INDEX IF NOT EXISTS idx_users_2fa_enabled
  ON users(two_factor_enabled)
  WHERE two_factor_enabled = TRUE;

-- ============================================================================
-- 2FA Setup Temporary Storage
-- ============================================================================

-- Store temporary 2FA secrets during setup (before confirmation)
CREATE TABLE IF NOT EXISTS two_factor_setup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    secret VARCHAR(32) NOT NULL,
    qr_code_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes'),

    CONSTRAINT two_factor_setup_user_id_key UNIQUE (user_id)
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_two_factor_setup_expires
  ON two_factor_setup(expires_at);

-- Auto-cleanup expired setup sessions
CREATE OR REPLACE FUNCTION cleanup_expired_2fa_setup()
RETURNS void AS $$
BEGIN
  DELETE FROM two_factor_setup
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2FA Backup Codes Tracking
-- ============================================================================

-- Track which backup codes have been used
CREATE TABLE IF NOT EXISTS two_factor_backup_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of used code
    used_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    INDEX idx_backup_code_usage_user (user_id, used_at DESC)
);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to verify 2FA is properly configured
CREATE OR REPLACE FUNCTION is_2fa_properly_configured(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
  v_secret VARCHAR(32);
BEGIN
  SELECT two_factor_enabled, two_factor_secret
  INTO v_enabled, v_secret
  FROM users
  WHERE id = p_user_id;

  RETURN v_enabled AND v_secret IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to mark session as 2FA verified
CREATE OR REPLACE FUNCTION mark_session_2fa_verified(p_token_hash VARCHAR(64))
RETURNS void AS $$
BEGIN
  UPDATE refresh_tokens
  SET two_factor_verified = TRUE,
      verified_at = NOW()
  WHERE token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_secret IS 'Base32-encoded TOTP secret (encrypted at app level)';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'JSON array of hashed backup codes (SHA-256)';
COMMENT ON COLUMN users.two_factor_enabled_at IS 'Timestamp when 2FA was first enabled';

COMMENT ON TABLE two_factor_setup IS 'Temporary storage for 2FA setup sessions (expires after 15 minutes)';
COMMENT ON TABLE two_factor_backup_code_usage IS 'Tracks used backup codes to prevent reuse';
