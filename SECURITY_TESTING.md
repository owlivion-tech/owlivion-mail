# Penetration Testing Checklist

## Authentication & Authorization

- [ ] SQL injection in login endpoint
- [ ] Brute force login protection (rate limiting)
- [ ] Password complexity enforcement
- [ ] JWT token manipulation
- [ ] JWT secret brute forcing
- [ ] Session fixation
- [ ] Session hijacking
- [ ] Privilege escalation (access other users' data)
- [ ] 2FA bypass attempts
- [ ] Backup code reuse

## API Security

- [ ] SQL injection in all endpoints
- [ ] NoSQL injection (JSON params)
- [ ] Command injection
- [ ] Path traversal
- [ ] SSRF (Server-Side Request Forgery)
- [ ] XXE (XML External Entity)
- [ ] IDOR (Insecure Direct Object Reference)
- [ ] Mass assignment
- [ ] Rate limiting bypass
- [ ] Parameter pollution

## Encryption & Data Protection

- [ ] Man-in-the-middle (HTTPS enforcement)
- [ ] Weak cipher suites
- [ ] Certificate validation
- [ ] E2E encryption bypass
- [ ] Encrypted data tampering
- [ ] Key derivation weaknesses
- [ ] Replay attacks

## Web Security

- [ ] XSS (Cross-Site Scripting)
- [ ] CSRF (Cross-Site Request Forgery)
- [ ] Clickjacking (X-Frame-Options)
- [ ] CORS misconfiguration
- [ ] Content-Type sniffing
- [ ] Open redirects
- [ ] HTTP header injection

## Infrastructure

- [ ] Default credentials
- [ ] Exposed admin panels
- [ ] Directory listing
- [ ] Sensitive file exposure (.env, .git)
- [ ] Verbose error messages (stack traces)
- [ ] Information disclosure (server version)

## Tools

- **Burp Suite Professional** - Comprehensive web app security testing
- **OWASP ZAP** - Open-source web app scanner
- **SQLMap** - Automated SQL injection testing
- **Nikto** - Web server scanner
- **Nmap** - Network scanner
- **John the Ripper** - Password cracking

---

## Automated Security Scanning

### NPM Audit (Dependency Vulnerabilities)

```bash
cd owlivion-sync-server
npm run security:audit
```

**What it checks:**
- Known vulnerabilities in npm dependencies
- Outdated packages with security issues
- Recommended fixes and updates

**Expected output:**
```
found 0 vulnerabilities
```

### Snyk (Advanced Vulnerability Scanning)

```bash
cd owlivion-sync-server
npm run security:snyk
```

**What it checks:**
- Deep dependency tree analysis
- License compliance issues
- CVE database cross-reference
- Fix recommendations with code examples

**Setup:**
```bash
# First time setup
npm install -g snyk
snyk auth  # Requires Snyk account (free tier available)
```

### Retire.js (Known Vulnerable Libraries)

```bash
cd owlivion-sync-server
npm run security:retire
```

**What it checks:**
- JavaScript libraries with known vulnerabilities
- Frontend and backend dependencies
- Outdated library versions

---

## Manual Penetration Testing

### 1. SQL Injection Tests

#### Test 1: Login Bypass
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com'\'' OR 1=1--","password":"any"}'
```

**Expected result:** ❌ Should FAIL with "Invalid credentials" (not SQL error)

#### Test 2: Union-based SQL Injection
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com'\'' UNION SELECT * FROM users--","password":"test"}'
```

**Expected result:** ❌ Should FAIL (parameterized queries prevent this)

### 2. JWT Token Manipulation

#### Test 1: Decode and Modify Token
```bash
# 1. Login to get valid token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.access_token')

# 2. Decode JWT (use https://jwt.io or jwt-cli)
echo $TOKEN | base64 -d

# 3. Modify userId in payload, try to re-sign with weak secret "secret"
# 4. Send request with modified token
curl -X GET http://localhost:3000/api/v1/sync/download?data_type=contacts \
  -H "Authorization: Bearer <MODIFIED_TOKEN>"
```

**Expected result:** ❌ Should FAIL with "Invalid token" (signature verification fails)

### 3. Rate Limiting Tests

#### Test 1: Brute Force Login
```bash
# Send 10 login requests rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong_password"}' &
done
wait
```

**Expected result:** ✅ First 5 requests should fail normally, requests 6-10 should get **429 Too Many Requests**

#### Test 2: General API Rate Limiting
```bash
# Send 120 requests in 1 minute (exceeds 100 req/min limit)
for i in {1..120}; do
  curl -X GET http://localhost:3000/api/v1/health &
done
wait
```

**Expected result:** ✅ Requests after 100 should get **429 Too Many Requests**

### 4. IDOR (Insecure Direct Object Reference)

#### Test 1: Access Other User's Data
```bash
# 1. Login as user A
TOKEN_A=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userA@example.com","password":"password"}' \
  | jq -r '.access_token')

# 2. Login as user B
TOKEN_B=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userB@example.com","password":"password"}' \
  | jq -r '.access_token')

# 3. Try to access user B's data with user A's token
curl -X GET http://localhost:3000/api/v1/sync/download?data_type=contacts \
  -H "Authorization: Bearer $TOKEN_A"
```

**Expected result:** ❌ Should ONLY return user A's data (JWT userId is verified)

### 5. CORS Bypass Attempts

#### Test 1: Request from Unauthorized Origin
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Origin: http://evil-site.com" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -v
```

**Expected result:** ✅ Should succeed but **no** `Access-Control-Allow-Origin` header in response (browser blocks it)

### 6. XSS (Cross-Site Scripting)

#### Test 1: Reflected XSS in Error Messages
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(1)</script>","password":"test"}'
```

**Expected result:** ❌ Error message should NOT echo `<script>` tags verbatim (input sanitization)

### 7. Security Headers Verification

#### Test 1: Check All Security Headers
```bash
curl -I http://localhost:3000/api/v1/health
```

**Expected headers:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Expect-CT: max-age=86400, enforce
```

### 8. 2FA Bypass Attempts (After Phase 1 Implementation)

#### Test 1: Skip 2FA Step
```bash
# 1. Login with correct credentials (2FA enabled account)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"2fa_user@example.com","password":"correct_password"}'

# Expected: 202 Accepted with requires_2fa: true (no tokens yet)

# 2. Try to use sync API without 2FA verification
curl -X GET http://localhost:3000/api/v1/sync/download?data_type=contacts \
  -H "Authorization: Bearer <token_from_step_1_if_any>"
```

**Expected result:** ❌ Should FAIL with "2FA verification required" (403 Forbidden)

#### Test 2: Reuse Backup Code
```bash
# 1. Use backup code to login
curl -X POST http://localhost:3000/api/v1/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","token":"BACKUP1234"}'

# 2. Try to use same backup code again
curl -X POST http://localhost:3000/api/v1/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","token":"BACKUP1234"}'
```

**Expected result:** ❌ Second attempt should FAIL (backup codes are one-time use)

---

## Security Scanning with Online Tools

### Mozilla Observatory
- **URL:** https://observatory.mozilla.org/
- **Test:** https://sync.owlivion.com
- **Target Score:** A+ (90+)

### SSL Labs
- **URL:** https://www.ssllabs.com/ssltest/
- **Test:** https://sync.owlivion.com
- **Target Grade:** A+

### Security Headers
- **URL:** https://securityheaders.com/
- **Test:** https://sync.owlivion.com
- **Target Grade:** A+

---

## Reporting

### Vulnerability Report Template

```markdown
# Security Vulnerability Report

**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Environment:** [Production/Staging/Development]

## Summary

[Brief description of the vulnerability]

## Severity

- [ ] Critical (Immediate fix required)
- [ ] High (Fix within 7 days)
- [ ] Medium (Fix within 30 days)
- [ ] Low (Fix when convenient)

## Affected Component

- **File:** `path/to/file.js`
- **Endpoint:** `/api/v1/endpoint`
- **Function:** `functionName()`

## Proof of Concept

```bash
# Steps to reproduce
curl -X POST ...
```

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Impact

[Who is affected and how]

## Recommended Fix

[Suggested solution]

## References

- OWASP: https://owasp.org/...
- CWE: https://cwe.mitre.org/...
```

---

## Testing Schedule

### Weekly
- [ ] `npm run security:audit` (automated)
- [ ] Check for outdated dependencies

### Monthly
- [ ] `npm run security:snyk` (automated)
- [ ] `npm run security:retire` (automated)
- [ ] Manual rate limiting tests
- [ ] CORS configuration review

### Quarterly
- [ ] Full manual penetration test (all tests above)
- [ ] Mozilla Observatory scan
- [ ] SSL Labs scan
- [ ] Security Headers scan
- [ ] Review JWT secret strength
- [ ] Review password policies

### Annually
- [ ] External professional penetration test
- [ ] Security audit by third-party
- [ ] Update security documentation
- [ ] Security team training

---

## Compliance Notes

### GDPR
- [ ] Data encryption (AES-256-GCM) ✅
- [ ] Right to access (user can view audit logs)
- [ ] Right to deletion (account deletion)
- [ ] Breach notification (within 72h)

### SOC 2 Type II
- [ ] Access control (JWT + 2FA)
- [ ] Audit logging (sync_history table)
- [ ] Encryption at rest and in transit
- [ ] Incident response plan

---

## Emergency Response

If a vulnerability is discovered in production:

1. **Assess severity** (use CVSS calculator)
2. **Create private security advisory** (GitHub Security Advisories)
3. **Develop patch** (in private repo/branch)
4. **Test thoroughly** (QA + staging)
5. **Deploy hotfix** (production)
6. **Notify users** (if data breach)
7. **Document incident** (post-mortem)
8. **Update security tests** (prevent regression)

**Emergency Contacts:**
- Dev Team Lead: [contact info]
- Security Officer: [contact info]
- VPS Provider (Hostinger): support ticket system
