/**
 * Authentication API Tests
 *
 * Tests for /api/v1/auth endpoints:
 * - POST /auth/register
 * - POST /auth/login
 * - POST /auth/refresh
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  teardownTestDatabase,
  generateTestEmail,
  generateDeviceId,
  createTestUser,
  sleep,
} from './setup.js';

const API_BASE = 'http://localhost:3000/api/v1';

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

describe('POST /auth/register', () => {
  test('should successfully register a new user', async () => {
    const email = generateTestEmail();
    const deviceId = generateDeviceId();

    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'SecurePassword123!',
        device_id: deviceId,
        device_name: 'Test Device',
        platform: 'linux',
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 201, 'Status should be 201');
    assert.strictEqual(data.success, true);
    assert.ok(data.data.user.id, 'Should return user ID');
    assert.strictEqual(data.data.user.email, email);
    assert.ok(data.data.tokens.access_token, 'Should return access token');
    assert.ok(data.data.tokens.refresh_token, 'Should return refresh token');
    assert.strictEqual(data.data.tokens.token_type, 'Bearer');
  });

  test('should reject duplicate email registration', async () => {
    const email = generateTestEmail();
    const deviceId = generateDeviceId();

    const payload = {
      email,
      password: 'SecurePassword123!',
      device_id: deviceId,
      device_name: 'Test Device',
      platform: 'linux',
    };

    // First registration
    const response1 = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(response1.status, 201);

    // Second registration (should fail)
    const response2 = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response2.json();

    assert.strictEqual(response2.status, 409, 'Should return 409 Conflict');
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'EMAIL_EXISTS');
  });

  test('should reject invalid email format', async () => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'SecurePassword123!',
        device_id: generateDeviceId(),
        device_name: 'Test Device',
        platform: 'linux',
      }),
    });

    assert.strictEqual(response.status, 400, 'Should return 400 Bad Request');
  });

  test('should reject weak password', async () => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateTestEmail(),
        password: '123', // Too short
        device_id: generateDeviceId(),
        device_name: 'Test Device',
        platform: 'linux',
      }),
    });

    assert.strictEqual(response.status, 400, 'Should return 400 Bad Request');
  });

  test('should reject missing required fields', async () => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateTestEmail(),
        // Missing password, device_id, etc.
      }),
    });

    assert.strictEqual(response.status, 400, 'Should return 400 Bad Request');
  });
});

describe('POST /auth/login', () => {
  test('should successfully login existing user', async () => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';

    // Create user
    await createTestUser(email, password);

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        device_id: generateDeviceId(),
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data.user.id);
    assert.strictEqual(data.data.user.email, email);
    assert.ok(data.data.tokens.access_token);
    assert.ok(data.data.tokens.refresh_token);
  });

  test('should reject invalid credentials', async () => {
    const email = generateTestEmail();
    await createTestUser(email, 'CorrectPassword123!');

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'WrongPassword123!',
        device_id: generateDeviceId(),
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 401, 'Should return 401 Unauthorized');
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_CREDENTIALS');
  });

  test('should reject non-existent user', async () => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@owlivion.test',
        password: 'SomePassword123!',
        device_id: generateDeviceId(),
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(data.code, 'INVALID_CREDENTIALS');
  });

  test('should handle multiple devices for same user', async () => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    await createTestUser(email, password);

    // Login from device 1
    const device1Response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        device_id: generateDeviceId(),
      }),
    });

    assert.strictEqual(device1Response.status, 200);

    // Login from device 2
    const device2Response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        device_id: generateDeviceId(),
      }),
    });

    assert.strictEqual(device2Response.status, 200);

    const device1Data = await device1Response.json();
    const device2Data = await device2Response.json();

    // Should have different tokens
    assert.notStrictEqual(
      device1Data.data.tokens.access_token,
      device2Data.data.tokens.access_token
    );
  });
});

describe('POST /auth/refresh', () => {
  test('should successfully refresh access token', async () => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';

    // Register user
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        device_id: generateDeviceId(),
        device_name: 'Test Device',
        platform: 'linux',
      }),
    });

    const registerData = await registerResponse.json();
    const refreshToken = registerData.data.tokens.refresh_token;

    // Refresh token
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    const refreshData = await refreshResponse.json();

    assert.strictEqual(refreshResponse.status, 200);
    assert.strictEqual(refreshData.success, true);
    assert.ok(refreshData.data.tokens.access_token);
    assert.ok(refreshData.data.tokens.refresh_token);
    assert.notStrictEqual(
      refreshData.data.tokens.access_token,
      registerData.data.tokens.access_token,
      'New access token should be different'
    );
  });

  test('should reject invalid refresh token', async () => {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'invalid-token',
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(data.success, false);
  });

  test('should reject reused refresh token', async () => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';

    // Register user
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        device_id: generateDeviceId(),
        device_name: 'Test Device',
        platform: 'linux',
      }),
    });

    const registerData = await registerResponse.json();
    const refreshToken = registerData.data.tokens.refresh_token;

    // First refresh (should succeed)
    const refresh1 = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    assert.strictEqual(refresh1.status, 200);

    // Second refresh with same token (should fail - token rotation)
    const refresh2 = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    assert.strictEqual(refresh2.status, 401, 'Should reject revoked token');
  });
});
