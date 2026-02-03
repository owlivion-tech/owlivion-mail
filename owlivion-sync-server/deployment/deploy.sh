#!/usr/bin/env bash
#
# Deployment Script for Owlivion Sync Server
# Automates deployment to VPS (31.97.216.36)
#
# Usage: ./deploy.sh [environment]
#   environment: production (default) | staging

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-production}
VPS_HOST="31.97.216.36"
VPS_USER="owlivion"
APP_DIR="/opt/owlivion-sync-server"
REPO_URL="https://github.com/owlivion/owlivion-sync-server.git"
BRANCH="main"

echo ""
echo "========================================="
echo "Owlivion Sync Server - Deployment"
echo "========================================="
echo ""
echo "Environment: $ENVIRONMENT"
echo "VPS: $VPS_USER@$VPS_HOST"
echo "Directory: $APP_DIR"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# SSH connection test
echo ""
echo -e "${BLUE}Testing SSH connection...${NC}"
if ! ssh -q "$VPS_USER@$VPS_HOST" exit; then
  echo -e "${RED}Error: Cannot connect to VPS${NC}"
  echo "Please check:"
  echo "  - SSH key is added: ssh-add ~/.ssh/id_rsa"
  echo "  - Host is accessible: ping $VPS_HOST"
  echo "  - User has permissions"
  exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"

# Deploy via SSH
echo ""
echo -e "${BLUE}Deploying to VPS...${NC}"

ssh "$VPS_USER@$VPS_HOST" <<ENDSSH
set -e

echo "========================================="
echo "Deployment on VPS"
echo "========================================="

# Check if directory exists
if [ ! -d "$APP_DIR" ]; then
  echo "Creating application directory..."
  sudo mkdir -p $APP_DIR
  sudo chown $VPS_USER:$VPS_USER $APP_DIR
fi

cd $APP_DIR

# Clone or pull repository
if [ ! -d ".git" ]; then
  echo "Cloning repository..."
  git clone $REPO_URL .
else
  echo "Pulling latest changes..."
  git fetch origin
  git reset --hard origin/$BRANCH
fi

# Checkout branch
git checkout $BRANCH

# Install/Update Node.js dependencies
echo "Installing dependencies..."
npm install --production

# Run database migrations (if any)
if [ -f "deployment/migrate.sh" ]; then
  echo "Running migrations..."
  bash deployment/migrate.sh
fi

# Environment check
if [ ! -f ".env" ]; then
  echo "Warning: .env file not found!"
  echo "Creating from .env.example..."
  cp .env.example .env
  echo "Please update .env with production values!"
fi

# Log directory
sudo mkdir -p /var/log/owlivion-sync
sudo chown $VPS_USER:$VPS_USER /var/log/owlivion-sync

# PM2 setup
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  sudo npm install -g pm2
fi

# Reload or start application
if pm2 list | grep -q "owlivion-sync"; then
  echo "Reloading application..."
  pm2 reload deployment/ecosystem.config.js --env $ENVIRONMENT
else
  echo "Starting application..."
  pm2 start deployment/ecosystem.config.js --env $ENVIRONMENT
fi

# Save PM2 configuration
pm2 save

# Setup PM2 startup script (first time only)
if ! sudo systemctl is-enabled pm2-$VPS_USER &> /dev/null; then
  echo "Setting up PM2 startup..."
  sudo pm2 startup systemd -u $VPS_USER --hp /home/$VPS_USER
fi

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="

# Show status
pm2 status
pm2 logs owlivion-sync --lines 20

ENDSSH

# Post-deployment checks
echo ""
echo -e "${BLUE}Running post-deployment checks...${NC}"

# Health check
sleep 5
echo "Testing health endpoint..."
if curl -f -s "http://$VPS_HOST:3000/api/v1/health" > /dev/null; then
  echo -e "${GREEN}✓ Server is responding${NC}"
else
  echo -e "${YELLOW}Warning: Health check failed${NC}"
  echo "Server might still be starting up..."
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}Deployment Summary${NC}"
echo "========================================="
echo ""
echo "Server URL: https://sync.owlivion.com"
echo "API Base: https://sync.owlivion.com/api/v1"
echo "Health Check: https://sync.owlivion.com/api/v1/health"
echo ""
echo "Useful commands:"
echo "  View logs: ssh $VPS_USER@$VPS_HOST 'pm2 logs owlivion-sync'"
echo "  Restart: ssh $VPS_USER@$VPS_HOST 'pm2 restart owlivion-sync'"
echo "  Status: ssh $VPS_USER@$VPS_HOST 'pm2 status'"
echo "  Monitor: ssh $VPS_USER@$VPS_HOST 'pm2 monit'"
echo ""
