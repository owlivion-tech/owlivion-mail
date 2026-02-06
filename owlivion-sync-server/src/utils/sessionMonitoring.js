/**
 * Session Monitoring & Anomaly Detection
 * Tracks login patterns and detects suspicious activity
 */

import geoip from 'geoip-lite';
import { query } from '../config/database.js';

/**
 * Extract session metadata from HTTP request
 * @param {Object} req - Express request object
 * @returns {Object} Session metadata
 */
export const extractSessionMetadata = (req) => {
  // Get client IP (considering proxies)
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';

  // Lookup geolocation
  const geo = geoip.lookup(ip);

  return {
    ip_address: ip,
    user_agent: req.headers['user-agent'] || 'Unknown',
    country_code: geo?.country || null,
    city: geo?.city || null,
  };
};

/**
 * Log login attempt to history
 * @param {String} userId - User UUID
 * @param {String} deviceId - Device identifier
 * @param {Object} metadata - Session metadata
 * @param {Boolean} success - Whether login succeeded
 * @param {String} failureReason - Reason for failure (if applicable)
 * @param {Boolean} twoFactorUsed - Whether 2FA was used
 */
export const logLoginAttempt = async (
  userId,
  deviceId,
  metadata,
  success,
  failureReason = null,
  twoFactorUsed = false
) => {
  try {
    await query(
      `INSERT INTO login_history
       (user_id, device_id, ip_address, user_agent, country_code, city, success, failure_reason, two_factor_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        deviceId,
        metadata.ip_address,
        metadata.user_agent,
        metadata.country_code,
        metadata.city,
        success,
        failureReason,
        twoFactorUsed,
      ]
    );
  } catch (error) {
    console.error('Failed to log login attempt:', error);
    // Don't throw - logging failure shouldn't block login
  }
};

/**
 * Detect anomalous login patterns
 * @param {String} userId - User UUID
 * @param {Object} metadata - Current session metadata
 * @returns {Array} Array of security alerts
 */
export const detectAnomalies = async (userId, metadata) => {
  const alerts = [];

  try {
    // ========================================================================
    // 1. Check for new location
    // ========================================================================
    const recentLocations = await query(
      `SELECT DISTINCT country_code, city FROM login_history
       WHERE user_id = $1 AND success = TRUE AND login_at > NOW() - INTERVAL '30 days'
       LIMIT 20`,
      [userId]
    );

    const knownLocation = recentLocations.rows.some(
      (l) =>
        l.country_code === metadata.country_code && l.city === metadata.city
    );

    // Only alert if user has login history and this is a new location
    if (recentLocations.rows.length > 0 && !knownLocation && metadata.city) {
      alerts.push({
        type: 'new_location',
        severity: 'medium',
        details: {
          location: `${metadata.city}, ${metadata.country_code}`,
          ip: metadata.ip_address,
          message: 'Login from a new location detected',
        },
      });
    }

    // ========================================================================
    // 2. Check for unusual login time
    // ========================================================================
    const currentHour = new Date().getUTCHours();

    const usualHours = await query(
      `SELECT EXTRACT(HOUR FROM login_at)::INTEGER as hour, COUNT(*) as count
       FROM login_history
       WHERE user_id = $1 AND success = TRUE
       GROUP BY hour
       ORDER BY count DESC
       LIMIT 3`,
      [userId]
    );

    // Only check if we have enough history (at least 10 successful logins)
    if (usualHours.rows.length > 0) {
      const totalLogins = usualHours.rows.reduce(
        (sum, row) => sum + parseInt(row.count, 10),
        0
      );

      if (totalLogins >= 10) {
        const isUsualTime = usualHours.rows.some(
          (h) => Math.abs(parseInt(h.hour, 10) - currentHour) < 3
        );

        if (!isUsualTime) {
          alerts.push({
            type: 'unusual_time',
            severity: 'low',
            details: {
              hour: currentHour,
              usual_hours: usualHours.rows.map((h) => parseInt(h.hour, 10)),
              message: 'Login at an unusual time',
            },
          });
        }
      }
    }

    // ========================================================================
    // 3. Check for recent failed login attempts
    // ========================================================================
    const recentFailures = await query(
      `SELECT COUNT(*) as count FROM login_history
       WHERE user_id = $1 AND success = FALSE AND login_at > NOW() - INTERVAL '1 hour'`,
      [userId]
    );

    const failureCount = parseInt(recentFailures.rows[0]?.count || 0, 10);

    if (failureCount >= 3) {
      alerts.push({
        type: 'failed_attempts',
        severity: failureCount >= 5 ? 'high' : 'medium',
        details: {
          count: failureCount,
          time_window: '1 hour',
          message: `${failureCount} failed login attempts in the last hour`,
        },
      });
    }

    // ========================================================================
    // 4. Check for new device
    // ========================================================================
    const knownDevices = await query(
      `SELECT DISTINCT device_id FROM login_history
       WHERE user_id = $1 AND success = TRUE
       LIMIT 50`,
      [userId]
    );

    // This check will be done externally by comparing device_id

  } catch (error) {
    console.error('Anomaly detection error:', error);
    // Don't throw - detection failure shouldn't block login
  }

  return alerts;
};

/**
 * Create security alert
 * @param {String} userId - User UUID
 * @param {String} alertType - Alert type
 * @param {String} severity - Severity level
 * @param {Object} details - Alert details
 */
export const createSecurityAlert = async (
  userId,
  alertType,
  severity,
  details
) => {
  try {
    await query(
      `INSERT INTO security_alerts (user_id, alert_type, severity, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, alertType, severity, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to create security alert:', error);
  }
};

/**
 * Get unacknowledged security alerts for user
 * @param {String} userId - User UUID
 * @returns {Array} Security alerts
 */
export const getUnacknowledgedAlerts = async (userId) => {
  try {
    const result = await query(
      `SELECT id, alert_type, severity, details, created_at
       FROM security_alerts
       WHERE user_id = $1 AND is_acknowledged = FALSE
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.alert_type,
      severity: row.severity,
      details: row.details,
      created_at: row.created_at,
    }));
  } catch (error) {
    console.error('Failed to get security alerts:', error);
    return [];
  }
};

/**
 * Acknowledge security alert
 * @param {String} alertId - Alert UUID
 * @param {String} userId - User UUID (for authorization)
 */
export const acknowledgeAlert = async (alertId, userId) => {
  try {
    await query(
      `UPDATE security_alerts
       SET is_acknowledged = TRUE, acknowledged_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [alertId, userId]
    );
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    throw error;
  }
};

/**
 * Get active sessions for user
 * @param {String} userId - User UUID
 * @returns {Array} Active sessions
 */
export const getActiveSessions = async (userId) => {
  try {
    const result = await query(
      `SELECT device_id, device_name, platform, ip_address, country_code, city,
              user_agent, created_at, last_activity_at, is_revoked
       FROM refresh_tokens
       WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > NOW()
       ORDER BY last_activity_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      device_id: row.device_id,
      device_name: row.device_name,
      platform: row.platform,
      ip_address: row.ip_address,
      location: row.city && row.country_code
        ? `${row.city}, ${row.country_code}`
        : row.country_code || 'Unknown',
      user_agent: row.user_agent,
      created_at: row.created_at,
      last_activity: row.last_activity_at,
      is_current: false, // Will be set by caller
    }));
  } catch (error) {
    console.error('Failed to get active sessions:', error);
    throw error;
  }
};

/**
 * Revoke session by device ID
 * @param {String} userId - User UUID
 * @param {String} deviceId - Device ID to revoke
 */
export const revokeSession = async (userId, deviceId) => {
  try {
    const result = await query(
      `UPDATE refresh_tokens
       SET is_revoked = TRUE, revoked_at = NOW()
       WHERE user_id = $1 AND device_id = $2 AND is_revoked = FALSE`,
      [userId, deviceId]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('Failed to revoke session:', error);
    throw error;
  }
};
