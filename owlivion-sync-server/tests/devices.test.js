/**
 * Device Management API Tests
 *
 * Tests for /api/v1/devices endpoints:
 * - GET /devices
 * - DELETE /devices/:device_id
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  teardownTestDatabase,
  generateTestEmail,
  generateDeviceId,
} from './setup.js';

const API_BASE = 'http://localhost:3000/api/v1';

// Helper to register and get tokens
async function registerUser(deviceName = 'Test Device') {
  const email = generateTestEmail();
  const deviceId = generateDeviceId();

  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'TestPassword123!',
      device_id: deviceId,
      device_name: deviceName,
      platform: 'linux',
    }),
  });

  const data = await response.json();
  return {
    accessToken: data.data.tokens.access_token,
    refreshToken: data.data.tokens.refresh_token,
    userId: data.data.user.id,
    email,
    deviceId,
  };
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

describe('GET /devices', () => {
  test('should list all devices for authenticated user', async () => {
    const { accessToken, deviceId } = await registerUser('Main Device');

    const response = await fetch(`${API_BASE}/devices`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.total, 1);
    assert.strictEqual(data.data.active, 1);
    assert.strictEqual(data.data.devices[0].device_id, deviceId);
    assert.strictEqual(data.data.devices[0].device_name, 'Main Device');
    assert.strictEqual(data.data.devices[0].is_current, true);
  });

  test('should list multiple devices', async () => {
    const user = await registerUser('Device 1');

    // Login from second device
    const device2Id = generateDeviceId();
    await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: 'TestPassword123!',
        device_id: device2Id,
      }),
    });

    // Login from third device
    const device3Id = generateDeviceId();
    await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: 'TestPassword123!',
        device_id: device3Id,
      }),
    });

    // List devices from first device
    const response = await fetch(`${API_BASE}/devices`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(data.data.total, 3, 'Should have 3 devices');
    assert.strictEqual(data.data.active, 3);

    // Check current device flag
    const currentDevice = data.data.devices.find((d) => d.is_current);
    assert.ok(currentDevice, 'Should mark current device');
    assert.strictEqual(currentDevice.device_id, user.deviceId);
  });

  test('should reject request without authentication', async () => {
    const response = await fetch(`${API_BASE}/devices`, {
      method: 'GET',
    });

    assert.strictEqual(response.status, 401);
  });

  test('should mask device IDs in response', async () => {
    const { accessToken } = await registerUser();

    const response = await fetch(`${API_BASE}/devices`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    const device = data.data.devices[0];

    assert.ok(device.device_id_masked, 'Should have masked ID');
    assert.ok(device.device_id_masked.includes('...'), 'Mask should include ...');
    assert.ok(device.device_id, 'Should have full ID for operations');
  });
});

describe('DELETE /devices/:device_id', () => {
  test('should successfully revoke device access', async () => {
    const user = await registerUser('Device 1');

    // Login from second device
    const device2Id = generateDeviceId();
    await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: 'TestPassword123!',
        device_id: device2Id,
      }),
    });

    // Revoke second device from first device
    const response = await fetch(`${API_BASE}/devices/${device2Id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.device.device_id, device2Id);

    // Verify device is marked inactive
    const listResponse = await fetch(`${API_BASE}/devices`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    });

    const listData = await listResponse.json();
    const revokedDevice = listData.data.devices.find((d) => d.device_id === device2Id);

    assert.strictEqual(revokedDevice.is_active, false);
    assert.strictEqual(listData.data.active, 1, 'Active count should decrease');
  });

  test('should prevent revoking current device', async () => {
    const { accessToken, deviceId } = await registerUser();

    const response = await fetch(`${API_BASE}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(response.status, 400);
    assert.strictEqual(data.code, 'CANNOT_DELETE_CURRENT_DEVICE');
  });

  test('should return 404 for non-existent device', async () => {
    const { accessToken } = await registerUser();
    const fakeDeviceId = generateDeviceId();

    const response = await fetch(`${API_BASE}/devices/${fakeDeviceId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    assert.strictEqual(response.status, 404);
    assert.strictEqual(data.code, 'DEVICE_NOT_FOUND');
  });

  test('should prevent revoking other users devices', async () => {
    const user1 = await registerUser('User 1 Device');
    const user2 = await registerUser('User 2 Device');

    // User 1 tries to revoke User 2's device
    const response = await fetch(`${API_BASE}/devices/${user2.deviceId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user1.accessToken}`,
      },
    });

    assert.strictEqual(response.status, 404, 'Should not find other user device');
  });

  test('should revoke refresh tokens when device is revoked', async () => {
    const user = await registerUser();

    // Login from second device and get its tokens
    const device2Id = generateDeviceId();
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: 'TestPassword123!',
        device_id: device2Id,
      }),
    });

    const loginData = await loginResponse.json();
    const device2RefreshToken = loginData.data.tokens.refresh_token;

    // Revoke device 2
    await fetch(`${API_BASE}/devices/${device2Id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    });

    // Try to use device 2's refresh token (should fail)
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: device2RefreshToken,
      }),
    });

    assert.strictEqual(refreshResponse.status, 401, 'Refresh token should be revoked');
  });
});
