/**
 * Session Management Routes
 * View and manage active sessions
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getActiveSessions, revokeSession } from '../utils/sessionMonitoring.js';

const router = express.Router();

/**
 * GET /api/v1/sessions
 * List all active sessions for the authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentDeviceId = req.user.deviceId;

    const sessions = await getActiveSessions(userId);

    // Mark current session
    sessions.forEach((session) => {
      session.is_current = session.device_id === currentDeviceId;
    });

    res.json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sessions',
    });
  }
});

/**
 * DELETE /api/v1/sessions/:device_id
 * Revoke a specific session (logout device)
 */
router.delete('/:device_id', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentDeviceId = req.user.deviceId;
    const targetDeviceId = req.params.device_id;

    // Prevent self-revocation
    if (targetDeviceId === currentDeviceId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot revoke current session. Use logout instead.',
      });
    }

    // Revoke the session
    const revoked = await revokeSession(userId, targetDeviceId);

    if (!revoked) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already revoked',
      });
    }

    res.json({
      success: true,
      message: 'Session revoked successfully',
      device_id: targetDeviceId,
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session',
    });
  }
});

/**
 * DELETE /api/v1/sessions
 * Revoke all sessions except current
 */
router.delete('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentDeviceId = req.user.deviceId;

    // Get all sessions
    const sessions = await getActiveSessions(userId);

    // Revoke all except current
    let revokedCount = 0;
    for (const session of sessions) {
      if (session.device_id !== currentDeviceId) {
        const revoked = await revokeSession(userId, session.device_id);
        if (revoked) revokedCount++;
      }
    }

    res.json({
      success: true,
      message: `${revokedCount} session(s) revoked successfully`,
      revoked_count: revokedCount,
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke sessions',
    });
  }
});

export default router;
