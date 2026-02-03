# Owlivion Sync Server - Integration Tests

Kapsamlı backend API integration testleri.

## Test Coverage

### Authentication Tests (`auth.test.js`)
- ✅ User registration (valid, duplicate email, invalid input)
- ✅ User login (valid credentials, invalid credentials)
- ✅ Token refresh (valid token, invalid token, token rotation)
- ✅ Multi-device authentication

### Sync Tests (`sync.test.js`)
- ✅ Upload encrypted data (all data types)
- ✅ Download encrypted data
- ✅ Version management (increment on update)
- ✅ Checksum validation
- ✅ Sync status endpoint
- ✅ Sync history logging

### Device Management Tests (`devices.test.js`)
- ✅ List user devices
- ✅ Revoke device access
- ✅ Prevent revoking current device
- ✅ Cross-user device isolation
- ✅ Token revocation on device removal

### End-to-End Integration Tests (`integration.test.js`)
- ✅ Complete sync workflow (register → upload → download)
- ✅ Multi-device sync scenarios
- ✅ All data types sync independently
- ✅ Token refresh flow
- ✅ Error recovery and retry logic

## Prerequisites

### 1. PostgreSQL Database
```bash
# Create test database
createdb owlivion_sync_test

# Or using psql
psql -U postgres
CREATE DATABASE owlivion_sync_test;
\q
```

### 2. Run Database Migrations
```bash
# From owlivion-sync-server directory
cd /path/to/owlivion-sync-server

# Apply schema
psql -U postgres -d owlivion_sync_test -f schema.sql
```

### 3. Configure Test Environment
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env to use test database
nano .env
```

**Important .env settings for tests:**
```env
DB_NAME=owlivion_sync_test
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=test_jwt_secret_key_change_in_production
JWT_REFRESH_SECRET=test_refresh_secret_key_change_in_production
```

## Running Tests

### Start the Server (Terminal 1)
```bash
cd owlivion-sync-server
npm install
npm run dev
```

Wait for the server to start:
```
🚀 Owlivion Sync Server Started
📍 Server: http://0.0.0.0:3000
```

### Run Tests (Terminal 2)
```bash
cd owlivion-sync-server

# Run all tests
npm test

# Run specific test file
node --test tests/auth.test.js
node --test tests/sync.test.js
node --test tests/devices.test.js
node --test tests/integration.test.js

# Run with verbose output
node --test --test-reporter=spec tests/

# Run with coverage (Node.js 20+)
node --test --experimental-test-coverage tests/
```

## Test Results Format

```
✔ POST /auth/register - should successfully register a new user (125ms)
✔ POST /auth/register - should reject duplicate email registration (89ms)
✔ POST /auth/login - should successfully login existing user (67ms)
...

Total: 45 tests
Passed: 45
Failed: 0
Duration: 2.3s
```

## Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
psql -U postgres -l | grep owlivion_sync_test

# Verify credentials in .env
cat .env | grep DB_
```

### Port Already in Use (3000)
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Test Timeout
- Increase test timeout in test files
- Check server is responding: `curl http://localhost:3000/`
- Check database connection

### Clean Database Between Test Runs
```bash
# Drop and recreate test database
dropdb owlivion_sync_test
createdb owlivion_sync_test
psql -U postgres -d owlivion_sync_test -f schema.sql
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: owlivion_sync_test
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd owlivion-sync-server
          npm ci

      - name: Run migrations
        run: |
          cd owlivion-sync-server
          psql -h localhost -U postgres -d owlivion_sync_test -f schema.sql
        env:
          PGPASSWORD: postgres

      - name: Start server
        run: |
          cd owlivion-sync-server
          npm start &
          sleep 5
        env:
          NODE_ENV: test

      - name: Run tests
        run: |
          cd owlivion-sync-server
          npm test
```

## Writing New Tests

### Test Structure
```javascript
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase, cleanupTestDatabase } from './setup.js';

before(async () => {
  await setupTestDatabase();
});

after(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await cleanupTestDatabase(); // Clean data between tests
});

describe('Your Feature', () => {
  test('should do something', async () => {
    // Arrange
    const input = 'test data';

    // Act
    const response = await fetch('...');
    const data = await response.json();

    // Assert
    assert.strictEqual(data.success, true);
  });
});
```

### Helper Functions
- `generateTestEmail()` - Random test email
- `generateDeviceId()` - Random UUID
- `createTestUser(email, password)` - Create user in DB
- `createTestDevice(userId, deviceId)` - Create device
- `sleep(ms)` - Async delay

## Performance Benchmarks

Target performance (single-threaded):
- Auth endpoints: < 200ms
- Sync upload: < 300ms
- Sync download: < 150ms
- Device list: < 100ms

Run benchmark tests:
```bash
# TODO: Add benchmark script
npm run benchmark
```

## Security Tests

Tests verify:
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ JWT token validation
- ✅ Rate limiting
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configuration
- ✅ Authorization checks (user can only access own data)
- ✅ Checksum validation (data integrity)

## Next Steps

1. Add load testing (Apache Bench, k6)
2. Add security audit tests (OWASP Top 10)
3. Add performance regression tests
4. Add API contract tests (OpenAPI validation)
5. Add mutation testing (Stryker)
