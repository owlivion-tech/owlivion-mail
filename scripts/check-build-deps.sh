#!/bin/bash

# Owlivion Mail - Build Dependencies Check
# Checks if all required dependencies for building are installed

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔍 Checking build dependencies..."
echo ""

MISSING_DEPS=0

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js: Not installed${NC}"
    MISSING_DEPS=1
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo -e "${GREEN}✅ pnpm: v$PNPM_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  pnpm: Not installed (will install automatically)${NC}"
fi

# Check Rust
if command -v cargo &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo -e "${GREEN}✅ Rust: $RUST_VERSION${NC}"
else
    echo -e "${RED}❌ Rust: Not installed${NC}"
    MISSING_DEPS=1
fi

# Check Tauri CLI
if command -v cargo-tauri &> /dev/null; then
    echo -e "${GREEN}✅ Tauri CLI: Installed${NC}"
else
    echo -e "${YELLOW}⚠️  Tauri CLI: Not installed (will install via pnpm)${NC}"
fi

echo ""
echo "🔍 Checking system dependencies..."
echo ""

# Check Linux specific dependencies
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "Distribution: $NAME $VERSION"
    echo ""

    # Check WebKit2GTK
    if ldconfig -p | grep -q libwebkit2gtk-4.1; then
        echo -e "${GREEN}✅ libwebkit2gtk-4.1: Installed${NC}"
    else
        echo -e "${RED}❌ libwebkit2gtk-4.1: Not installed${NC}"
        echo "   Install: sudo apt install libwebkit2gtk-4.1-dev"
        MISSING_DEPS=1
    fi

    # Check GTK3
    if ldconfig -p | grep -q libgtk-3; then
        echo -e "${GREEN}✅ libgtk-3: Installed${NC}"
    else
        echo -e "${RED}❌ libgtk-3: Not installed${NC}"
        echo "   Install: sudo apt install libgtk-3-dev"
        MISSING_DEPS=1
    fi

    # Check AppIndicator
    if ldconfig -p | grep -q libayatana-appindicator3; then
        echo -e "${GREEN}✅ libayatana-appindicator3: Installed${NC}"
    else
        echo -e "${YELLOW}⚠️  libayatana-appindicator3: Not installed (optional)${NC}"
        echo "   Install: sudo apt install libayatana-appindicator3-dev"
    fi

    # Check build-essential
    if dpkg -l | grep -q build-essential; then
        echo -e "${GREEN}✅ build-essential: Installed${NC}"
    else
        echo -e "${RED}❌ build-essential: Not installed${NC}"
        echo "   Install: sudo apt install build-essential"
        MISSING_DEPS=1
    fi
fi

echo ""
if [ $MISSING_DEPS -eq 0 ]; then
    echo -e "${GREEN}✅ All required dependencies are installed!${NC}"
    echo ""
    echo "You can now run:"
    echo "  pnpm run build:linux"
    exit 0
else
    echo -e "${RED}❌ Some dependencies are missing!${NC}"
    echo ""
    echo "To install all dependencies on Ubuntu/Debian:"
    echo ""
    echo "  sudo apt update"
    echo "  sudo apt install -y \\"
    echo "    libwebkit2gtk-4.1-dev \\"
    echo "    build-essential \\"
    echo "    curl \\"
    echo "    wget \\"
    echo "    file \\"
    echo "    libssl-dev \\"
    echo "    libgtk-3-dev \\"
    echo "    libayatana-appindicator3-dev \\"
    echo "    librsvg2-dev"
    echo ""
    echo "For Rust installation:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    exit 1
fi
