/**
 * Device Management Routes
 *
 * GET /api/v1/devices - List all user devices
 * DELETE /api/v1/devices/:device_id - Revoke device access
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { deviceDeleteValidation } from '../utils/validator.js';
import { query, getClient } from '../config/database.js';

const router = express.Router();

// All device routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/devices
 * List all registered devices for current user
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1. Query devices table for user_id
    const result = await query(
      `SELECT
        id,
        device_id,
        device_name,
        platform,
        last_sync_at,
        created_at,
        is_active
       FROM devices
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // 2. Return device list with metadata
    const devices = result.rows.map((device) => ({
      id: device.id,
      // 3. Mask device_id for security (show first 8 chars)
      device_id_masked: device.device_id.substring(0, 8) + '...',
      device_id: device.device_id, // Full ID for deletion
      device_name: device.device_name,
      platform: device.platform,
      last_sync_at: device.last_sync_at,
      created_at: device.created_at,
      is_active: device.is_active,
      is_current: device.device_id === req.user.deviceId,
    }));

    res.status(200).json({
      success: true,
      data: {
        devices,
        total: devices.length,
        active: devices.filter((d) => d.is_active).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/devices/:device_id
 * Revoke device access (mark as inactive)
 */
router.delete('/:device_id', deviceDeleteValidation, async (req, res, next) => {
  const client = await getClient();

  try {
    const userId = req.user.userId;
    const deviceId = req.params.device_id;

    // Prevent user from deleting their current device
    if (deviceId === req.user.deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot revoke access for current device',
        code: 'CANNOT_DELETE_CURRENT_DEVICE',
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // 1. Verify device belongs to user
    const deviceResult = await client.query(
      'SELECT id, device_name FROM devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    if (deviceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        code: 'DEVICE_NOT_FOUND',
      });
    }

    const device = deviceResult.rows[0];

    // 2. Mark device as inactive
    await client.query(
      'UPDATE devices SET is_active = FALSE WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    // 3. Revoke all refresh tokens for device
    await client.query(
      'UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE user_id = $1 AND device_id = $2 AND is_revoked = FALSE',
      [userId, deviceId]
    );

    // 4. Log action to sync_history
    await client.query(
      `INSERT INTO sync_history (user_id, device_id, data_type, action, timestamp, success, ip_address)
       VALUES ($1, $2, $3, $4, NOW(), TRUE, $5)`,
      [userId, req.user.deviceId, 'device_revoked', 'revoke', req.ip || null]
    );

    // Commit transaction
    await client.query('COMMIT');

    // 5. Return success
    res.status(200).json({
      success: true,
      data: {
        message: 'Device access revoked successfully',
        device: {
          device_id: deviceId,
          device_name: device.device_name,
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

export default router;
