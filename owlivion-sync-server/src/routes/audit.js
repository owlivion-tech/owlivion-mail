/**
 * Audit Log Routes
 * View sync history and audit trail
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/v1/audit/logs
 * Get audit logs for authenticated user with filtering and pagination
 */
router.get('/logs', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 50,
      data_type,
      action,
      start_date,
      end_date,
      success,
      device_id,
    } = req.query;

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10))); // Max 100 per page
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let queryText = `
      SELECT id, device_id, data_type, action, timestamp, success, error_message,
             ip_address, checksum
      FROM sync_history
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    // Apply filters
    if (data_type) {
      queryText += ` AND data_type = $${paramIndex++}`;
      params.push(data_type);
    }

    if (action) {
      queryText += ` AND action = $${paramIndex++}`;
      params.push(action);
    }

    if (start_date) {
      queryText += ` AND timestamp >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      queryText += ` AND timestamp <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (success !== undefined) {
      queryText += ` AND success = $${paramIndex++}`;
      params.push(success === 'true');
    }

    if (device_id) {
      queryText += ` AND device_id = $${paramIndex++}`;
      params.push(device_id);
    }

    // Order and pagination
    queryText += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limitNum, offset);

    // Execute query
    const result = await query(queryText, params);

    // Get total count for pagination (with same filters)
    let countQuery = `SELECT COUNT(*) FROM sync_history WHERE user_id = $1`;
    const countParams = [userId];
    let countIndex = 2;

    if (data_type) {
      countQuery += ` AND data_type = $${countIndex++}`;
      countParams.push(data_type);
    }

    if (action) {
      countQuery += ` AND action = $${countIndex++}`;
      countParams.push(action);
    }

    if (start_date) {
      countQuery += ` AND timestamp >= $${countIndex++}`;
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ` AND timestamp <= $${countIndex++}`;
      countParams.push(end_date);
    }

    if (success !== undefined) {
      countQuery += ` AND success = $${countIndex++}`;
      countParams.push(success === 'true');
    }

    if (device_id) {
      countQuery += ` AND device_id = $${countIndex++}`;
      countParams.push(device_id);
    }

    const countResult = await query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    res.json({
      success: true,
      logs: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs',
    });
  }
});

/**
 * GET /api/v1/audit/stats
 * Get audit statistics for authenticated user
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Overall statistics
    const overallStats = await query(
      `SELECT
         COUNT(*) as total_operations,
         COUNT(*) FILTER (WHERE success = TRUE) as successful,
         COUNT(*) FILTER (WHERE success = FALSE) as failed,
         COUNT(DISTINCT device_id) as unique_devices,
         COUNT(DISTINCT ip_address) as unique_ips,
         MIN(timestamp) as first_activity,
         MAX(timestamp) as last_activity
       FROM sync_history
       WHERE user_id = $1`,
      [userId]
    );

    // By data type
    const byDataType = await query(
      `SELECT data_type, COUNT(*) as count
       FROM sync_history
       WHERE user_id = $1
       GROUP BY data_type
       ORDER BY count DESC`,
      [userId]
    );

    // By action
    const byAction = await query(
      `SELECT action, COUNT(*) as count
       FROM sync_history
       WHERE user_id = $1
       GROUP BY action
       ORDER BY count DESC`,
      [userId]
    );

    // Recent activity (last 30 days, grouped by day)
    const recentActivity = await query(
      `SELECT
         DATE(timestamp) as date,
         COUNT(*) as count,
         COUNT(*) FILTER (WHERE success = TRUE) as successful,
         COUNT(*) FILTER (WHERE success = FALSE) as failed
       FROM sync_history
       WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '30 days'
       GROUP BY DATE(timestamp)
       ORDER BY date DESC`,
      [userId]
    );

    // Recent failures (last 10)
    const recentFailures = await query(
      `SELECT id, device_id, data_type, action, timestamp, error_message
       FROM sync_history
       WHERE user_id = $1 AND success = FALSE
       ORDER BY timestamp DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        overall: overallStats.rows[0],
        by_data_type: byDataType.rows,
        by_action: byAction.rows,
        recent_activity: recentActivity.rows,
        recent_failures: recentFailures.rows,
      },
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit statistics',
    });
  }
});

/**
 * GET /api/v1/audit/export
 * Export audit logs as CSV
 */
router.get('/export', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { start_date, end_date } = req.query;

    // Build query
    let queryText = `
      SELECT timestamp, device_id, data_type, action, success, error_message, ip_address, checksum
      FROM sync_history
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (start_date) {
      queryText += ` AND timestamp >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      queryText += ` AND timestamp <= $${paramIndex++}`;
      params.push(end_date);
    }

    queryText += ` ORDER BY timestamp DESC LIMIT 10000`; // Max 10k rows for export

    const result = await query(queryText, params);

    // Convert to CSV
    const headers = [
      'Timestamp',
      'Device ID',
      'Data Type',
      'Action',
      'Success',
      'Error Message',
      'IP Address',
      'Checksum',
    ];

    let csv = headers.join(',') + '\n';

    for (const row of result.rows) {
      csv += [
        new Date(row.timestamp).toISOString(),
        row.device_id,
        row.data_type,
        row.action,
        row.success,
        row.error_message || '',
        row.ip_address || '',
        row.checksum || '',
      ]
        .map((field) => `"${field}"`) // Quote all fields
        .join(',') + '\n';
    }

    // Set headers for CSV download
    const filename = `owlivion-audit-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
    });
  }
});

export default router;
