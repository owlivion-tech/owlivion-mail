# Production Testing Scenarios

Comprehensive test scenarios for production deployment validation.

## Overview

Bu doküman production ortamında manuel ve otomatik test senaryolarını içerir:
- ✅ Multi-device sync tests
- ✅ Encryption integrity verification
- ✅ Performance/load testing
- ✅ Security audit
- ✅ Disaster recovery
- ✅ Conflict resolution

## Prerequisites

- VPS deployed and running (31.97.216.36)
- SSL certificate installed
- Server accessible via HTTPS
- Test accounts created
- curl, jq, and ab (Apache Bench) installed

```bash
# Install testing tools
sudo apt install -y curl jq apache2-utils
```

## Test Environment Setup

```bash
# Set variables
export API_BASE="https://sync.owlivion.com/api/v1"
export TEST_EMAIL="test-prod-$(date +%s)@owlivion.test"
export TEST_PASSWORD="SecureProd123!"
```

---

## 1. Multi-Device Sync Tests

### Scenario 1.1: Two Devices Initial Sync

**Objective**: Verify data syncs correctly between two devices.

**Steps**:

1. **Register from Device 1**
```bash
DEVICE1_ID=$(uuidgen)

REGISTER1=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"device_id\": \"$DEVICE1_ID\",
    \"device_name\": \"Device 1\",
    \"platform\": \"linux\"
  }")

TOKEN1=$(echo $REGISTER1 | jq -r '.data.tokens.access_token')
echo "Device 1 Token: $TOKEN1"
```

2. **Upload contacts from Device 1**
```bash
CONTACTS_DATA=$(echo '{"contacts":[{"email":"alice@example.com","name":"Alice"},{"email":"bob@example.com","name":"Bob"}]}' | base64 -w0)
NONCE=$(openssl rand -base64 12)
CHECKSUM=$(echo -n "$CONTACTS_DATA" | base64 -d | sha256sum | cut -d' ' -f1)

UPLOAD=$(curl -s -X POST "$API_BASE/sync/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"data_type\": \"contacts\",
    \"encrypted_blob\": \"$CONTACTS_DATA\",
    \"nonce\": \"$NONCE\",
    \"checksum\": \"$CHECKSUM\",
    \"device_id\": \"$DEVICE1_ID\"
  }")

echo $UPLOAD | jq
```

3. **Login from Device 2**
```bash
DEVICE2_ID=$(uuidgen)

LOGIN2=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"device_id\": \"$DEVICE2_ID\"
  }")

TOKEN2=$(echo $LOGIN2 | jq -r '.data.tokens.access_token')
echo "Device 2 Token: $TOKEN2"
```

4. **Download contacts from Device 2**
```bash
DOWNLOAD=$(curl -s -X GET "$API_BASE/sync/download?data_type=contacts" \
  -H "Authorization: Bearer $TOKEN2")

echo $DOWNLOAD | jq
```

5. **Verify data matches**
```bash
ORIGINAL=$(echo $UPLOAD | jq -r '.data.version')
SYNCED=$(echo $DOWNLOAD | jq -r '.data.version')

if [ "$ORIGINAL" == "$SYNCED" ]; then
  echo "✅ PASS: Data synced successfully"
else
  echo "❌ FAIL: Version mismatch"
fi
```

**Expected Result**: Device 2 receives the same encrypted data uploaded by Device 1.

---

### Scenario 1.2: Three Devices Concurrent Sync

**Objective**: Test sync with multiple devices making concurrent changes.

**Steps**:

1. Register 3 devices with same account
2. Upload different data types from each device simultaneously:
   - Device 1: Contacts
   - Device 2: Preferences
   - Device 3: Signatures
3. Download all data types from each device
4. Verify all devices have all data

**Automation Script**: `tests/scripts/multi-device-test.sh`

---

## 2. Encryption Integrity Tests

### Scenario 2.1: End-to-End Encryption Verification

**Objective**: Verify server never sees plaintext data.

**Steps**:

1. **Upload encrypted data**
```bash
# Generate test data with known plaintext
PLAINTEXT='{"secret":"this_should_never_be_visible_on_server"}'
ENCRYPTED=$(echo "$PLAINTEXT" | base64 -w0)
NONCE=$(openssl rand -base64 12)
CHECKSUM=$(echo -n "$ENCRYPTED" | base64 -d | sha256sum | cut -d' ' -f1)

curl -s -X POST "$API_BASE/sync/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"data_type\": \"contacts\",
    \"encrypted_blob\": \"$ENCRYPTED\",
    \"nonce\": \"$NONCE\",
    \"checksum\": \"$CHECKSUM\",
    \"device_id\": \"$DEVICE1_ID\"
  }"
```

2. **Check database on server**
```bash
# SSH into VPS and query database
ssh owlivion@31.97.216.36 << 'ENDSSH'
psql -U owlivion -d owlivion_sync -c \
  "SELECT encode(encrypted_blob, 'escape') FROM sync_data LIMIT 1;" | grep "secret"

if [ $? -eq 0 ]; then
  echo "❌ FAIL: Plaintext found in database!"
else
  echo "✅ PASS: No plaintext in database"
fi
ENDSSH
```

3. **Verify checksum validation**
```bash
# Try uploading with invalid checksum
curl -s -X POST "$API_BASE/sync/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"data_type\": \"contacts\",
    \"encrypted_blob\": \"$ENCRYPTED\",
    \"nonce\": \"$NONCE\",
    \"checksum\": \"invalid_checksum_here\",
    \"device_id\": \"$DEVICE1_ID\"
  }" | jq -r '.code'

# Should return: CHECKSUM_MISMATCH
```

**Expected Result**: Server stores only encrypted blobs, rejects tampered data.

---

### Scenario 2.2: Key Isolation Between Data Types

**Objective**: Verify different data types use isolated encryption keys.

**Client-side test** (run from Rust client):
```bash
cd src-tauri
cargo test --lib test_multi_data_type_encryption_isolation -- --nocapture
```

**Expected Result**: Same plaintext encrypted with different data types produces different ciphertexts.

---

## 3. Performance & Load Testing

### Scenario 3.1: Stress Test - Concurrent Users

**Objective**: Test server under load with 100 concurrent users.

**Apache Bench Test**:
```bash
# Register endpoint stress test
ab -n 1000 -c 100 -T 'application/json' \
  -p register-payload.json \
  "$API_BASE/auth/register"

# Upload endpoint stress test
ab -n 1000 -c 100 -T 'application/json' \
  -H "Authorization: Bearer $TOKEN1" \
  -p upload-payload.json \
  "$API_BASE/sync/upload"
```

**Target Performance**:
- Auth endpoints: < 500ms @ p95
- Sync upload: < 1000ms @ p95
- Sync download: < 500ms @ p95
- Error rate: < 1%

**Monitoring**:
```bash
# Monitor on VPS
ssh owlivion@31.97.216.36 "pm2 monit"

# Watch CPU/Memory
ssh owlivion@31.97.216.36 "htop"
```

---

### Scenario 3.2: Large Payload Test

**Objective**: Test with large encrypted data (1MB+).

**Steps**:
```bash
# Generate 1MB test data
dd if=/dev/urandom bs=1M count=1 | base64 -w0 > large-payload.txt
LARGE_DATA=$(cat large-payload.txt)
NONCE=$(openssl rand -base64 12)
CHECKSUM=$(echo -n "$LARGE_DATA" | base64 -d | sha256sum | cut -d' ' -f1)

# Upload
time curl -s -X POST "$API_BASE/sync/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"data_type\": \"contacts\",
    \"encrypted_blob\": \"$LARGE_DATA\",
    \"nonce\": \"$NONCE\",
    \"checksum\": \"$CHECKSUM\",
    \"device_id\": \"$DEVICE1_ID\"
  }"

# Download
time curl -s -X GET "$API_BASE/sync/download?data_type=contacts" \
  -H "Authorization: Bearer $TOKEN1" > /dev/null
```

**Expected Result**: Upload/download completes within reasonable time (< 5s).

---

## 4. Security Audit

### Scenario 4.1: Authentication Security

**Test 4.1.1: Brute Force Protection**
```bash
# Try 10 failed login attempts
for i in {1..10}; do
  curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"wrong_password\",
      \"device_id\": \"test\"
    }"
  echo ""
done

# 6th+ attempt should return 429 (Rate Limit)
```

**Test 4.1.2: JWT Token Validation**
```bash
# Try accessing protected endpoint without token
curl -s -X GET "$API_BASE/devices" | jq -r '.error'
# Should return: Unauthorized

# Try with invalid token
curl -s -X GET "$API_BASE/devices" \
  -H "Authorization: Bearer invalid_token_here" | jq -r '.error'
# Should return: Unauthorized

# Try with expired token (manually modify JWT exp claim)
```

**Test 4.1.3: SQL Injection Prevention**
```bash
# Try SQL injection in email field
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"admin' OR '1'='1\",
    \"password\": \"test\",
    \"device_id\": \"test\"
  }" | jq

# Should return validation error, not SQL error
```

---

### Scenario 4.2: Authorization Tests

**Test 4.2.1: Cross-User Data Access**
```bash
# Create two users
USER1_TOKEN=$(register_user "user1@test.com")
USER2_TOKEN=$(register_user "user2@test.com")

# User 1 uploads data
upload_data "$USER1_TOKEN" "contacts" "user1_data"

# User 2 tries to download User 1's data
RESULT=$(curl -s -X GET "$API_BASE/sync/download?data_type=contacts" \
  -H "Authorization: Bearer $USER2_TOKEN")

# Should return 404 (no data for User 2)
echo $RESULT | jq -r '.code'
# Expected: NO_DATA
```

**Test 4.2.2: Device Revocation**
```bash
# Login from Device 2
# Revoke Device 2 from Device 1
curl -s -X DELETE "$API_BASE/devices/$DEVICE2_ID" \
  -H "Authorization: Bearer $TOKEN1"

# Try to sync from Device 2 (should fail after token expires)
```

---

### Scenario 4.3: HTTPS/TLS Security

```bash
# Check SSL certificate
echo | openssl s_client -connect sync.owlivion.com:443 -servername sync.owlivion.com 2>/dev/null | openssl x509 -noout -dates

# Test SSL strength
nmap --script ssl-enum-ciphers -p 443 sync.owlivion.com

# Check security headers
curl -I https://sync.owlivion.com | grep -E "Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options"
```

**Expected Headers**:
- `Strict-Transport-Security: max-age=63072000`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`

---

## 5. Disaster Recovery Tests

### Scenario 5.1: Database Backup & Restore

**Steps**:

1. **Create test data**
```bash
# Register user and upload data
register_and_upload_test_data
```

2. **Create backup**
```bash
ssh owlivion@31.97.216.36 "sudo bash /opt/owlivion-sync-server/deployment/backup.sh database"
```

3. **Simulate data loss** (CAUTION: Test environment only!)
```bash
ssh owlivion@31.97.216.36 << 'ENDSSH'
sudo -u postgres psql -c "DROP DATABASE owlivion_sync;"
sudo -u postgres psql -c "CREATE DATABASE owlivion_sync OWNER owlivion;"
ENDSSH
```

4. **Restore from backup**
```bash
ssh owlivion@31.97.216.36 << 'ENDSSH'
BACKUP_FILE=$(ls -t /var/backups/owlivion-sync/db_*.sql.gz | head -1)
sudo bash /opt/owlivion-sync-server/deployment/backup.sh restore "$BACKUP_FILE"
ENDSSH
```

5. **Verify data restored**
```bash
# Login and download data
curl -s -X GET "$API_BASE/sync/download?data_type=contacts" \
  -H "Authorization: Bearer $TOKEN1" | jq
```

**Expected Result**: All data recovered successfully.

---

### Scenario 5.2: Application Crash Recovery

**Steps**:

1. **Crash application**
```bash
ssh owlivion@31.97.216.36 "pm2 kill"
```

2. **Wait 10 seconds**

3. **Check auto-restart**
```bash
ssh owlivion@31.97.216.36 "pm2 status"
```

4. **Verify service available**
```bash
curl -s "$API_BASE/health" | jq
```

**Expected Result**: PM2 automatically restarts application within 10s.

---

### Scenario 5.3: VPS Reboot Test

**Steps**:

1. **Reboot VPS**
```bash
ssh owlivion@31.97.216.36 "sudo reboot"
```

2. **Wait for reboot (~ 2 minutes)**

3. **Verify services auto-start**
```bash
# Check PostgreSQL
ssh owlivion@31.97.216.36 "sudo systemctl status postgresql"

# Check nginx
ssh owlivion@31.97.216.36 "sudo systemctl status nginx"

# Check PM2
ssh owlivion@31.97.216.36 "pm2 status"
```

4. **Verify API accessible**
```bash
curl -s "$API_BASE/health" | jq
```

**Expected Result**: All services start automatically after reboot.

---

## 6. Conflict Resolution Tests

### Scenario 6.1: Simultaneous Uploads (LWW - Last Write Wins)

**Objective**: Test conflict resolution when two devices upload simultaneously.

**Steps**:

1. **Device 1 and Device 2 both modify contacts offline**

2. **Both upload simultaneously**
```bash
# Device 1 upload (background)
upload_from_device1 &
PID1=$!

# Device 2 upload (background)
upload_from_device2 &
PID2=$!

# Wait for both
wait $PID1 $PID2
```

3. **Check version numbers**
```bash
curl -s "$API_BASE/sync/status" -H "Authorization: Bearer $TOKEN1" | jq '.data.sync_status.contacts'
```

4. **Download from Device 3**
```bash
# Latest version should win
curl -s "$API_BASE/sync/download?data_type=contacts" \
  -H "Authorization: Bearer $TOKEN3" | jq
```

**Expected Result**: Higher version number wins, data is consistent across all devices.

---

## Test Automation Scripts

### Complete Test Suite

```bash
#!/bin/bash
# tests/scripts/production-test-suite.sh

API_BASE="https://sync.owlivion.com/api/v1"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

test_case() {
  local name=$1
  local command=$2

  echo -n "Testing: $name ... "

  if eval "$command"; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
  fi
}

# Run all tests
test_case "Health Check" "curl -f -s $API_BASE/health > /dev/null"
test_case "Register User" "test_register"
test_case "Login User" "test_login"
test_case "Upload Data" "test_upload"
test_case "Download Data" "test_download"
test_case "Multi-Device Sync" "test_multi_device"
test_case "Rate Limiting" "test_rate_limit"
test_case "Authentication" "test_auth_security"

# Summary
echo ""
echo "========================================"
echo "Test Results"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
```

---

## Continuous Monitoring

### Health Check Cron

```bash
# Add to crontab
*/5 * * * * curl -f https://sync.owlivion.com/api/v1/health || echo "API DOWN" | mail -s "Alert" admin@owlivion.com
```

### Uptime Monitoring

Use external services:
- UptimeRobot: https://uptimerobot.com
- Pingdom: https://pingdom.com
- StatusCake: https://statuscake.com

---

## Test Checklist

Before marking Phase 3 complete, verify:

- [ ] All multi-device sync scenarios pass
- [ ] Encryption integrity verified (no plaintext on server)
- [ ] Performance benchmarks met (< 1s response times)
- [ ] Security audit passed (rate limiting, auth, SQL injection)
- [ ] Disaster recovery tested (backup/restore works)
- [ ] Auto-restart after crashes verified
- [ ] Services start after VPS reboot
- [ ] SSL certificate valid and secure
- [ ] HTTPS enforced (HTTP redirects)
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

## Next Steps After Phase 3

1. Enable production monitoring (Sentry, Datadog)
2. Setup alerting (PagerDuty, Slack)
3. Performance optimization based on real usage
4. Security hardening (fail2ban, intrusion detection)
5. Regular penetration testing
6. Compliance audit (GDPR, if applicable)
