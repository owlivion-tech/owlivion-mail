# Owlivion Sync Server - Monitoring Setup

Complete monitoring solution with health checks, backups, log rotation, and PM2 Plus integration.

## 🎯 Overview

Bu setup 4 ana monitoring bileşeni içerir:

1. **Health Checks**: 5 dakikada bir server sağlığı kontrolü
2. **Automated Backups**: Günlük database backup, haftalık full backup
3. **Log Rotation**: PM2 log'ları için otomatik rotation
4. **PM2 Plus**: Real-time dashboard, alerts, exception tracking

## 📦 Installed Components

### 1. Health Check System

**Script**: `/opt/owlivion-sync-server/deployment/healthcheck.sh`

**Checks:**
- ✅ Server process health (PM2)
- ✅ HTTP endpoint availability
- ✅ SQLite database integrity
- ✅ Disk space (85% threshold)
- ✅ Memory usage (90% threshold)

**Cron**: Every 5 minutes
**Log**: `/var/log/owlivion-health.log`

```bash
# Manuel çalıştırma
sudo /opt/owlivion-sync-server/deployment/healthcheck.sh --verbose

# Log'ları görüntüle
sudo tail -f /var/log/owlivion-health.log
```

### 2. Backup System

**Script**: `/opt/owlivion-sync-server/deployment/backup.sh`

**Backups:**
- 📦 Database: Daily at 2 AM
- 📦 Full (DB + Config): Weekly on Sunday at 3 AM
- 📦 Retention: 7 days (auto-cleanup)

**Location**: `/opt/owlivion-sync-server/backups/`
**Log**: `/var/log/owlivion-backup.log`

```bash
# Manuel backup
sudo /opt/owlivion-sync-server/deployment/backup.sh full

# Backup listesi
sudo /opt/owlivion-sync-server/deployment/backup.sh list

# Backup restore
sudo /opt/owlivion-sync-server/deployment/backup.sh restore <backup_file>
```

### 3. Log Rotation

**Config**: `/etc/logrotate.d/owlivion-pm2`

**Settings:**
- 🔄 Daily rotation
- 📊 Keep 14 days
- 🗜️ Compress old logs
- 🔄 Max size: 100M per log

**Affected Logs:**
- `/var/log/owlivion-sync/*.log`
- `/root/.pm2/logs/*.log`

```bash
# Manuel rotation test
sudo logrotate -f /etc/logrotate.d/owlivion-pm2

# Debug mode
sudo logrotate -d /etc/logrotate.d/owlivion-pm2
```

### 4. PM2 Plus Dashboard (OPTIONAL)

**Features:**
- 📊 Real-time CPU/Memory monitoring
- 🚨 Custom threshold alerts
- 🐛 Exception tracking
- 📈 Custom business metrics
- 📱 Mobile app support

**Status**: ⏸️ Optional feature (not currently needed)
**Guide**: See `optional/pm2-plus/` if you want to enable it later

## 🚀 Quick Start

### Initial Setup (One-time)

```bash
# 1. Run monitoring setup (if not already done)
cd /opt/owlivion-sync-server/deployment
sudo ./setup-monitoring.sh --email your@email.com

# 2. Setup PM2 Plus
# Get keys from: https://app.pm2.io/
./setup-pm2-plus.sh <SECRET_KEY> <PUBLIC_KEY>

# 3. Verify everything is working
sudo ./healthcheck.sh --verbose
```

### Daily Operations

```bash
# Check server health
pm2 monit

# View recent logs
pm2 logs owlivion-sync --lines 50

# Check health log
sudo tail -20 /var/log/owlivion-health.log

# Check backup log
sudo tail -20 /var/log/owlivion-backup.log

# PM2 Plus dashboard
# Visit: https://app.pm2.io/
```

## 📋 Cron Jobs

Current scheduled tasks:

```bash
# View all cron jobs
crontab -l

# Scheduled tasks:
*/5 * * * *   - Health check (every 5 minutes)
0 2 * * *     - Database backup (daily at 2 AM)
0 3 * * 0     - Full backup (Sunday at 3 AM)
```

## 🔔 Alerts & Notifications

### Health Check Alerts

**Triggers:**
- ❌ Server process down
- ❌ HTTP endpoint unreachable
- ❌ Database corruption
- ⚠️ Disk space > 85%
- ⚠️ Memory usage > 90%

**Action**: Logged to `/var/log/owlivion-health.log`

### PM2 Plus Alerts (Once configured)

**Recommended Alerts:**

| Alert | Threshold | Duration | Action |
|-------|-----------|----------|--------|
| High CPU | > 80% | 5 min | Email/Slack |
| High Memory | > 400MB | 2 min | Email |
| Frequent Restarts | > 3 | 10 min | Email/SMS |
| Error Spike | > 5 exceptions | 5 min | Email/Slack |

Configure in: https://app.pm2.io/ → Alerts

## 📊 Monitoring Dashboard

### PM2 Built-in (Current)

```bash
# Real-time monitoring
pm2 monit

# Process details
pm2 describe owlivion-sync

# Recent logs
pm2 logs owlivion-sync
```

### PM2 Plus Dashboard (After setup)

**URL**: https://app.pm2.io/

**Views:**
- **Overview**: Server health, CPU/Memory graphs
- **Metrics**: Custom metrics dashboard
- **Exceptions**: Error tracking & stack traces
- **Transactions**: Slow request analysis

## 🔧 Troubleshooting

### Health Checks Failing

```bash
# Check cron is running
sudo systemctl status cron

# Manually run health check
sudo /opt/owlivion-sync-server/deployment/healthcheck.sh --verbose

# Check logs
sudo tail -50 /var/log/owlivion-health.log
```

### Backups Not Running

```bash
# Verify backup script exists
ls -la /opt/owlivion-sync-server/deployment/backup.sh

# Test backup manually
sudo /opt/owlivion-sync-server/deployment/backup.sh database

# Check logs
sudo tail -50 /var/log/owlivion-backup.log
```

### PM2 Plus Not Connecting

```bash
# Check link status
pm2 info | grep "Agent status"

# Verify @pm2/io installed
cd /opt/owlivion-sync-server
npm list @pm2/io

# Check ecosystem config
grep "automation" deployment/ecosystem.config.js
# Should show: automation: true

# Reload processes
pm2 reload deployment/ecosystem.config.js
```

### Logs Growing Too Large

```bash
# Check log sizes
du -sh /var/log/owlivion-sync/*
du -sh /root/.pm2/logs/*

# Force log rotation
sudo logrotate -f /etc/logrotate.d/owlivion-pm2

# Clear old PM2 logs
pm2 flush
```

## 📱 Mobile Monitoring

### PM2 Plus App

Download app:
- **iOS**: https://apps.apple.com/app/pm2-plus/id1456946515
- **Android**: https://play.google.com/store/apps/details?id=io.keymetrics.mobile

Features:
- 📊 Real-time metrics
- 🔔 Push notifications
- 🔄 Process management (restart/stop)
- 📈 Historical graphs

## 🔐 Security Considerations

### Access Control

```bash
# Health log permissions
ls -la /var/log/owlivion-health.log
# Should be: -rw-r--r-- root root

# Backup directory permissions
ls -la /opt/owlivion-sync-server/backups/
# Should be: drwx------ owlivion owlivion
```

### Sensitive Data in Logs

- ✅ Logs are stored locally (not sent anywhere)
- ✅ PM2 Plus: Only metrics sent (no source code)
- ⚠️ Ensure logs don't contain passwords/tokens
- ⚠️ Use log sanitization for sensitive operations

### Backup Encryption (Optional)

```bash
# Encrypt backups with GPG
gpg --symmetric --cipher-algo AES256 backup.tar.gz

# Decrypt when needed
gpg --decrypt backup.tar.gz.gpg > backup.tar.gz
```

## 📈 Performance Impact

Monitoring overhead:

| Component | CPU Impact | Memory Impact |
|-----------|------------|---------------|
| Health Checks | < 1% | ~10MB |
| PM2 Plus Agent | 1-2% | ~30MB |
| Logrotate | < 1% | Minimal |
| Total | ~3% | ~40MB |

**Note**: Impact is minimal and acceptable for production.

## 📚 Documentation

### Setup Guides

- **PM2 Plus Full Guide**: `PM2_PLUS_SETUP.md`
- **PM2 Plus Quick Start**: `pm2-plus-quickstart.md`
- **This Overview**: `MONITORING_README.md`

### Scripts

- **Monitoring Setup**: `setup-monitoring.sh`
- **PM2 Plus Setup**: `setup-pm2-plus.sh`
- **Health Check**: `healthcheck.sh`
- **Backup**: `backup.sh`

### Configuration Files

- **PM2 Ecosystem**: `ecosystem.config.js`
- **Logrotate Config**: `/etc/logrotate.d/owlivion-pm2`
- **Crontab**: `crontab -l`

## 🎯 Next Steps

### Immediate (Required)

- [ ] Setup PM2 Plus dashboard
  ```bash
  cd /opt/owlivion-sync-server/deployment
  ./setup-pm2-plus.sh <secret> <public>
  ```

- [ ] Configure PM2 Plus alerts
  - CPU > 80% threshold
  - Memory > 400MB threshold
  - Restart > 3 in 10 min

- [ ] Setup notification channels
  - Email notifications
  - Slack integration (optional)

### Optional (Recommended)

- [ ] Setup external uptime monitoring
  - Use UptimeRobot: https://uptimerobot.com/
  - Monitor: http://31.97.216.36:3000/health
  - 5-minute intervals

- [ ] Add custom metrics to code
  - Active sync count
  - Queue size
  - Sync duration histogram

- [ ] Install PM2 Plus mobile app
  - Real-time monitoring on the go
  - Push notifications for alerts

- [ ] Configure backup encryption
  - GPG encryption for backups
  - Secure backup storage

### Future Enhancements

- [ ] Grafana dashboard (alternative to PM2 Plus)
- [ ] Prometheus metrics export
- [ ] ELK stack for log aggregation
- [ ] Distributed tracing (Jaeger)

## 🆘 Support

### Common Issues

See **Troubleshooting** section above.

### Get Help

- **Documentation**: This README + PM2_PLUS_SETUP.md
- **PM2 Docs**: https://pm2.io/docs/
- **PM2 Plus Support**: support@pm2.io
- **Community**: https://github.com/Unitech/pm2/issues

### Contact

- **Project**: Owlivion Mail
- **Server**: 31.97.216.36
- **Environment**: Production

---

**Last Updated**: 2026-02-04
**Version**: 1.0
**Status**: ✅ Health checks & backups active | ⏳ PM2 Plus pending setup
