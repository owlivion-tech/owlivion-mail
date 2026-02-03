# Owlivion Sync Server - Deployment Guide

Production deployment guide for VPS (31.97.216.36).

## Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: Minimum 20GB free space
- **CPU**: 2+ cores recommended

### Local Requirements
- SSH access to VPS
- SSH key added to VPS
- Git installed

## Quick Start

### 1. Initial VPS Setup

```bash
# SSH into VPS
ssh owlivion@31.97.216.36

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    curl \
    git \
    build-essential \
    nginx \
    postgresql \
    postgresql-contrib \
    ufw
```

### 2. Install Node.js

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### 3. Setup Database

```bash
# Clone repository
git clone https://github.com/owlivion/owlivion-sync-server.git
cd owlivion-sync-server

# Run database setup script
sudo bash deployment/setup-database.sh
```

This will:
- ✅ Install PostgreSQL (if not installed)
- ✅ Create database and user
- ✅ Apply schema from `schema.sql`
- ✅ Generate `.env` file with secure JWT secrets

### 4. Configure Environment

```bash
# Edit .env file
nano .env

# Update these values:
# - DB_PASSWORD (use strong password)
# - JWT_SECRET (auto-generated, verify it's present)
# - JWT_REFRESH_SECRET (auto-generated, verify it's present)
# - CORS_ORIGIN (set to your client URL or *)
```

### 5. Install Dependencies

```bash
# Install Node.js dependencies
npm install --production
```

### 6. Setup PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start deployment/ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u owlivion --hp /home/owlivion
# Run the command that PM2 outputs

# Verify it's running
pm2 status
pm2 logs owlivion-sync
```

### 7. Configure Nginx

```bash
# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Copy nginx configuration
sudo cp deployment/nginx.conf /etc/nginx/sites-available/owlivion-sync

# Create symlink
sudo ln -s /etc/nginx/sites-available/owlivion-sync /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d sync.owlivion.com

# Reload nginx
sudo systemctl reload nginx
```

### 8. Configure Firewall

```bash
# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 9. Verify Deployment

```bash
# Test local endpoint
curl http://localhost:3000/api/v1/health

# Test through nginx
curl https://sync.owlivion.com/api/v1/health

# Check PM2 status
pm2 status

# View logs
pm2 logs owlivion-sync --lines 50
```

## Automated Deployment

### Deploy Script

Use the automated deployment script from your local machine:

```bash
# From your local machine
cd owlivion-sync-server/deployment

# Deploy to production
./deploy.sh production

# This will:
# - Connect to VPS via SSH
# - Pull latest code
# - Install dependencies
# - Run migrations
# - Reload PM2
```

### Manual Deployment

```bash
# SSH into VPS
ssh owlivion@31.97.216.36

# Navigate to app directory
cd /opt/owlivion-sync-server

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Reload application
pm2 reload owlivion-sync
```

## Backup & Restore

### Automated Backups

```bash
# Create full backup (database + logs + app)
sudo bash deployment/backup.sh full

# Database only
sudo bash deployment/backup.sh database

# Logs only
sudo bash deployment/backup.sh logs

# List backups
sudo bash deployment/backup.sh list
```

### Schedule Automatic Backups

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/owlivion-sync-server/deployment/backup.sh full >> /var/log/owlivion-sync-backup.log 2>&1
```

### Restore from Backup

```bash
# List available backups
sudo bash deployment/backup.sh list

# Restore database
sudo bash deployment/backup.sh restore /var/backups/owlivion-sync/db_owlivion_sync_20240101_020000.sql.gz
```

## Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs owlivion-sync

# View last 100 lines
pm2 logs owlivion-sync --lines 100

# Error logs only
pm2 logs owlivion-sync --err

# Application info
pm2 info owlivion-sync
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/owlivion-sync-access.log

# Error logs
sudo tail -f /var/log/nginx/owlivion-sync-error.log
```

### Database Monitoring

```bash
# Connect to database
psql -U owlivion -d owlivion_sync

# Check active connections
SELECT * FROM pg_stat_activity;

# Check database size
SELECT pg_size_pretty(pg_database_size('owlivion_sync'));

# Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### System Resources

```bash
# CPU usage
top -bn1 | grep "Cpu(s)"

# Memory usage
free -h

# Disk usage
df -h

# Network connections
netstat -tulpn | grep :3000
```

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs owlivion-sync --err

# Check if port is in use
sudo lsof -i :3000

# Restart application
pm2 restart owlivion-sync

# Delete and restart
pm2 delete owlivion-sync
pm2 start deployment/ecosystem.config.js --env production
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U owlivion -d owlivion_sync -c "SELECT 1"

# Check .env file has correct credentials
cat .env | grep DB_

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Nginx Issues

```bash
# Check nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Test renewal (dry run)
sudo certbot renew --dry-run
```

### Out of Memory

```bash
# Check memory usage
pm2 info owlivion-sync

# Increase max_memory_restart in ecosystem.config.js
nano deployment/ecosystem.config.js
# Change: max_memory_restart: '500M' to '1G'

# Reload PM2
pm2 reload owlivion-sync
```

## Security Checklist

- [ ] Strong database password set
- [ ] JWT secrets are unique and secure (32+ characters)
- [ ] Firewall (ufw) enabled with only necessary ports
- [ ] SSL/TLS certificate installed (Let's Encrypt)
- [ ] Regular backups scheduled (cron)
- [ ] Nginx security headers configured
- [ ] Rate limiting enabled in nginx
- [ ] PM2 auto-restart on crashes
- [ ] System updates scheduled
- [ ] Monitoring alerts configured

## Maintenance

### Update Application

```bash
# SSH into VPS
ssh owlivion@31.97.216.36
cd /opt/owlivion-sync-server

# Backup before update
sudo bash deployment/backup.sh full

# Update code
git pull origin main

# Update dependencies
npm install --production

# Reload application (zero-downtime)
pm2 reload owlivion-sync
```

### Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y

# Reboot if kernel updated
sudo reboot
```

### Rotate Logs

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Performance Tuning

### PM2 Cluster Mode

Edit `deployment/ecosystem.config.js`:
```javascript
instances: 'max', // Use all CPU cores
exec_mode: 'cluster',
```

### Database Optimization

```sql
-- Analyze tables
ANALYZE;

-- Vacuum
VACUUM ANALYZE;

-- Add indexes (if needed)
CREATE INDEX idx_sync_data_user_id ON sync_data(user_id);
CREATE INDEX idx_devices_user_id ON devices(user_id);
```

### Nginx Caching

Add to nginx.conf:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m;

location /api/v1/sync/status {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_pass http://localhost:3000;
}
```

## Useful Commands

```bash
# Quick restart
pm2 restart owlivion-sync

# View real-time logs
pm2 logs owlivion-sync --raw

# Monitor resources
pm2 monit

# Flush logs
pm2 flush owlivion-sync

# Reload nginx
sudo systemctl reload nginx

# Test API
curl -X POST https://sync.owlivion.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","device_id":"test-device","device_name":"Test","platform":"linux"}'
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/owlivion/owlivion-sync-server/issues
- Email: support@owlivion.com
- Documentation: https://docs.owlivion.com
