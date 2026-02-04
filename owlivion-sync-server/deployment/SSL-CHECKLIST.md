# SSL Setup Checklist - Task #2

## Pre-Setup Checklist

- [ ] **DNS Configuration**
  - [ ] A record created: `sync.owlivion.com → 31.97.216.36`
  - [ ] DNS propagation verified: `dig +short sync.owlivion.com`
  - [ ] Wait 5-10 minutes after DNS changes

- [ ] **VPS Access**
  - [ ] SSH connection working: `ssh owlivion@31.97.216.36`
  - [ ] SSH key added to agent: `ssh-add ~/.ssh/id_rsa`
  - [ ] Sudo access verified

- [ ] **Application Status**
  - [ ] Node.js server running: `pm2 status`
  - [ ] Health check responds: `curl http://31.97.216.36:3000/api/v1/health`
  - [ ] PostgreSQL running: `sudo systemctl status postgresql`

- [ ] **Ports Open (Task #3 dependency)**
  - [ ] Port 80 accessible from internet
  - [ ] Port 443 accessible from internet
  - [ ] Check with: `telnet sync.owlivion.com 80`

## Setup Execution

- [ ] **Update Configuration**
  - [ ] Email address updated in `setup-ssl.sh` (line 18)
  - [ ] Domain name verified: `sync.owlivion.com`

- [ ] **Run Setup Script**
  ```bash
  cd owlivion-sync-server/deployment
  ./setup-ssl.sh
  ```

- [ ] **Script Steps Completed**
  - [ ] SSH connection test passed
  - [ ] DNS resolution verified
  - [ ] Certbot installed
  - [ ] Temporary Nginx config deployed
  - [ ] SSL certificate obtained
  - [ ] Production Nginx config deployed
  - [ ] Automatic renewal configured
  - [ ] Post-setup verification passed

## Post-Setup Verification

- [ ] **HTTPS Functionality**
  ```bash
  # Should return 200 OK
  curl -v https://sync.owlivion.com/api/v1/health
  ```

- [ ] **HTTP Redirect**
  ```bash
  # Should return 301 redirect
  curl -I http://sync.owlivion.com/
  ```

- [ ] **Certificate Information**
  ```bash
  ssh owlivion@31.97.216.36 'sudo certbot certificates'
  ```
  - [ ] Certificate domain: sync.owlivion.com
  - [ ] Expiry date: ~90 days from now
  - [ ] Valid from: today

- [ ] **Nginx Status**
  ```bash
  ssh owlivion@31.97.216.36 'sudo systemctl status nginx'
  ```
  - [ ] Active (running)
  - [ ] No errors in logs

- [ ] **SSL Labs Test**
  - [ ] Visit: https://www.ssllabs.com/ssltest/analyze.html?d=sync.owlivion.com
  - [ ] Target grade: A or A+
  - [ ] TLS 1.2 and 1.3 enabled
  - [ ] TLS 1.0 and 1.1 disabled

## Security Verification

- [ ] **Security Headers**
  ```bash
  curl -I https://sync.owlivion.com
  ```
  Verify presence of:
  - [ ] `Strict-Transport-Security: max-age=63072000`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-XSS-Protection: 1; mode=block`

- [ ] **Certificate Chain**
  ```bash
  openssl s_client -connect sync.owlivion.com:443 -showcerts < /dev/null
  ```
  - [ ] Certificate chain valid
  - [ ] No certificate errors
  - [ ] Issuer: Let's Encrypt

- [ ] **Rate Limiting**
  ```bash
  # Test auth endpoint rate limit
  for i in {1..6}; do curl -X POST https://sync.owlivion.com/api/v1/auth/login; done
  ```
  - [ ] 6th request returns 429 (Too Many Requests)

## Automatic Renewal

- [ ] **Renewal Timer**
  ```bash
  ssh owlivion@31.97.216.36 'sudo systemctl status certbot.timer'
  ```
  - [ ] Active (waiting)
  - [ ] Next run scheduled

- [ ] **Dry Run Test**
  ```bash
  ssh owlivion@31.97.216.36 'sudo certbot renew --dry-run'
  ```
  - [ ] Test passed
  - [ ] No errors

## Documentation Update

- [ ] **Update TODO.md**
  - [ ] Mark Task #2 as completed: `[x]`
  - [ ] Update Phase 4 progress

- [ ] **Commit Changes**
  ```bash
  git add deployment/setup-ssl.sh deployment/SSL-SETUP.md deployment/SSL-CHECKLIST.md
  git commit -m "Phase 4 Task #2: Complete SSL certificate configuration"
  ```

- [ ] **Test from Desktop Client** (Future)
  - [ ] Update frontend API endpoint to use HTTPS
  - [ ] Test sync functionality with HTTPS
  - [ ] Verify certificate is trusted by system

## Rollback Plan (If Issues)

If SSL setup fails and needs rollback:

1. **Remove SSL Configuration**
   ```bash
   ssh owlivion@31.97.216.36 '
     sudo rm /etc/nginx/sites-enabled/owlivion-sync
     sudo systemctl stop nginx
   '
   ```

2. **Restore Direct Access (Temporary)**
   ```bash
   # Access via HTTP on port 3000 only
   curl http://31.97.216.36:3000/api/v1/health
   ```

3. **Debug Issues**
   - Check certbot logs: `/var/log/letsencrypt/letsencrypt.log`
   - Check nginx logs: `/var/log/nginx/error.log`
   - Verify DNS resolution
   - Verify ports 80/443 are open

4. **Re-run Setup**
   ```bash
   ./setup-ssl.sh
   ```

## Next Steps After Completion

1. ✓ Task #2 complete
2. → Proceed to **Task #3: Firewall Configuration (ufw)**
3. → Then: **Execute Production Tests**
4. → Finally: **Monitoring & Alerting Setup**

## Notes

- Certificate renewal happens automatically every 60 days
- Monitor certificate expiration: https://certificatemonitor.org/
- Keep this checklist for future reference
- Document any issues encountered in SSL-SETUP.md

---

**Task #2 Status:** [ ] Not Started | [ ] In Progress | [ ] Completed | [ ] Blocked

**Completed By:** _______________
**Date:** _______________
**Duration:** _______________
