#!/usr/bin/env bash
#
# Backup Script for Owlivion Sync Server
# Creates database backups and stores them with rotation
#
# Usage:
#   ./backup.sh [full|database|logs]
#   ./backup.sh restore <backup_file>
#
# Cron schedule (daily at 2 AM):
#   0 2 * * * /opt/owlivion-sync-server/deployment/backup.sh full

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_TYPE=${1:-full}
BACKUP_DIR="/var/backups/owlivion-sync"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Database credentials (load from .env if available)
if [ -f "/opt/owlivion-sync-server/.env" ]; then
  source <(grep -E '^DB_' /opt/owlivion-sync-server/.env | sed 's/^/export /')
fi

DB_NAME=${DB_NAME:-owlivion_sync}
DB_USER=${DB_USER:-owlivion}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo ""
echo "========================================="
echo "Owlivion Sync Server - Backup"
echo "========================================="
echo "Type: $BACKUP_TYPE"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create backup directory
sudo mkdir -p "$BACKUP_DIR"
sudo chown $USER:$USER "$BACKUP_DIR"
cd "$BACKUP_DIR"

# ============================================================================
# Database Backup
# ============================================================================

backup_database() {
  echo -e "${YELLOW}Backing up database...${NC}"

  BACKUP_FILE="$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"

  # Create compressed database dump
  sudo -u postgres pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-privileges \
    | gzip > "$BACKUP_FILE"

  # Calculate size
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

  echo -e "${GREEN}✓ Database backup created: $BACKUP_FILE ($SIZE)${NC}"
}

# ============================================================================
# Logs Backup
# ============================================================================

backup_logs() {
  echo -e "${YELLOW}Backing up logs...${NC}"

  LOGS_DIR="/var/log/owlivion-sync"
  BACKUP_FILE="$BACKUP_DIR/logs_${TIMESTAMP}.tar.gz"

  if [ -d "$LOGS_DIR" ]; then
    tar -czf "$BACKUP_FILE" -C "$(dirname "$LOGS_DIR")" "$(basename "$LOGS_DIR")"

    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Logs backup created: $BACKUP_FILE ($SIZE)${NC}"
  else
    echo -e "${YELLOW}Warning: Logs directory not found${NC}"
  fi
}

# ============================================================================
# Full Backup
# ============================================================================

backup_full() {
  echo -e "${YELLOW}Creating full backup...${NC}"

  # Database backup
  backup_database

  # Logs backup
  backup_logs

  # Application files backup (excluding node_modules)
  APP_DIR="/opt/owlivion-sync-server"
  BACKUP_FILE="$BACKUP_DIR/app_${TIMESTAMP}.tar.gz"

  if [ -d "$APP_DIR" ]; then
    tar -czf "$BACKUP_FILE" \
      -C "$(dirname "$APP_DIR")" \
      --exclude='node_modules' \
      --exclude='.git' \
      --exclude='coverage' \
      --exclude='*.log' \
      "$(basename "$APP_DIR")"

    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Application backup created: $BACKUP_FILE ($SIZE)${NC}"
  fi
}

# ============================================================================
# Restore Database
# ============================================================================

restore_database() {
  BACKUP_FILE=$1

  if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 restore <backup_file>"
    exit 1
  fi

  if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
  fi

  echo -e "${YELLOW}Restoring database from: $BACKUP_FILE${NC}"
  echo -e "${RED}WARNING: This will overwrite the current database!${NC}"
  read -p "Continue? (y/n) " -n 1 -r
  echo ""

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
  fi

  # Stop application
  echo "Stopping application..."
  pm2 stop owlivion-sync || true

  # Drop and recreate database
  echo "Recreating database..."
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

  # Restore from backup
  echo "Restoring data..."
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -d "$DB_NAME"
  else
    sudo -u postgres psql -d "$DB_NAME" -f "$BACKUP_FILE"
  fi

  # Restart application
  echo "Restarting application..."
  pm2 restart owlivion-sync

  echo -e "${GREEN}✓ Database restored successfully${NC}"
}

# ============================================================================
# Cleanup Old Backups
# ============================================================================

cleanup_old_backups() {
  echo -e "${YELLOW}Cleaning up old backups (older than $RETENTION_DAYS days)...${NC}"

  DELETED=$(find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)

  if [ "$DELETED" -gt 0 ]; then
    echo -e "${GREEN}✓ Deleted $DELETED old backup(s)${NC}"
  else
    echo "No old backups to delete"
  fi
}

# ============================================================================
# List Backups
# ============================================================================

list_backups() {
  echo -e "${YELLOW}Available backups:${NC}"
  echo ""

  if [ -d "$BACKUP_DIR" ]; then
    ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null || echo "No backups found"
  else
    echo "Backup directory does not exist"
  fi

  echo ""
  echo "Disk usage:"
  du -sh "$BACKUP_DIR" 2>/dev/null || echo "N/A"
}

# ============================================================================
# Main Logic
# ============================================================================

case "$BACKUP_TYPE" in
  database)
    backup_database
    cleanup_old_backups
    ;;

  logs)
    backup_logs
    cleanup_old_backups
    ;;

  full)
    backup_full
    cleanup_old_backups
    ;;

  restore)
    restore_database "$2"
    ;;

  list)
    list_backups
    ;;

  *)
    echo "Usage: $0 {full|database|logs|restore|list}"
    echo ""
    echo "Examples:"
    echo "  $0 full            # Create full backup"
    echo "  $0 database        # Backup database only"
    echo "  $0 logs            # Backup logs only"
    echo "  $0 list            # List all backups"
    echo "  $0 restore <file>  # Restore from backup"
    exit 1
    ;;
esac

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}Backup Complete!${NC}"
echo "========================================="
echo "Location: $BACKUP_DIR"
echo "Retention: $RETENTION_DAYS days"
echo ""
echo "To restore:"
echo "  $0 restore $BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"
echo ""
