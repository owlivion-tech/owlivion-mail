/**
 * Sync Routes
 *
 * POST /api/v1/sync/upload - Upload encrypted sync data
 * GET /api/v1/sync/download - Download encrypted sync data
 * GET /api/v1/sync/status - Get sync status for all data types
 */

import express from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { syncUploadValidation, syncDownloadValidation } from '../utils/validator.js';
import { syncUploadLimiter, syncDownloadLimiter } from '../utils/rateLimiter.js';
import { query, getClient } from '../config/database.js';

const router = express.Router();

// All sync routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/sync/upload
 * Upload encrypted sync data
 */
router.post('/upload', syncUploadLimiter, syncUploadValidation, async (req, res, next) => {
  const client = await getClient();

  try {
    const { data_type, encrypted_blob, nonce, checksum, device_id } = req.body;
    const userId = req.user.userId;

    // 1. Validate user owns the data (implicit via JWT)
    // User ID comes from authenticated JWT token

    // 2. Decode base64 encrypted_blob and nonce
    let encryptedBuffer;
    let nonceBuffer;

    try {
      encryptedBuffer = Buffer.from(encrypted_blob, 'base64');
      nonceBuffer = Buffer.from(nonce, 'base64');
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base64 encoding',
        code: 'INVALID_ENCODING',
      });
    }

    // 3. Verify checksum (SHA-256 of encrypted_blob)
    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(encryptedBuffer)
      .digest('hex');

    if (calculatedChecksum !== checksum.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Checksum mismatch',
        code: 'CHECKSUM_MISMATCH',
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // 4. Upsert into sync_data table
    const existingData = await client.query(
      'SELECT id, version FROM sync_data WHERE user_id = $1 AND data_type = $2',
      [userId, data_type]
    );

    let newVersion = 1;
    let syncDataId;

    if (existingData.rows.length > 0) {
      // Update existing data
      newVersion = existingData.rows[0].version + 1;
      syncDataId = existingData.rows[0].id;

      await client.query(
        `UPDATE sync_data
         SET encrypted_blob = $1, nonce = $2, checksum = $3, version = $4, device_id = $5, updated_at = NOW()
         WHERE id = $6`,
        [encryptedBuffer, nonceBuffer, checksum, newVersion, device_id, syncDataId]
      );
    } else {
      // Insert new data
      const insertResult = await client.query(
        `INSERT INTO sync_data (user_id, data_type, encrypted_blob, nonce, checksum, version, device_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id, version`,
        [userId, data_type, encryptedBuffer, nonceBuffer, checksum, newVersion, device_id]
      );

      syncDataId = insertResult.rows[0].id;
      newVersion = insertResult.rows[0].version;
    }

    // Update device last_sync_at
    await client.query(
      'UPDATE devices SET last_sync_at = NOW() WHERE user_id = $1 AND device_id = $2',
      [userId, device_id]
    );

    // 6. Log to sync_history
    await client.query(
      `INSERT INTO sync_history (user_id, device_id, data_type, action, timestamp, success, checksum, ip_address)
       VALUES ($1, $2, $3, $4, NOW(), TRUE, $5, $6)`,
      [userId, device_id, data_type, 'upload', checksum, req.ip || null]
    );

    // Commit transaction
    await client.query('COMMIT');

    // 7. Return success with new version
    res.status(200).json({
      success: true,
      data: {
        data_type,
        version: newVersion,
        synced_at: new Date().toISOString(),
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
 * GET /api/v1/sync/download
 * Download encrypted sync data for a specific data type
 */
router.get('/download', syncDownloadLimiter, syncDownloadValidation, async (req, res, next) => {
  try {
    const { data_type } = req.query;
    const userId = req.user.userId;
    const deviceId = req.user.deviceId;

    // 2. Fetch encrypted blob from sync_data
    const result = await query(
      `SELECT encrypted_blob, nonce, checksum, version, updated_at
       FROM sync_data
       WHERE user_id = $1 AND data_type = $2`,
      [userId, data_type]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No sync data found for this data type',
        code: 'NO_DATA',
      });
    }

    const syncData = result.rows[0];

    // 3. Encode to base64
    const encryptedBlobBase64 = syncData.encrypted_blob.toString('base64');
    const nonceBase64 = syncData.nonce.toString('base64');

    // 4. Log to sync_history
    await query(
      `INSERT INTO sync_history (user_id, device_id, data_type, action, timestamp, success, checksum, ip_address)
       VALUES ($1, $2, $3, $4, NOW(), TRUE, $5, $6)`,
      [userId, deviceId, data_type, 'download', syncData.checksum, req.ip || null]
    );

    // 5. Return encrypted payload
    res.status(200).json({
      success: true,
      data: {
        data_type,
        encrypted_blob: encryptedBlobBase64,
        nonce: nonceBase64,
        checksum: syncData.checksum,
        version: syncData.version,
        last_sync_at: syncData.updated_at,
      },
    });
  } catch (error) {
    // Log failed download attempt
    try {
      await query(
        `INSERT INTO sync_history (user_id, device_id, data_type, action, timestamp, success, error_message, ip_address)
         VALUES ($1, $2, $3, $4, NOW(), FALSE, $5, $6)`,
        [
          req.user.userId,
          req.user.deviceId,
          req.query.data_type,
          'download',
          error.message,
          req.ip || null,
        ]
      );
    } catch (logError) {
      console.error('Failed to log sync history:', logError);
    }

    next(error);
  }
});

/**
 * GET /api/v1/sync/status
 * Get sync status for all data types
 */
router.get('/status', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1. Query sync_data for user using the database function
    const result = await query('SELECT * FROM get_user_sync_status($1)', [userId]);

    // 2. Return version and last_sync_at for each data type
    const syncStatus = {};
    const allDataTypes = ['accounts', 'contacts', 'preferences', 'signatures'];

    // Initialize all data types with null
    allDataTypes.forEach((type) => {
      syncStatus[type] = null;
    });

    // Fill in synced data
    result.rows.forEach((row) => {
      syncStatus[row.data_type] = {
        version: row.version,
        last_sync_at: row.last_sync_at,
        device_id: row.device_id,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        sync_status: syncStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
