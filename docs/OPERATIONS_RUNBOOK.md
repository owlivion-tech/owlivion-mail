# Owlivion Mail - Operations Runbook

> **Last Updated:** February 5, 2026
> **Purpose:** Daily operations, monitoring, maintenance, and incident response procedures
> **Audience:** DevOps, SRE, System Administrators

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Weekly Maintenance](#weekly-maintenance)
3. [Monthly Tasks](#monthly-tasks)
4. [Monitoring Procedures](#monitoring-procedures)
5. [Backup & Restore](#backup--restore)
6. [Incident Response](#incident-response)
7. [Deployment Procedures](#deployment-procedures)
8. [Security Operations](#security-operations)
9. [Performance Optimization](#performance-optimization)
10. [Emergency Contacts](#emergency-contacts)

---

## Daily Operations

### Morning Checklist (9:00 AM)

```bash
# 1. Check service health
ssh owlivion@31.97.216.36
pm2 status
sudo systemctl status postgresql
sudo systemctl status nginx
docker ps

# 2. Verify API health
curl https://owlivion.com/api/v1/health

# 3. Check disk space (alert if >80%)
df -h | grep -E '/$|/home'

# 4. Check memory usage
free -h

# 5. Review overnight logs
pm2 logs owlivion-sync-server --lines 100 --nostream | grep -i "error\|warning"

# 6. Check SSL certificate validity (alert if <30 days)
sudo certbot certificates | grep -A 2 "Expiry"
```

**Expected Results:**
- ✅ PM2 status: `online` (uptime > 0s)
- ✅ PostgreSQL: `active (running)`
- ✅ Nginx: `active (running)`
- ✅ API health: `{"status":"ok"}`
- ✅ Disk usage: < 80%
- ✅ SSL expires: > 30 days

### Evening Checklist (6:00 PM)

```bash
# 1. Check sync operation stats
psql -U owlivion -d owlivion_sync -c "
SELECT
    data_type,
    COUNT(*) as operations,
    MAX(created_at) as last_sync
FROM sync_data
WHERE created_at::date = CURRENT_DATE
GROUP BY data_type;"

# 2. Review PM2 metrics
pm2 show owlivion-sync-server

# 3. Check error rate (should be < 1%)
pm2 logs --err --lines 50 --nostream | wc -l

# 4. Verify backup completion
ls -lht /backups/daily/ | head -5
```

---

## Weekly Maintenance

### Monday (Weekly Server Maintenance)

```bash
# 1. Update system packages (non-critical)
sudo apt update
sudo apt list --upgradable

# 2. Restart services (if needed)
pm2 restart owlivion-sync-server
sudo systemctl restart postgresql
sudo systemctl reload nginx

# 3. Check for PM2 updates
npm outdated -g pm2

# 4. Review weekly backup logs
cat /var/log/owlivion-backup.log | grep "$(date -d 'last sunday' +%Y-%m-%d)"

# 5. Database maintenance
psql -U owlivion -d owlivion_sync -c "VACUUM ANALYZE;"
psql -U owlivion -d owlivion_sync -c "REINDEX DATABASE owlivion_sync;"
```

### Wednesday (Security Review)

```bash
# 1. Review UFW firewall logs
sudo tail -100 /var/log/ufw.log | grep -i "block\|deny"

# 2. Check for failed SSH attempts
sudo grep "Failed password" /var/log/auth.log | tail -20

# 3. Review PostgreSQL connections
psql -U owlivion -d owlivion_sync -c "
SELECT client_addr, COUNT(*)
FROM pg_stat_activity
WHERE client_addr IS NOT NULL
GROUP BY client_addr;"

# 4. Scan for suspicious processes
ps aux | grep -v "$(whoami)" | grep -i "owlivion\|sync\|node"

# 5. Check open ports
sudo netstat -tulnp | grep LISTEN
```

### Friday (Performance Review)

```bash
# 1. Database query performance
psql -U owlivion -d owlivion_sync -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;"

# 2. API response time analysis
pm2 logs --lines 1000 --nostream | grep "Response time" | awk '{print $NF}' | sort -n | tail -10

# 3. Check database size growth
psql -U owlivion -d owlivion_sync -c "
SELECT pg_database.datname,
       pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'owlivion_sync';"

# 4. Review slow queries (>1s)
psql -U owlivion -d owlivion_sync -c "
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;"
```

---

## Monthly Tasks

### First Monday of the Month

```bash
# 1. Update Node.js dependencies
cd /home/owlivion/owlivion-mail/owlivion-sync-server
npm outdated
npm update
pm2 restart owlivion-sync-server

# 2. Rotate old backups (keep last 3 months)
find /backups/daily/ -type f -mtime +90 -delete
find /backups/weekly/ -type f -mtime +90 -delete

# 3. Review and archive old logs
pm2 flush
sudo journalctl --vacuum-time=90d

# 4. Update system packages (critical only)
sudo apt update
sudo apt upgrade -y

# 5. Test disaster recovery plan
bash /home/owlivion/owlivion-mail/owlivion-sync-server/deployment/test-restore.sh
```

### SSL Certificate Renewal (Auto - 1st of each month)

```bash
# Certbot auto-renewal is configured via systemd timer
# Manual check:
sudo certbot renew --dry-run

# If manual renewal needed:
sudo certbot renew --nginx
sudo systemctl reload nginx
```

---

## Monitoring Procedures

### Health Check Script

Run every 5 minutes via cron:
```bash
# Edit crontab
crontab -e

# Add this line:
*/5 * * * * /home/owlivion/owlivion-mail/owlivion-sync-server/deployment/healthcheck.sh
```

**healthcheck.sh monitors:**
- PostgreSQL connectivity
- PM2 process status
- Nginx status
- API endpoint response
- Disk usage (>80% alert)
- Memory usage (>90% alert)
- SSL certificate expiry (<7 days alert)

### Alerts Configuration

**Email Alerts (via healthcheck.sh):**
```bash
# Configure email in healthcheck.sh
ALERT_EMAIL="admin@owlivion.com"
```

**PM2 Plus Alerts:**
- CPU usage > 80% (5 min avg)
- Memory usage > 500MB
- Application restarts > 5 per hour
- Exception rate > 10 per minute

**UptimeRobot Alerts:**
- API downtime > 2 minutes
- Response time > 5 seconds
- SSL certificate expiry < 7 days

---

## Backup & Restore

### Automated Backup Schedule

```bash
# View current cron jobs
crontab -l

# Expected cron jobs:
# 0 2 * * * /path/to/backup.sh          # Daily at 2 AM
# 0 3 * * 0 /path/to/full-backup.sh     # Weekly Sunday 3 AM
# */5 * * * * /path/to/healthcheck.sh   # Every 5 minutes
```

### Manual Backup

```bash
# Database only
pg_dump -U owlivion owlivion_sync > backup_$(date +%Y%m%d_%H%M%S).sql

# Database + logs + config
bash /home/owlivion/owlivion-mail/owlivion-sync-server/deployment/backup.sh
```

### Restore Procedure

**Database Restore:**
```bash
# 1. Stop application
pm2 stop owlivion-sync-server

# 2. Drop existing database
psql -U postgres -c "DROP DATABASE owlivion_sync;"
psql -U postgres -c "CREATE DATABASE owlivion_sync;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE owlivion_sync TO owlivion;"

# 3. Restore from backup
psql -U owlivion owlivion_sync < backup_YYYYMMDD_HHMMSS.sql

# 4. Verify data
psql -U owlivion -d owlivion_sync -c "SELECT COUNT(*) FROM users;"

# 5. Restart application
pm2 restart owlivion-sync-server
pm2 logs --lines 50
```

**Full System Restore:**
See `USER_MIGRATION_GUIDE.md` for complete restoration procedures.

---

## Incident Response

### Severity Levels

**P0 - Critical (Response: <15 min)**
- Complete service outage
- Data breach or security incident
- Database corruption

**P1 - High (Response: <1 hour)**
- API degraded performance (>5s response time)
- Authentication failures
- Database connection issues

**P2 - Medium (Response: <4 hours)**
- Non-critical feature failures
- Slow queries affecting performance
- Sync conflicts

**P3 - Low (Response: <24 hours)**
- Cosmetic issues
- Feature requests
- Documentation updates

### Incident Response Checklist

**Step 1: Assess & Communicate**
```bash
# 1. Check service status
pm2 status
curl https://owlivion.com/api/v1/health

# 2. Update status page
# (If using status.io or similar)

# 3. Notify team
# (Via Slack, email, etc.)
```

**Step 2: Diagnose**
```bash
# Check recent errors
pm2 logs --err --lines 200

# Check system resources
top -b -n 1 | head -20
df -h
free -h

# Check database connections
psql -U owlivion -d owlivion_sync -c "SELECT * FROM pg_stat_activity;"

# Check Nginx logs
sudo tail -100 /var/log/nginx/error.log
```

**Step 3: Mitigate**
```bash
# Quick fixes:
pm2 restart owlivion-sync-server      # Restart app
sudo systemctl restart postgresql     # Restart DB
sudo systemctl reload nginx           # Reload Nginx

# Emergency rollback (if recent deployment):
cd /home/owlivion/owlivion-mail/owlivion-sync-server
git log --oneline -5
git checkout <previous-commit-hash>
npm install
pm2 restart owlivion-sync-server
```

**Step 4: Resolve & Document**
```bash
# After fix:
# 1. Verify service health
curl https://owlivion.com/api/v1/health

# 2. Document incident
# - Root cause
# - Timeline
# - Resolution
# - Action items

# 3. Update monitoring/alerts if needed
```

### Emergency Rollback

```bash
# 1. Navigate to application directory
cd /home/owlivion/owlivion-mail/owlivion-sync-server

# 2. View recent commits
git log --oneline -10

# 3. Rollback to previous version
git checkout <commit-hash>

# 4. Reinstall dependencies
npm install

# 5. Restart application
pm2 restart owlivion-sync-server

# 6. Verify health
pm2 logs --lines 50
curl https://owlivion.com/api/v1/health
```

---

## Deployment Procedures

### Standard Deployment (Non-Breaking Changes)

```bash
# 1. SSH into production server
ssh owlivion@31.97.216.36

# 2. Navigate to application directory
cd /home/owlivion/owlivion-mail/owlivion-sync-server

# 3. Pull latest changes
git pull origin main

# 4. Install dependencies
npm install

# 5. Run database migrations (if any)
psql -U owlivion -d owlivion_sync -f deployment/migrations/YYYYMMDD_migration.sql

# 6. Restart application
pm2 restart owlivion-sync-server

# 7. Monitor logs for errors
pm2 logs owlivion-sync-server --lines 100

# 8. Verify deployment
curl https://owlivion.com/api/v1/health
```

### Zero-Downtime Deployment (Blue-Green)

```bash
# 1. Start new instance on different port
PORT=3001 pm2 start server.js --name owlivion-sync-server-new

# 2. Wait for health check
sleep 10
curl http://localhost:3001/api/v1/health

# 3. Update Nginx to point to new instance
sudo nano /etc/nginx/conf.d/owlivion.conf
# Change: proxy_pass http://localhost:3001

# 4. Reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# 5. Stop old instance
pm2 stop owlivion-sync-server
pm2 delete owlivion-sync-server

# 6. Rename new instance
pm2 restart owlivion-sync-server-new --name owlivion-sync-server
pm2 save
```

---

## Security Operations

### Weekly Security Scan

```bash
# 1. Check for vulnerable npm packages
npm audit

# 2. Update critical vulnerabilities
npm audit fix

# 3. Check system vulnerabilities
sudo apt update
sudo apt upgrade --dry-run | grep -i security

# 4. Review firewall rules
sudo ufw status verbose

# 5. Check for rootkits (if rkhunter installed)
sudo rkhunter --check --skip-keypress
```

### Access Review (Monthly)

```bash
# 1. List sudo users
getent group sudo

# 2. List SSH keys
cat ~/.ssh/authorized_keys

# 3. Review PostgreSQL users
psql -U postgres -c "\du"

# 4. Review active sessions
who
w

# 5. Review cron jobs
sudo crontab -l
crontab -l
```

### Log Analysis (Weekly)

```bash
# 1. Failed SSH attempts
sudo grep "Failed password" /var/log/auth.log | tail -50

# 2. Successful SSH logins
sudo grep "Accepted publickey" /var/log/auth.log | tail -20

# 3. Sudo commands executed
sudo grep "sudo:" /var/log/auth.log | tail -30

# 4. Firewall blocks
sudo grep "UFW BLOCK" /var/log/ufw.log | tail -50

# 5. API authentication failures
pm2 logs --lines 500 --nostream | grep -i "unauthorized\|forbidden"
```

---

## Performance Optimization

### Database Optimization (Monthly)

```bash
# 1. Analyze slow queries
psql -U owlivion -d owlivion_sync -c "
SELECT query, calls, total_time, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;"

# 2. Vacuum database
psql -U owlivion -d owlivion_sync -c "VACUUM FULL ANALYZE;"

# 3. Reindex tables
psql -U owlivion -d owlivion_sync -c "REINDEX DATABASE owlivion_sync;"

# 4. Update statistics
psql -U owlivion -d owlivion_sync -c "ANALYZE;"

# 5. Check for bloat
psql -U owlivion -d owlivion_sync -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;"
```

### Application Performance

```bash
# 1. Check memory leaks
pm2 monit

# 2. Profile CPU usage
top -p $(pgrep -f owlivion-sync-server)

# 3. Check event loop lag
pm2 show owlivion-sync-server | grep "Loop delay"

# 4. Analyze response times
pm2 logs --lines 1000 --nostream | grep "Response time" | \
  awk '{print $NF}' | \
  awk '{sum+=$1; count++} END {print "Avg:", sum/count, "ms"}'
```

### Cache Optimization

```bash
# 1. Check Nginx cache stats
sudo grep -r "HIT\|MISS" /var/log/nginx/access.log | wc -l

# 2. Clear Nginx cache (if enabled)
sudo rm -rf /var/cache/nginx/*

# 3. Restart Nginx
sudo systemctl restart nginx
```

---

## Emergency Contacts

### On-Call Rotation
- **Primary:** [Your Name] - [Email] - [Phone]
- **Secondary:** [Backup Name] - [Email] - [Phone]
- **Escalation:** [Manager Name] - [Email] - [Phone]

### External Services
- **VPS Provider:** [Support Email/Phone]
- **DNS Provider:** [Support Email/Phone]
- **Monitoring Service:** UptimeRobot - support@uptimerobot.com

### Useful Links
- **PM2 Dashboard:** [PM2 Plus URL if configured]
- **Status Page:** [Your Status Page URL]
- **Monitoring Dashboard:** [UptimeRobot Dashboard URL]
- **Repository:** https://github.com/babafpv/owlivion-mail
- **Documentation:** /docs/

---

## Runbook Maintenance

**Review Schedule:** Quarterly (every 3 months)
**Last Review:** February 5, 2026
**Next Review:** May 5, 2026

**Change Log:**
- 2026-02-05: Initial runbook creation
- [Future updates here]

---

## Related Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [User Migration Guide](./USER_MIGRATION_GUIDE.md)

---

**Document Status:** ✅ Active
**Last Updated:** February 5, 2026
**Maintainer:** DevOps Team
