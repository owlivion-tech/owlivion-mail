-- Migration: Session Monitoring & Anomaly Detection
-- Description: Add session tracking, login history, and security alerts
-- Version: 004
-- Date: 2026-02-06

-- ============================================================================
-- Enhanced Session Tracking
-- ============================================================================

-- Add session metadata to refresh_tokens table
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Update last_activity_at on token refresh
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_token_activity
  BEFORE UPDATE ON refresh_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_last_activity();

-- ============================================================================
-- Login History for Anomaly Detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    login_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET NOT NULL,
    user_agent TEXT,
    country_code VARCHAR(2),
    city VARCHAR(100),
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    two_factor_used BOOLEAN DEFAULT FALSE,

    -- Indexes for performance
    CONSTRAINT login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_failed ON login_history(user_id, success, login_at DESC) WHERE success = FALSE;
CREATE INDEX IF NOT EXISTS idx_login_history_device ON login_history(device_id, login_at DESC);

-- ============================================================================
-- Security Alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'new_location', 'unusual_time', 'failed_attempts', 'new_device'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    is_acknowledged BOOLEAN DEFAULT FALSE,

    CONSTRAINT security_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_unack ON security_alerts(user_id, is_acknowledged) WHERE is_acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity, created_at DESC);

-- ============================================================================
-- Data Retention Policy (Auto-cleanup)
-- ============================================================================

-- Function to clean old login history (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_login_history()
RETURNS void AS $$
BEGIN
  DELETE FROM login_history
  WHERE login_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean acknowledged alerts (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_alerts()
RETURNS void AS $$
BEGIN
  DELETE FROM security_alerts
  WHERE is_acknowledged = TRUE AND acknowledged_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON TABLE login_history IS 'Tracks all login attempts for anomaly detection and audit trail';
COMMENT ON TABLE security_alerts IS 'Stores security alerts for suspicious activity';
COMMENT ON COLUMN login_history.two_factor_used IS 'Whether 2FA was used for this login (future use)';
COMMENT ON COLUMN security_alerts.alert_type IS 'Type: new_location, unusual_time, failed_attempts, new_device';
COMMENT ON COLUMN security_alerts.severity IS 'Severity: low, medium, high, critical';
