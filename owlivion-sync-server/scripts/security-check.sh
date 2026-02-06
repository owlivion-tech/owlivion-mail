#!/bin/bash

# Owlivion Sync Server - Security Check Script
# Runs all automated security tests

set -e  # Exit on error

echo "🔒 Owlivion Sync Server - Security Check"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Must run from owlivion-sync-server directory${NC}"
  exit 1
fi

echo "📦 1/4 - Running npm audit..."
echo "-----------------------------"
if npm run security:audit; then
  echo -e "${GREEN}✅ No vulnerabilities found${NC}"
else
  echo -e "${YELLOW}⚠️  Vulnerabilities detected - review above${NC}"
fi
echo ""

echo "🔍 2/4 - Checking for known vulnerable libraries..."
echo "----------------------------------------------------"
if npm run security:retire; then
  echo -e "${GREEN}✅ No known vulnerable libraries${NC}"
else
  echo -e "${YELLOW}⚠️  Vulnerable libraries detected - review above${NC}"
fi
echo ""

echo "🔐 3/4 - Checking environment configuration..."
echo "------------------------------------------------"

# Check if .env exists
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  No .env file found - using defaults${NC}"
else
  # Check for weak secrets
  if grep -q "change-this\|change_this\|your_" .env; then
    echo -e "${RED}❌ CRITICAL: Weak/default secrets detected in .env!${NC}"
    echo "   Please update JWT_SECRET, JWT_REFRESH_SECRET, and DB_PASSWORD"
    exit 1
  else
    echo -e "${GREEN}✅ No weak defaults detected${NC}"
  fi

  # Check CORS configuration
  if grep -q "CORS_ORIGINS=\*" .env; then
    echo -e "${YELLOW}⚠️  CORS allows all origins (*) - not recommended for production${NC}"
  else
    echo -e "${GREEN}✅ CORS properly configured${NC}"
  fi
fi
echo ""

echo "📋 4/4 - Security headers test..."
echo "----------------------------------"

# Check if server is running
if ! curl -s http://localhost:3000/api/v1/health > /dev/null; then
  echo -e "${YELLOW}⚠️  Server not running - skipping headers test${NC}"
  echo "   Start server with: npm run dev"
else
  echo "Testing security headers..."

  HEADERS=$(curl -sI http://localhost:3000/api/v1/health)

  # Check for required headers
  if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
    echo -e "${GREEN}✓${NC} HSTS enabled"
  else
    echo -e "${RED}✗${NC} HSTS missing"
  fi

  if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
    echo -e "${GREEN}✓${NC} CSP enabled"
  else
    echo -e "${RED}✗${NC} CSP missing"
  fi

  if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo -e "${GREEN}✓${NC} X-Frame-Options enabled"
  else
    echo -e "${RED}✗${NC} X-Frame-Options missing"
  fi

  if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    echo -e "${GREEN}✓${NC} X-Content-Type-Options enabled"
  else
    echo -e "${RED}✗${NC} X-Content-Type-Options missing"
  fi

  if echo "$HEADERS" | grep -q "Permissions-Policy"; then
    echo -e "${GREEN}✓${NC} Permissions-Policy enabled"
  else
    echo -e "${RED}✗${NC} Permissions-Policy missing"
  fi
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ Security check complete!${NC}"
echo ""
echo "📖 For manual penetration testing, see: SECURITY_TESTING.md"
echo "🔗 Run Mozilla Observatory scan: https://observatory.mozilla.org/"
echo ""
