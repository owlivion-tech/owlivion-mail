# Production Monitoring - Final Setup

> Owlivion Sync Server için production-ready monitoring stack

## ✅ Aktif Monitoring Komponenler

### 1. Health Checks (Cron)

```bash
Script: /opt/owlivion-sync-server/deployment/healthcheck.sh
Frequency: Every 5 minutes
Log: /var/log/owlivion-health.log

Checks:
✓ PM2 process status
✓ HTTP endpoint (http://localhost:3000/health)
✓ SQLite database integrity
✓ Disk space (threshold: 85%)
✓ Memory usage (threshold: 90%)
```

**Manuel Test:**
```bash
sudo /opt/owlivion-sync-server/deployment/healthcheck.sh --verbose
```

### 2. Automated Backups (Cron)

```bash
Script: /opt/owlivion-sync-server/deployment/backup.sh
Location: /opt/owlivion-sync-server/backups/
Log: /var/log/owlivion-backup.log

Schedule:
✓ Database backup: Daily at 2 AM
✓ Full backup: Weekly (Sunday at 3 AM)
✓ Retention: 7 days (auto-cleanup)
```

**Manuel Backup:**
```bash
# Database backup
sudo /opt/owlivion-sync-server/deployment/backup.sh database

# Full backup
sudo /opt/owlivion-sync-server/deployment/backup.sh full

# List backups
sudo /opt/owlivion-sync-server/deployment/backup.sh list

# Restore
sudo /opt/owlivion-sync-server/deployment/backup.sh restore <file>
```

### 3. Log Rotation (Logrotate)

```bash
Config: /etc/logrotate.d/owlivion-pm2
Frequency: Daily

Settings:
✓ Rotate daily
✓ Keep 14 days
✓ Compress old logs
✓ Max size: 100MB per log

Logs:
- /var/log/owlivion-sync/*.log
- /root/.pm2/logs/*.log
```

**Manuel Rotation:**
```bash
sudo logrotate -f /etc/logrotate.d/owlivion-pm2
```

### 4. PM2 Process Manager

```bash
Config: /opt/owlivion-sync-server/deployment/ecosystem.config.js

Settings:
✓ Cluster mode: 2 instances
✓ Auto restart: Yes
✓ Max memory: 500MB (auto-restart)
✓ Max restarts: 10 per minute
✓ Min uptime: 10 seconds
```

**Monitoring Commands:**
```bash
# Real-time monitoring
pm2 monit

# Process details
pm2 describe owlivion-sync

# View logs
pm2 logs owlivion-sync

# Check status
pm2 status
```

## 📊 Monitoring Architecture

```
┌─────────────────────────────────────┐
│     SSH Access (Manual)             │
│   pm2 monit / pm2 logs              │
└─────────────────────────────────────┘
              ↑
              │
┌─────────────────────────────────────┐
│      PM2 Process Manager            │
│  Cluster: 2 instances               │
│  Auto-restart, Memory limits        │
└─────────────────────────────────────┘
              ↑
              │
┌─────────────────────────────────────┐
│   Automated Tasks (Cron)            │
│                                     │
│  ✓ Health checks (5 min)           │
│  ✓ Backups (daily/weekly)          │
│  ✓ Log rotation (daily)            │
└─────────────────────────────────────┘
              ↑
              │
┌─────────────────────────────────────┐
│   Owlivion Sync Server              │
│   Node.js + Express                 │
│   Port: 3000                        │
└─────────────────────────────────────┘
```

## 🚀 Deployment Checklist

### Initial Setup (One-time)

```bash
# 1. SSH into VPS
ssh owlivion@31.97.216.36

# 2. Run monitoring setup
cd /opt/owlivion-sync-server/deployment
sudo ./setup-monitoring.sh --email your@email.com

# 3. Verify health checks
sudo ./healthcheck.sh --verbose

# 4. Test backup
sudo ./backup.sh database

# 5. Check cron jobs
crontab -l | grep owlivion
```

### Verification

```bash
# Check all components:

# 1. Health check log exists
ls -la /var/log/owlivion-health.log

# 2. Backup log exists
ls -la /var/log/owlivion-backup.log

# 3. Logrotate config installed
ls -la /etc/logrotate.d/owlivion-pm2

# 4. Cron jobs active
crontab -l | grep -E "health|backup"

# 5. PM2 running
pm2 status
```

## 📋 Daily Operations

### Morning Checkup

```bash
# 1. Check process health
pm2 status

# 2. Review health log (last 24 hours)
sudo tail -100 /var/log/owlivion-health.log

# 3. Check for errors in PM2 logs
pm2 logs owlivion-sync --lines 50 --err

# 4. Verify disk space
df -h /opt/owlivion-sync-server
```

### Weekly Review

```bash
# 1. Check backup status
sudo /opt/owlivion-sync-server/deployment/backup.sh list

# 2. Review full health log
sudo less /var/log/owlivion-health.log

# 3. Check log sizes
du -sh /var/log/owlivion-sync/*
du -sh /root/.pm2/logs/*

# 4. Review PM2 process stats
pm2 describe owlivion-sync
```

## 🔧 Troubleshooting

### Health Checks Not Running

```bash
# Check cron service
sudo systemctl status cron

# View cron logs
sudo grep CRON /var/log/syslog | grep owlivion

# Manually run health check
sudo /opt/owlivion-sync-server/deployment/healthcheck.sh --verbose
```

### Backups Failing

```bash
# Check backup log
sudo tail -50 /var/log/owlivion-backup.log

# Verify backup directory permissions
ls -la /opt/owlivion-sync-server/backups/

# Test manual backup
sudo /opt/owlivion-sync-server/deployment/backup.sh database
```

### Logs Growing Too Large

```bash
# Check log sizes
du -sh /var/log/owlivion-sync/*
du -sh /root/.pm2/logs/*

# Force log rotation
sudo logrotate -f /etc/logrotate.d/owlivion-pm2

# Clear PM2 logs
pm2 flush
```

### Server Slow/Unresponsive

```bash
# Check CPU/Memory
pm2 monit

# View recent errors
pm2 logs owlivion-sync --err --lines 100

# Check health status
sudo tail -20 /var/log/owlivion-health.log

# Restart if needed
pm2 restart owlivion-sync
```

## 📱 Monitoring Access

### SSH Access

```bash
# From local machine
ssh owlivion@31.97.216.36

# Or as root
ssh root@31.97.216.36

# Then use PM2 commands
pm2 monit
pm2 logs
pm2 status
```

### Health Endpoint (External)

```bash
# Check server health via HTTP
curl http://31.97.216.36:3000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-04T12:00:00Z"
}
```

## 🔐 Security

### Log File Permissions

```bash
# Health log
-rw-r--r-- root root /var/log/owlivion-health.log

# Backup log
-rw-r--r-- root root /var/log/owlivion-backup.log

# Backup directory (restricted)
drwx------ owlivion owlivion /opt/owlivion-sync-server/backups/
```

### Sensitive Data

- ✅ Logs stored locally only
- ✅ Backups encrypted at rest (filesystem level)
- ✅ No external monitoring (no data sent out)
- ⚠️ Ensure logs don't contain passwords/tokens

## 💰 Cost Analysis

| Component | CPU Impact | Memory Impact | Disk Usage | Cost |
|-----------|------------|---------------|------------|------|
| Health Checks | <1% | ~10MB | ~50MB logs | $0 |
| Backups | <1% | ~20MB | ~500MB | $0 |
| Log Rotation | <1% | Minimal | Managed | $0 |
| PM2 | ~2% | ~50MB | ~100MB logs | $0 |
| **Total** | **~4%** | **~80MB** | **~650MB** | **$0** |

**Performance Impact:** Minimal ve acceptable

## 📚 Documentation

### Main Documents

- **PRODUCTION_MONITORING_FINAL.md** (this file) - Overview
- **MONITORING_README.md** - Detailed guide
- **healthcheck.sh** - Health check script
- **backup.sh** - Backup script
- **setup-monitoring.sh** - Initial setup

### Optional Features

- **optional/pm2-plus/** - PM2 Plus integration (if needed later)

### Configuration Files

- **ecosystem.config.js** - PM2 configuration
- **/etc/logrotate.d/owlivion-pm2** - Log rotation config
- **crontab -l** - Scheduled tasks

## 🎯 Success Metrics

### Operational Health

- ✅ Uptime: Target > 99.5%
- ✅ Health checks: All passing
- ✅ Backups: Daily + Weekly successful
- ✅ Logs: Properly rotated
- ✅ Disk space: < 80% usage

### Monitoring Coverage

- ✅ Process health: Every 5 minutes
- ✅ Data protection: Daily backups
- ✅ Log management: Daily rotation
- ✅ Performance: PM2 monitoring available

## 🚦 When to Upgrade

Consider additional monitoring if:

- ❌ Kullanıcı sayısı 100+ olursa
- ❌ Kritik iş uygulaması olursa
- ❌ 7/24 uptime SLA gerekliyse
- ❌ Proaktif alert sistemi lazımsa

**Upgrade Options:**
- PM2 Plus (ücretsiz, 15 dakika kurulum) → `optional/pm2-plus/`
- UptimeRobot (ücretsiz external monitoring)
- Grafana + Prometheus (self-hosted, tam kontrol)

## ✅ Current Status

```
Owlivion Sync Server - Monitoring Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Health Checks: Active (every 5 min)
✅ Backups: Active (daily + weekly)
✅ Log Rotation: Active (daily)
✅ PM2 Monitoring: Active (pm2 monit)

❌ PM2 Plus: Disabled (optional)
❌ External Monitoring: Not configured
❌ Alert System: None (manual check)

Status: Production Ready 🚀
Coverage: Basic but sufficient ✓
```

## 🎓 Best Practices

### Regular Maintenance

```bash
# Weekly (5 minutes)
1. Check PM2 status
2. Review health logs
3. Verify backups exist
4. Check disk space

# Monthly (15 minutes)
1. Test backup restore
2. Review log sizes
3. Check for PM2 updates
4. Verify cron jobs
```

### Emergency Procedures

```bash
# Server down:
1. ssh owlivion@31.97.216.36
2. pm2 status
3. pm2 logs owlivion-sync --err --lines 100
4. pm2 restart owlivion-sync
5. Check /var/log/owlivion-health.log

# Data corruption:
1. Stop PM2: pm2 stop owlivion-sync
2. List backups: ./backup.sh list
3. Restore: ./backup.sh restore <file>
4. Start PM2: pm2 start ecosystem.config.js
```

## 📞 Support

### Self-Service

- Check health logs: `/var/log/owlivion-health.log`
- Check backup logs: `/var/log/owlivion-backup.log`
- View PM2 logs: `pm2 logs owlivion-sync`
- Check process: `pm2 monit`

### Documentation

- This file: `PRODUCTION_MONITORING_FINAL.md`
- Detailed guide: `MONITORING_README.md`
- Script help: `./healthcheck.sh --help`

### Resources

- PM2 Documentation: https://pm2.keymetrics.io/
- Linux cron: `man 5 crontab`
- Logrotate: `man logrotate`

---

**Last Updated**: 2026-02-04
**Version**: 1.0 (Final)
**Status**: ✅ Production Ready
**Coverage**: Basic monitoring (sufficient for current needs)
**Cost**: $0/month
**Maintenance**: ~5 min/week
