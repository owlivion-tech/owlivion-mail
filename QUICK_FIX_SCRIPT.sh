#!/bin/bash
# Owlivion Mail - Quick Security Fixes Script
# Run this script to apply immediate security improvements

set -e

echo "🔒 Owlivion Mail - Security Quick Fixes"
echo "======================================="
echo ""

# 1. Fix .env permissions
echo "1. Fixing .env file permissions..."
if [ -f .env ]; then
    chmod 600 .env
    echo "   ✓ .env permissions set to 0600 (owner-only read/write)"
else
    echo "   ⚠️  .env not found (OK if using example file)"
fi

if [ -f src-tauri/.env ]; then
    chmod 600 src-tauri/.env
    echo "   ✓ src-tauri/.env permissions set to 0600"
fi

# 2. Check if .env is in .gitignore
echo ""
echo "2. Checking .gitignore..."
if grep -q "^\.env$" .gitignore; then
    echo "   ✓ .env is in .gitignore"
else
    echo "   ⚠️  Adding .env to .gitignore"
    echo ".env" >> .gitignore
fi

# 3. Check if credentials are committed
echo ""
echo "3. Checking Git history for secrets..."
if git log --all --full-history -S "GOCSPX-" --oneline | head -1; then
    echo "   ❌ OAuth secrets found in Git history!"
    echo "   ⚠️  CRITICAL: Secrets have been committed to Git."
    echo "   📝 You MUST revoke these credentials immediately:"
    echo "      1. Go to https://console.cloud.google.com/apis/credentials"
    echo "      2. Delete the compromised OAuth client"
    echo "      3. Create new credentials"
    echo ""
    echo "   To clean Git history (DANGEROUS - backup first!):"
    echo "      git filter-branch --force --index-filter \\"
    echo "        'git rm --cached --ignore-unmatch .env src-tauri/.env' \\"
    echo "        --prune-empty --tag-name-filter cat -- --all"
else
    echo "   ✓ No OAuth secrets found in Git history"
fi

# 4. Install security audit tools
echo ""
echo "4. Installing security audit tools..."
if ! command -v cargo-audit &> /dev/null; then
    echo "   📦 Installing cargo-audit..."
    cargo install cargo-audit --quiet
    echo "   ✓ cargo-audit installed"
else
    echo "   ✓ cargo-audit already installed"
fi

# 5. Run dependency audits
echo ""
echo "5. Running dependency security audit..."
echo "   [Rust Dependencies]"
cd src-tauri
if cargo audit --deny warnings; then
    echo "   ✓ No known vulnerabilities in Rust dependencies"
else
    echo "   ⚠️  Vulnerabilities found! Review output above."
fi
cd ..

echo ""
echo "   [Node Dependencies]"
if npm audit --production --audit-level=high; then
    echo "   ✓ No high/critical vulnerabilities in Node dependencies"
else
    echo "   ⚠️  Vulnerabilities found! Run: npm audit fix"
fi

# 6. Create security checklist
echo ""
echo "6. Security checklist..."
cat << 'EOF' > SECURITY_CHECKLIST.md
# Security Checklist

## Pre-Production
- [ ] OAuth credentials revoked and regenerated
- [ ] .env files excluded from Git (check .gitignore)
- [ ] File permissions set (chmod 600 .env)
- [ ] No secrets in Git history
- [ ] cargo audit passes
- [ ] npm audit passes
- [ ] CSP policy hardened (remove unsafe-inline/eval)
- [ ] Certificate validation warnings added to UI

## Regular Maintenance (Monthly)
- [ ] cargo audit
- [ ] npm audit
- [ ] Dependency updates reviewed
- [ ] Security patches applied

## Before Each Release
- [ ] Full security audit completed
- [ ] Penetration test results reviewed
- [ ] Known issues documented
- [ ] Security.md updated
EOF
echo "   ✓ Created SECURITY_CHECKLIST.md"

# 7. Summary
echo ""
echo "======================================="
echo "✅ Quick fixes completed!"
echo ""
echo "⚠️  CRITICAL ACTIONS REQUIRED:"
echo "   1. Revoke exposed OAuth credentials (see report)"
echo "   2. Review audit results above"
echo "   3. Read SECURITY_CHECKLIST.md"
echo ""
echo "📄 Full report: SECURITY_PENTEST_REPORT.md"
echo "======================================="
