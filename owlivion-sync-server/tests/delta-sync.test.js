/**
 * Delta Sync API Integration Tests
 */

import request from 'supertest';
import app from '../src/index.js';
import { query } from '../src/config/database.js';

describe('Delta Sync API', () => {
  let authToken;
  let userId;
  let deviceId = '550e8400-e29b-41d4-a716-446655440001';
  const testEmail = `deltatest-${Date.now()}@example.com`;
  const testPassword = 'DeltaTest123!';

  // Setup: Register and login user
  beforeAll(async () => {
    // Register user
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        device_id: deviceId,
        device_name: 'Test Device',
        platform: 'linux',
      });

    expect(registerRes.status).toBe(200);
    authToken = registerRes.body.data.access_token;
    userId = registerRes.body.data.user_id;
  });

  // Cleanup: Delete test user
  afterAll(async () => {
    if (userId) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  describe('POST /api/v1/sync/:data_type/delta', () => {
    it('should upload delta changes successfully', async () => {
      const changes = [
        {
          record_id: 'contact-001',
          change_type: 'insert',
          encrypted_record: Buffer.from('test encrypted data').toString('base64'),
          record_nonce: Buffer.from('testnonce123').toString('base64'),
          record_checksum: 'a'.repeat(64),
        },
        {
          record_id: 'contact-002',
          change_type: 'update',
          encrypted_record: Buffer.from('updated data').toString('base64'),
          record_nonce: Buffer.from('nonce456789a').toString('base64'),
          record_checksum: 'b'.repeat(64),
        },
      ];

      const res = await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes,
          device_id: deviceId,
          client_timestamp: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('processed_count');
      expect(res.body.data.processed_count).toBe(2);
    });

    it('should handle delete changes', async () => {
      const changes = [
        {
          record_id: 'contact-003',
          change_type: 'delete',
        },
      ];

      const res = await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes,
          device_id: deviceId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processed_count).toBe(1);

      // Verify deleted record was created
      const deletedResult = await query(
        'SELECT * FROM deleted_records WHERE user_id = $1 AND record_id = $2',
        [userId, 'contact-003']
      );
      expect(deletedResult.rows.length).toBe(1);
    });

    it('should reject invalid data_type', async () => {
      const res = await request(app)
        .post('/api/v1/sync/invalid_type/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes: [
            {
              record_id: 'test',
              change_type: 'insert',
              encrypted_record: 'dGVzdA==',
              record_nonce: 'bm9uY2U=',
              record_checksum: 'a'.repeat(64),
            },
          ],
          device_id: deviceId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty changes array', async () => {
      const res = await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes: [],
          device_id: deviceId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject changes without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/sync/contacts/delta')
        .send({
          changes: [
            {
              record_id: 'test',
              change_type: 'insert',
              encrypted_record: 'dGVzdA==',
              record_nonce: 'bm9uY2U=',
              record_checksum: 'a'.repeat(64),
            },
          ],
          device_id: deviceId,
        });

      expect(res.status).toBe(401);
    });

    it('should handle batch uploads (multiple changes)', async () => {
      const changes = [];
      for (let i = 0; i < 50; i++) {
        changes.push({
          record_id: `contact-batch-${i}`,
          change_type: 'insert',
          encrypted_record: Buffer.from(`data-${i}`).toString('base64'),
          record_nonce: Buffer.from(`nonce-${i}`.padEnd(12, '0')).toString('base64'),
          record_checksum: i.toString().padStart(64, '0'),
        });
      }

      const res = await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes,
          device_id: deviceId,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.processed_count).toBe(50);
    });

    it('should reject batch size > 1000', async () => {
      const changes = [];
      for (let i = 0; i < 1001; i++) {
        changes.push({
          record_id: `contact-large-${i}`,
          change_type: 'insert',
          encrypted_record: 'dGVzdA==',
          record_nonce: 'bm9uY2U=',
          record_checksum: 'a'.repeat(64),
        });
      }

      const res = await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes,
          device_id: deviceId,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BATCH_TOO_LARGE');
    });
  });

  describe('GET /api/v1/sync/:data_type/delta', () => {
    let timestampBeforeChanges;
    let timestampAfterChanges;

    beforeAll(async () => {
      timestampBeforeChanges = new Date(Date.now() - 1000).toISOString();

      // Insert some test changes
      const changes = [
        {
          record_id: 'delta-test-001',
          change_type: 'insert',
          encrypted_record: Buffer.from('test data 1').toString('base64'),
          record_nonce: Buffer.from('nonce0000001').toString('base64'),
          record_checksum: 'c'.repeat(64),
        },
        {
          record_id: 'delta-test-002',
          change_type: 'update',
          encrypted_record: Buffer.from('test data 2').toString('base64'),
          record_nonce: Buffer.from('nonce0000002').toString('base64'),
          record_checksum: 'd'.repeat(64),
        },
      ];

      await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes,
          device_id: deviceId,
        });

      timestampAfterChanges = new Date().toISOString();
    });

    it('should download delta changes since timestamp', async () => {
      const res = await request(app)
        .get('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ since: timestampBeforeChanges });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('changes');
      expect(res.body.data).toHaveProperty('deleted');
      expect(res.body.data).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data.changes)).toBe(true);
      expect(res.body.data.changes.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          since: timestampBeforeChanges,
          limit: 5,
          offset: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toHaveProperty('limit');
      expect(res.body.data.pagination).toHaveProperty('offset');
      expect(res.body.data.pagination).toHaveProperty('has_more');
      expect(res.body.data.pagination.limit).toBe(5);
    });

    it('should return empty changes if no changes since timestamp', async () => {
      const futureTimestamp = new Date(Date.now() + 10000).toISOString();

      const res = await request(app)
        .get('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ since: futureTimestamp });

      expect(res.status).toBe(200);
      expect(res.body.data.changes.length).toBe(0);
    });

    it('should reject missing since parameter', async () => {
      const res = await request(app)
        .get('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_SINCE_PARAM');
    });

    it('should reject invalid since timestamp', async () => {
      const res = await request(app)
        .get('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ since: 'invalid-timestamp' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/sync/:data_type/deleted', () => {
    let timestampBeforeDelete;

    beforeAll(async () => {
      timestampBeforeDelete = new Date(Date.now() - 1000).toISOString();

      // Create a delete change
      await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes: [
            {
              record_id: 'delete-test-001',
              change_type: 'delete',
            },
          ],
          device_id: deviceId,
        });
    });

    it('should return deleted records since timestamp', async () => {
      const res = await request(app)
        .get('/api/v1/sync/contacts/deleted')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ since: timestampBeforeDelete });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('deleted');
      expect(Array.isArray(res.body.data.deleted)).toBe(true);
      expect(res.body.data.deleted.length).toBeGreaterThan(0);

      // Check deleted record structure
      const deletedRecord = res.body.data.deleted.find((r) => r.record_id === 'delete-test-001');
      expect(deletedRecord).toBeDefined();
      expect(deletedRecord).toHaveProperty('deleted_at');
      expect(deletedRecord).toHaveProperty('deleted_by_device_id');
    });

    it('should support pagination for deleted records', async () => {
      const res = await request(app)
        .get('/api/v1/sync/contacts/deleted')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          since: timestampBeforeDelete,
          limit: 10,
          offset: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toHaveProperty('total');
      expect(res.body.data.pagination).toHaveProperty('limit');
      expect(res.body.data.pagination).toHaveProperty('has_more');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts when server version is newer', async () => {
      const recordId = 'conflict-test-001';

      // First upload with recent timestamp
      await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes: [
            {
              record_id: recordId,
              change_type: 'insert',
              encrypted_record: Buffer.from('initial data').toString('base64'),
              record_nonce: Buffer.from('nonce1234567').toString('base64'),
              record_checksum: 'e'.repeat(64),
            },
          ],
          device_id: deviceId,
          client_timestamp: new Date().toISOString(),
        });

      // Second upload with older timestamp (conflict)
      const res = await request(app)
        .post('/api/v1/sync/contacts/delta')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          changes: [
            {
              record_id: recordId,
              change_type: 'update',
              encrypted_record: Buffer.from('conflicting data').toString('base64'),
              record_nonce: Buffer.from('nonce7654321').toString('base64'),
              record_checksum: 'f'.repeat(64),
            },
          ],
          device_id: deviceId,
          client_timestamp: new Date(Date.now() - 10000).toISOString(), // Older timestamp
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('conflict_count');
      expect(res.body.data.conflict_count).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('conflicts');
      expect(Array.isArray(res.body.data.conflicts)).toBe(true);
    });
  });

  describe('Database Functions', () => {
    it('should track changes in sync_data_changes table', async () => {
      const result = await query(
        'SELECT COUNT(*) as count FROM sync_data_changes WHERE user_id = $1',
        [userId]
      );

      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });

    it('should track deleted records in deleted_records table', async () => {
      const result = await query(
        'SELECT COUNT(*) as count FROM deleted_records WHERE user_id = $1',
        [userId]
      );

      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });

    it('should use get_changes_since function', async () => {
      const since = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      const result = await query('SELECT * FROM get_changes_since($1, $2, $3, $4, $5)', [
        userId,
        'contacts',
        since,
        100,
        0,
      ]);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should use count_changes_since function', async () => {
      const since = new Date(Date.now() - 3600000).toISOString();

      const result = await query('SELECT * FROM count_changes_since($1, $2, $3)', [
        userId,
        'contacts',
        since,
      ]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]).toHaveProperty('change_count');
      expect(result.rows[0]).toHaveProperty('deleted_count');
    });
  });
});
