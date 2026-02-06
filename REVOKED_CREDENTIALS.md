# 🚨 REVOKED CREDENTIALS - SECURITY INCIDENT RESPONSE

**Date:** 2026-02-06
**Incident:** OAuth credentials and API keys exposed in .env file
**Status:** 🔴 CRITICAL - Immediate action required

---

## 🔑 Exposed Credentials (MUST BE REVOKED)

### 1. Google OAuth Client
```
Client ID: REDACTED_GOOGLE_CLIENT_ID
Secret:    REDACTED_GOOGLE_CLIENT_SECRET
```

**Action Required:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find this OAuth 2.0 Client ID
3. **DELETE IT IMMEDIATELY**
4. Create new OAuth client with fresh credentials

### 2. Gemini API Key
```
API Key: REDACTED_GEMINI_API_KEY
```

**Action Required:**
1. Go to: https://makersuite.google.com/app/apikey
2. **DELETE THIS KEY**
3. Generate new API key

---

## ✅ Actions Taken

- [x] .env file cleaned (placeholders inserted)
- [x] File permissions set to 0600
- [x] Verified .gitignore contains .env
- [ ] **YOU MUST:** Revoke exposed credentials (see above)
- [ ] **YOU MUST:** Generate new credentials
- [ ] **YOU MUST:** Update .env with new credentials

---

## 📋 Step-by-Step Revocation Guide

### Google OAuth Client

1. **Open Google Cloud Console**
   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. **Find the OAuth Client**
   - Look for Client ID: `REDACTED_CLIENT_ID`
   - It may be named "Owlivion Mail" or similar

3. **Delete It**
   - Click the trash icon
   - Confirm deletion

4. **Create New Client**
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **Desktop application**
   - Name: "Owlivion Mail"
   - Click "Create"

5. **Configure Redirect URI** (if needed)
   - Add: `http://localhost:8080/callback`

6. **Copy New Credentials**
   - Client ID: Copy to .env as `GOOGLE_CLIENT_ID`
   - Client Secret: Copy to .env as `GOOGLE_CLIENT_SECRET`

### Gemini API Key

1. **Open AI Studio**
   ```
   https://makersuite.google.com/app/apikey
   ```

2. **Find the Key**
   - Look for key starting with `REDACTED_GEMINI_API_KEY`

3. **Delete It**
   - Click delete/revoke button

4. **Create New Key**
   - Click "Create API Key"
   - Select your Google Cloud project
   - Copy new key to .env as `GEMINI_API_KEY`

---

## 🛡️ Prevention Measures

**Implemented:**
- ✅ .env in .gitignore
- ✅ .env permissions: 0600 (owner only)
- ✅ .env.example with placeholders only

**Best Practices:**
1. Never share .env file
2. Never commit .env to Git
3. Use environment-specific credentials
4. Rotate credentials regularly (every 90 days)
5. Use secret management tools in production

---

## ⚠️ Impact Assessment

**Exposure Window:**
- File created: Unknown
- Discovered: 2026-02-06
- Cleaned: 2026-02-06

**Risk Level:**
- Google OAuth: HIGH (can send emails on behalf of users)
- Gemini API: MEDIUM (API quota abuse)

**Recommended Actions:**
1. ✅ Revoke immediately (do this NOW)
2. Monitor Google Cloud audit logs for unauthorized usage
3. Check Gemini API usage for anomalies
4. Consider rotating all secrets as precaution

---

## 📞 Support

If you see unauthorized usage:
1. Revoke credentials immediately
2. Check Google Cloud audit logs
3. Review Gemini API usage dashboard
4. Contact Google Cloud support if needed

---

**Status:** ⏳ Awaiting credential revocation
**Next Action:** YOU must revoke credentials at URLs above
