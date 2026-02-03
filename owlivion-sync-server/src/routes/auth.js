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
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiration,
} from '../config/jwt.js';

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

    // 1. Find user by email
    const userResult = await client.query(
      'SELECT id, email, password_hash, is_active FROM users WHERE email = $1',
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
      return res.status(403).json({
        success: false,
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // 2. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
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

export default router;
