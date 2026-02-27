#!/bin/bash

# Owlivion Mail v1.0.0 - Test Installation Script

set -e

echo "🔍 Owlivion Mail v1.0.0 Test Installation"
echo "=========================================="
echo ""

# Check if already installed
if dpkg -l | grep -q owlivion-mail; then
    echo "⚠️  Owlivion Mail zaten kurulu. Önce kaldırılıyor..."
    sudo apt remove -y owlivion-mail
    echo "✅ Eski paket kaldırıldı"
    echo ""
fi

# Install new package
echo "📦 Yeni paket kuruluyor..."
cd src-tauri/target/release/bundle/deb
sudo dpkg -i "Owlivion Mail_1.0.0_amd64.deb"

# Fix dependencies if needed
if [ $? -ne 0 ]; then
    echo "🔧 Bağımlılıklar düzeltiliyor..."
    sudo apt-get install -f -y
fi

echo ""
echo "✅ Kurulum tamamlandı!"
echo ""

# Verify installation
echo "🔍 Kurulum doğrulaması:"
echo ""

# Check binary
if [ -f /usr/bin/owlivion-mail ]; then
    echo "✅ Binary: /usr/bin/owlivion-mail"
    ls -lh /usr/bin/owlivion-mail
else
    echo "❌ Binary bulunamadı!"
    exit 1
fi

echo ""

# Check desktop entry
if [ -f /usr/share/applications/owlivion-mail.desktop ]; then
    echo "✅ Desktop Entry: /usr/share/applications/owlivion-mail.desktop"
    echo ""
    echo "Desktop Entry içeriği:"
    grep "Exec=" /usr/share/applications/owlivion-mail.desktop
else
    echo "❌ Desktop entry bulunamadı!"
fi

echo ""

# Check icons
echo "✅ Icon'lar:"
ls -lh /usr/share/icons/hicolor/*/apps/owlivion-mail.png 2>/dev/null || echo "⚠️  Icon'lar bulunamadı"

echo ""
echo "=========================================="
echo "✅ Test Hazır!"
echo ""
echo "Çalıştırmak için:"
echo "  1. Uygulama menüsünden 'Owlivion Mail' arayın"
echo "  2. veya terminalde: owlivion-mail"
echo ""
echo "Not: Software rendering otomatik aktif"
echo "     (LIBGL_ALWAYS_SOFTWARE=1)"
echo ""
