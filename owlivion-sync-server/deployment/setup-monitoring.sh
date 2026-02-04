#!/usr/bin/env bash
#
# Monitoring Setup Script for Owlivion Sync Server
# Sets up log rotation, health checks, and automated backups
#
# Usage:
#   sudo ./setup-monitoring.sh [--email your@email.com]
#
# What it does:
#   1. Installs logrotate config for PM2 logs
#   2. Sets up health check monitoring (every 5 minutes)
#   3. Configures automated database backups (daily at 2 AM)
#   4. Creates monitoring log directory

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/owlivion-sync-server"
ALERT_EMAIL="${1}"

echo ""
echo "========================================="
echo "Owlivion Sync Server - Monitoring Setup"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  echo "Usage: sudo $0 [--email your@email.com]"
  exit 1
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --email)
      ALERT_EMAIL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# ============================================================================
# Step 1: Install Logrotate Config
# ============================================================================

echo -e "${BLUE}[1/5] Installing logrotate configuration...${NC}"

if [ -f "$SCRIPT_DIR/owlivion-pm2-logrotate" ]; then
  cp "$SCRIPT_DIR/owlivion-pm2-logrotate" /etc/logrotate.d/owlivion-pm2
  chmod 644 /etc/logrotate.d/owlivion-pm2
  echo -e "${GREEN}✓ Logrotate config installed${NC}"

  # Test logrotate config
  echo "  Testing logrotate configuration..."
  if logrotate -d /etc/logrotate.d/owlivion-pm2 > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Logrotate config is valid${NC}"
  else
    echo -e "${YELLOW}  ⚠ Warning: Logrotate config may have issues${NC}"
  fi
else
  echo -e "${RED}✗ owlivion-pm2-logrotate file not found${NC}"
  exit 1
fi

echo ""

# ============================================================================
# Step 2: Create Health Check Log Directory
# ============================================================================

echo -e "${BLUE}[2/5] Creating monitoring directories...${NC}"

mkdir -p /var/log
touch /var/log/owlivion-health.log
chmod 644 /var/log/owlivion-health.log

echo -e "${GREEN}✓ Health check log created: /var/log/owlivion-health.log${NC}"
echo ""

# ============================================================================
# Step 3: Install Health Check Script
# ============================================================================

echo -e "${BLUE}[3/5] Installing health check script...${NC}"

if [ -f "$SCRIPT_DIR/healthcheck.sh" ]; then
  # Only copy if source and destination are different
  if [ "$SCRIPT_DIR/healthcheck.sh" != "$APP_DIR/deployment/healthcheck.sh" ]; then
    cp "$SCRIPT_DIR/healthcheck.sh" "$APP_DIR/deployment/healthcheck.sh"
  fi
  chmod +x "$APP_DIR/deployment/healthcheck.sh"
  echo -e "${GREEN}✓ Health check script installed${NC}"

  # Test health check
  echo "  Running test health check..."
  if "$APP_DIR/deployment/healthcheck.sh" --verbose > /tmp/healthcheck-test.log 2>&1; then
    echo -e "${GREEN}  ✓ Health check passed${NC}"
  else
    echo -e "${YELLOW}  ⚠ Some health checks failed (see /tmp/healthcheck-test.log)${NC}"
  fi
else
  echo -e "${RED}✗ healthcheck.sh file not found${NC}"
  exit 1
fi

echo ""

# ============================================================================
# Step 4: Setup Cron Jobs
# ============================================================================

echo -e "${BLUE}[4/5] Configuring cron jobs...${NC}"

# Create temporary crontab file
TEMP_CRON=$(mktemp)

# Get existing crontab (if any)
crontab -l > "$TEMP_CRON" 2>/dev/null || true

# Remove old owlivion entries
sed -i '/owlivion/d' "$TEMP_CRON"

# Add new cron jobs
cat >> "$TEMP_CRON" << EOF

# Owlivion Sync Server - Monitoring & Backups
# Added by setup-monitoring.sh on $(date +"%Y-%m-%d")

# Health check every 5 minutes
*/5 * * * * $APP_DIR/deployment/healthcheck.sh >> /var/log/owlivion-health.log 2>&1

# Database backup daily at 2 AM
0 2 * * * $APP_DIR/deployment/backup.sh database >> /var/log/owlivion-backup.log 2>&1

# Full backup weekly on Sunday at 3 AM
0 3 * * 0 $APP_DIR/deployment/backup.sh full >> /var/log/owlivion-backup.log 2>&1

EOF

# Install new crontab
crontab "$TEMP_CRON"
rm "$TEMP_CRON"

echo -e "${GREEN}✓ Cron jobs configured:${NC}"
echo "  - Health check: every 5 minutes"
echo "  - Database backup: daily at 2 AM"
echo "  - Full backup: weekly on Sunday at 3 AM"

echo ""

# ============================================================================
# Step 5: Configure Email Alerts (Optional)
# ============================================================================

echo -e "${BLUE}[5/5] Configuring email alerts...${NC}"

if [ -n "$ALERT_EMAIL" ]; then
  # Check if mail command is available
  if ! command -v mail &> /dev/null; then
    echo "  Installing mailutils..."
    apt-get update -qq
    apt-get install -y -qq mailutils > /dev/null 2>&1
  fi

  # Set email in environment
  echo "export ALERT_EMAIL=$ALERT_EMAIL" >> /etc/environment

  echo -e "${GREEN}✓ Email alerts enabled for: $ALERT_EMAIL${NC}"
  echo "  Note: You may need to configure SMTP settings for outbound email"
else
  echo -e "${YELLOW}⚠ Email alerts not configured (no email provided)${NC}"
  echo "  To enable later: sudo ./setup-monitoring.sh --email your@email.com"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "========================================="
echo -e "${GREEN}Monitoring Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Installed components:"
echo "  ✓ Logrotate config: /etc/logrotate.d/owlivion-pm2"
echo "  ✓ Health check script: $APP_DIR/deployment/healthcheck.sh"
echo "  ✓ Backup script: $APP_DIR/deployment/backup.sh"
echo "  ✓ Cron jobs: 3 automated tasks"
echo ""
echo "Log files:"
echo "  - Health checks: /var/log/owlivion-health.log"
echo "  - Backups: /var/log/owlivion-backup.log"
echo "  - PM2 logs: /root/.pm2/logs/"
echo ""
echo "Manual commands:"
echo "  - Test health check: sudo $APP_DIR/deployment/healthcheck.sh --verbose"
echo "  - Run backup: sudo $APP_DIR/deployment/backup.sh full"
echo "  - View logs: sudo tail -f /var/log/owlivion-health.log"
echo "  - List backups: sudo $APP_DIR/deployment/backup.sh list"
echo ""
echo "Next steps:"
echo "  1. Verify monitoring is working:"
echo "     - Check health log: sudo tail -f /var/log/owlivion-health.log"
echo "     - Test backup: sudo $APP_DIR/deployment/backup.sh database"
echo ""
echo "  2. (Optional) Setup external uptime monitoring:"
echo "     - UptimeRobot: https://uptimerobot.com/"
echo "     - Monitor URL: http://31.97.216.36:3000/health"
echo ""
echo "  3. (Optional) Setup PM2 Plus dashboard:"
echo "     - See: $APP_DIR/deployment/optional/pm2-plus/"
echo ""
echo "  4. Test email alerts if configured:"
echo "     - Manually trigger health check failure"
echo "     - Verify email delivery"
echo ""
