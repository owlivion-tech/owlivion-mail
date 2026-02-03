/**
 * End-to-End Integration Tests
 *
 * Complete workflow tests:
 * - Register → Login → Upload → Download → Sync flow
 * - Multi-device sync scenarios
 * - Error recovery scenarios
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
  sleep,
} from './setup.js';

const API_BASE = 'http://localhost:3000/api/v1';

// Helper to create test sync data
function createEncryptedPayload(data) {
  const json = JSON.stringify(data);
  const encryptedBlob = Buffer.from(json).toString('base64');
  const nonce = crypto.randomBytes(12).toString('base64');
  const checksum = crypto
    .createHash('sha256')
    .update(Buffer.from(encryptedBlob, 'base64'))
    .digest('hex');

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

describe('Complete Sync Flow', () => {
  test('should complete full sync workflow: register → upload → download', async () => {
    const email = generateTestEmail();
    const deviceId = generateDeviceId();

    // 1. Register
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
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

    const registerData = await registerResponse.json();
    assert.strictEqual(registerResponse.status, 201);

    const accessToken = registerData.data.tokens.access_token;

    // 2. Upload contacts data
    const contacts = [
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' },
    ];

    const { encryptedBlob, nonce, checksum } = createEncryptedPayload({ contacts });

    const uploadResponse = await fetch(`${API_BASE}/sync/upload`, {
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

    const uploadData = await uploadResponse.json();
    assert.strictEqual(uploadResponse.status, 200);
    assert.strictEqual(uploadData.data.version, 1);

    // 3. Download and verify
    const downloadResponse = await fetch(`${API_BASE}/sync/download?data_type=contacts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const downloadData = await downloadResponse.json();
    assert.strictEqual(downloadResponse.status, 200);
    assert.strictEqual(downloadData.data.encrypted_blob, encryptedBlob);
    assert.strictEqual(downloadData.data.checksum, checksum);

    // 4. Check sync status
    const statusResponse = await fetch(`${API_BASE}/sync/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const statusData = await statusResponse.json();
    assert.strictEqual(statusData.data.sync_status.contacts.version, 1);
  });

  test('should handle multi-device sync scenario', async () => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    const device1Id = generateDeviceId();
    const device2Id = generateDeviceId();

    // Register from Device 1
    const register1 = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        device_id: device1Id,
        device_name: 'Device 1',
        platform: 'linux',
      }),
    });

    const device1Data = await register1.json();
    const device1Token = device1Data.data.tokens.access_token;

    // Upload from Device 1
    const preferences = {
      theme: 'dark',
      language: 'en',
      notifications_enabled: true,
    };

    const payload1 = createEncryptedPayload(preferences);

    await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`,
      },
      body: JSON.stringify({
        data_type: 'preferences',
        encrypted_blob: payload1.encryptedBlob,
        nonce: payload1.nonce,
        checksum: payload1.checksum,
        device_id: device1Id,
      }),
    });

    // Login from Device 2
    const login2 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        device_id: device2Id,
      }),
    });

    const device2Data = await login2.json();
    const device2Token = device2Data.data.tokens.access_token;

    // Download from Device 2
    const downloadResponse = await fetch(`${API_BASE}/sync/download?data_type=preferences`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${device2Token}`,
      },
    });

    const downloadData = await downloadResponse.json();
    assert.strictEqual(downloadData.data.encrypted_blob, payload1.encryptedBlob);
    assert.strictEqual(downloadData.data.checksum, payload1.checksum);

    // Upload updated preferences from Device 2
    const updatedPreferences = {
      ...preferences,
      theme: 'light',
    };

    const payload2 = createEncryptedPayload(updatedPreferences);

    const uploadResponse = await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device2Token}`,
      },
      body: JSON.stringify({
        data_type: 'preferences',
        encrypted_blob: payload2.encryptedBlob,
        nonce: payload2.nonce,
        checksum: payload2.checksum,
        device_id: device2Id,
      }),
    });

    const uploadData = await uploadResponse.json();
    assert.strictEqual(uploadData.data.version, 2, 'Version should increment');

    // Download from Device 1 (should get Device 2's update)
    const downloadFromDevice1 = await fetch(`${API_BASE}/sync/download?data_type=preferences`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${device1Token}`,
      },
    });

    const latestData = await downloadFromDevice1.json();
    assert.strictEqual(latestData.data.version, 2);
    assert.strictEqual(latestData.data.encrypted_blob, payload2.encryptedBlob);
  });

  test('should sync all data types independently', async () => {
    const email = generateTestEmail();
    const deviceId = generateDeviceId();

    // Register
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
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

    const registerData = await registerResponse.json();
    const accessToken = registerData.data.tokens.access_token;

    // Upload all 4 data types
    const dataTypes = [
      { type: 'accounts', data: { accounts: [] } },
      { type: 'contacts', data: { contacts: [] } },
      { type: 'preferences', data: { theme: 'dark' } },
      { type: 'signatures', data: { signatures: {} } },
    ];

    for (const { type, data } of dataTypes) {
      const payload = createEncryptedPayload(data);

      const response = await fetch(`${API_BASE}/sync/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data_type: type,
          encrypted_blob: payload.encryptedBlob,
          nonce: payload.nonce,
          checksum: payload.checksum,
          device_id: deviceId,
        }),
      });

      assert.strictEqual(response.status, 200, `Upload ${type} should succeed`);
    }

    // Verify all synced via status endpoint
    const statusResponse = await fetch(`${API_BASE}/sync/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const statusData = await statusResponse.json();

    assert.strictEqual(statusData.data.sync_status.accounts.version, 1);
    assert.strictEqual(statusData.data.sync_status.contacts.version, 1);
    assert.strictEqual(statusData.data.sync_status.preferences.version, 1);
    assert.strictEqual(statusData.data.sync_status.signatures.version, 1);
  });
});

describe('Token Refresh Flow', () => {
  test('should use refresh token when access token expires', async () => {
    const email = generateTestEmail();
    const deviceId = generateDeviceId();

    // Register
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
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

    const registerData = await registerResponse.json();
    const refreshToken = registerData.data.tokens.refresh_token;

    // Refresh to get new access token
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    const refreshData = await refreshResponse.json();
    assert.strictEqual(refreshResponse.status, 200);

    const newAccessToken = refreshData.data.tokens.access_token;
    const newRefreshToken = refreshData.data.tokens.refresh_token;

    // Use new access token for sync
    const payload = createEncryptedPayload({ test: 'data' });

    const syncResponse = await fetch(`${API_BASE}/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        data_type: 'contacts',
        encrypted_blob: payload.encryptedBlob,
        nonce: payload.nonce,
        checksum: payload.checksum,
        device_id: deviceId,
      }),
    });

    assert.strictEqual(syncResponse.status, 200);

    // Old refresh token should be revoked
    const oldRefreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshToken, // Old token
      }),
    });

    assert.strictEqual(oldRefreshResponse.status, 401, 'Old token should be revoked');
  });
});

describe('Error Recovery', () => {
  test('should handle network retry for failed upload', async () => {
    const email = generateTestEmail();
    const deviceId = generateDeviceId();

    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
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

    const registerData = await registerResponse.json();
    const accessToken = registerData.data.tokens.access_token;

    const payload = createEncryptedPayload({ test: 'data' });

    // Simulate retry logic
    let uploadSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!uploadSuccess && attempts < maxAttempts) {
      attempts++;

      const response = await fetch(`${API_BASE}/sync/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data_type: 'contacts',
          encrypted_blob: payload.encryptedBlob,
          nonce: payload.nonce,
          checksum: payload.checksum,
          device_id: deviceId,
        }),
      });

      if (response.status === 200) {
        uploadSuccess = true;
      } else {
        await sleep(100); // Wait before retry
      }
    }

    assert.strictEqual(uploadSuccess, true, 'Upload should eventually succeed');
    assert.ok(attempts <= maxAttempts, 'Should succeed within retry limit');
  });
});
