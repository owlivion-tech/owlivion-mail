#!/bin/bash

# Google Cloud OAuth2 Setup Script for Owlivion Mail
# Bu scripti Google Cloud Shell'de çalıştırın

set -e

echo "🦉 Owlivion Mail - Google OAuth2 Setup"
echo "========================================"
echo ""

# Renkler
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Proje ID'si sor
echo -e "${YELLOW}1. Proje ID'si girin (örn: owlivion-mail-12345):${NC}"
read -p "Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Proje ID boş olamaz!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Proje ID: $PROJECT_ID${NC}"
echo ""

# Projeyi oluştur
echo -e "${YELLOW}2. Proje oluşturuluyor...${NC}"
gcloud projects create $PROJECT_ID --name="Owlivion Mail" 2>/dev/null || echo "Proje zaten mevcut, devam ediliyor..."
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Proje ayarlandı${NC}"
echo ""

# Faturalama kontrolü
echo -e "${YELLOW}3. Faturalama hesabı kontrol ediliyor...${NC}"
echo -e "${YELLOW}⚠️  NOT: Gmail API kullanmak için faturalama hesabı gerekebilir.${NC}"
echo -e "${YELLOW}   Eğer yoksa, https://console.cloud.google.com/billing adresinden ekleyin.${NC}"
echo ""
read -p "Devam etmek için Enter'a basın..."

# Gmail API'yi etkinleştir
echo ""
echo -e "${YELLOW}4. Gmail API etkinleştiriliyor...${NC}"
gcloud services enable gmail.googleapis.com
gcloud services enable iap.googleapis.com
echo -e "${GREEN}✓ Gmail API etkinleştirildi${NC}"
echo ""

# OAuth Consent Screen
echo -e "${YELLOW}5. OAuth Consent Screen yapılandırması${NC}"
echo -e "${YELLOW}   Bu adımı manuel olarak yapmanız gerekiyor:${NC}"
echo ""
echo "   📋 Şu adımları takip edin:"
echo "   1. https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo "   2. User Type: 'External' seçin"
echo "   3. App name: 'Owlivion Mail'"
echo "   4. User support email: Kendi emailiniz"
echo "   5. Scopes ekleyin:"
echo "      - https://mail.google.com/"
echo "      - https://www.googleapis.com/auth/userinfo.email"
echo "      - https://www.googleapis.com/auth/userinfo.profile"
echo "   6. Test users: Gmail adresinizi ekleyin"
echo ""
read -p "OAuth Consent Screen yapılandırdıktan sonra Enter'a basın..."

# OAuth2 Client ID oluştur
echo ""
echo -e "${YELLOW}6. OAuth2 Client ID oluşturuluyor...${NC}"

# Client ID oluştur
CLIENT_NAME="owlivion-mail-desktop"
gcloud alpha iap oauth-brands list --format="value(name)" > /tmp/brand_name.txt 2>/dev/null || true

# OAuth client oluşturmayı dene
echo ""
echo -e "${YELLOW}   OAuth Client oluşturuluyor...${NC}"
echo -e "${YELLOW}   NOT: Bu komut alpha olduğu için başarısız olabilir.${NC}"
echo -e "${YELLOW}   Başarısız olursa, manuel yöntemle devam edeceğiz.${NC}"
echo ""

# Manuel yöntem
echo -e "${YELLOW}7. OAuth Client ID oluşturma (MANUEL):${NC}"
echo ""
echo "   Şu adımları takip edin:"
echo "   1. https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "   2. '+ Create Credentials' → 'OAuth client ID'"
echo "   3. Application type: 'Desktop app'"
echo "   4. Name: 'Owlivion Mail Desktop'"
echo "   5. 'Create' tıklayın"
echo ""
echo "   6. Açılan popup'tan Client ID ve Client Secret'i kopyalayın"
echo ""
echo "   7. Credentials listesinden oluşturduğunuz client'e tıklayın"
echo "   8. 'Authorized redirect URIs' → '+ Add URI'"
echo "   9. Ekleyin: http://localhost:8080/callback"
echo "   10. 'Save' tıklayın"
echo ""

read -p "Client ID ve Secret'i aldıktan sonra Enter'a basın..."

# .env dosyasına kaydet
echo ""
echo -e "${YELLOW}8. Credentials'ları .env dosyasına ekleyin:${NC}"
echo ""
read -p "Google Client ID: " GOOGLE_CLIENT_ID
read -p "Google Client Secret: " GOOGLE_CLIENT_SECRET

echo ""
echo -e "${GREEN}✓ Credentials alındı${NC}"
echo ""

# .env dosyası oluştur
echo "# Google OAuth2 Credentials" > .env.local
echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> .env.local
echo "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" >> .env.local

echo -e "${GREEN}✓ Credentials .env.local dosyasına kaydedildi${NC}"
echo ""

# Özet
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✨ OAuth2 Setup Tamamlandı!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📋 Yapılacaklar:"
echo ""
echo "1. .env.local dosyasındaki credentials'ları kopyalayın:"
echo "   cat .env.local"
echo ""
echo "2. Yerel .env dosyanıza yapıştırın"
echo ""
echo "3. Uygulamayı yeniden başlatın:"
echo "   pnpm tauri dev"
echo ""
echo "4. 'Gmail ile Giriş' butonunu test edin!"
echo ""
echo -e "${GREEN}🦉 Başarılar!${NC}"
