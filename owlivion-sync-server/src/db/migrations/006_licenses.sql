-- ============================================================================
-- Migration 006: License Management
-- Adds license key validation for Pro/Team plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_key VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('free', 'pro', 'team')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
    provider VARCHAR(50) NOT NULL DEFAULT 'lemonsqueezy',
    provider_order_id VARCHAR(255),
    provider_subscription_id VARCHAR(255),
    max_devices INTEGER NOT NULL DEFAULT 3,
    activated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_licenses_provider_order ON licenses(provider_order_id);

-- Track license activations per device
CREATE TABLE IF NOT EXISTS license_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    activated_at TIMESTAMP DEFAULT NOW(),
    deactivated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(license_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_license_activations_license ON license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_active ON license_activations(license_id, is_active) WHERE is_active = TRUE;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_licenses_timestamp ON licenses;
CREATE TRIGGER update_licenses_timestamp
    BEFORE UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
