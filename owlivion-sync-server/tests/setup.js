/**
 * Test Setup and Helpers
 *
 * Provides database setup, teardown, and helper functions for tests
 */

import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load test environment variables
dotenv.config({ path: '.env' });

const { Pool } = pg;

// Test database pool
let testPool;

/**
 * Initialize test database connection
 */
export async function setupTestDatabase() {
  testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'owlivion_sync_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  // Test connection
  try {
    await testPool.query('SELECT NOW()');
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Test database connection failed:', error.message);
    throw error;
  }

  return testPool;
}

/**
 * Clean up test database (clear all data)
 */
export async function cleanupTestDatabase() {
  if (!testPool) return;

  try {
    await testPool.query('BEGIN');
    await testPool.query('DELETE FROM sync_history');
    await testPool.query('DELETE FROM sync_data');
    await testPool.query('DELETE FROM refresh_tokens');
    await testPool.query('DELETE FROM devices');
    await testPool.query('DELETE FROM users');
    await testPool.query('COMMIT');
  } catch (error) {
    await testPool.query('ROLLBACK');
    console.error('Failed to cleanup test database:', error);
    throw error;
  }
}

/**
 * Close test database connection
 */
export async function teardownTestDatabase() {
  if (testPool) {
    await testPool.end();
    console.log('✅ Test database disconnected');
  }
}

/**
 * Generate random test email
 */
export function generateTestEmail() {
  return `test-${crypto.randomBytes(4).toString('hex')}@owlivion.test`;
}

/**
 * Generate random device ID
 */
export function generateDeviceId() {
  return crypto.randomUUID();
}

/**
 * Create test user directly in database
 */
export async function createTestUser(email, password = 'testpassword123') {
  const bcrypt = (await import('bcrypt')).default;
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await testPool.query(
    `INSERT INTO users (email, password_hash, created_at, updated_at, last_login_at)
     VALUES ($1, $2, NOW(), NOW(), NOW())
     RETURNING id, email, created_at`,
    [email, passwordHash]
  );

  return result.rows[0];
}

/**
 * Create test device for user
 */
export async function createTestDevice(userId, deviceId, deviceName = 'Test Device') {
  const result = await testPool.query(
    `INSERT INTO devices (user_id, device_id, device_name, platform, created_at, is_active)
     VALUES ($1, $2, $3, $4, NOW(), TRUE)
     RETURNING *`,
    [userId, deviceId, deviceName, 'linux']
  );

  return result.rows[0];
}

/**
 * Get test database pool
 */
export function getTestPool() {
  return testPool;
}

/**
 * Wait for specified milliseconds
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert helper
 */
export function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Deep equal check
 */
export function assertEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);

  if (actualStr !== expectedStr) {
    throw new Error(
      `Assertion failed: ${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`
    );
  }
}
