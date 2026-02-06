// Remaining 2FA endpoints to be added to auth.js before "export default router;"

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

          // Log backup code usage
          const sessionMetadata = extractSessionMetadata(req);
          await client.query(
            `INSERT INTO two_factor_backup_code_usage
             (user_id, code_hash, used_at, ip_address, user_agent)
             VALUES ($1, $2, NOW(), $3, $4)`,
            [
              user.id,
              hashBackupCode(token),
              sessionMetadata.ip_address,
              sessionMetadata.user_agent,
            ]
          );

          break;
        }
      }
    }

    if (!isValid) {
      await client.query('ROLLBACK');

      // Log failed 2FA attempt
      await logLoginAttempt(
        user.id,
        req.body.device_id || 'unknown',
        extractSessionMetadata(req),
        false,
        '2FA_VERIFICATION_FAILED',
        true
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA code',
      });
    }

    // Mark current session as 2FA verified
    // (This requires the refresh token, which should be in the request)
    if (req.body.refresh_token) {
      const tokenHash = hashToken(req.body.refresh_token);
      await client.query(
        'UPDATE refresh_tokens SET two_factor_verified = TRUE, verified_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
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
