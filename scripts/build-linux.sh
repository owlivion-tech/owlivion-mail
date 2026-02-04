#!/bin/bash

# Owlivion Mail - Linux Build Script
# This script builds .deb and AppImage packages for Linux

set -e

echo "🚀 Owlivion Mail - Linux Build Script"
echo "======================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Installing...${NC}"
    npm install -g pnpm
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Rust/Cargo is not installed${NC}"
    exit 1
fi

# Install frontend dependencies
echo -e "${BLUE}Installing frontend dependencies...${NC}"
pnpm install

# Build the application
echo -e "${BLUE}Building Owlivion Mail...${NC}"
pnpm tauri build

# Check build output
BUILD_DIR="src-tauri/target/release/bundle"

if [ -d "$BUILD_DIR/deb" ]; then
    echo -e "${GREEN}✅ .deb package created successfully!${NC}"
    echo "Location: $BUILD_DIR/deb/"
    ls -lh "$BUILD_DIR/deb/"
fi

if [ -d "$BUILD_DIR/appimage" ]; then
    echo -e "${GREEN}✅ AppImage created successfully!${NC}"
    echo "Location: $BUILD_DIR/appimage/"
    ls -lh "$BUILD_DIR/appimage/"
fi

echo ""
echo -e "${GREEN}======================================"
echo "✅ Build completed successfully!"
echo "======================================${NC}"
echo ""
echo "📦 Installation instructions:"
echo ""
echo "For .deb package:"
echo "  sudo dpkg -i $BUILD_DIR/deb/*.deb"
echo "  sudo apt-get install -f  # If dependencies missing"
echo ""
echo "For AppImage:"
echo "  chmod +x $BUILD_DIR/appimage/*.AppImage"
echo "  ./$BUILD_DIR/appimage/*.AppImage"
echo ""
