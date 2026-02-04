# Owlivion Sync Server - Monitoring Setup Guide

Complete guide for setting up production monitoring, log rotation, and automated backups.

## Quick Start

### 1. Automated Setup (Recommended)

```bash
# SSH to production server
ssh root@31.97.216.36

# Navigate to deployment directory
cd /opt/owlivion-sync-server/deployment

# Run monitoring setup (with optional email alerts)
sudo ./setup-monitoring.sh --email your@email.com
```

This script will automatically:
- ✅ Install logrotate config for PM2 logs
- ✅ Setup health check monitoring (every 5 minutes)
- ✅ Configure automated backups (daily at 2 AM)
- ✅ Create cron jobs for automation

---

## What Gets Installed

### 1. Log Rotation (Logrotate)

**Config:** `/etc/logrotate.d/owlivion-pm2`

PM2 logs are automatically rotated:
- **Frequency:** Daily
- **Retention:** 30 days
- **Compression:** gzip (after 1 day)
- **Location:** `/root/.pm2/logs/*.log`

**Manual commands:**
```bash
# Test logrotate config
sudo logrotate -d /etc/logrotate.d/owlivion-pm2

# Force rotation
sudo logrotate -f /etc/logrotate.d/owlivion-pm2

# View rotated logs
ls -lh /root/.pm2/logs/
```

---

### 2. Health Check Monitoring

**Script:** `/opt/owlivion-sync-server/deployment/healthcheck.sh`
**Log:** `/var/log/owlivion-health.log`
**Schedule:** Every 5 minutes (cron)

#### What it monitors:
- ✅ PostgreSQL service status
- ✅ PM2 process manager
- ✅ Nginx web server
- ✅ API health endpoint (https://owlivion.com/api/v1/health)
- ✅ Disk space usage (alert > 80%)
- ✅ Memory usage (alert > 90%)
- ✅ SSL certificate expiry (alert < 7 days)

#### Auto-restart:
If a service fails, the script automatically attempts to restart it.

**Manual commands:**
```bash
# Run health check with verbose output
sudo /opt/owlivion-sync-server/deployment/healthcheck.sh --verbose

# View health log
sudo tail -f /var/log/owlivion-health.log

# Check last 50 lines
sudo tail -n 50 /var/log/owlivion-health.log
```

---

### 3. Automated Backups

**Script:** `/opt/owlivion-sync-server/deployment/backup.sh`
**Location:** `/var/backups/owlivion-sync/`
**Schedule:**
- Daily database backup at 2 AM
- Weekly full backup on Sunday at 3 AM

#### Backup types:
- **Database:** PostgreSQL dump (compressed)
- **Logs:** PM2 logs archive
- **Application:** App files (excluding node_modules)

**Retention:** 30 days (automatic cleanup)

**Manual commands:**
```bash
# Create database backup
sudo /opt/owlivion-sync-server/deployment/backup.sh database

# Create full backup
sudo /opt/owlivion-sync-server/deployment/backup.sh full

# List all backups
sudo /opt/owlivion-sync-server/deployment/backup.sh list

# Restore from backup
sudo /opt/owlivion-sync-server/deployment/backup.sh restore /var/backups/owlivion-sync/db_owlivion_sync_20260204_020000.sql.gz
```

---

### 4. Cron Jobs

The following cron jobs are automatically configured:

```cron
# Health check every 5 minutes
*/5 * * * * /opt/owlivion-sync-server/deployment/healthcheck.sh >> /var/log/owlivion-health.log 2>&1

# Database backup daily at 2 AM
0 2 * * * /opt/owlivion-sync-server/deployment/backup.sh database >> /var/log/owlivion-backup.log 2>&1

# Full backup weekly on Sunday at 3 AM
0 3 * * 0 /opt/owlivion-sync-server/deployment/backup.sh full >> /var/log/owlivion-backup.log 2>&1
```

**View cron jobs:**
```bash
sudo crontab -l
```

---

## External Monitoring Setup

### 1. UptimeRobot (Uptime Monitoring)

UptimeRobot provides free external uptime monitoring.

#### Setup Steps:

1. **Create account:** https://uptimerobot.com/signUp

2. **Add new monitor:**
   - Type: HTTP(s)
   - URL: `https://owlivion.com/api/v1/health`
   - Friendly Name: `Owlivion API Health`
   - Monitoring Interval: 5 minutes
   - Monitor Timeout: 30 seconds

3. **Configure alerts:**
   - Alert Contacts: Add your email
   - Alert When: Down, SSL expires
   - Alert frequency: Immediately

4. **Optional: Public Status Page**
   - Create public status page: `https://stats.uptimerobot.com/YOUR_ID`
   - Share with users

#### Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-04T10:00:00.000Z",
  "uptime": 99.99
}
```

---

### 2. PM2 Plus (Process Monitoring)

PM2 Plus (formerly Keymetrics) provides real-time monitoring dashboard.

#### Setup Steps:

1. **Create account:** https://app.pm2.io/

2. **Link PM2 to dashboard:**
   ```bash
   # SSH to server
   ssh root@31.97.216.36

   # Link PM2 (you'll get public/private keys from PM2 Plus)
   pm2 link <secret_key> <public_key>
   ```

3. **Verify connection:**
   ```bash
   pm2 list
   # Should show "linked" status
   ```

4. **Dashboard features:**
   - Real-time metrics (CPU, memory, event loop)
   - HTTP latency monitoring
   - Error tracking
   - Process logs
   - Custom metrics

5. **Configure alerts:**
   - Go to Settings → Alerts
   - Add alert for:
     - Process restart
     - High CPU (> 80%)
     - High memory (> 90%)
     - Error rate spikes

#### Custom metrics (optional):
Add to your Node.js app:
```javascript
const pmx = require('@pm2/io');

pmx.metric({
  name: 'Sync Operations',
  value: () => getSyncCount()
});
```

---

## Email Alerts Configuration

### Option 1: Using mailutils (Simple)

```bash
# Install mailutils
sudo apt-get install mailutils

# Set alert email
export ALERT_EMAIL="your@email.com"
echo 'export ALERT_EMAIL="your@email.com"' >> /etc/environment

# Test email
echo "Test alert" | mail -s "Test" your@email.com
```

### Option 2: Using external SMTP (Gmail, SendGrid)

For production, use an SMTP service:

**Configure postfix with Gmail:**
```bash
sudo apt-get install postfix libsasl2-modules

# Edit /etc/postfix/main.cf
relayhost = [smtp.gmail.com]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt

# Add credentials
echo "[smtp.gmail.com]:587 your@gmail.com:app_password" > /etc/postfix/sasl_passwd
sudo chmod 600 /etc/postfix/sasl_passwd
sudo postmap /etc/postfix/sasl_passwd

# Restart postfix
sudo systemctl restart postfix
```

---

## Troubleshooting

### Health check fails

```bash
# Check service status
sudo systemctl status postgresql
sudo systemctl status nginx
pm2 status

# View error logs
sudo journalctl -xe
pm2 logs
```

### Backups not running

```bash
# Check cron service
sudo systemctl status cron

# Check cron logs
sudo grep CRON /var/log/syslog

# Test backup manually
sudo /opt/owlivion-sync-server/deployment/backup.sh database
```

### Logrotate not working

```bash
# Check logrotate status
sudo cat /var/lib/logrotate/status | grep owlivion

# Test logrotate
sudo logrotate -d /etc/logrotate.d/owlivion-pm2

# Force rotation
sudo logrotate -f /etc/logrotate.d/owlivion-pm2
```

### Disk space full

```bash
# Check disk usage
df -h

# Find large files
sudo du -h /var/log | sort -h | tail -20

# Clean old backups
sudo /opt/owlivion-sync-server/deployment/backup.sh list
sudo rm /var/backups/owlivion-sync/old_backup.sql.gz

# Clean Docker images (if using Docker)
docker system prune -a
```

---

## Maintenance Commands

### View system status

```bash
# Services
sudo systemctl status postgresql nginx
pm2 status

# Disk space
df -h

# Memory usage
free -h

# Recent health checks
sudo tail -20 /var/log/owlivion-health.log

# Recent backups
ls -lh /var/backups/owlivion-sync/
```

### Manual interventions

```bash
# Restart all services
sudo systemctl restart postgresql nginx
pm2 restart all

# Clear old logs
sudo find /root/.pm2/logs -name "*.log" -mtime +30 -delete

# Force backup
sudo /opt/owlivion-sync-server/deployment/backup.sh full

# Test email alerts
sudo /opt/owlivion-sync-server/deployment/healthcheck.sh --verbose --email your@email.com
```

---

## Security Considerations

1. **Backup encryption:** Consider encrypting backups before storing
2. **SMTP credentials:** Use app passwords, not real passwords
3. **Log rotation:** Ensure old logs are deleted (30 day retention)
4. **Firewall:** Backups should not be web-accessible
5. **Monitoring access:** Use read-only API keys for external monitors

---

## Checklist

- [ ] Run `setup-monitoring.sh` on production server
- [ ] Verify cron jobs: `sudo crontab -l`
- [ ] Test health check: `sudo ./healthcheck.sh --verbose`
- [ ] Test backup: `sudo ./backup.sh database`
- [ ] Setup UptimeRobot monitor
- [ ] Setup PM2 Plus dashboard
- [ ] Configure email alerts
- [ ] Test alert delivery
- [ ] Document custom procedures in runbook

---

## Next Steps

After monitoring is setup:
1. Monitor for 1 week to establish baseline
2. Adjust thresholds if needed (disk, memory)
3. Add custom metrics for sync operations
4. Create operational runbook
5. Schedule regular review (monthly)

---

**Last Updated:** 2026-02-04
**Version:** 1.0
**Maintainer:** Owlivion Team
