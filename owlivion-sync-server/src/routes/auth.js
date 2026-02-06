/**
 * Authentication Routes
 *
 * POST /api/v1/auth/register - Register new user
 * POST /api/v1/auth/login - Login user
 * POST /api/v1/auth/refresh - Refresh access token
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { registerValidation, loginValidation, refreshTokenValidation } from '../utils/validator.js';
import { registerLimiter, authLimiter } from '../utils/rateLimiter.js';
import { query, getClient } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiration,
} from '../config/jwt.js';
import {
  extractSessionMetadata,
  logLoginAttempt,
  detectAnomalies,
  createSecurityAlert,
  getUnacknowledgedAlerts,
} from '../utils/sessionMonitoring.js';
import {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  isValidBackupCodeFormat,
} from '../utils/twoFactor.js';

const router = express.Router();

// Bcrypt rounds for password hashing
const BCRYPT_ROUNDS = 12;

/**
 * POST /api/v1/auth/register
 * Register a new Owlivion Account
 */
router.post('/register', registerLimiter, registerValidation, async (req, res, next) => {
  const client = await getClient();

  try {
    const { email, password, device_id, device_name, platform } = req.body;

    // Start transaction
    await client.query('BEGIN');

    // 1. Check if email already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    }

    // 2. Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 3. Create user in database
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, created_at, updated_at, last_login_at)
       VALUES ($1, $2, NOW(), NOW(), NOW())
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );

    const user = userResult.rows[0];

    // 4. Register device
    await client.query(
      `INSERT INTO devices (user_id, device_id, device_name, platform, created_at, is_active)
       VALUES ($1, $2, $3, $4, NOW(), TRUE)`,
      [user.id, device_id, device_name || 'Owlivion Mail Client', platform]
    );

    // 5. Generate JWT tokens
    const tokenPayload = {
      user_id: user.id,
      device_id: device_id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 6. Store refresh token hash
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiration();

    await client.query(
      `INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user.id, device_id, refreshTokenHash, expiresAt]
    );

    // Commit transaction
    await client.query('COMMIT');

    // 7. Return tokens
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
router.post('/login', authLimiter, loginValidation, async (req, res, next) => {
  const client = await getClient();

  try {
    const { email, password, device_id } = req.body;

    // Extract session metadata for security monitoring
    const sessionMetadata = extractSessionMetadata(req);

    // 1. Find user by email
    const userResult = await client.query(
      'SELECT id, email, password_hash, is_active, two_factor_enabled FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      // Log failed login (account disabled)
      await logLoginAttempt(
        user.id,
        device_id,
        sessionMetadata,
        false,
        'ACCOUNT_DISABLED',
        false
      );

      return res.status(403).json({
        success: false,
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // 2. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Log failed login (invalid password)
      await logLoginAttempt(
        user.id,
        device_id,
        sessionMetadata,
        false,
        'INVALID_PASSWORD',
        false
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // 2.5. Check if 2FA is enabled
    if (user.two_factor_enabled) {
      // Don't return tokens yet - return 2FA challenge
      return res.status(202).json({
        success: true,
        requires_2fa: true,
        email: user.email,
        message: 'Please provide 2FA code',
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // 3. Update last_login_at
    await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // 4. Register/update device
    const deviceResult = await client.query(
      'SELECT id FROM devices WHERE user_id = $1 AND device_id = $2',
      [user.id, device_id]
    );

    if (deviceResult.rows.length > 0) {
      // Update existing device
      await client.query(
        'UPDATE devices SET last_sync_at = NOW(), is_active = TRUE WHERE user_id = $1 AND device_id = $2',
        [user.id, device_id]
      );
    } else {
      // Register new device
      await client.query(
        `INSERT INTO devices (user_id, device_id, device_name, platform, created_at, is_active)
         VALUES ($1, $2, $3, $4, NOW(), TRUE)`,
        [user.id, device_id, 'Owlivion Mail Client', 'unknown']
      );
    }

    // 5. Generate JWT tokens
    const tokenPayload = {
      user_id: user.id,
      device_id: device_id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 6. Store refresh token hash with session metadata
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiration();

    await client.query(
      `INSERT INTO refresh_tokens
       (user_id, device_id, token_hash, expires_at, created_at, ip_address, user_agent, country_code, city)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)`,
      [
        user.id,
        device_id,
        refreshTokenHash,
        expiresAt,
        sessionMetadata.ip_address,
        sessionMetadata.user_agent,
        sessionMetadata.country_code,
        sessionMetadata.city,
      ]
    );

    // 7. Log successful login
    await logLoginAttempt(user.id, device_id, sessionMetadata, true, null, false);

    // 8. Detect anomalies
    const alerts = await detectAnomalies(user.id, sessionMetadata);

    // 9. Create security alerts if anomalies detected
    for (const alert of alerts) {
      await createSecurityAlert(user.id, alert.type, alert.severity, alert.details);
    }

    // Commit transaction
    await client.query('COMMIT');

    // 10. Get unacknowledged security alerts
    const securityAlerts = await getUnacknowledgedAlerts(user.id);

    // 11. Return tokens with security alerts
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
        },
      },
      security_alerts: securityAlerts.length > 0 ? securityAlerts : undefined,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', authLimiter, refreshTokenValidation, async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    // 1. Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refresh_token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error.message,
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    const refreshTokenHash = hashToken(refresh_token);

    // 2. Check if token is revoked or expired
    const tokenResult = await query(
      `SELECT id, user_id, device_id, expires_at, is_revoked
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [refreshTokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'TOKEN_NOT_FOUND',
      });
    }

    const storedToken = tokenResult.rows[0];

    if (storedToken.is_revoked) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token has been revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    // 3. Generate new access token
    const tokenPayload = {
      user_id: decoded.user_id,
      device_id: decoded.device_id,
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    // 4. Optionally rotate refresh token (recommended for security)
    const newRefreshToken = generateRefreshToken(tokenPayload);
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const newExpiresAt = getRefreshTokenExpiration();

    // Revoke old refresh token
    await query('UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE id = $1', [
      storedToken.id,
    ]);

    // Store new refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [decoded.user_id, decoded.device_id, newRefreshTokenHash, newExpiresAt]
    );

    // 5. Return new tokens
    res.status(200).json({
      success: true,
      data: {
        tokens: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          token_type: 'Bearer',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Two-Factor Authentication (2FA) Endpoints
// ============================================================================

/**
 * POST /api/v1/auth/2fa/setup
 * Initialize 2FA setup (generate secret and QR code)
 */
router.post('/2fa/setup', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get user email
    const userResult = await query('SELECT email, two_factor_enabled FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if 2FA is already enabled
    if (user.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled. Disable it first to set up again.',
      });
    }

    // Generate new secret
    const { secret, otpauth_url } = generateSecret(user.email);

    // Generate QR code
    const qr_code_url = await generateQRCode(otpauth_url);

    // Store temporarily (expires in 15 minutes)
    await query(
      `INSERT INTO two_factor_setup (user_id, secret, qr_code_url, created_at, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '15 minutes')
       ON CONFLICT (user_id) DO UPDATE
       SET secret = $2, qr_code_url = $3, created_at = NOW(), expires_at = NOW() + INTERVAL '15 minutes'`,
      [userId, secret, qr_code_url]
    );

    res.json({
      success: true,
      data: {
        secret: secret,
        qr_code_url: qr_code_url,
        manual_entry_key: secret, // For manual entry in authenticator apps
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/enable
 * Confirm and enable 2FA (verify token and generate backup codes)
 */
router.post('/2fa/enable', authenticate, async (req, res, next) => {
  const client = await getClient();

  try {
    const userId = req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Get temporary setup secret
    const setupResult = await client.query(
      'SELECT secret FROM two_factor_setup WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );

    if (setupResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No pending 2FA setup found or setup expired. Please start setup again.',
      });
    }

    const secret = setupResult.rows[0].secret;

    // Verify token
    if (!verifyToken(secret, token)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please try again.',
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = hashBackupCodes(backupCodes);

    // Enable 2FA
    await client.query(
      `UPDATE users
       SET two_factor_enabled = TRUE,
           two_factor_secret = $1,
           two_factor_backup_codes = $2,
           two_factor_enabled_at = NOW()
       WHERE id = $3`,
      [secret, JSON.stringify(hashedBackupCodes), userId]
    );

    // Clean up temporary setup
    await client.query('DELETE FROM two_factor_setup WHERE user_id = $1', [userId]);

    // Commit transaction
    await client.query('COMMIT');

    res.json({
      success: true,
      message: '2FA enabled successfully',
      backup_codes: backupCodes, // IMPORTANT: This is the ONLY time backup codes are shown
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/auth/2fa/disable
 * Disable 2FA (requires password and current 2FA token/backup code)
 */
router.post('/2fa/disable', authenticate, async (req, res, next) => {
  const client = await getClient();

  try {
    const userId = req.user.userId;
    const { password, token } = req.body;

    if (!password || !token) {
      return res.status(400).json({
        success: false,
        error: 'Password and token/backup code are required',
      });
    }

    await client.query('BEGIN');

    // Get user data
    const userResult = await client.query(
      'SELECT password_hash, two_factor_enabled, two_factor_secret, two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: '2FA is not enabled' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    // Verify 2FA token or backup code
    let isValid = false;

    // Try TOTP token first
    if (verifyToken(user.two_factor_secret, token)) {
      isValid = true;
    } else {
      // Try backup codes
      const backupCodes = JSON.parse(user.two_factor_backup_codes || '[]');
      for (const hashedCode of backupCodes) {
        if (verifyBackupCode(token, hashedCode)) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA code or backup code',
      });
    }

    // Disable 2FA
    await client.query(
      `UPDATE users
       SET two_factor_enabled = FALSE,
           two_factor_secret = NULL,
           two_factor_backup_codes = NULL,
           two_factor_enabled_at = NULL
       WHERE id = $1`,
      [userId]
    );

    // Revoke all sessions (force re-login)
    await client.query(
      'UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '2FA disabled successfully. All sessions have been revoked.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/auth/2fa/verify
 * Verify 2FA token during login (called after successful password auth)
 */
router.post('/2fa/verify', authLimiter, async (req, res, next) => {
  const client = await getClient();

  try {
    const { email, token, remember_device = false } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        error: 'Email and token are required',
      });
    }

    await client.query('BEGIN');

    // Get user
    const userResult = await client.query(
      'SELECT id, email, two_factor_enabled, two_factor_secret, two_factor_backup_codes FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (!user.two_factor_enabled) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: '2FA is not enabled for this user' });
    }

    // Verify token or backup code
    let isValid = false;
    let isBackupCode = false;

    // Try TOTP token
    if (verifyToken(user.two_factor_secret, token)) {
      isValid = true;
    } else {
      // Try backup codes
      const backupCodes = JSON.parse(user.two_factor_backup_codes || '[]');
      for (let i = 0; i < backupCodes.length; i++) {
        if (verifyBackupCode(token, backupCodes[i])) {
          isValid = true;
          isBackupCode = true;

          // Remove used backup code
          backupCodes.splice(i, 1);
          await client.query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [JSON.stringify(backupCodes), user.id]
          );

          break;
        }
      }
    }

    if (!isValid) {
      await client.query('ROLLBACK');

      // Log failed 2FA attempt
      const sessionMetadata = extractSessionMetadata(req);
      await logLoginAttempt(
        user.id,
        req.body.device_id || 'unknown',
        sessionMetadata,
        false,
        '2FA_VERIFICATION_FAILED',
        true
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA code',
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '2FA verification successful',
      backup_code_used: isBackupCode,
      remaining_backup_codes: isBackupCode
        ? JSON.parse(user.two_factor_backup_codes || '[]').length
        : undefined,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/auth/2fa/status
 * Get 2FA status for current user
 */
router.get('/2fa/status', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const userResult = await query(
      'SELECT two_factor_enabled, two_factor_enabled_at, two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];
    const backupCodes = JSON.parse(user.two_factor_backup_codes || '[]');

    res.json({
      success: true,
      data: {
        enabled: user.two_factor_enabled,
        enabled_at: user.two_factor_enabled_at,
        backup_codes_remaining: backupCodes.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
