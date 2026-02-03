#!/usr/bin/env bash
#
# Database Setup Script
# Sets up PostgreSQL database for Owlivion Sync Server
#
# Usage: sudo ./setup-database.sh

set -e

echo "========================================="
echo "Owlivion Sync Server - Database Setup"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run as root (sudo)${NC}"
  exit 1
fi

# Configuration
DB_NAME=${DB_NAME:-"owlivion_sync"}
DB_USER=${DB_USER:-"owlivion"}
DB_PASSWORD=${DB_PASSWORD:-""}

# Prompt for password if not set
if [ -z "$DB_PASSWORD" ]; then
  read -sp "Enter database password for user '$DB_USER': " DB_PASSWORD
  echo ""

  if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Password cannot be empty${NC}"
    exit 1
  fi
fi

echo ""
echo "Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

read -p "Continue with these settings? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Install PostgreSQL if not installed
echo -e "${YELLOW}Checking PostgreSQL installation...${NC}"
if ! command -v psql &> /dev/null; then
  echo "PostgreSQL not found. Installing..."
  apt update
  apt install -y postgresql postgresql-contrib
  systemctl start postgresql
  systemctl enable postgresql
  echo -e "${GREEN}✓ PostgreSQL installed${NC}"
else
  echo -e "${GREEN}✓ PostgreSQL already installed${NC}"
fi

# Create database user
echo ""
echo -e "${YELLOW}Creating database user...${NC}"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "User already exists"

# Create database
echo -e "${YELLOW}Creating database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "Database already exists"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
echo -e "${GREEN}✓ Database and user created${NC}"

# Apply schema
echo ""
echo -e "${YELLOW}Applying database schema...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/../schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
  sudo -u postgres psql -d $DB_NAME -f "$SCHEMA_FILE"
  echo -e "${GREEN}✓ Schema applied successfully${NC}"
else
  echo -e "${RED}Error: schema.sql not found at $SCHEMA_FILE${NC}"
  exit 1
fi

# Verify installation
echo ""
echo -e "${YELLOW}Verifying installation...${NC}"
TABLE_COUNT=$(sudo -u postgres psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

if [ "$TABLE_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Database tables created: $TABLE_COUNT tables${NC}"
else
  echo -e "${RED}Error: No tables found in database${NC}"
  exit 1
fi

# Configure PostgreSQL for remote access (optional)
echo ""
read -p "Allow remote database connections? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  PG_HBA_CONF="/etc/postgresql/*/main/pg_hba.conf"
  PG_CONF="/etc/postgresql/*/main/postgresql.conf"

  # Allow password authentication
  echo "host    $DB_NAME    $DB_USER    0.0.0.0/0    md5" | sudo tee -a $PG_HBA_CONF > /dev/null

  # Listen on all interfaces
  sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONF

  # Restart PostgreSQL
  systemctl restart postgresql

  echo -e "${GREEN}✓ Remote access enabled${NC}"
  echo -e "${YELLOW}Note: Make sure to configure firewall (ufw/iptables)${NC}"
fi

# Create .env file template
echo ""
echo -e "${YELLOW}Creating .env configuration...${NC}"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# JWT Secrets (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=*

# API Version
API_VERSION=v1

# Logging
LOG_LEVEL=info
EOF
  echo -e "${GREEN}✓ .env file created${NC}"
  echo -e "${YELLOW}Note: Review and update .env file before starting server${NC}"
else
  echo ".env file already exists, skipping..."
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}Database Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Database Information:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""
echo "Connection string:"
echo "  postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo "Next steps:"
echo "  1. Review .env file: nano $ENV_FILE"
echo "  2. Install Node.js dependencies: npm install"
echo "  3. Start server: npm start"
echo ""
