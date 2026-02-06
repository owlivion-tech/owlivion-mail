#!/bin/bash

# ============================================================================
# Database Migration Runner
# Usage: ./run-migration.sh [migration_number]
# Example: ./run-migration.sh 002
# ============================================================================

set -e  # Exit on error

# Load environment variables
if [ -f "../../../.env" ]; then
    export $(cat ../../../.env | grep -v '^#' | xargs)
fi

# Database connection settings
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-owlivion_sync}"
DB_USER="${DB_USER:-owlivion}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to run migration
run_migration() {
    local migration_file=$1

    if [ ! -f "$migration_file" ]; then
        echo -e "${RED}❌ Migration file not found: $migration_file${NC}"
        exit 1
    fi

    echo -e "${YELLOW}🔄 Running migration: $migration_file${NC}"

    # Run migration using psql
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migration completed successfully${NC}"
    else
        echo -e "${RED}❌ Migration failed${NC}"
        exit 1
    fi
}

# Main logic
if [ -z "$1" ]; then
    echo "Usage: $0 [migration_number]"
    echo "Example: $0 002"
    echo ""
    echo "Available migrations:"
    ls -1 *.sql 2>/dev/null || echo "  No migrations found"
    exit 1
fi

MIGRATION_NUMBER=$1
MIGRATION_FILE="${MIGRATION_NUMBER}_*.sql"

# Find migration file
FOUND_FILE=$(ls $MIGRATION_FILE 2>/dev/null | head -n 1)

if [ -z "$FOUND_FILE" ]; then
    echo -e "${RED}❌ No migration found for: $MIGRATION_NUMBER${NC}"
    exit 1
fi

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Database Migration Runner            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Database: $DB_NAME@$DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Migration: $FOUND_FILE"
echo ""
read -p "Continue with migration? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    run_migration "$FOUND_FILE"
else
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
fi
