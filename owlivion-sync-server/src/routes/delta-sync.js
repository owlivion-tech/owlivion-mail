/**
 * Delta Sync Routes
 *
 * POST /api/v1/sync/:data_type/delta - Upload delta changes
 * GET /api/v1/sync/:data_type/delta - Download delta changes
 * GET /api/v1/sync/:data_type/deleted - Get deleted records
 */

import express from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { deltaSyncUploadValidation, deltaSyncDownloadValidation } from '../utils/validator.js';
import { deltaSyncUploadLimiter, deltaSyncDownloadLimiter } from '../utils/rateLimiter.js';
import { query, getClient } from '../config/database.js';

const router = express.Router();

// All delta sync routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/sync/:data_type/delta
 * Upload delta changes (insert, update, delete)
 */
router.post('/:data_type/delta', deltaSyncUploadLimiter, deltaSyncUploadValidation, async (req, res, next) => {
  const client = await getClient();

  try {
    const { data_type } = req.params;
    const { changes, device_id, client_timestamp } = req.body;
    const userId = req.user.userId;

    // Validate data_type
    const validTypes = ['accounts', 'contacts', 'preferences', 'signatures'];
    if (!validTypes.includes(data_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data_type',
        code: 'INVALID_DATA_TYPE',
      });
    }

    // Validate changes array
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Changes must be a non-empty array',
        code: 'INVALID_CHANGES',
      });
    }

    // Limit batch size to prevent abuse
    if (changes.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 1000 changes per request',
        code: 'BATCH_TOO_LARGE',
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // Get current version for this data type
    const versionResult = await client.query(
      'SELECT version FROM sync_data WHERE user_id = $1 AND data_type = $2',
      [userId, data_type]
    );

    let currentVersion = versionResult.rows.length > 0 ? versionResult.rows[0].version : 0;
    let newVersion = currentVersion + 1;

    // Process each change
    const processedChanges = [];
    const conflicts = [];

    for (const change of changes) {
      const { record_id, change_type, encrypted_record, record_nonce, record_checksum } = change;

      // Validate change structure
      if (!record_id || !change_type) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Each change must have record_id and change_type',
          code: 'INVALID_CHANGE_STRUCTURE',
        });
      }

      // Validate change_type
      if (!['insert', 'update', 'delete'].includes(change_type)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Invalid change_type: ${change_type}`,
          code: 'INVALID_CHANGE_TYPE',
        });
      }

      // For insert/update, validate encrypted data
      if (change_type !== 'delete') {
        if (!encrypted_record || !record_nonce || !record_checksum) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'Insert/update changes must include encrypted_record, record_nonce, and record_checksum',
            code: 'MISSING_ENCRYPTED_DATA',
          });
        }

        // Decode and verify checksum
        let encryptedBuffer, nonceBuffer;
        try {
          encryptedBuffer = Buffer.from(encrypted_record, 'base64');
          nonceBuffer = Buffer.from(record_nonce, 'base64');
        } catch (error) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'Invalid base64 encoding',
            code: 'INVALID_ENCODING',
          });
        }

        const calculatedChecksum = crypto
          .createHash('sha256')
          .update(encryptedBuffer)
          .digest('hex');

        if (calculatedChecksum !== record_checksum.toLowerCase()) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Checksum mismatch for record ${record_id}`,
            code: 'CHECKSUM_MISMATCH',
          });
        }
      }

      // Check for conflicts (existing change for same record)
      const existingChange = await client.query(
        `SELECT id, version, changed_at FROM sync_data_changes
         WHERE user_id = $1 AND data_type = $2 AND record_id = $3
         ORDER BY changed_at DESC LIMIT 1`,
        [userId, data_type, record_id]
      );

      // Simple conflict resolution: Last-Write-Wins (LWW)
      // If there's an existing change and it's newer than client_timestamp, it's a conflict
      let isConflict = false;
      if (existingChange.rows.length > 0) {
        const existingTimestamp = new Date(existingChange.rows[0].changed_at);
        const clientTimestampDate = client_timestamp ? new Date(client_timestamp) : new Date();

        if (existingTimestamp > clientTimestampDate) {
          isConflict = true;
          conflicts.push({
            record_id,
            server_version: existingChange.rows[0].version,
            server_timestamp: existingTimestamp.toISOString(),
          });
          continue; // Skip this change, server version is newer
        }
      }

      // Insert change record
      let encryptedBuffer = null;
      let nonceBuffer = null;

      if (change_type !== 'delete') {
        encryptedBuffer = Buffer.from(encrypted_record, 'base64');
        nonceBuffer = Buffer.from(record_nonce, 'base64');
      }

      await client.query(
        `INSERT INTO sync_data_changes
         (user_id, data_type, record_id, change_type, encrypted_record, record_nonce, record_checksum,
          device_id, version, changed_at, client_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
        [
          userId,
          data_type,
          record_id,
          change_type,
          encryptedBuffer,
          nonceBuffer,
          record_checksum || null,
          device_id,
          newVersion,
          client_timestamp || null,
        ]
      );

      // If delete, add to deleted_records
      if (change_type === 'delete') {
        await client.query(
          `INSERT INTO deleted_records (user_id, data_type, record_id, deleted_by_device_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, data_type, record_id) DO UPDATE
           SET deleted_at = NOW(), deleted_by_device_id = $4`,
          [userId, data_type, record_id, device_id]
        );
      }

      processedChanges.push({ record_id, change_type, version: newVersion });
    }

    // Update sync_data metadata
    await client.query(
      `INSERT INTO sync_data (user_id, data_type, encrypted_blob, nonce, checksum, version, device_id, updated_at, last_delta_sync_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (user_id, data_type) DO UPDATE
       SET version = $6, device_id = $7, updated_at = NOW(), last_delta_sync_at = NOW()`,
      [userId, data_type, Buffer.from(''), Buffer.from(''), '', newVersion, device_id]
    );

    // Update device last_sync_at
    await client.query(
      'UPDATE devices SET last_sync_at = NOW() WHERE user_id = $1 AND device_id = $2',
      [userId, device_id]
    );

    // Log to sync_history
    await client.query(
      `INSERT INTO sync_history (user_id, device_id, data_type, action, timestamp, success, ip_address)
       VALUES ($1, $2, $3, $4, NOW(), TRUE, $5)`,
      [userId, device_id, data_type, 'delta_upload', req.ip || null]
    );

    // Commit transaction
    await client.query('COMMIT');

    // Return response
    res.status(200).json({
      success: true,
      data: {
        data_type,
        version: newVersion,
        processed_count: processedChanges.length,
        conflict_count: conflicts.length,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
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
 * GET /api/v1/sync/:data_type/delta
 * Download delta changes since timestamp
 */
router.get('/:data_type/delta', deltaSyncDownloadLimiter, deltaSyncDownloadValidation, async (req, res, next) => {
  try {
    const { data_type } = req.params;
    const { since, limit = 100, offset = 0 } = req.query;
    const userId = req.user.userId;
    const deviceId = req.user.deviceId;

    // Validate data_type
    const validTypes = ['accounts', 'contacts', 'preferences', 'signatures'];
    if (!validTypes.includes(data_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data_type',
        code: 'INVALID_DATA_TYPE',
      });
    }

    // Validate since timestamp
    if (!since) {
      return res.status(400).json({
        success: false,
        error: 'since parameter is required',
        code: 'MISSING_SINCE_PARAM',
      });
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid since timestamp',
        code: 'INVALID_TIMESTAMP',
      });
    }

    // Limit pagination
    const parsedLimit = Math.min(parseInt(limit) || 100, 1000);
    const parsedOffset = parseInt(offset) || 0;

    // Get change count first
    const countResult = await query(
      'SELECT * FROM count_changes_since($1, $2, $3)',
      [userId, data_type, sinceDate]
    );

    const totalChanges = parseInt(countResult.rows[0].change_count) || 0;
    const totalDeleted = parseInt(countResult.rows[0].deleted_count) || 0;

    // Get changes
    const changesResult = await query(
      'SELECT * FROM get_changes_since($1, $2, $3, $4, $5)',
      [userId, data_type, sinceDate, parsedLimit, parsedOffset]
    );

    // Get deleted records
    const deletedResult = await query(
      'SELECT * FROM get_deleted_since($1, $2, $3, $4, $5)',
      [userId, data_type, sinceDate, parsedLimit, 0] // Always start from offset 0 for deletes
    );

    // Format changes
    const changes = changesResult.rows.map((row) => ({
      record_id: row.record_id,
      change_type: row.change_type,
      encrypted_record: row.encrypted_record ? row.encrypted_record.toString('base64') : null,
      record_nonce: row.record_nonce ? row.record_nonce.toString('base64') : null,
      record_checksum: row.record_checksum,
      changed_at: row.changed_at,
      version: row.version,
      device_id: row.device_id,
    }));

    // Format deleted records
    const deleted = deletedResult.rows.map((row) => ({
      record_id: row.record_id,
      deleted_at: row.deleted_at,
      deleted_by_device_id: row.deleted_by_device_id,
    }));

    // Calculate pagination metadata
    const hasMore = totalChanges > parsedOffset + parsedLimit;
    const nextOffset = hasMore ? parsedOffset + parsedLimit : null;

    // Log to sync_history
    await query(
      `INSERT INTO sync_history (user_id, device_id, data_type, action, timestamp, success, ip_address)
       VALUES ($1, $2, $3, $4, NOW(), TRUE, $5)`,
      [userId, deviceId, data_type, 'delta_download', req.ip || null]
    );

    // Return response
    res.status(200).json({
      success: true,
      data: {
        data_type,
        since: sinceDate.toISOString(),
        changes,
        deleted,
        pagination: {
          total_changes: totalChanges,
          total_deleted: totalDeleted,
          limit: parsedLimit,
          offset: parsedOffset,
          returned_count: changes.length,
          has_more: hasMore,
          next_offset: nextOffset,
        },
      },
    });
  } catch (error) {
    // Log failed download
    try {
      await query(
        `INSERT INTO sync_history (user_id, device_id, data_type, action, timestamp, success, error_message, ip_address)
         VALUES ($1, $2, $3, $4, NOW(), FALSE, $5, $6)`,
        [
          req.user.userId,
          req.user.deviceId,
          req.params.data_type,
          'delta_download',
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
 * GET /api/v1/sync/:data_type/deleted
 * Get deleted records since timestamp (standalone endpoint for clarity)
 */
router.get('/:data_type/deleted', deltaSyncDownloadLimiter, deltaSyncDownloadValidation, async (req, res, next) => {
  try {
    const { data_type } = req.params;
    const { since, limit = 100, offset = 0 } = req.query;
    const userId = req.user.userId;

    // Validate data_type
    const validTypes = ['accounts', 'contacts', 'preferences', 'signatures'];
    if (!validTypes.includes(data_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data_type',
        code: 'INVALID_DATA_TYPE',
      });
    }

    // Validate since timestamp
    if (!since) {
      return res.status(400).json({
        success: false,
        error: 'since parameter is required',
        code: 'MISSING_SINCE_PARAM',
      });
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid since timestamp',
        code: 'INVALID_TIMESTAMP',
      });
    }

    // Limit pagination
    const parsedLimit = Math.min(parseInt(limit) || 100, 1000);
    const parsedOffset = parseInt(offset) || 0;

    // Get deleted records
    const deletedResult = await query(
      'SELECT * FROM get_deleted_since($1, $2, $3, $4, $5)',
      [userId, data_type, sinceDate, parsedLimit, parsedOffset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM deleted_records
       WHERE user_id = $1 AND data_type = $2 AND deleted_at > $3 AND expires_at > NOW()`,
      [userId, data_type, sinceDate]
    );

    const totalDeleted = parseInt(countResult.rows[0].total) || 0;

    // Format deleted records
    const deleted = deletedResult.rows.map((row) => ({
      record_id: row.record_id,
      deleted_at: row.deleted_at,
      deleted_by_device_id: row.deleted_by_device_id,
    }));

    // Calculate pagination
    const hasMore = totalDeleted > parsedOffset + parsedLimit;
    const nextOffset = hasMore ? parsedOffset + parsedLimit : null;

    // Return response
    res.status(200).json({
      success: true,
      data: {
        data_type,
        since: sinceDate.toISOString(),
        deleted,
        pagination: {
          total: totalDeleted,
          limit: parsedLimit,
          offset: parsedOffset,
          returned_count: deleted.length,
          has_more: hasMore,
          next_offset: nextOffset,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
