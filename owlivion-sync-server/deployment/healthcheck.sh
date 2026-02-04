#!/usr/bin/env bash
#
# Health Check Script for Owlivion Sync Server
# Monitors critical services and sends alerts on failure
#
# Usage:
#   ./healthcheck.sh [--verbose] [--email your@email.com]
#
# Cron schedule (every 5 minutes):
#   */5 * * * * /opt/owlivion-sync-server/deployment/healthcheck.sh >> /var/log/owlivion-health.log 2>&1

set -e

# Configuration
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
HEALTH_LOG="/var/log/owlivion-health.log"
ALERT_EMAIL="${ALERT_EMAIL:-}"
VERBOSE=false
AUTO_RESTART=true

# API endpoint
API_URL="https://owlivion.com/api/v1/health"

# Thresholds
DISK_THRESHOLD=80       # Alert if disk usage > 80%
MEMORY_THRESHOLD=90     # Alert if memory usage > 90%

# Colors (for terminal output)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose)
      VERBOSE=true
      shift
      ;;
    --email)
      ALERT_EMAIL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Logging function
log() {
  local level=$1
  shift
  local message="$@"
  echo "[$TIMESTAMP] [$level] $message" | tee -a "$HEALTH_LOG"
}

log_verbose() {
  if [ "$VERBOSE" = true ]; then
    log "INFO" "$@"
  fi
}

# Send alert email
send_alert() {
  local subject="$1"
  local body="$2"

  log "ALERT" "$subject"

  if [ -n "$ALERT_EMAIL" ] && command -v mail &> /dev/null; then
    echo "$body" | mail -s "[Owlivion] $subject" "$ALERT_EMAIL"
    log_verbose "Alert email sent to $ALERT_EMAIL"
  fi
}

# Restart service
restart_service() {
  local service=$1

  if [ "$AUTO_RESTART" = false ]; then
    return
  fi

  log "ACTION" "Attempting to restart $service..."

  case $service in
    postgresql)
      sudo systemctl restart postgresql
      ;;
    pm2)
      pm2 restart all
      ;;
    nginx)
      sudo systemctl restart nginx
      ;;
  esac

  sleep 2
  log "ACTION" "$service restarted"
}

# ============================================================================
# Check: PostgreSQL
# ============================================================================

check_postgresql() {
  log_verbose "Checking PostgreSQL..."

  if ! sudo systemctl is-active --quiet postgresql; then
    send_alert "PostgreSQL DOWN" "PostgreSQL service is not running"
    restart_service postgresql
    return 1
  fi

  # Try to connect
  if ! sudo -u postgres psql -c '\l' > /dev/null 2>&1; then
    send_alert "PostgreSQL Connection Failed" "Cannot connect to PostgreSQL"
    return 1
  fi

  log_verbose "PostgreSQL: OK"
  return 0
}

# ============================================================================
# Check: PM2
# ============================================================================

check_pm2() {
  log_verbose "Checking PM2..."

  if ! command -v pm2 &> /dev/null; then
    send_alert "PM2 Not Found" "PM2 command not available"
    return 1
  fi

  # Check if owlivion-sync app is running
  if ! pm2 list | grep -q "owlivion-sync.*online"; then
    send_alert "PM2 App DOWN" "owlivion-sync application is not online"
    restart_service pm2
    return 1
  fi

  log_verbose "PM2: OK"
  return 0
}

# ============================================================================
# Check: Nginx
# ============================================================================

check_nginx() {
  log_verbose "Checking Nginx..."

  if ! sudo systemctl is-active --quiet nginx; then
    send_alert "Nginx DOWN" "Nginx service is not running"
    restart_service nginx
    return 1
  fi

  # Test nginx config
  if ! sudo nginx -t > /dev/null 2>&1; then
    send_alert "Nginx Config Error" "Nginx configuration is invalid"
    return 1
  fi

  log_verbose "Nginx: OK"
  return 0
}

# ============================================================================
# Check: API Health Endpoint
# ============================================================================

check_api() {
  log_verbose "Checking API health endpoint..."

  # Try to reach health endpoint
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL" || echo "000")

  if [ "$response" != "200" ]; then
    send_alert "API Health Check Failed" "Health endpoint returned HTTP $response"

    # Try to restart PM2 if API is down
    if [ "$response" = "000" ] || [ "$response" = "502" ] || [ "$response" = "503" ]; then
      restart_service pm2
    fi

    return 1
  fi

  log_verbose "API: OK"
  return 0
}

# ============================================================================
# Check: Disk Space
# ============================================================================

check_disk() {
  log_verbose "Checking disk space..."

  # Get disk usage percentage (root partition)
  disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

  if [ "$disk_usage" -gt "$DISK_THRESHOLD" ]; then
    send_alert "Disk Space Warning" "Disk usage is at ${disk_usage}% (threshold: ${DISK_THRESHOLD}%)"
    return 1
  fi

  log_verbose "Disk: ${disk_usage}% used (OK)"
  return 0
}

# ============================================================================
# Check: Memory Usage
# ============================================================================

check_memory() {
  log_verbose "Checking memory usage..."

  # Get memory usage percentage
  memory_usage=$(free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')

  if [ "$memory_usage" -gt "$MEMORY_THRESHOLD" ]; then
    send_alert "Memory Usage Warning" "Memory usage is at ${memory_usage}% (threshold: ${MEMORY_THRESHOLD}%)"
    return 1
  fi

  log_verbose "Memory: ${memory_usage}% used (OK)"
  return 0
}

# ============================================================================
# Check: SSL Certificate Expiry
# ============================================================================

check_ssl_cert() {
  log_verbose "Checking SSL certificate..."

  # Get certificate expiry date
  expiry_date=$(echo | openssl s_client -servername owlivion.com -connect owlivion.com:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

  if [ -n "$expiry_date" ]; then
    expiry_epoch=$(date -d "$expiry_date" +%s)
    now_epoch=$(date +%s)
    days_left=$(( ($expiry_epoch - $now_epoch) / 86400 ))

    if [ "$days_left" -lt 7 ]; then
      send_alert "SSL Certificate Expiring Soon" "SSL certificate expires in $days_left days"
      return 1
    fi

    log_verbose "SSL: ${days_left} days until expiry (OK)"
  else
    log "WARNING" "Could not check SSL certificate"
  fi

  return 0
}

# ============================================================================
# Main Health Check
# ============================================================================

main() {
  log "INFO" "Starting health check..."

  failed_checks=0

  # Run all checks
  check_postgresql || ((failed_checks++))
  check_pm2 || ((failed_checks++))
  check_nginx || ((failed_checks++))
  check_api || ((failed_checks++))
  check_disk || ((failed_checks++))
  check_memory || ((failed_checks++))
  check_ssl_cert || ((failed_checks++))

  # Summary
  if [ $failed_checks -eq 0 ]; then
    log "INFO" "All checks passed ✓"
    exit 0
  else
    log "WARNING" "$failed_checks check(s) failed"
    exit 1
  fi
}

# Ensure log file exists
sudo touch "$HEALTH_LOG"
sudo chmod 644 "$HEALTH_LOG"

# Run health check
main
