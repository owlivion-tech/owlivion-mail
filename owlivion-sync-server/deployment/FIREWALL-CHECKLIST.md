# Task #3: UFW Firewall Setup Checklist

## Overview
Configure UFW firewall on production VPS (31.97.216.36) to secure the Owlivion Sync Server.

## Prerequisites
- [x] VPS deployment complete (Task #1)
- [ ] SSH access to VPS
- [ ] Root/sudo privileges

## Security Goals
- ✅ Allow only necessary ports (SSH, HTTP, HTTPS)
- ✅ Block direct access to database (PostgreSQL on 5432)
- ✅ Block direct access to Node.js app (port 3000)
- ✅ Prevent SSH brute-force attacks (rate limiting)
- ✅ Default deny incoming, allow outgoing

## Firewall Rules Summary

| Port | Protocol | Access | Purpose | Status |
|------|----------|--------|---------|--------|
| 22 | TCP | Allow (rate-limited) | SSH access | ⏳ Pending |
| 80 | TCP | Allow | HTTP traffic | ⏳ Pending |
| 443 | TCP | Allow | HTTPS traffic | ⏳ Pending |
| 5432 | TCP | Deny (external) | PostgreSQL | ⏳ Pending |
| 3000 | TCP | Deny (external) | Node.js app | ⏳ Pending |

## Execution Steps

### 1. Upload Script to VPS
```bash
# From local machine
scp owlivion-sync-server/deployment/setup-firewall.sh owlivion@31.97.216.36:~/
```

### 2. Connect to VPS
```bash
ssh owlivion@31.97.216.36
```

### 3. Make Script Executable
```bash
chmod +x ~/setup-firewall.sh
```

### 4. Run Firewall Setup
```bash
sudo ./setup-firewall.sh
```

**⚠️ CRITICAL WARNING:**
- This script MUST allow SSH (port 22) FIRST
- DO NOT disconnect from current SSH session until verified
- Keep backup SSH session open during setup

### 5. Verify Firewall Status
```bash
# Check UFW status
sudo ufw status verbose

# Check listening ports
sudo ss -tulnp | grep LISTEN

# Test SSH from another terminal (DO NOT close current session!)
ssh owlivion@31.97.216.36
```

### 6. Test External Access

From local machine:
```bash
# Should work (after SSL setup):
curl http://31.97.216.36
curl https://31.97.216.36

# Should be blocked:
telnet 31.97.216.36 5432  # PostgreSQL
telnet 31.97.216.36 3000  # Node.js app
```

## Post-Setup Verification

- [ ] SSH connection still works
- [ ] UFW is active and enabled
- [ ] HTTP (80) is accessible
- [ ] HTTPS (443) is accessible (after Task #2)
- [ ] PostgreSQL (5432) is NOT accessible externally
- [ ] Node.js app (3000) is NOT accessible externally
- [ ] SSH rate limiting is active

## Monitoring Commands

```bash
# View UFW logs
sudo tail -f /var/log/ufw.log

# Check UFW status
sudo ufw status numbered

# List all rules
sudo ufw show added

# Check denied connections
sudo grep -i 'UFW BLOCK' /var/log/ufw.log
```

## Troubleshooting

### Locked Out of SSH
If you get locked out, access via VPS provider's console:
```bash
sudo ufw disable
sudo ufw allow 22/tcp
sudo ufw enable
```

### Reset Firewall
```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw enable
```

### Add Custom Rule
```bash
# Allow specific IP
sudo ufw allow from <IP_ADDRESS> to any port 22

# Delete rule
sudo ufw delete <rule_number>
```

## Expected Output

After successful setup, `sudo ufw status` should show:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     LIMIT       Anywhere                   # SSH rate limit
80/tcp                     ALLOW       Anywhere                   # HTTP
443/tcp                    ALLOW       Anywhere                   # HTTPS
5432/tcp                   DENY        Anywhere                   # Block external PostgreSQL
3000/tcp                   DENY        Anywhere                   # Block direct Node.js access
```

## Integration with Other Tasks

- **Task #1 (VPS Deployment)**: ✅ Complete
- **Task #2 (SSL Setup)**: Requires ports 80/443 open (provided by this task)
- **Task #4 (Production Tests)**: Will verify firewall rules

## Security Best Practices

1. ✅ **Minimal Attack Surface**: Only expose necessary ports
2. ✅ **Defense in Depth**: Application-level + network-level security
3. ✅ **Rate Limiting**: Prevent brute-force attacks
4. ✅ **Logging**: Enable UFW logging for audit trail
5. ⏳ **Regular Audits**: Review firewall rules monthly

## Rollback Plan

If issues occur:
```bash
# Disable firewall temporarily
sudo ufw disable

# Re-enable after fixing
sudo ufw enable
```

## Notes
- Nginx will reverse proxy to Node.js app (3000)
- PostgreSQL only needs localhost access
- All internal services communicate via localhost
- External clients only interact via Nginx (80/443)

## Success Criteria
- [ ] UFW active and enabled on boot
- [ ] Only SSH, HTTP, HTTPS accessible externally
- [ ] All internal services protected
- [ ] SSH rate limiting active
- [ ] No service disruption

---
**Status**: ⏳ Ready for execution
**Estimated Time**: 5-10 minutes
**Risk Level**: Medium (SSH lockout risk - mitigated by keeping session open)
