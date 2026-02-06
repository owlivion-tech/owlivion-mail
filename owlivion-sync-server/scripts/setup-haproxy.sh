#!/bin/bash

################################################################################
# Owlivion Sync Server - HAProxy Load Balancer Setup
#
# This script installs and configures HAProxy for load balancing
# multiple Node.js application instances.
#
# Features:
# - Layer 7 HTTP/HTTPS load balancing
# - Health checks
# - Sticky sessions (JWT-based)
# - SSL termination
# - Stats page
#
# Usage: sudo bash scripts/setup-haproxy.sh
################################################################################

set -e  # Exit on error

echo "================================================"
echo "HAProxy Load Balancer Setup"
echo "================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

echo "📦 Step 1: Installing HAProxy..."

apt-get update
apt-get install -y haproxy

echo "✅ HAProxy installed"

################################################################################
# SSL CERTIFICATE PREPARATION
################################################################################

echo ""
echo "🔐 Step 2: Preparing SSL certificate for HAProxy..."

# HAProxy requires combined cert+key in one file
SSL_CERT_DIR="/etc/letsencrypt/live/owlivion.com"
HAPROXY_CERT="${SSL_CERT_DIR}/haproxy.pem"

if [ -f "${SSL_CERT_DIR}/fullchain.pem" ] && [ -f "${SSL_CERT_DIR}/privkey.pem" ]; then
  cat "${SSL_CERT_DIR}/fullchain.pem" \
      "${SSL_CERT_DIR}/privkey.pem" \
      > "${HAPROXY_CERT}"
  chmod 600 "${HAPROXY_CERT}"
  echo "✅ SSL certificate prepared"
else
  echo "⚠️  WARNING: SSL certificates not found!"
  echo "   Please run certbot first or adjust SSL_CERT_DIR variable"
  echo "   Continuing without SSL..."
fi

################################################################################
# HAPROXY CONFIGURATION
################################################################################

echo ""
echo "⚙️  Step 3: Configuring HAProxy..."

# Backup existing config
if [ -f /etc/haproxy/haproxy.cfg ]; then
  cp /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg.backup.$(date +%Y%m%d_%H%M%S)
  echo "   Backed up existing config"
fi

# Create new config
cat > /etc/haproxy/haproxy.cfg <<'HAPROXY_CONFIG'
global
    log /dev/log local0
    log /dev/log local1 notice
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin expose-fd listeners
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

    # SSL Settings
    ssl-default-bind-ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305
    ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets

    # Performance tuning
    maxconn 4096
    tune.ssl.default-dh-param 2048

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    option  http-server-close
    option  forwardfor except 127.0.0.0/8
    option  redispatch
    retries 3
    timeout connect 5000
    timeout client  50000
    timeout server  50000
    timeout http-keep-alive 10000
    timeout http-request 10000
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

# ============================================================================
# STATS PAGE
# ============================================================================

frontend stats
    bind *:8404
    mode http
    stats enable
    stats uri /stats
    stats refresh 10s
    stats auth admin:CHANGE_THIS_PASSWORD
    stats admin if TRUE

# ============================================================================
# FRONTEND - HTTP (Redirect to HTTPS)
# ============================================================================

frontend http_frontend
    bind *:80
    mode http

    # Redirect all HTTP to HTTPS
    redirect scheme https code 301 if !{ ssl_fc }

# ============================================================================
# FRONTEND - HTTPS
# ============================================================================

frontend https_frontend
    bind *:443 ssl crt /etc/letsencrypt/live/owlivion.com/haproxy.pem
    mode http

    # HSTS Header (31536000 seconds = 1 year)
    http-response set-header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

    # Security Headers
    http-response set-header X-Frame-Options "DENY"
    http-response set-header X-Content-Type-Options "nosniff"
    http-response set-header X-XSS-Protection "1; mode=block"

    # Rate limiting (basic)
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny deny_status 429 if { sc_http_req_rate(0) gt 100 }

    # ACL for API paths
    acl is_api path_beg /api/
    acl is_metrics path_beg /metrics

    # Use backend
    use_backend sync_servers if is_api
    use_backend sync_servers if is_metrics
    default_backend sync_servers

# ============================================================================
# BACKEND - Node.js Application Servers
# ============================================================================

backend sync_servers
    mode http
    balance roundrobin
    option httpchk GET /api/v1/health
    http-check expect status 200

    # Sticky sessions (based on source IP)
    # For JWT-based sticky sessions, use cookie instead
    # cookie SERVER insert indirect nocache

    # Stick to same server based on source IP
    stick-table type ip size 200k expire 30m
    stick on src

    # Server list
    # Add more servers as you scale horizontally
    server node1 localhost:3000 check cookie node1 weight 100 maxconn 500
    # server node2 10.0.0.2:3000 check cookie node2 weight 100 maxconn 500
    # server node3 10.0.0.3:3000 check cookie node3 weight 100 maxconn 500

    # Health check settings
    http-check send meth GET uri /api/v1/health ver HTTP/1.1 hdr Host owlivion.com
    http-check expect status 200

    # Timeout settings
    timeout server 60000
    timeout connect 5000

# ============================================================================
# CUSTOM ERROR PAGES (Optional)
# ============================================================================

# Listen for custom error pages
# listen custom_errors
#     bind *:8080
#     errorfile 503 /etc/haproxy/errors/503-custom.http
HAPROXY_CONFIG

echo "✅ HAProxy configured"

################################################################################
# SSL AUTO-RENEWAL HOOK
################################################################################

echo ""
echo "🔄 Step 4: Setting up SSL auto-renewal hook..."

mkdir -p /etc/letsencrypt/renewal-hooks/post

cat > /etc/letsencrypt/renewal-hooks/post/haproxy-reload.sh <<'RENEWAL_HOOK'
#!/bin/bash
# HAProxy SSL Certificate Renewal Hook
# This script runs after certbot renews certificates

SSL_CERT_DIR="/etc/letsencrypt/live/owlivion.com"
HAPROXY_CERT="${SSL_CERT_DIR}/haproxy.pem"

# Combine cert and key
cat "${SSL_CERT_DIR}/fullchain.pem" \
    "${SSL_CERT_DIR}/privkey.pem" \
    > "${HAPROXY_CERT}"

chmod 600 "${HAPROXY_CERT}"

# Reload HAProxy
systemctl reload haproxy

echo "$(date): HAProxy SSL certificate renewed and reloaded" >> /var/log/haproxy-ssl-renewal.log
RENEWAL_HOOK

chmod +x /etc/letsencrypt/renewal-hooks/post/haproxy-reload.sh

echo "✅ SSL auto-renewal hook created"

################################################################################
# ENABLE AND START HAPROXY
################################################################################

echo ""
echo "🚀 Step 5: Enabling and starting HAProxy..."

systemctl enable haproxy
systemctl restart haproxy

sleep 2

echo "✅ HAProxy started"

################################################################################
# VERIFY INSTALLATION
################################################################################

echo ""
echo "🔍 Step 6: Verifying installation..."

if systemctl is-active --quiet haproxy; then
  echo "✅ HAProxy is running"
else
  echo "❌ HAProxy failed to start"
  echo "   Check logs: journalctl -u haproxy -n 50"
  exit 1
fi

echo ""
echo "Service Status:"
echo "---------------"
systemctl status haproxy --no-pager | head -10

################################################################################
# FIREWALL CONFIGURATION
################################################################################

echo ""
echo "🔥 Step 7: Configuring firewall..."

# Allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow stats page (restrict to your IP for security)
echo ""
echo "⚠️  HAProxy stats page is on port 8404"
echo "   To allow access from your IP:"
echo "   sudo ufw allow from YOUR_IP to any port 8404 proto tcp"

################################################################################
# POST-INSTALLATION STEPS
################################################################################

echo ""
echo "================================================"
echo "✅ HAProxy Installation Complete!"
echo "================================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Update HAProxy stats password:"
echo "   - Edit /etc/haproxy/haproxy.cfg"
echo "   - Change 'CHANGE_THIS_PASSWORD' in stats section"
echo "   - Run: sudo systemctl reload haproxy"
echo ""
echo "2. Access HAProxy stats page:"
echo "   - URL: http://YOUR_SERVER_IP:8404/stats"
echo "   - Username: admin"
echo "   - Password: (see config file)"
echo ""
echo "3. Test load balancing:"
echo "   - curl -k https://owlivion.com/api/v1/health"
echo "   - Check stats page for traffic distribution"
echo ""
echo "4. Add more backend servers (optional):"
echo "   - Edit /etc/haproxy/haproxy.cfg"
echo "   - Uncomment and configure node2, node3, etc."
echo "   - Run: sudo systemctl reload haproxy"
echo ""
echo "5. Monitor logs:"
echo "   - tail -f /var/log/haproxy.log"
echo "   - journalctl -u haproxy -f"
echo ""
echo "6. Update Nginx:"
echo "   - Stop Nginx reverse proxy (if running)"
echo "   - HAProxy now handles SSL termination and load balancing"
echo ""
echo "================================================"
echo ""
echo "📊 Health Check Endpoint: /api/v1/health"
echo "🔐 SSL Certificate: /etc/letsencrypt/live/owlivion.com/haproxy.pem"
echo "📈 Stats Page: http://localhost:8404/stats"
echo ""
echo "================================================"
