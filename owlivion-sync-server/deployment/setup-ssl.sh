#!/usr/bin/env bash
#
# SSL Certificate Setup Script for Owlivion Sync Server
# Configures Let's Encrypt SSL certificate with certbot
#
# Prerequisites:
#   - Domain sync.owlivion.com must point to 31.97.216.36
#   - VPS must be accessible via SSH
#   - Ports 80 and 443 must be open
#
# Usage: ./setup-ssl.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VPS_HOST="31.97.216.36"
VPS_USER="owlivion"
DOMAIN="sync.owlivion.com"
APP_DIR="/opt/owlivion-sync-server"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available/owlivion-sync"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled/owlivion-sync"
EMAIL="admin@owlivion.com"  # Update with your email for Let's Encrypt notifications

echo ""
echo "========================================="
echo "SSL Certificate Setup - Owlivion Sync"
echo "========================================="
echo ""
echo "Domain: $DOMAIN"
echo "VPS: $VPS_USER@$VPS_HOST"
echo "Email: $EMAIL"
echo ""

# Pre-flight checks
echo -e "${BLUE}Running pre-flight checks...${NC}"

# Check SSH connection
echo -n "Checking SSH connection... "
if ! ssh -q "$VPS_USER@$VPS_HOST" exit 2>/dev/null; then
  echo -e "${RED}FAILED${NC}"
  echo -e "${RED}Error: Cannot connect to VPS${NC}"
  echo "Please ensure SSH key is added: ssh-add ~/.ssh/id_rsa"
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# Check DNS resolution
echo -n "Checking DNS resolution for $DOMAIN... "
RESOLVED_IP=$(dig +short "$DOMAIN" @8.8.8.8 | tail -n1)
if [ "$RESOLVED_IP" != "$VPS_HOST" ]; then
  echo -e "${YELLOW}WARNING${NC}"
  echo -e "${YELLOW}Domain $DOMAIN resolves to $RESOLVED_IP instead of $VPS_HOST${NC}"
  echo -e "${YELLOW}SSL certificate issuance may fail!${NC}"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
  fi
else
  echo -e "${GREEN}OK${NC}"
fi

# Confirmation
echo ""
read -p "Proceed with SSL certificate setup? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Setup cancelled."
  exit 0
fi

# Main SSL setup via SSH
echo ""
echo -e "${BLUE}Setting up SSL certificate on VPS...${NC}"

ssh "$VPS_USER@$VPS_HOST" <<ENDSSH
set -e

echo ""
echo "========================================="
echo "SSL Setup on VPS"
echo "========================================="
echo ""

# Step 1: Install required packages
echo -e "${BLUE}[1/8] Installing certbot and dependencies...${NC}"
sudo apt-get update -qq
sudo apt-get install -y certbot python3-certbot-nginx

# Step 2: Stop any conflicting services
echo -e "${BLUE}[2/8] Checking for conflicting services...${NC}"
if sudo systemctl is-active nginx &>/dev/null; then
  echo "Stopping Nginx temporarily..."
  sudo systemctl stop nginx
fi

# Step 3: Backup existing nginx config (if any)
echo -e "${BLUE}[3/8] Backing up existing Nginx configuration...${NC}"
if [ -f "$NGINX_SITES_AVAILABLE" ]; then
  sudo cp "$NGINX_SITES_AVAILABLE" "${NGINX_SITES_AVAILABLE}.backup.\$(date +%Y%m%d_%H%M%S)"
  echo "Backup created"
fi

# Step 4: Create temporary nginx config for ACME challenge
echo -e "${BLUE}[4/8] Creating temporary Nginx configuration...${NC}"
sudo tee "$NGINX_SITES_AVAILABLE" > /dev/null <<'NGINXCONF'
# Temporary config for ACME challenge
server {
    listen 80;
    listen [::]:80;
    server_name sync.owlivion.com;

    # ACME challenge directory
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Proxy other traffic to Node.js (for health checks during setup)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXCONF

# Step 5: Enable site and test config
echo -e "${BLUE}[5/8] Enabling Nginx site configuration...${NC}"
sudo ln -sf "$NGINX_SITES_AVAILABLE" "$NGINX_SITES_ENABLED"
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
if ! sudo nginx -t; then
  echo -e "${RED}Error: Nginx configuration test failed${NC}"
  exit 1
fi

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Ensure webroot exists
sudo mkdir -p /var/www/html
sudo chown -R www-data:www-data /var/www/html

# Step 6: Obtain SSL certificate
echo ""
echo -e "${BLUE}[6/8] Obtaining SSL certificate from Let's Encrypt...${NC}"
echo "This may take a minute..."
echo ""

if sudo certbot certonly --webroot \
  -w /var/www/html \
  -d $DOMAIN \
  --email $EMAIL \
  --agree-tos \
  --non-interactive \
  --verbose; then
  echo ""
  echo -e "${GREEN}✓ SSL certificate obtained successfully!${NC}"
else
  echo ""
  echo -e "${RED}Error: Failed to obtain SSL certificate${NC}"
  echo "Please check the certbot logs above for details."
  exit 1
fi

# Step 7: Deploy production nginx config with SSL
echo ""
echo -e "${BLUE}[7/8] Deploying production Nginx configuration...${NC}"

# Copy production config from repository
if [ -f "$APP_DIR/deployment/nginx.conf" ]; then
  sudo cp "$APP_DIR/deployment/nginx.conf" "$NGINX_SITES_AVAILABLE"
else
  echo -e "${YELLOW}Warning: Production nginx.conf not found in repository${NC}"
  echo "Using generated configuration..."

  # Generate production config
  sudo tee "$NGINX_SITES_AVAILABLE" > /dev/null <<'NGINXPROD'
# Production Nginx Configuration for Owlivion Sync Server

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=auth_limit:10m rate=5r/m;
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=100r/m;

# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name sync.owlivion.com;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sync.owlivion.com;

    # SSL Certificate
    ssl_certificate /etc/letsencrypt/live/sync.owlivion.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sync.owlivion.com/privkey.pem;

    # SSL Configuration (Mozilla Modern)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/owlivion-sync-access.log;
    error_log /var/log/nginx/owlivion-sync-error.log warn;

    # Client body size limit
    client_max_body_size 20M;

    # API endpoints
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Root endpoint
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Rate limiting for auth endpoints
    location /api/v1/auth {
        limit_req zone=auth_limit burst=10 nodelay;
        limit_req_status 429;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check endpoint
    location = /api/v1/health {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        access_log off;
    }
}
NGINXPROD
fi

# Test and reload nginx
if ! sudo nginx -t; then
  echo -e "${RED}Error: Nginx configuration test failed${NC}"
  exit 1
fi

sudo systemctl reload nginx

# Step 8: Setup automatic certificate renewal
echo ""
echo -e "${BLUE}[8/8] Setting up automatic certificate renewal...${NC}"

# Test renewal process
echo "Testing renewal process..."
if sudo certbot renew --dry-run; then
  echo -e "${GREEN}✓ Certificate renewal test passed${NC}"
else
  echo -e "${YELLOW}Warning: Renewal test had issues (may be OK if cert is new)${NC}"
fi

# Certbot creates a systemd timer automatically
# Verify it's enabled
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo ""
echo "========================================="
echo -e "${GREEN}SSL Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Certificate details:"
sudo certbot certificates -d $DOMAIN

ENDSSH

# Post-setup verification
echo ""
echo -e "${BLUE}Running post-setup verification...${NC}"
echo ""

# Test HTTPS endpoint
sleep 3
echo "Testing HTTPS endpoint..."
if curl -fsSL "https://$DOMAIN/api/v1/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ HTTPS is working!${NC}"
else
  echo -e "${YELLOW}Warning: HTTPS health check failed${NC}"
  echo "The certificate may still be propagating..."
fi

# Test HTTP redirect
echo "Testing HTTP to HTTPS redirect..."
REDIRECT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/" 2>/dev/null || echo "000")
if [ "$REDIRECT_STATUS" = "301" ] || [ "$REDIRECT_STATUS" = "302" ]; then
  echo -e "${GREEN}✓ HTTP to HTTPS redirect is working!${NC}"
else
  echo -e "${YELLOW}Warning: HTTP redirect returned status $REDIRECT_STATUS${NC}"
fi

# SSL Labs test link
echo ""
echo "========================================="
echo -e "${GREEN}Setup Summary${NC}"
echo "========================================="
echo ""
echo "✓ SSL certificate obtained for: $DOMAIN"
echo "✓ Nginx configured with HTTPS"
echo "✓ Automatic renewal enabled"
echo ""
echo "URLs:"
echo "  • HTTPS: https://$DOMAIN"
echo "  • API: https://$DOMAIN/api/v1"
echo "  • Health: https://$DOMAIN/api/v1/health"
echo ""
echo "Certificate management:"
echo "  • Check status: ssh $VPS_USER@$VPS_HOST 'sudo certbot certificates'"
echo "  • Renew manually: ssh $VPS_USER@$VPS_HOST 'sudo certbot renew'"
echo "  • View logs: ssh $VPS_USER@$VPS_HOST 'sudo journalctl -u certbot.timer'"
echo ""
echo "Security testing:"
echo "  • SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo "  • Mozilla Observatory: https://observatory.mozilla.org/analyze/$DOMAIN"
echo ""
echo -e "${GREEN}SSL setup completed successfully!${NC}"
echo ""
