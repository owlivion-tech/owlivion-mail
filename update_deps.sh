#!/bin/bash
# Owlivion Mail - Dependency Security Update Script
# Fixes RUSTSEC-2026-0007 and RUSTSEC-2026-0009

set -e

echo "🔒 Owlivion Mail - Dependency Security Update"
echo "=============================================="
echo ""

cd src-tauri

# Fix RUSTSEC-2026-0007 (bytes integer overflow)
echo "1. Updating bytes (RUSTSEC-2026-0007)..."
cargo update bytes
BYTES_VERSION=$(cargo tree -p bytes | head -1 | awk '{print $2}')
echo "   ✓ bytes updated to $BYTES_VERSION"

# Fix RUSTSEC-2026-0009 (time DoS)
echo ""
echo "2. Updating time (RUSTSEC-2026-0009)..."
cargo update time
TIME_VERSION=$(cargo tree -p time | head -1 | awk '{print $2}')
echo "   ✓ time updated to $TIME_VERSION"

# Try to update other vulnerable deps
echo ""
echo "3. Checking other dependencies..."
cargo update imap 2>/dev/null && echo "   ✓ imap updated" || echo "   ⚠️  imap: no update available"

# Verify build
echo ""
echo "4. Verifying build..."
if cargo build --quiet; then
    echo "   ✓ Build successful"
else
    echo "   ❌ Build failed! Review errors above."
    exit 1
fi

# Run audit again
echo ""
echo "5. Re-running security audit..."
echo "─────────────────────────────────"
if cargo audit 2>&1 | grep -q "error: "; then
    echo "   ⚠️  Some vulnerabilities remain (check output above)"
else
    echo "   ✅ No vulnerabilities found!"
fi

echo ""
echo "=============================================="
echo "✅ Dependency updates complete!"
echo ""
echo "Next steps:"
echo "1. Review Cargo.lock changes: git diff Cargo.lock"
echo "2. Test the application: pnpm tauri dev"
echo "3. Commit changes: git commit -am 'security: Update vulnerable dependencies'"
echo ""
