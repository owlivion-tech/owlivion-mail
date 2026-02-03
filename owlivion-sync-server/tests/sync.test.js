/**
 * Sync API Tests
 *
 * Tests for /api/v1/sync endpoints:
 * - POST /sync/upload
 * - GET /sync/download
 * - GET /sync/status
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  teardownTestDatabase,
  generateTestEmail,
  generateDeviceId,
  createTestUser,
  createTestDevice,
  getTestPool,
} from './setup.js';

const API_BASE = 'http://localhost:3000/api/v1';

// Helper to register and get tokens
async function registerAndGetTokens() {
  const email = generateTestEmail();
  const deviceId = generateDeviceId();

  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'TestPassword123!',
      device_id: deviceId,
      device_name: 'Test Device',
      platform: 'linux',
    }),
  });

  const data = await response.json();
  return {
    accessToken: data.data.tokens.access_token,
    refreshToken: data.data.tokens.refresh_token,
    userId: data.data.user.id,
    deviceId,
  };
}

// Helper to create encrypted test data
function createTestSyncData() {
  const testData = JSON.stringify({
    contacts: [
      { email: 'test@example.com', name: 'Test User' },
      { email: 'jane@example.com', name: 'Jane Doe' },
    ],
  });

  const encryptedBlob = Buffer.from(testData).toString('base64');
  const nonce = crypto.randomBytes(12).toString('base64');
  const checksum = crypto.createHash('sha256').update(Buffer.from(encryptedBlob, 'base64')).digest('hex');

  return { encryptedBlob, nonce, checksum };
}

// Setup and teardown
before(async () => {
  await setupTestDatabase();
});

after(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await cleanupTestDatabase();
});

describe('POST /sync/upload', () => {
  test('should successfully upload encrypted sync data', async () => {
    const { accessToken, deviceId } = await registerAndGetTokens();
    const { encryptedBlob, nonce, checksum } = createTestSyncData();

    const response = await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: encryptedBlob,
        nonce,
        checksum,
        device_id: deviceId,
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.data_type, 'contacts');
    assert.strictEqual(data.data.version, 1, 'First upload should be version 1');
    assert.ok(data.data.synced_at);
  });

  test('should increment version on subsequent uploads', async () => {
    const { accessToken, deviceId } = await registerAndGetTokens();
    const { encryptedBlob, nonce, checksum } = createTestSyncData();

    const payload = {
      data_type: 'contacts',
      encrypted_blob: encryptedBlob,
      nonce,
      checksum,
      device_id: deviceId,
    };

    // First upload
    const response1 = await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data1 = await response1.json();
    assert.strictEqual(data1.data.version, 1);

    // Second upload (update)
    const { encryptedBlob: blob2, nonce: nonce2, checksum: checksum2 } = createTestSyncData();

    const response2 = await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...payload,
        encrypted_blob: blob2,
        nonce: nonce2,
        checksum: checksum2,
      }),
    });

    const data2 = await response2.json();
    assert.strictEqual(data2.data.version, 2, 'Version should increment');
  });

  test('should reject upload without authentication', async () => {
    const { encryptedBlob, nonce, checksum } = createTestSyncData();

    const response = await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: encryptedBlob,
        nonce,
        checksum,
        device_id: generateDeviceId(),
      }),
    });

    assert.strictEqual(response.status, 401, 'Should return 401 Unauthorized');
  });

  test('should reject upload with invalid checksum', async () => {
    const { accessToken, deviceId } = await registerAndGetTokens();
    const { encryptedBlob, nonce } = createTestSyncData();

    const response = await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: encryptedBlob,
        nonce,
        checksum: 'invalid_checksum',
        device_id: deviceId,
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 400);
    assert.strictEqual(data.code, 'CHECKSUM_MISMATCH');
  });

  test('should support all data types', async () => {
    const { accessToken, deviceId } = await registerAndGetTokens();
    const dataTypes = ['accounts', 'contacts', 'preferences', 'signatures'];

    for (const dataType of dataTypes) {
      const { encryptedBlob, nonce, checksum } = createTestSyncData();

      const response = await fetch(`${API_BASE}/sync/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data_type: dataType,
          encrypted_blob: encryptedBlob,
          nonce,
          checksum,
          device_id: deviceId,
        }),
      });

      const data = await response.json();
      assert.strictEqual(response.status, 200, `Should accept ${dataType}`);
      assert.strictEqual(data.data.data_type, dataType);
    }
  });

  test('should log sync history', async () => {
    const { accessToken, deviceId, userId } = await registerAndGetTokens();
    const { encryptedBlob, nonce, checksum } = createTestSyncData();

    await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: encryptedBlob,
        nonce,
        checksum,
        device_id: deviceId,
      }),
    });

    // Check sync_history table
    const pool = getTestPool();
    const result = await pool.query(
      'SELECT * FROM sync_history WHERE user_id = $1 AND action = $2',
      [userId, 'upload']
    );

    assert.strictEqual(result.rows.length, 1, 'Should log sync history');
    assert.strictEqual(result.rows[0].data_type, 'contacts');
    assert.strictEqual(result.rows[0].success, true);
  });
});

describe('GET /sync/download', () => {
  test('should successfully download previously uploaded data', async () => {
    const { accessToken, deviceId } = await registerAndGetTokens();
    const { encryptedBlob, nonce, checksum } = createTestSyncData();

    // Upload first
    await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: encryptedBlob,
        nonce,
        checksum,
        device_id: deviceId,
      }),
    });

    // Download
    const response = await fetch(`${API_BASE}/sync/download?data_type=contacts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.data_type, 'contacts');
    assert.strictEqual(data.data.encrypted_blob, encryptedBlob);
    assert.strictEqual(data.data.nonce, nonce);
    assert.strictEqual(data.data.checksum, checksum);
    assert.strictEqual(data.data.version, 1);
  });

  test('should return 404 for non-existent data type', async () => {
    const { accessToken } = await registerAndGetTokens();

    const response = await fetch(`${API_BASE}/sync/download?data_type=contacts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    assert.strictEqual(response.status, 404);
    const data = await response.json();
    assert.strictEqual(data.code, 'NO_DATA');
  });

  test('should reject download without authentication', async () => {
    const response = await fetch(`${API_BASE}/sync/download?data_type=contacts`, {
      method: 'GET',
    });

    assert.strictEqual(response.status, 401);
  });

  test('should return latest version after multiple uploads', async () => {
    const { accessToken, deviceId } = await registerAndGetTokens();

    // Upload version 1
    const data1 = createTestSyncData();
    await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: data1.encryptedBlob,
        nonce: data1.nonce,
        checksum: data1.checksum,
        device_id: deviceId,
      }),
    });

    // Upload version 2
    const data2 = createTestSyncData();
    await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: data2.encryptedBlob,
        nonce: data2.nonce,
        checksum: data2.checksum,
        device_id: deviceId,
      }),
    });

    // Download
    const response = await fetch(`${API_BASE}/sync/download?data_type=contacts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const downloadData = await response.json();
    assert.strictEqual(downloadData.data.version, 2, 'Should return latest version');
    assert.strictEqual(downloadData.data.encrypted_blob, data2.encryptedBlob);
  });
});

describe('GET /sync/status', () => {
  test('should return sync status for all data types', async () => {
    const { accessToken, deviceId } = await registerAndGetTokens();

    // Upload some data
    const contactsData = createTestSyncData();
    await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: contactsData.encryptedBlob,
        nonce: contactsData.nonce,
        checksum: contactsData.checksum,
        device_id: deviceId,
      }),
    });

    const preferencesData = createTestSyncData();
    await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        data_type: 'preferences',
        encrypted_blob: preferencesData.encryptedBlob,
        nonce: preferencesData.nonce,
        checksum: preferencesData.checksum,
        device_id: deviceId,
      }),
    });

    // Get status
    const response = await fetch(`${API_BASE}/sync/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.sync_status);

    // Check contacts status
    assert.strictEqual(data.data.sync_status.contacts.version, 1);
    assert.ok(data.data.sync_status.contacts.last_sync_at);

    // Check preferences status
    assert.strictEqual(data.data.sync_status.preferences.version, 1);

    // Check unsynced types are null
    assert.strictEqual(data.data.sync_status.accounts, null);
    assert.strictEqual(data.data.sync_status.signatures, null);
  });

  test('should return all null for fresh account', async () => {
    const { accessToken } = await registerAndGetTokens();

    const response = await fetch(`${API_BASE}/sync/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(data.data.sync_status.accounts, null);
    assert.strictEqual(data.data.sync_status.contacts, null);
    assert.strictEqual(data.data.sync_status.preferences, null);
    assert.strictEqual(data.data.sync_status.signatures, null);
  });

  test('should reject status request without authentication', async () => {
    const response = await fetch(`${API_BASE}/sync/status`, {
      method: 'GET',
    });

    assert.strictEqual(response.status, 401);
  });
});
