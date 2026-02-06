# Owlivion Mail - Troubleshooting Guide

> **Last Updated:** February 5, 2026
> **Purpose:** Common issues, error codes, diagnostics, and resolution steps
> **Audience:** Support, DevOps, Developers

## Table of Contents

1. [Quick Diagnosis](#quick-diagnosis)
2. [Client Application Issues](#client-application-issues)
3. [Sync Server Issues](#sync-server-issues)
4. [Database Issues](#database-issues)
5. [Email Connection Issues](#email-connection-issues)
6. [OAuth2 Authentication Issues](#oauth2-authentication-issues)
7. [SSL/TLS Issues](#ssltls-issues)
8. [Performance Issues](#performance-issues)
9. [Error Code Reference](#error-code-reference)
10. [Diagnostic Tools](#diagnostic-tools)

---

## Quick Diagnosis

### System Health Check

```bash
# Run this first for quick diagnosis
ssh owlivion@31.97.216.36

# Check all services
echo "=== PM2 Status ===" && pm2 status
echo "=== PostgreSQL ===" && sudo systemctl status postgresql --no-pager
echo "=== Nginx ===" && sudo systemctl status nginx --no-pager
echo "=== Disk Usage ===" && df -h | grep -E '/$|/home'
echo "=== Memory ===" && free -h
echo "=== API Health ===" && curl -s https://owlivion.com/api/v1/health
```

**Expected Output:**
- PM2: `online` status
- PostgreSQL: `active (running)`
- Nginx: `active (running)`
- Disk: < 80% usage
- API: `{"status":"ok"}`

---

## Client Application Issues

### Issue 1: Application Won't Start (Windows/Linux/macOS)

**Symptoms:**
- Double-click does nothing
- Crash on startup
- "Application is already running" error

**Diagnosis:**
```bash
# Windows (PowerShell)
Get-Process owlivion-mail -ErrorAction SilentlyContinue

# Linux/macOS
ps aux | grep owlivion-mail
```

**Solutions:**

**Solution 1: Kill zombie process**
```bash
# Windows
taskkill /IM owlivion-mail.exe /F

# Linux/macOS
pkill -9 owlivion-mail
```

**Solution 2: Delete lock file**
```bash
# Windows
del %APPDATA%\owlivion-mail\.lock

# Linux
rm ~/.local/share/owlivion-mail/.lock

# macOS
rm ~/Library/Application\ Support/owlivion-mail/.lock
```

**Solution 3: Reset application data (CAUTION: Deletes local data)**
```bash
# Windows
rmdir /S %APPDATA%\owlivion-mail

# Linux
rm -rf ~/.local/share/owlivion-mail

# macOS
rm -rf ~/Library/Application\ Support/owlivion-mail
```

### Issue 2: Emails Not Showing / Empty Inbox

**Symptoms:**
- Inbox appears empty
- "No emails found" message
- Emails show on webmail but not in Owlivion

**Diagnosis:**
```bash
# Check database for emails
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT COUNT(*) FROM emails;"

# Check FTS5 index
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT COUNT(*) FROM emails_fts;"

# Check logs
journalctl -xe | grep owlivion
```

**Solutions:**

**Solution 1: Trigger manual sync**
1. Open Owlivion Mail
2. Click account in sidebar
3. Click "Refresh" button (🔄)
4. Wait for sync to complete

**Solution 2: Rebuild FTS5 index**
```bash
sqlite3 ~/.local/share/owlivion-mail/owlivion.db << 'EOF'
DELETE FROM emails_fts;
INSERT INTO emails_fts(rowid, subject, body_text, from_name, from_address)
SELECT id, subject, body_text, from_name, from_address FROM emails;
EOF
```

**Solution 3: Re-sync account (CAUTION: Re-downloads all emails)**
```sql
-- Delete local email cache
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "DELETE FROM emails WHERE account_id = 1;"
-- Then refresh in app
```

### Issue 3: Search Not Working

**Symptoms:**
- Search returns no results
- Search shows "0 results" for known emails

**Diagnosis:**
```bash
# Check FTS5 index count
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT COUNT(*) FROM emails_fts;"

# Test FTS5 query
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT * FROM emails_fts WHERE emails_fts MATCH 'test' LIMIT 1;"
```

**Solution: Rebuild FTS5 index**
```bash
sqlite3 ~/.local/share/owlivion-mail/owlivion.db << 'EOF'
-- Drop and recreate FTS5 table
DROP TABLE IF EXISTS emails_fts;

CREATE VIRTUAL TABLE emails_fts USING fts5(
    subject,
    body_text,
    from_name,
    from_address,
    content=emails,
    content_rowid=id
);

-- Repopulate FTS5 index
INSERT INTO emails_fts(rowid, subject, body_text, from_name, from_address)
SELECT id, subject, body_text, from_name, from_address FROM emails;

-- Verify count
SELECT COUNT(*) FROM emails_fts;
EOF
```

### Issue 4: Application Crashes on Email Open

**Symptoms:**
- App crashes when clicking email
- "Application has stopped responding"
- Blank screen when viewing email

**Diagnosis:**
```bash
# Check crash logs
# Windows: %APPDATA%\owlivion-mail\logs\crash.log
# Linux: ~/.local/share/owlivion-mail/logs/crash.log
# macOS: ~/Library/Logs/owlivion-mail/crash.log

cat ~/.local/share/owlivion-mail/logs/crash.log | tail -50
```

**Solutions:**

**Solution 1: Clear cache**
```bash
# Delete cache directory
rm -rf ~/.local/share/owlivion-mail/cache/
```

**Solution 2: Disable HTML rendering (temporary)**
```sql
-- Set all emails to plain text mode
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "UPDATE settings SET value = 'false' WHERE key = 'render_html';"
```

**Solution 3: Update to latest version**
```bash
# Check for updates in app
# Help -> Check for Updates
```

---

## Sync Server Issues

### Issue 1: API Not Responding (502 Bad Gateway)

**Symptoms:**
- `curl https://owlivion.com/api/v1/health` returns 502
- "Bad Gateway" error in browser

**Diagnosis:**
```bash
# Check PM2 status
pm2 status

# Check logs for crashes
pm2 logs owlivion-sync-server --lines 100 --err
```

**Solutions:**

**Solution 1: Restart PM2 process**
```bash
pm2 restart owlivion-sync-server
pm2 logs --lines 50

# Verify health
curl https://owlivion.com/api/v1/health
```

**Solution 2: Check for port conflicts**
```bash
sudo netstat -tulnp | grep 3000

# If port 3000 is occupied by another process:
sudo kill -9 <PID>
pm2 restart owlivion-sync-server
```

**Solution 3: Check Nginx configuration**
```bash
# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check Nginx logs
sudo tail -100 /var/log/nginx/error.log
```

### Issue 2: Database Connection Errors

**Symptoms:**
- PM2 logs show "ECONNREFUSED" or "database connection failed"
- API returns 500 errors

**Diagnosis:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
psql -U owlivion -d owlivion_sync -c "SELECT version();"

# Check active connections
psql -U owlivion -d owlivion_sync -c "SELECT COUNT(*) FROM pg_stat_activity;"
```

**Solutions:**

**Solution 1: Restart PostgreSQL**
```bash
sudo systemctl restart postgresql
pm2 restart owlivion-sync-server

# Verify connection
psql -U owlivion -d owlivion_sync -c "SELECT 1;"
```

**Solution 2: Check database credentials**
```bash
# Verify .env file
cat /home/owlivion/owlivion-mail/owlivion-sync-server/.env | grep DB_

# Test credentials
PGPASSWORD='password_from_env' psql -U owlivion -h localhost -d owlivion_sync
```

**Solution 3: Fix max connections limit**
```sql
-- Check current connections
SELECT COUNT(*) FROM pg_stat_activity;

-- Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < NOW() - INTERVAL '1 hour';

-- Increase max connections (edit postgresql.conf)
sudo nano /etc/postgresql/14/main/postgresql.conf
# Set: max_connections = 200
sudo systemctl restart postgresql
```

### Issue 3: Sync Conflicts Not Resolving

**Symptoms:**
- Manual sync keeps showing conflicts
- Conflict resolution modal doesn't work
- Data not syncing to server

**Diagnosis:**
```bash
# Check sync history
psql -U owlivion -d owlivion_sync -c "
SELECT data_type, operation, sync_status, error_message
FROM sync_history
ORDER BY created_at DESC
LIMIT 10;"

# Check for conflict records
psql -U owlivion -d owlivion_sync -c "
SELECT COUNT(*) FROM sync_history WHERE sync_status = 'conflict';"
```

**Solutions:**

**Solution 1: Force re-sync (server wins)**
```sql
-- Update sync_data version for user
UPDATE sync_data
SET version = version + 1,
    updated_at = NOW()
WHERE user_id = <user_id> AND data_type = 'contacts';

-- Client will detect newer version and download
```

**Solution 2: Clear client sync cache**
```sql
-- On client side
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "DELETE FROM sync_history;"
-- Then trigger manual sync in app
```

---

## Database Issues

### Issue 1: Database Corruption

**Symptoms:**
- "database disk image is malformed" error
- SQLite errors in logs
- Data inconsistencies

**Diagnosis:**
```bash
# Check database integrity
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "PRAGMA integrity_check;"

# Check FTS5 integrity
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "INSERT INTO emails_fts(emails_fts) VALUES('integrity-check');"
```

**Solutions:**

**Solution 1: Rebuild database (CLIENT)**
```bash
# 1. Backup current database
cp ~/.local/share/owlivion-mail/owlivion.db ~/.local/share/owlivion-mail/owlivion.db.backup

# 2. Export data
sqlite3 ~/.local/share/owlivion-mail/owlivion.db .dump > dump.sql

# 3. Create new database
rm ~/.local/share/owlivion-mail/owlivion.db
sqlite3 ~/.local/share/owlivion-mail/owlivion.db < dump.sql

# 4. Verify integrity
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "PRAGMA integrity_check;"
```

**Solution 2: Restore from backup (SERVER)**
```bash
# 1. Stop application
pm2 stop owlivion-sync-server

# 2. Restore database
psql -U postgres -c "DROP DATABASE owlivion_sync;"
psql -U postgres -c "CREATE DATABASE owlivion_sync OWNER owlivion;"
psql -U owlivion owlivion_sync < /backups/daily/latest_backup.sql

# 3. Restart application
pm2 restart owlivion-sync-server
```

### Issue 2: Slow Queries

**Symptoms:**
- Search takes > 5 seconds
- Email list loads slowly
- UI freezes

**Diagnosis:**
```bash
# Check database file size
ls -lh ~/.local/share/owlivion-mail/owlivion.db

# Analyze query plan
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "EXPLAIN QUERY PLAN SELECT * FROM emails LIMIT 10;"

# Check for missing indexes
sqlite3 ~/.local/share/owlivion-mail/owlivion.db ".schema emails" | grep INDEX
```

**Solutions:**

**Solution 1: Vacuum database**
```bash
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "VACUUM;"
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "ANALYZE;"
```

**Solution 2: Rebuild indexes**
```sql
-- Rebuild all indexes
REINDEX;

-- Rebuild FTS5 specifically
INSERT INTO emails_fts(emails_fts) VALUES('rebuild');
```

**Solution 3: Archive old emails**
```sql
-- Archive emails older than 1 year
DELETE FROM emails WHERE date < datetime('now', '-1 year');

-- Vacuum to reclaim space
VACUUM;
```

---

## Email Connection Issues

### Issue 1: IMAP Connection Timeout

**Symptoms:**
- "Connection timeout" error
- "Failed to connect to IMAP server"
- Emails not syncing

**Diagnosis:**
```bash
# Test IMAP connection
telnet imap.gmail.com 993
# OR
openssl s_client -connect imap.gmail.com:993

# Check firewall
sudo ufw status | grep 993

# Check DNS resolution
nslookup imap.gmail.com
```

**Solutions:**

**Solution 1: Verify IMAP settings**
```text
Gmail:
- IMAP: imap.gmail.com
- Port: 993
- Security: SSL/TLS

Outlook:
- IMAP: outlook.office365.com
- Port: 993
- Security: SSL/TLS

Hostinger:
- IMAP: imap.hostinger.com
- Port: 993
- Security: SSL/TLS
```

**Solution 2: Enable "Less secure apps" (Gmail legacy)**
```text
For Gmail accounts created before May 2022:
1. Go to https://myaccount.google.com/security
2. Enable "Less secure app access"
3. OR: Use OAuth2 authentication (recommended)
```

**Solution 3: Check firewall rules**
```bash
# Allow IMAP/SMTP ports
sudo ufw allow 993/tcp
sudo ufw allow 587/tcp
sudo ufw allow 465/tcp
```

### Issue 2: "Invalid Credentials" Error

**Symptoms:**
- "Authentication failed" error
- "Invalid username or password"
- Account keeps disconnecting

**Diagnosis:**
```bash
# Check encrypted password in database
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT email, password_encrypted FROM accounts WHERE id = 1;"

# Test credentials manually
openssl s_client -connect imap.gmail.com:993
# Then type: A LOGIN username@example.com password
```

**Solutions:**

**Solution 1: Re-enter password**
```text
1. Settings -> Accounts
2. Select account
3. Click "Edit"
4. Re-enter password
5. Click "Test Connection"
6. Save
```

**Solution 2: Use App Password (Gmail)**
```text
Gmail with 2FA enabled:
1. Go to https://myaccount.google.com/apppasswords
2. Generate app password for "Mail"
3. Use generated password in Owlivion
```

**Solution 3: Switch to OAuth2 (Gmail)**
```text
1. Settings -> Accounts
2. Remove existing account
3. Click "Add Account"
4. Select "Gmail (OAuth2)"
5. Follow OAuth2 flow
```

### Issue 3: OAuth2 Token Expired

**Symptoms:**
- "Token expired" error (Gmail OAuth)
- Account disconnects after hours/days

**Diagnosis:**
```bash
# Check OAuth token expiry
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "
SELECT email, oauth_expires_at, datetime(oauth_expires_at, 'unixepoch')
FROM accounts
WHERE oauth_provider IS NOT NULL;"

# Current time
date +%s
```

**Solutions:**

**Solution 1: Refresh token automatically (built-in)**
```text
Owlivion automatically refreshes OAuth tokens.
If this fails, try Solution 2.
```

**Solution 2: Re-authenticate account**
```text
1. Settings -> Accounts
2. Select OAuth account
3. Click "Re-authenticate"
4. Follow OAuth flow again
```

**Solution 3: Check OAuth credentials**
```bash
# Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
# These are set during build time (see OAUTH_SETUP.md)

# If missing, rebuild app with OAuth credentials:
cd /path/to/owlivion-mail
export GOOGLE_CLIENT_ID="your_client_id"
export GOOGLE_CLIENT_SECRET="your_client_secret"
pnpm tauri build
```

---

## OAuth2 Authentication Issues

### Issue 1: OAuth Flow Fails / "Failed to open browser"

**Symptoms:**
- OAuth popup doesn't open
- "Failed to start OAuth flow" error
- Stuck on "Waiting for authentication..."

**Diagnosis:**
```bash
# Check if default browser is configured
xdg-settings get default-web-browser  # Linux
# Windows: Check Default Apps -> Web browser

# Check OAuth server logs
pm2 logs owlivion-sync-server | grep "oauth"
```

**Solutions:**

**Solution 1: Manually open OAuth URL**
```text
1. When stuck, check terminal/logs for OAuth URL
2. Copy URL manually
3. Paste in browser
4. Complete authorization
```

**Solution 2: Set default browser (Linux)**
```bash
xdg-settings set default-web-browser firefox.desktop
# OR
xdg-settings set default-web-browser google-chrome.desktop
```

**Solution 3: Use environment variable**
```bash
BROWSER=firefox owlivion-mail
# OR
BROWSER=google-chrome owlivion-mail
```

### Issue 2: "IMAP OAuth Hangs Indefinitely" (Known Issue)

**Symptoms:**
- Gmail OAuth connection hangs forever
- App freezes during OAuth IMAP auth
- No error, just infinite loading

**This is a KNOWN BUG in async-imap 0.11.1**

**Solution: Already fixed in current version**
```text
Owlivion uses synchronous imap crate (rust-imap) for OAuth accounts.
If you encounter this:
1. Update to latest version
2. Remove and re-add Gmail account
3. Should work immediately
```

**Root Cause (for developers):**
```rust
// OLD (broken): async-imap with OAuth2
client.authenticate("XOAUTH2", authenticator).await  // HANGS

// NEW (working): sync imap with spawn_blocking
tokio::spawn_blocking(|| {
    client.authenticate("XOAUTH2", &auth)  // WORKS
}).await
```

---

## SSL/TLS Issues

### Issue 1: "Certificate Verification Failed"

**Symptoms:**
- "SSL certificate verification failed"
- "Invalid certificate" error
- Cannot connect to self-signed cert servers

**Diagnosis:**
```bash
# Check certificate
openssl s_client -connect imap.example.com:993 -showcerts

# Verify certificate expiry
echo | openssl s_client -connect imap.example.com:993 2>/dev/null | openssl x509 -noout -dates
```

**Solutions:**

**Solution 1: Enable "Accept Invalid Certificates" (for self-signed certs)**
```text
1. Settings -> Accounts
2. Select account (or add new)
3. Expand "Advanced Settings"
4. Check ☑ "Accept Invalid SSL Certificates"
5. WARNING: Use only for:
   - Self-signed certificates
   - Hostinger/cPanel shared hosting
   - Local test servers
```

**Solution 2: Install custom CA certificate (Linux)**
```bash
# Copy certificate
sudo cp your_ca.crt /usr/local/share/ca-certificates/

# Update CA store
sudo update-ca-certificates

# Restart Owlivion
```

**Solution 3: Update system CA certificates**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ca-certificates

# Restart Owlivion
```

### Issue 2: SMTP Port 587 TLS Handshake Fails (OAuth)

**Symptoms:**
- "TLS handshake failed: wrong version number"
- Gmail OAuth SMTP fails on port 587

**This is a KNOWN ISSUE with Owlivion's OAuth SMTP implementation**

**Solution: Use port 465 instead**
```text
Gmail OAuth accounts automatically use port 465 (direct TLS).
Port 587 requires STARTTLS which is not supported.

If issue persists:
1. Settings -> Accounts
2. Edit Gmail OAuth account
3. SMTP Port: 465
4. SMTP Security: SSL/TLS (not STARTTLS)
5. Save
```

---

## Performance Issues

### Issue 1: High Memory Usage

**Symptoms:**
- App uses > 1GB RAM
- System becomes slow
- "Out of memory" errors

**Diagnosis:**
```bash
# Check memory usage
ps aux | grep owlivion-mail

# Monitor over time
top -p $(pgrep owlivion-mail)
```

**Solutions:**

**Solution 1: Clear cache**
```bash
rm -rf ~/.local/share/owlivion-mail/cache/
```

**Solution 2: Reduce email cache**
```sql
-- Keep only recent emails (last 3 months)
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "
DELETE FROM emails WHERE date < datetime('now', '-3 months');"
```

**Solution 3: Restart application periodically**
```text
Restart Owlivion Mail once a week to clear memory leaks.
```

### Issue 2: Slow Email Loading

**Symptoms:**
- Email list takes > 5 seconds to load
- Scrolling is laggy
- Search is slow

**Solutions:**

**Solution 1: Rebuild FTS5 index**
```bash
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "INSERT INTO emails_fts(emails_fts) VALUES('rebuild');"
```

**Solution 2: Vacuum database**
```bash
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "VACUUM; ANALYZE;"
```

**Solution 3: Disable animations (if available)**
```text
Settings -> General -> Disable animations
```

---

## Error Code Reference

### Client Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `ERR_DB_001` | Database file locked | Close other instances, restart app |
| `ERR_DB_002` | Database corruption | Rebuild database (see above) |
| `ERR_IMAP_001` | IMAP connection timeout | Check firewall, verify IMAP host/port |
| `ERR_IMAP_002` | IMAP authentication failed | Re-enter password, use app password |
| `ERR_IMAP_003` | IMAP mailbox not found | Verify folder name, re-sync account |
| `ERR_SMTP_001` | SMTP connection failed | Check SMTP host/port, firewall |
| `ERR_SMTP_002` | SMTP authentication failed | Re-enter password |
| `ERR_OAUTH_001` | OAuth flow failed | Re-authenticate, check credentials |
| `ERR_OAUTH_002` | OAuth token expired | Auto-refreshes, or re-authenticate |
| `ERR_SYNC_001` | Sync server unreachable | Check internet, server status |
| `ERR_SYNC_002` | Sync conflict detected | Use conflict resolution UI |

### Server Errors (API)

| HTTP Code | Error Code | Description | Solution |
|-----------|------------|-------------|----------|
| 400 | `BAD_REQUEST` | Invalid request data | Check request payload |
| 401 | `UNAUTHORIZED` | Invalid credentials | Re-login, check JWT token |
| 403 | `FORBIDDEN` | Access denied | Check user permissions |
| 404 | `NOT_FOUND` | Resource not found | Verify resource ID |
| 409 | `CONFLICT` | Data conflict | Resolve conflict, retry |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded | Wait 15 minutes, retry |
| 500 | `INTERNAL_ERROR` | Server error | Check server logs, contact support |
| 502 | `BAD_GATEWAY` | Nginx/PM2 issue | Restart services |
| 503 | `SERVICE_UNAVAILABLE` | Server down | Check PM2, PostgreSQL status |

---

## Diagnostic Tools

### Database Inspection (SQLite)

```bash
# Open database
sqlite3 ~/.local/share/owlivion-mail/owlivion.db

# List tables
.tables

# Show schema
.schema emails

# Count records
SELECT COUNT(*) FROM emails;

# Check settings
SELECT * FROM settings;

# Exit
.quit
```

### Log Viewing

**Client Logs:**
```bash
# Linux
tail -f ~/.local/share/owlivion-mail/logs/app.log

# macOS
tail -f ~/Library/Logs/owlivion-mail/app.log

# Windows (PowerShell)
Get-Content "$env:APPDATA\owlivion-mail\logs\app.log" -Wait
```

**Server Logs:**
```bash
# PM2 logs
pm2 logs owlivion-sync-server

# PM2 error logs only
pm2 logs owlivion-sync-server --err

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Network Debugging

```bash
# Test IMAP connection
telnet imap.gmail.com 993
openssl s_client -connect imap.gmail.com:993

# Test SMTP connection
telnet smtp.gmail.com 587
openssl s_client -starttls smtp -connect smtp.gmail.com:587

# Test API endpoint
curl -v https://owlivion.com/api/v1/health

# DNS lookup
nslookup imap.gmail.com
dig imap.gmail.com

# Traceroute
traceroute imap.gmail.com
```

---

## Getting Help

### Before Reporting Issues

1. ✅ Check this troubleshooting guide
2. ✅ Search existing issues: https://github.com/babafpv/owlivion-mail/issues
3. ✅ Collect logs (client + server if applicable)
4. ✅ Note error codes and symptoms
5. ✅ Try quick fixes above

### Reporting Bugs

**Include the following information:**

1. **System Information:**
   - OS (Windows 11, Ubuntu 22.04, macOS 14, etc.)
   - Owlivion Mail version
   - Installation method (installer, AppImage, DMG)

2. **Error Details:**
   - Error code (if any)
   - Exact error message
   - Steps to reproduce

3. **Logs:**
   - Client logs (last 100 lines)
   - Server logs (if sync issue)
   - Database query results (if relevant)

4. **Context:**
   - What were you trying to do?
   - When did it start happening?
   - Does it happen consistently?

**Submit issue:** https://github.com/babafpv/owlivion-mail/issues/new

---

## Related Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK.md)
- [User Migration Guide](./USER_MIGRATION_GUIDE.md)

---

**Document Status:** ✅ Active
**Last Updated:** February 5, 2026
**Maintainer:** Support Team
