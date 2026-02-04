#!/usr/bin/env bash
#
# PM2 Plus Setup Script for Owlivion Sync Server
# Links PM2 to PM2 Plus monitoring dashboard
#
# Usage:
#   ./setup-pm2-plus.sh <secret_key> <public_key>
#
# Get your keys from:
#   https://app.pm2.io/ → Bucket Settings → Connect to PM2 Plus
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/owlivion-sync-server"

echo ""
echo "========================================="
echo "  PM2 Plus Setup - Owlivion Sync Server"
echo "========================================="
echo ""

# Parse arguments
SECRET_KEY="${1}"
PUBLIC_KEY="${2}"

if [ -z "$SECRET_KEY" ] || [ -z "$PUBLIC_KEY" ]; then
  echo -e "${RED}Error: Missing PM2 Plus keys${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 <secret_key> <public_key>"
  echo ""
  echo "Get your keys from:"
  echo "  1. Visit: https://app.pm2.io/"
  echo "  2. Go to: Bucket Settings → General"
  echo "  3. Find: 'Connect to PM2 Plus' section"
  echo "  4. Copy: Secret Key and Public Key"
  echo ""
  exit 1
fi

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================

echo -e "${BLUE}[1/6] Checking prerequisites...${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo -e "${RED}✗ PM2 is not installed${NC}"
  echo "  Install with: npm install -g pm2"
  exit 1
fi

PM2_VERSION=$(pm2 --version)
echo -e "${GREEN}✓ PM2 installed (v${PM2_VERSION})${NC}"

# Check if @pm2/io is installed
if [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  if npm list @pm2/io &> /dev/null; then
    echo -e "${GREEN}✓ @pm2/io module installed${NC}"
  else
    echo -e "${YELLOW}⚠ @pm2/io not installed, installing now...${NC}"
    npm install --save @pm2/io
    echo -e "${GREEN}✓ @pm2/io installed${NC}"
  fi
else
  echo -e "${YELLOW}⚠ package.json not found at $APP_DIR${NC}"
fi

echo ""

# ============================================================================
# Step 2: Unlink Previous Connection (if exists)
# ============================================================================

echo -e "${BLUE}[2/6] Checking existing PM2 Plus connection...${NC}"

# Check if already linked
if pm2 info 2>&1 | grep -q "Agent status.*connected"; then
  echo -e "${YELLOW}⚠ Already linked to PM2 Plus, unlinking first...${NC}"
  pm2 unlink
  echo -e "${GREEN}✓ Unlinked from previous connection${NC}"
else
  echo -e "${GREEN}✓ No previous connection${NC}"
fi

echo ""

# ============================================================================
# Step 3: Link to PM2 Plus
# ============================================================================

echo -e "${BLUE}[3/6] Linking to PM2 Plus...${NC}"

# Link PM2 daemon to PM2 Plus
if pm2 link "$SECRET_KEY" "$PUBLIC_KEY" owlivion-sync-server; then
  echo -e "${GREEN}✓ Successfully linked to PM2 Plus${NC}"
else
  echo -e "${RED}✗ Failed to link to PM2 Plus${NC}"
  echo "  Check your keys and network connection"
  exit 1
fi

echo ""

# ============================================================================
# Step 4: Update Ecosystem Config
# ============================================================================

echo -e "${BLUE}[4/6] Updating ecosystem configuration...${NC}"

ECOSYSTEM_FILE="$SCRIPT_DIR/ecosystem.config.js"

if [ -f "$ECOSYSTEM_FILE" ]; then
  # Check if automation is enabled
  if grep -q "automation: true" "$ECOSYSTEM_FILE"; then
    echo -e "${GREEN}✓ PM2 Plus already enabled in ecosystem.config.js${NC}"
  else
    echo -e "${YELLOW}⚠ Enabling PM2 Plus in ecosystem.config.js...${NC}"

    # Backup original file
    cp "$ECOSYSTEM_FILE" "$ECOSYSTEM_FILE.backup"

    # Enable automation
    sed -i 's/automation: false/automation: true/' "$ECOSYSTEM_FILE"

    echo -e "${GREEN}✓ Ecosystem config updated (backup created)${NC}"
  fi
else
  echo -e "${RED}✗ ecosystem.config.js not found${NC}"
  exit 1
fi

echo ""

# ============================================================================
# Step 5: Reload PM2 Processes
# ============================================================================

echo -e "${BLUE}[5/6] Reloading PM2 processes...${NC}"

# Check if app is running
if pm2 list | grep -q "owlivion-sync"; then
  echo "  Reloading with new configuration..."
  pm2 reload "$ECOSYSTEM_FILE"
  echo -e "${GREEN}✓ PM2 processes reloaded${NC}"
else
  echo "  Starting processes..."
  pm2 start "$ECOSYSTEM_FILE"
  echo -e "${GREEN}✓ PM2 processes started${NC}"
fi

# Save PM2 configuration
pm2 save

echo ""

# ============================================================================
# Step 6: Verify Setup
# ============================================================================

echo -e "${BLUE}[6/6] Verifying PM2 Plus connection...${NC}"

sleep 3  # Wait for connection to establish

# Check PM2 agent status
echo "  Checking PM2 agent status..."
if pm2 info 2>&1 | grep -q "Agent status.*connected"; then
  echo -e "${GREEN}✓ PM2 Plus agent connected${NC}"
else
  echo -e "${YELLOW}⚠ PM2 Plus agent not yet connected (may take a few seconds)${NC}"
fi

# Display process info
echo ""
echo "  Process information:"
pm2 describe owlivion-sync | grep -E "(name|status|mode|instances|pm id)" || true

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "========================================="
echo -e "${GREEN}PM2 Plus Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Visit PM2 Plus Dashboard:"
echo -e "     ${CYAN}https://app.pm2.io/${NC}"
echo ""
echo "  2. Verify connection:"
echo "     - Server should appear in dashboard"
echo "     - Process 'owlivion-sync' should be visible"
echo "     - Metrics should start appearing within 1-2 minutes"
echo ""
echo "  3. Configure alerts (recommended):"
echo "     - CPU > 80% for 5 minutes"
echo "     - Memory > 400MB for 2 minutes"
echo "     - Process restarts > 3 in 10 minutes"
echo ""
echo "  4. Setup notifications:"
echo "     - Email: Settings → Notifications → Email"
echo "     - Slack: Settings → Integrations → Slack"
echo ""
echo "Useful commands:"
echo "  - View real-time monitoring: ${CYAN}pm2 monit${NC}"
echo "  - Check process info:       ${CYAN}pm2 describe owlivion-sync${NC}"
echo "  - View logs:                ${CYAN}pm2 logs owlivion-sync${NC}"
echo "  - Unlink from PM2 Plus:     ${CYAN}pm2 unlink${NC}"
echo ""
echo "Documentation:"
echo "  - See: $SCRIPT_DIR/PM2_PLUS_SETUP.md"
echo "  - Docs: https://pm2.io/docs/"
echo ""
