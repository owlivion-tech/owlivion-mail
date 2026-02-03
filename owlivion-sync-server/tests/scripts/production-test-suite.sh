#!/usr/bin/env bash
#
# Production Test Suite
# Automated testing for production deployment
#
# Usage: ./production-test-suite.sh [api_base_url]

set -e

# Configuration
API_BASE="${1:-https://sync.owlivion.com/api/v1}"
TEST_EMAIL="test-prod-$(date +%s)@owlivion.test"
TEST_PASSWORD="SecureProd123!"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Test result arrays
declare -a PASSED_TESTS
declare -a FAILED_TESTS

echo ""
echo "========================================="
echo "Production Test Suite"
echo "========================================="
echo "API Base: $API_BASE"
echo "Test Email: $TEST_EMAIL"
echo ""

# Helper function to run test
test_case() {
  local name="$1"
  local command="$2"
  local required="${3:-true}"

  echo -n "Testing: $name ... "

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    PASSED_TESTS+=("$name")
    ((PASSED++))
    return 0
  else
    if [ "$required" = "true" ]; then
      echo -e "${RED}FAIL${NC}"
      FAILED_TESTS+=("$name")
      ((FAILED++))
      return 1
    else
      echo -e "${YELLOW}SKIP${NC}"
      ((SKIPPED++))
      return 0
    fi
  fi
}

# Helper: Generate UUID
generate_uuid() {
  if command -v uuidgen &> /dev/null; then
    uuidgen
  else
    cat /proc/sys/kernel/random/uuid
  fi
}

# Test 1: Health Check
test_health_check() {
  local response=$(curl -s -w "\n%{http_code}" "$API_BASE/health")
  local body=$(echo "$response" | sed '$d')
  local status=$(echo "$response" | tail -n1)

  [ "$status" = "200" ] && echo "$body" | jq -e '.success == true' > /dev/null
}

# Test 2: Register User
test_register_user() {
  local device_id=$(generate_uuid)

  local response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"$TEST_PASSWORD\",
      \"device_id\": \"$device_id\",
      \"device_name\": \"Test Device\",
      \"platform\": \"linux\"
    }")

  local body=$(echo "$response" | sed '$d')
  local status=$(echo "$response" | tail -n1)

  if [ "$status" = "201" ]; then
    ACCESS_TOKEN=$(echo "$body" | jq -r '.data.tokens.access_token')
    REFRESH_TOKEN=$(echo "$body" | jq -r '.data.tokens.refresh_token')
    DEVICE_ID="$device_id"
    return 0
  fi

  return 1
}

# Test 3: Login User
test_login_user() {
  local device_id=$(generate_uuid)

  local response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"$TEST_PASSWORD\",
      \"device_id\": \"$device_id\"
    }")

  local body=$(echo "$response" | sed '$d')
  local status=$(echo "$response" | tail -n1)

  [ "$status" = "200" ] && echo "$body" | jq -e '.data.tokens.access_token' > /dev/null
}

# Test 4: Invalid Login
test_invalid_login() {
  local response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"wrong_password\",
      \"device_id\": \"test\"
    }")

  local status=$(echo "$response" | tail -n1)
  [ "$status" = "401" ]
}

# Test 5: Upload Sync Data
test_upload_sync_data() {
  local encrypted_blob=$(echo '{"contacts":[{"email":"alice@example.com","name":"Alice"}]}' | base64 -w0)
  local nonce=$(openssl rand -base64 12)
  local checksum=$(echo -n "$encrypted_blob" | base64 -d | sha256sum | cut -d' ' -f1)

  local response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/sync/upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
      \"data_type\": \"contacts\",
      \"encrypted_blob\": \"$encrypted_blob\",
      \"nonce\": \"$nonce\",
      \"checksum\": \"$checksum\",
      \"device_id\": \"$DEVICE_ID\"
    }")

  local status=$(echo "$response" | tail -n1)
  [ "$status" = "200" ]
}

# Test 6: Download Sync Data
test_download_sync_data() {
  local response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/sync/download?data_type=contacts" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  local body=$(echo "$response" | sed '$d')
  local status=$(echo "$response" | tail -n1)

  [ "$status" = "200" ] && echo "$body" | jq -e '.data.encrypted_blob' > /dev/null
}

# Test 7: Sync Status
test_sync_status() {
  local response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/sync/status" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  local body=$(echo "$response" | sed '$d')
  local status=$(echo "$response" | tail -n1)

  [ "$status" = "200" ] && echo "$body" | jq -e '.data.sync_status' > /dev/null
}

# Test 8: List Devices
test_list_devices() {
  local response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/devices" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  local body=$(echo "$response" | sed '$d')
  local status=$(echo "$response" | tail -n1)

  [ "$status" = "200" ] && echo "$body" | jq -e '.data.devices' > /dev/null
}

# Test 9: Unauthorized Access
test_unauthorized_access() {
  local response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/devices")
  local status=$(echo "$response" | tail -n1)

  [ "$status" = "401" ]
}

# Test 10: Invalid Checksum
test_invalid_checksum() {
  local encrypted_blob=$(echo '{"test":"data"}' | base64 -w0)
  local nonce=$(openssl rand -base64 12)

  local response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/sync/upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
      \"data_type\": \"contacts\",
      \"encrypted_blob\": \"$encrypted_blob\",
      \"nonce\": \"$nonce\",
      \"checksum\": \"invalid_checksum\",
      \"device_id\": \"$DEVICE_ID\"
    }")

  local status=$(echo "$response" | tail -n1)
  [ "$status" = "400" ]
}

# Test 11: Token Refresh
test_token_refresh() {
  local response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{
      \"refresh_token\": \"$REFRESH_TOKEN\"
    }")

  local body=$(echo "$response" | sed '$d')
  local status=$(echo "$response" | tail -n1)

  [ "$status" = "200" ] && echo "$body" | jq -e '.data.tokens.access_token' > /dev/null
}

# Test 12: Rate Limiting (optional - may affect production)
test_rate_limiting() {
  local count=0
  for i in {1..10}; do
    local response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/auth/login" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"nonexistent@example.com\",
        \"password\": \"wrong\",
        \"device_id\": \"test\"
      }")

    local status=$(echo "$response" | tail -n1)

    if [ "$status" = "429" ]; then
      return 0
    fi
  done

  # If we made it here, rate limiting might be too lenient or disabled
  return 1
}

# ============================================================================
# Run All Tests
# ============================================================================

echo -e "${BLUE}Running tests...${NC}"
echo ""

# Core functionality tests
test_case "1. Health Check" "test_health_check" true
test_case "2. Register User" "test_register_user" true
test_case "3. Login User" "test_login_user" true
test_case "4. Invalid Login (401)" "test_invalid_login" true
test_case "5. Upload Sync Data" "test_upload_sync_data" true
test_case "6. Download Sync Data" "test_download_sync_data" true
test_case "7. Sync Status" "test_sync_status" true
test_case "8. List Devices" "test_list_devices" true

# Security tests
test_case "9. Unauthorized Access (401)" "test_unauthorized_access" true
test_case "10. Invalid Checksum (400)" "test_invalid_checksum" true
test_case "11. Token Refresh" "test_token_refresh" true
test_case "12. Rate Limiting (optional)" "test_rate_limiting" false

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "========================================="
echo "Test Results"
echo "========================================="
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED${NC}"
echo ""

if [ ${#PASSED_TESTS[@]} -gt 0 ]; then
  echo -e "${GREEN}Passed Tests:${NC}"
  for test in "${PASSED_TESTS[@]}"; do
    echo "  ✓ $test"
  done
  echo ""
fi

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo -e "${RED}Failed Tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo "  ✗ $test"
  done
  echo ""
fi

# Exit code
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All required tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
