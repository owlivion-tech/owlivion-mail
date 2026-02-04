# SSL Certificate Setup Guide

## Overview
This guide covers SSL/TLS certificate configuration for Owlivion Sync Server using Let's Encrypt and certbot.

## Prerequisites

### 1. DNS Configuration
**CRITICAL:** Domain must point to your VPS before running the setup script.

```bash
# Verify DNS resolution
dig +short sync.owlivion.com @8.8.8.8
# Should return: 31.97.216.36
```

**DNS Record Required:**
```
Type: A
Name: sync.owlivion.com
Value: 31.97.216.36
TTL: 3600 (or default)
```

### 2. Firewall Ports
Ensure ports 80 (HTTP) and 443 (HTTPS) are open:

```bash
# On VPS, check firewall status
ssh owlivion@31.97.216.36 'sudo ufw status'

# If needed, open ports (will be done in Task #3)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 3. Application Running
Verify the Node.js application is running:

```bash
# Check PM2 status
ssh owlivion@31.97.216.36 'pm2 status'

# Test health endpoint
curl http://31.97.216.36:3000/api/v1/health
```

## Setup Process

### Step 1: Update Email Address
Edit `setup-ssl.sh` and update the email address for Let's Encrypt notifications:

```bash
EMAIL="admin@owlivion.com"  # Line 18
```

### Step 2: Run Setup Script
From the repository root:

```bash
cd owlivion-sync-server/deployment
./setup-ssl.sh
```

The script will:
1. ✓ Test SSH connection
2. ✓ Verify DNS resolution
3. ✓ Install certbot and dependencies
4. ✓ Create temporary Nginx configuration
5. ✓ Obtain SSL certificate from Let's Encrypt
6. ✓ Deploy production Nginx configuration with SSL
7. ✓ Configure automatic certificate renewal
8. ✓ Verify HTTPS is working

### Step 3: Verification
After setup completes, test the following:

```bash
# Test HTTPS endpoint
curl https://sync.owlivion.com/api/v1/health

# Test HTTP redirect
curl -I http://sync.owlivion.com/

# Check certificate details
ssh owlivion@31.97.216.36 'sudo certbot certificates'
```

## Certificate Management

### View Certificate Information
```bash
ssh owlivion@31.97.216.36 'sudo certbot certificates'
```

### Manual Renewal (if needed)
```bash
ssh owlivion@31.97.216.36 'sudo certbot renew'
```

### Automatic Renewal
Certbot automatically sets up a systemd timer for renewal:

```bash
# Check renewal timer status
ssh owlivion@31.97.216.36 'sudo systemctl status certbot.timer'

# View renewal logs
ssh owlivion@31.97.216.36 'sudo journalctl -u certbot.timer'
```

Certificates are automatically renewed 30 days before expiration.

## Troubleshooting

### Issue: DNS Not Resolving
**Symptom:** Script warns "Domain resolves to wrong IP"

**Solution:**
1. Check DNS records in your domain registrar
2. Wait for DNS propagation (can take up to 24-48 hours)
3. Verify with: `dig +short sync.owlivion.com @8.8.8.8`

### Issue: Port 80/443 Blocked
**Symptom:** certbot fails with "connection refused"

**Solution:**
```bash
# On VPS, check if ports are open
ssh owlivion@31.97.216.36 'sudo netstat -tlnp | grep -E ":80|:443"'

# Check firewall
ssh owlivion@31.97.216.36 'sudo ufw status'

# Open ports
ssh owlivion@31.97.216.36 'sudo ufw allow 80/tcp && sudo ufw allow 443/tcp'
```

### Issue: Certificate Validation Failed
**Symptom:** certbot fails with "validation failed"

**Solution:**
1. Ensure webroot directory exists: `/var/www/html/.well-known/acme-challenge/`
2. Check Nginx is serving the challenge directory
3. Verify no other service is using port 80

```bash
# Check what's listening on port 80
ssh owlivion@31.97.216.36 'sudo lsof -i :80'

# Test ACME challenge directory
ssh owlivion@31.97.216.36 'echo "test" | sudo tee /var/www/html/.well-known/acme-challenge/test.txt'
curl http://sync.owlivion.com/.well-known/acme-challenge/test.txt
```

### Issue: Nginx Configuration Error
**Symptom:** nginx -t fails

**Solution:**
```bash
# View detailed error
ssh owlivion@31.97.216.36 'sudo nginx -t'

# Check nginx error log
ssh owlivion@31.97.216.36 'sudo tail -50 /var/log/nginx/error.log'

# Restore backup if needed
ssh owlivion@31.97.216.36 'sudo cp /etc/nginx/sites-available/owlivion-sync.backup.* /etc/nginx/sites-available/owlivion-sync'
```

## Security Testing

### SSL Labs Test
Test your SSL configuration:
```
https://www.ssllabs.com/ssltest/analyze.html?d=sync.owlivion.com
```

Target rating: **A or A+**

### Mozilla Observatory
Security headers test:
```
https://observatory.mozilla.org/analyze/sync.owlivion.com
```

### Manual Security Checks
```bash
# Test TLS versions
nmap --script ssl-enum-ciphers -p 443 sync.owlivion.com

# Test security headers
curl -I https://sync.owlivion.com | grep -E 'Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options'

# Test certificate chain
openssl s_client -connect sync.owlivion.com:443 -showcerts
```

## Nginx Configuration

### Current Configuration
The production Nginx configuration includes:
- ✓ HTTP to HTTPS redirect (301)
- ✓ TLS 1.2 and 1.3 only
- ✓ Modern cipher suite (Mozilla recommendations)
- ✓ Security headers (HSTS, X-Frame-Options, etc.)
- ✓ Rate limiting for auth endpoints (5 requests/minute)
- ✓ Reverse proxy to Node.js (localhost:3000)
- ✓ 20MB client body size limit
- ✓ OCSP stapling

### Configuration Files
- Config: `/etc/nginx/sites-available/owlivion-sync`
- Enabled: `/etc/nginx/sites-enabled/owlivion-sync`
- Logs: `/var/log/nginx/owlivion-sync-*.log`

### Reload Configuration
```bash
# Test configuration
ssh owlivion@31.97.216.36 'sudo nginx -t'

# Reload nginx
ssh owlivion@31.97.216.36 'sudo systemctl reload nginx'
```

## Certificate Renewal Process

### Automatic Renewal
Certbot systemd timer runs twice daily and renews certificates within 30 days of expiration.

### Post-Renewal Hooks
The Nginx reload hook is automatically configured by certbot-nginx plugin.

### Testing Renewal
```bash
# Dry run (doesn't actually renew)
ssh owlivion@31.97.216.36 'sudo certbot renew --dry-run'

# Force renewal (testing only, don't use in production)
ssh owlivion@31.97.216.36 'sudo certbot renew --force-renewal'
```

## Files and Locations

### Certificate Files
```
/etc/letsencrypt/live/sync.owlivion.com/
├── fullchain.pem      → SSL certificate + intermediate chain
├── privkey.pem        → Private key
├── cert.pem           → Certificate only
└── chain.pem          → Intermediate chain only
```

### Nginx Files
```
/etc/nginx/
├── sites-available/owlivion-sync    → Main config
├── sites-enabled/owlivion-sync      → Symlink to config
└── /var/log/nginx/
    ├── owlivion-sync-access.log
    └── owlivion-sync-error.log
```

### Certbot Files
```
/etc/letsencrypt/
├── live/sync.owlivion.com/      → Active certificates (symlinks)
├── archive/sync.owlivion.com/   → All certificate versions
├── renewal/                     → Renewal configuration
└── renewal-hooks/              → Post-renewal scripts
```

## Next Steps

After SSL setup is complete:
1. ✓ Verify HTTPS is working
2. Run SSL Labs test to confirm A/A+ rating
3. Proceed to Task #3: Firewall Configuration (ufw)
4. Update TODO.md to mark Task #2 as complete

## Support

### Useful Commands
```bash
# Check certificate expiration
ssh owlivion@31.97.216.36 'sudo certbot certificates'

# View renewal timer
ssh owlivion@31.97.216.36 'sudo systemctl list-timers certbot*'

# Test Nginx config
ssh owlivion@31.97.216.36 'sudo nginx -t'

# View Nginx status
ssh owlivion@31.97.216.36 'sudo systemctl status nginx'

# Restart Nginx
ssh owlivion@31.97.216.36 'sudo systemctl restart nginx'
```

### Logs
```bash
# Certbot logs
ssh owlivion@31.97.216.36 'sudo tail -100 /var/log/letsencrypt/letsencrypt.log'

# Nginx access logs
ssh owlivion@31.97.216.36 'sudo tail -100 /var/log/nginx/owlivion-sync-access.log'

# Nginx error logs
ssh owlivion@31.97.216.36 'sudo tail -100 /var/log/nginx/owlivion-sync-error.log'
```

## References

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
