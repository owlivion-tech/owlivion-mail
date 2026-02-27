/**
 * License Management Routes
 *
 * Handles license activation, validation, and webhook events
 */

import express from 'express';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// GET /license/status - Get current license status
// ============================================================================
router.get('/status', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT l.id, l.license_key, l.plan, l.status, l.max_devices,
              l.activated_at, l.expires_at,
              (SELECT COUNT(*) FROM license_activations la WHERE la.license_id = l.id AND la.is_active = TRUE) as active_devices
       FROM licenses l
       WHERE l.user_id = $1 AND l.status = 'active'
       ORDER BY l.created_at DESC
       LIMIT 1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        license: {
          plan: 'free',
          status: 'active',
          max_devices: 1,
          active_devices: 0,
        },
      });
    }

    const license = result.rows[0];

    // Check expiry
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      await query(
        `UPDATE licenses SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [license.id]
      );
      return res.json({
        success: true,
        license: {
          plan: 'free',
          status: 'expired',
          expired_plan: license.plan,
        },
      });
    }

    res.json({
      success: true,
      license: {
        plan: license.plan,
        status: license.status,
        license_key: maskLicenseKey(license.license_key),
        max_devices: license.max_devices,
        active_devices: parseInt(license.active_devices, 10),
        activated_at: license.activated_at,
        expires_at: license.expires_at,
      },
    });
  } catch (error) {
    console.error('License status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get license status' });
  }
});

// ============================================================================
// POST /license/activate - Activate a license key
// ============================================================================
router.post('/activate', authenticate, async (req, res) => {
  try {
    const { license_key } = req.body;

    if (!license_key || typeof license_key !== 'string' || license_key.trim().length < 8) {
      return res.status(400).json({ success: false, error: 'Invalid license key' });
    }

    const trimmedKey = license_key.trim();

    // Check if license key exists and is not already assigned to another user
    const licenseResult = await query(
      `SELECT id, user_id, plan, status, max_devices, expires_at
       FROM licenses
       WHERE license_key = $1`,
      [trimmedKey]
    );

    if (licenseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'License key not found' });
    }

    const license = licenseResult.rows[0];

    // Check if already assigned to another user
    if (license.user_id && license.user_id !== req.user.userId) {
      return res.status(409).json({ success: false, error: 'License key already in use' });
    }

    // Check status
    if (license.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `License is ${license.status}`,
      });
    }

    // Check expiry
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'License has expired' });
    }

    // Assign to user if not yet assigned
    if (!license.user_id) {
      await query(
        `UPDATE licenses SET user_id = $1, activated_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [req.user.userId, license.id]
      );
    }

    // Check device activation limit
    const activeDevices = await query(
      `SELECT COUNT(*) as count FROM license_activations
       WHERE license_id = $1 AND is_active = TRUE`,
      [license.id]
    );

    const deviceCount = parseInt(activeDevices.rows[0].count, 10);

    // Get or create device record
    const deviceResult = await query(
      `SELECT id FROM devices WHERE user_id = $1 AND device_id = $2`,
      [req.user.userId, req.user.deviceId]
    );

    if (deviceResult.rows.length > 0) {
      const deviceDbId = deviceResult.rows[0].id;

      // Check if already activated on this device
      const existingActivation = await query(
        `SELECT id, is_active FROM license_activations
         WHERE license_id = $1 AND device_id = $2`,
        [license.id, deviceDbId]
      );

      if (existingActivation.rows.length > 0 && existingActivation.rows[0].is_active) {
        return res.json({
          success: true,
          message: 'License already activated on this device',
          license: {
            plan: license.plan,
            status: 'active',
          },
        });
      }

      // Check device limit
      if (deviceCount >= license.max_devices) {
        return res.status(400).json({
          success: false,
          error: `Device limit reached (${license.max_devices})`,
          max_devices: license.max_devices,
          active_devices: deviceCount,
        });
      }

      // Activate on this device (upsert)
      await query(
        `INSERT INTO license_activations (license_id, device_id, is_active, activated_at)
         VALUES ($1, $2, TRUE, NOW())
         ON CONFLICT (license_id, device_id)
         DO UPDATE SET is_active = TRUE, activated_at = NOW(), deactivated_at = NULL`,
        [license.id, deviceDbId]
      );
    }

    res.json({
      success: true,
      message: 'License activated successfully',
      license: {
        plan: license.plan,
        status: 'active',
        license_key: maskLicenseKey(trimmedKey),
        max_devices: license.max_devices,
        active_devices: deviceCount + 1,
      },
    });
  } catch (error) {
    console.error('License activation error:', error);
    res.status(500).json({ success: false, error: 'Failed to activate license' });
  }
});

// ============================================================================
// POST /license/deactivate - Deactivate license on current device
// ============================================================================
router.post('/deactivate', authenticate, async (req, res) => {
  try {
    const licenseResult = await query(
      `SELECT l.id FROM licenses l
       WHERE l.user_id = $1 AND l.status = 'active'
       ORDER BY l.created_at DESC LIMIT 1`,
      [req.user.userId]
    );

    if (licenseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No active license found' });
    }

    const licenseId = licenseResult.rows[0].id;

    const deviceResult = await query(
      `SELECT id FROM devices WHERE user_id = $1 AND device_id = $2`,
      [req.user.userId, req.user.deviceId]
    );

    if (deviceResult.rows.length > 0) {
      await query(
        `UPDATE license_activations
         SET is_active = FALSE, deactivated_at = NOW()
         WHERE license_id = $1 AND device_id = $2`,
        [licenseId, deviceResult.rows[0].id]
      );
    }

    res.json({
      success: true,
      message: 'License deactivated on this device',
    });
  } catch (error) {
    console.error('License deactivation error:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate license' });
  }
});

// ============================================================================
// POST /license/webhook - LemonSqueezy webhook handler
// ============================================================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('LEMONSQUEEZY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify signature
    const signature = req.headers['x-signature'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventName = payload.meta?.event_name;
    const data = payload.data?.attributes;

    console.log(`Webhook received: ${eventName}`);

    switch (eventName) {
      case 'order_created': {
        const email = data?.user_email;
        const orderId = payload.data?.id;
        const plan = determinePlan(data);
        const licenseKey = generateLicenseKey();

        // Find user by email
        const userResult = await query(
          `SELECT id FROM users WHERE email = $1`,
          [email]
        );

        const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;

        await query(
          `INSERT INTO licenses (user_id, license_key, plan, status, provider, provider_order_id, max_devices, expires_at)
           VALUES ($1, $2, $3, 'active', 'lemonsqueezy', $4, $5, $6)`,
          [
            userId,
            licenseKey,
            plan,
            orderId,
            plan === 'team' ? 10 : 3,
            data?.renews_at || null,
          ]
        );
        break;
      }

      case 'subscription_updated': {
        const subscriptionId = payload.data?.id;
        const status = data?.status;

        if (status === 'active') {
          await query(
            `UPDATE licenses SET status = 'active', expires_at = $1, updated_at = NOW()
             WHERE provider_subscription_id = $2`,
            [data?.renews_at, subscriptionId]
          );
        } else if (status === 'cancelled' || status === 'expired') {
          await query(
            `UPDATE licenses SET status = $1, cancelled_at = NOW(), updated_at = NOW()
             WHERE provider_subscription_id = $2`,
            [status === 'cancelled' ? 'cancelled' : 'expired', subscriptionId]
          );
        }
        break;
      }

      case 'subscription_cancelled': {
        const subscriptionId = payload.data?.id;
        await query(
          `UPDATE licenses SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
           WHERE provider_subscription_id = $1`,
          [subscriptionId]
        );
        break;
      }

      case 'order_refunded': {
        const orderId = payload.data?.id;
        await query(
          `UPDATE licenses SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
           WHERE provider_order_id = $1`,
          [orderId]
        );
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventName}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// Helpers
// ============================================================================

function maskLicenseKey(key) {
  if (!key || key.length < 8) return '****';
  return key.substring(0, 4) + '-****-****-' + key.substring(key.length - 4);
}

function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(4).toString('hex').toUpperCase().substring(0, 4));
  }
  return segments.join('-');
}

function determinePlan(attributes) {
  const variantName = attributes?.variant_name?.toLowerCase() || '';
  const productName = attributes?.product_name?.toLowerCase() || '';

  if (variantName.includes('team') || productName.includes('team')) return 'team';
  if (variantName.includes('pro') || productName.includes('pro')) return 'pro';
  return 'pro'; // default to pro for paid orders
}

export default router;
