# Owlivion Mail - User Migration Guide

> **Last Updated:** February 5, 2026
> **Purpose:** User data migration, account transfer, backup/restore procedures
> **Audience:** End Users, System Administrators

## Table of Contents

1. [Overview](#overview)
2. [Migration Scenarios](#migration-scenarios)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Backup Procedures](#backup-procedures)
5. [Migration: Same Computer (OS Reinstall)](#migration-same-computer-os-reinstall)
6. [Migration: New Computer (Same OS)](#migration-new-computer-same-os)
7. [Migration: Cross-Platform (Windows ↔ Linux ↔ macOS)](#migration-cross-platform)
8. [Migration: From Other Email Clients](#migration-from-other-email-clients)
9. [Restore Procedures](#restore-procedures)
10. [Account Sync (Cloud Backup)](#account-sync-cloud-backup)
11. [Troubleshooting Migration Issues](#troubleshooting-migration-issues)

---

## Overview

Owlivion Mail stores all data locally in SQLite databases. This guide covers:
- **Local Migration**: Moving data between computers/OS
- **Cloud Sync**: Using Owlivion Account for automatic backup
- **Backup/Restore**: Manual backup and restoration
- **Import/Export**: Migrating from other email clients

### Data Storage Locations

| Platform | Database Location | Settings Location |
|----------|-------------------|-------------------|
| **Windows** | `%APPDATA%\owlivion-mail\owlivion.db` | `%APPDATA%\owlivion-mail\` |
| **Linux** | `~/.local/share/owlivion-mail/owlivion.db` | `~/.config/owlivion-mail/` |
| **macOS** | `~/Library/Application Support/owlivion-mail/owlivion.db` | `~/Library/Preferences/owlivion-mail/` |

### What Gets Migrated

✅ **Included in Migration:**
- Email accounts (encrypted passwords)
- Downloaded emails (cached locally)
- Contacts
- Settings & preferences
- Email signatures
- Drafts
- Starred/flagged emails
- Search index (FTS5)
- Folder structure

❌ **Not Included:**
- OAuth2 tokens (will need re-authentication)
- Temporary cache files
- Log files
- IMAP/SMTP connection states

---

## Migration Scenarios

### Scenario 1: OS Reinstall (Same Computer)
**Use Case:** Reinstalling Windows, upgrading Linux, etc.
**Method:** [Backup before reinstall → Install Owlivion → Restore](#migration-same-computer-os-reinstall)

### Scenario 2: New Computer (Same OS)
**Use Case:** Upgrading laptop, buying new desktop
**Method:** [Backup old computer → Transfer files → Restore on new computer](#migration-new-computer-same-os)

### Scenario 3: Cross-Platform Migration
**Use Case:** Windows → Linux, macOS → Windows, etc.
**Method:** [Export database → Install on new OS → Import database](#migration-cross-platform)

### Scenario 4: From Other Email Clients
**Use Case:** Migrating from Thunderbird, Outlook, Apple Mail
**Method:** [Use IMAP sync (no direct import)](#migration-from-other-email-clients)

### Scenario 5: Cloud Sync (Recommended)
**Use Case:** Automatic backup across multiple devices
**Method:** [Enable Owlivion Account Sync](#account-sync-cloud-backup)

---

## Pre-Migration Checklist

Before starting migration, complete these steps:

- [ ] **Verify Owlivion version** (same or newer on destination)
- [ ] **Check disk space** (database size + 500MB free)
- [ ] **Close Owlivion Mail** (on source computer)
- [ ] **Note OAuth accounts** (will need re-authentication)
- [ ] **Backup current data** (even if synced to cloud)
- [ ] **Test backup integrity** (open database with sqlite3)

**Check Database Size:**
```bash
# Windows (PowerShell)
Get-ChildItem "$env:APPDATA\owlivion-mail\owlivion.db" | Select-Object Name, @{Name="SizeMB";Expression={$_.Length / 1MB}}

# Linux/macOS
du -h ~/.local/share/owlivion-mail/owlivion.db
```

---

## Backup Procedures

### Method 1: Manual Backup (Recommended)

**Windows:**
```powershell
# 1. Close Owlivion Mail
# 2. Open PowerShell

# 3. Create backup folder
New-Item -Path "$env:USERPROFILE\Desktop\OwlivionBackup" -ItemType Directory

# 4. Copy database
Copy-Item -Path "$env:APPDATA\owlivion-mail\owlivion.db" -Destination "$env:USERPROFILE\Desktop\OwlivionBackup\"

# 5. Copy settings
Copy-Item -Path "$env:APPDATA\owlivion-mail\settings.json" -Destination "$env:USERPROFILE\Desktop\OwlivionBackup\" -ErrorAction SilentlyContinue

# 6. Compress backup (optional)
Compress-Archive -Path "$env:USERPROFILE\Desktop\OwlivionBackup\*" -DestinationPath "$env:USERPROFILE\Desktop\OwlivionBackup_$(Get-Date -Format 'yyyyMMdd').zip"
```

**Linux/macOS:**
```bash
# 1. Close Owlivion Mail
# 2. Open Terminal

# 3. Create backup folder
mkdir -p ~/Desktop/OwlivionBackup

# 4. Copy database
cp ~/.local/share/owlivion-mail/owlivion.db ~/Desktop/OwlivionBackup/

# 5. Copy settings
cp -r ~/.config/owlivion-mail ~/Desktop/OwlivionBackup/ 2>/dev/null || true

# 6. Compress backup
cd ~/Desktop
tar -czf OwlivionBackup_$(date +%Y%m%d).tar.gz OwlivionBackup/

# 7. Verify backup
tar -tzf OwlivionBackup_$(date +%Y%m%d).tar.gz | head -10
```

### Method 2: Cloud Sync Backup (Automatic)

**Enable Owlivion Account Sync:**
```text
1. Open Owlivion Mail
2. Go to Settings → Sync
3. Click "Create Account or Login"
4. Follow registration process
5. Enable sync for:
   ☑ Accounts (encrypted, no passwords)
   ☑ Contacts
   ☑ Preferences
   ☑ Signatures
6. Click "Sync Now"
7. Wait for "✓ Sync complete" message
```

**What Gets Synced:**
- ✅ Account configurations (no passwords)
- ✅ Contacts
- ✅ App preferences
- ✅ Email signatures
- ❌ Email content (use IMAP sync)
- ❌ Passwords (security)

### Method 3: Database Export (SQL Dump)

```bash
# Export entire database to SQL
sqlite3 ~/.local/share/owlivion-mail/owlivion.db .dump > owlivion_backup.sql

# Compress SQL dump
gzip owlivion_backup.sql

# Result: owlivion_backup.sql.gz (portable, text format)
```

---

## Migration: Same Computer (OS Reinstall)

**Scenario:** Reinstalling Windows, upgrading Ubuntu, etc.

### Before Reinstall

```bash
# 1. Backup database (see above)
# 2. Save backup to external drive or cloud storage
# 3. Note Owlivion version: Help → About
# 4. Proceed with OS reinstall
```

### After Reinstall

```bash
# 1. Install Owlivion Mail (same or newer version)
# Download from: https://github.com/babafpv/owlivion-mail/releases

# 2. Run Owlivion once (creates folders)
# 3. Close Owlivion

# 4. Restore database
# Windows:
Copy-Item -Path "D:\Backup\owlivion.db" -Destination "$env:APPDATA\owlivion-mail\" -Force

# Linux/macOS:
cp /path/to/backup/owlivion.db ~/.local/share/owlivion-mail/

# 5. Set permissions (Linux/macOS only)
chmod 644 ~/.local/share/owlivion-mail/owlivion.db

# 6. Start Owlivion Mail
# 7. Re-authenticate OAuth accounts (Gmail, etc.)
```

**Expected Result:**
- ✅ All emails appear
- ✅ Settings preserved
- ✅ Contacts intact
- ⚠️ OAuth accounts need re-authentication

---

## Migration: New Computer (Same OS)

**Scenario:** Moving from old laptop to new laptop (same OS)

### Step 1: Backup from Old Computer

Follow [Backup Procedures](#backup-procedures) above.

### Step 2: Transfer Backup

**Method A: USB Drive**
```bash
# Copy to USB
cp ~/Desktop/OwlivionBackup_*.tar.gz /media/USB_DRIVE/
```

**Method B: Cloud Storage**
```bash
# Upload to Dropbox/Google Drive/OneDrive
# Or use scp/rsync for Linux:
scp ~/Desktop/OwlivionBackup_*.tar.gz user@new-computer:/tmp/
```

### Step 3: Restore on New Computer

```bash
# 1. Install Owlivion Mail
# 2. Extract backup
cd ~/Desktop
tar -xzf OwlivionBackup_20260205.tar.gz

# 3. Close Owlivion (if running)

# 4. Copy database
cp OwlivionBackup/owlivion.db ~/.local/share/owlivion-mail/

# 5. Copy settings (optional)
cp -r OwlivionBackup/owlivion-mail/* ~/.config/owlivion-mail/ 2>/dev/null || true

# 6. Fix permissions
chmod 644 ~/.local/share/owlivion-mail/owlivion.db
chmod 755 ~/.local/share/owlivion-mail/

# 7. Start Owlivion Mail
```

**Verification:**
```bash
# Check email count
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT COUNT(*) FROM emails;"

# Check accounts
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT email FROM accounts;"
```

---

## Migration: Cross-Platform

**Scenario:** Windows → Linux, macOS → Windows, etc.

### Step 1: Export Database (Source OS)

**On Windows:**
```powershell
# Copy database to USB or cloud
Copy-Item -Path "$env:APPDATA\owlivion-mail\owlivion.db" -Destination "D:\owlivion_export.db"
```

**On Linux/macOS:**
```bash
# Copy to Downloads for easy access
cp ~/.local/share/owlivion-mail/owlivion.db ~/Downloads/owlivion_export.db
```

### Step 2: Transfer to Destination Computer

- Use USB drive, email, cloud storage, or network share
- File: `owlivion_export.db`

### Step 3: Import on Destination OS

**On Windows (destination):**
```powershell
# 1. Install Owlivion Mail for Windows
# 2. Run once, then close
# 3. Open PowerShell

# Replace database
Copy-Item -Path "D:\owlivion_export.db" -Destination "$env:APPDATA\owlivion-mail\owlivion.db" -Force

# Start Owlivion
```

**On Linux/macOS (destination):**
```bash
# 1. Install Owlivion Mail
# 2. Run once, then close

# Replace database
cp ~/Downloads/owlivion_export.db ~/.local/share/owlivion-mail/owlivion.db

# Fix permissions
chmod 644 ~/.local/share/owlivion-mail/owlivion.db

# Start Owlivion
```

**Important Notes:**
- ✅ Database is platform-independent (SQLite)
- ✅ All data transfers (emails, contacts, settings)
- ⚠️ OAuth accounts need re-authentication
- ⚠️ File paths in settings may need adjustment (rare)

---

## Migration: From Other Email Clients

### Thunderbird → Owlivion

**Method: IMAP Re-Sync (Recommended)**
```text
1. Ensure emails are on IMAP server (Gmail, Outlook, etc.)
2. Add same account to Owlivion Mail
3. Wait for automatic IMAP sync
4. Verify all emails downloaded
5. Uninstall Thunderbird (optional)
```

**Manual Export (Advanced):**
```text
Thunderbird uses Mbox format.
Owlivion doesn't support direct Mbox import.

Alternative:
1. Export Thunderbird emails to IMAP server
2. Sync Owlivion with same IMAP server
```

### Outlook (Windows) → Owlivion

**Method: Use IMAP Account**
```text
1. Ensure Outlook uses IMAP (not POP3)
2. Add same account to Owlivion
3. Enable IMAP sync
4. Wait for download
```

**If using Exchange/Office 365:**
```text
1. Add account to Owlivion
2. Use OAuth2 if available (Gmail, Outlook.com)
3. OR: Use app password
```

### Apple Mail (macOS) → Owlivion

**Method: IMAP Re-Sync**
```text
1. Verify account uses IMAP
2. Add account to Owlivion Mail
3. Automatic sync
```

**Export Contacts:**
```text
Apple Mail contacts are in Contacts.app:
1. Open Contacts.app
2. Select all contacts (Cmd+A)
3. File → Export → Export vCard
4. Import to Owlivion:
   Settings → Contacts → Import vCard
```

### Gmail Web → Owlivion

**Method: OAuth2 Authentication (Best)**
```text
1. Owlivion Mail → Add Account
2. Select "Gmail (OAuth2)"
3. Authorize with Google
4. All emails sync automatically
```

### Other Clients (Evolution, KMail, etc.)

**Use IMAP sync method for all clients.**

---

## Restore Procedures

### Restore from Manual Backup

**Windows:**
```powershell
# 1. Close Owlivion Mail

# 2. Extract backup
Expand-Archive -Path "$env:USERPROFILE\Desktop\OwlivionBackup_20260205.zip" -DestinationPath "$env:USERPROFILE\Desktop\OwlivionRestore"

# 3. Replace database
Copy-Item -Path "$env:USERPROFILE\Desktop\OwlivionRestore\owlivion.db" -Destination "$env:APPDATA\owlivion-mail\" -Force

# 4. Start Owlivion
```

**Linux/macOS:**
```bash
# 1. Close Owlivion Mail

# 2. Extract backup
cd ~/Desktop
tar -xzf OwlivionBackup_20260205.tar.gz

# 3. Replace database
cp OwlivionBackup/owlivion.db ~/.local/share/owlivion-mail/

# 4. Fix permissions
chmod 644 ~/.local/share/owlivion-mail/owlivion.db

# 5. Start Owlivion
```

### Restore from SQL Dump

```bash
# 1. Close Owlivion Mail

# 2. Remove current database
rm ~/.local/share/owlivion-mail/owlivion.db

# 3. Import SQL dump
sqlite3 ~/.local/share/owlivion-mail/owlivion.db < owlivion_backup.sql

# 4. Verify integrity
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "PRAGMA integrity_check;"

# 5. Start Owlivion
```

### Restore from Cloud Sync

```text
1. Install Owlivion Mail on new device
2. Settings → Sync
3. Login to Owlivion Account
4. Click "Sync Now"
5. Select "Download from server" for conflicts
6. Wait for sync completion
7. Add email accounts manually (passwords not synced)
8. IMAP will re-download emails
```

**What Gets Restored from Cloud:**
- ✅ Account configurations
- ✅ Contacts
- ✅ Settings/preferences
- ✅ Signatures
- ❌ Email content (use IMAP)
- ❌ Passwords (security)

---

## Account Sync (Cloud Backup)

### Enable Account Sync

```text
1. Open Owlivion Mail
2. Settings → Sync
3. Click "Create Account or Login"
4. Register with:
   - Email
   - Password (for Owlivion Account, not email)
   - Device name
5. Verify email (check inbox)
6. Login to Owlivion Account
7. Configure sync:
   ☑ Accounts
   ☑ Contacts
   ☑ Preferences
   ☑ Signatures
8. Click "Sync Now"
```

### Manual Sync

```text
1. Settings → Sync
2. Click "Manual Sync"
3. Wait for "✓ Sync complete"
```

### Auto-Sync Schedule

```text
Settings → Sync → Background Sync
- Enable: ☑ Auto-sync on startup
- Interval: 15 / 30 / 60 / 120 / 240 minutes
```

### Sync Multiple Devices

```text
Device 1 (Primary):
1. Enable sync (as above)
2. Sync all data

Device 2 (Secondary):
1. Install Owlivion Mail
2. Login to same Owlivion Account
3. Click "Download from Server"
4. Data syncs automatically
```

### Conflict Resolution

```text
If both devices modified data:
1. Sync will show "Conflict detected"
2. Click "Resolve Conflicts"
3. Choose:
   - Use Local (this device)
   - Use Server (other devices)
4. Click "Apply"
5. Sync completes
```

---

## Troubleshooting Migration Issues

### Issue 1: Database Won't Open After Migration

**Error:** "database disk image is malformed"

**Solution:**
```bash
# Check integrity
sqlite3 owlivion.db "PRAGMA integrity_check;"

# If corrupted, try recovery:
sqlite3 owlivion.db ".dump" | sqlite3 owlivion_recovered.db

# Replace database
mv owlivion_recovered.db ~/.local/share/owlivion-mail/owlivion.db
```

### Issue 2: Emails Missing After Migration

**Check email count:**
```bash
sqlite3 ~/.local/share/owlivion-mail/owlivion.db "SELECT COUNT(*) FROM emails;"
```

**Solutions:**
1. **Backup had zero emails:** Re-sync from IMAP
2. **FTS5 index missing:** Rebuild index
   ```sql
   INSERT INTO emails_fts(emails_fts) VALUES('rebuild');
   ```
3. **Wrong backup file:** Use correct backup file

### Issue 3: OAuth Accounts Not Working

**Expected behavior:** OAuth tokens don't migrate (security)

**Solution:**
```text
1. Settings → Accounts
2. Select OAuth account (Gmail, etc.)
3. Click "Re-authenticate"
4. Follow OAuth flow
5. Done
```

### Issue 4: Permissions Error (Linux/macOS)

**Error:** "Permission denied" when accessing database

**Solution:**
```bash
# Fix ownership
chown $USER:$USER ~/.local/share/owlivion-mail/owlivion.db

# Fix permissions
chmod 644 ~/.local/share/owlivion-mail/owlivion.db
chmod 755 ~/.local/share/owlivion-mail/
```

### Issue 5: Database Too Large for Transfer

**If database > 2GB:**

**Solution 1: Export recent emails only**
```sql
-- Export last 6 months
sqlite3 owlivion.db << 'EOF'
ATTACH DATABASE 'owlivion_recent.db' AS recent;

-- Copy schema
CREATE TABLE recent.emails AS SELECT * FROM emails WHERE date > datetime('now', '-6 months');

-- Copy other tables (full)
.dump accounts contacts settings folders
EOF

-- Use owlivion_recent.db for migration
```

**Solution 2: Compress backup**
```bash
# Compress database (can reduce size by 50-70%)
gzip -9 owlivion.db

# Transfer: owlivion.db.gz

# Decompress on destination:
gunzip owlivion.db.gz
```

---

## Best Practices

### ✅ Do's
- ✅ Backup regularly (weekly recommended)
- ✅ Test backups before migration
- ✅ Use Cloud Sync for automatic backup
- ✅ Verify data after restoration
- ✅ Keep multiple backup copies
- ✅ Document OAuth accounts (will need re-auth)

### ❌ Don'ts
- ❌ Don't modify database manually (corruption risk)
- ❌ Don't interrupt migration/restore process
- ❌ Don't share backups (contains sensitive data)
- ❌ Don't store backups unencrypted in cloud
- ❌ Don't forget to close Owlivion before backup

### Security Recommendations

**Encrypt Backups (Recommended):**
```bash
# Encrypt with GPG
gpg -c owlivion_backup.tar.gz
# Creates: owlivion_backup.tar.gz.gpg

# Decrypt:
gpg owlivion_backup.tar.gz.gpg
```

**Secure Storage:**
- Use encrypted cloud storage (Tresorit, Sync.com)
- Enable 2FA on cloud accounts
- Delete backups from public locations after transfer

---

## Migration Checklist

### Before Migration
- [ ] Backup database to external storage
- [ ] Verify backup integrity (sqlite3 check)
- [ ] Note Owlivion version
- [ ] Document email accounts & passwords
- [ ] Document OAuth accounts (need re-auth)
- [ ] Export contacts (if not using sync)

### After Migration
- [ ] Install Owlivion Mail (same/newer version)
- [ ] Restore database
- [ ] Fix permissions (Linux/macOS)
- [ ] Verify email count matches backup
- [ ] Re-authenticate OAuth accounts
- [ ] Test email send/receive
- [ ] Test search functionality
- [ ] Verify settings preserved
- [ ] Delete backup from public locations

---

## Support

**Need help with migration?**
- **Documentation:** /docs/TROUBLESHOOTING.md
- **Issues:** https://github.com/babafpv/owlivion-mail/issues
- **Email:** support@owlivion.com

---

## Related Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

**Document Status:** ✅ Active
**Last Updated:** February 5, 2026
**Maintainer:** Support Team
