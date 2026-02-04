# OAuth2 Authentication Setup Guide

Bu rehber, Owlivion Mail'de Gmail ve Microsoft/Outlook hesapları için OAuth2 authentication nasıl kurulur açıklar.

## 📋 İçindekiler
- [Google OAuth2 Setup](#google-oauth2-setup)
- [Microsoft OAuth2 Setup](#microsoft-oauth2-setup)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## 🔐 Google OAuth2 Setup

### Adım 1: Google Cloud Console'a Giriş

1. https://console.cloud.google.com/ adresine gidin
2. Google hesabınızla giriş yapın

### Adım 2: Yeni Proje Oluşturun

1. Üst menüden **"Select a project"** → **"New Project"** tıklayın
2. Proje adı: `Owlivion Mail` (veya istediğiniz bir isim)
3. **"Create"** tıklayın
4. Proje oluşturulduktan sonra, üst menüden projenizi seçin

### Adım 3: Gmail API'yi Etkinleştirin

1. Sol menüden **"APIs & Services"** → **"Library"** tıklayın
2. Arama kutusuna `Gmail API` yazın
3. **Gmail API** üzerine tıklayın
4. **"Enable"** butonuna tıklayın

### Adım 4: OAuth Consent Screen Yapılandırın

1. Sol menüden **"APIs & Services"** → **"OAuth consent screen"** tıklayın
2. User Type: **"External"** seçin (test için yeterli)
3. **"Create"** tıklayın

**OAuth consent screen bilgileri:**
- **App name:** `Owlivion Mail`
- **User support email:** Kendi email adresiniz
- **App logo:** (opsiyonel) Logo yükleyebilirsiniz
- **Developer contact information:** Email adresiniz
- **"Save and Continue"** tıklayın

**Scopes:**
- **"Add or Remove Scopes"** tıklayın
- Şu scope'ları ekleyin:
  - `https://mail.google.com/` (Gmail tam erişim)
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`
- **"Update"** ve **"Save and Continue"** tıklayın

**Test users:**
- **"Add Users"** tıklayın
- Gmail adresinizi ekleyin (test için)
- **"Save and Continue"** tıklayın

### Adım 5: OAuth2 Credentials Oluşturun

1. Sol menüden **"APIs & Services"** → **"Credentials"** tıklayın
2. Üst kısımda **"+ Create Credentials"** → **"OAuth client ID"** tıklayın
3. Application type: **"Desktop app"** seçin
4. Name: `Owlivion Mail Desktop`
5. **"Create"** tıklayın

### Adım 6: Client ID ve Secret'i Kopyalayın

1. Credentials oluşturulduktan sonra bir popup açılacak
2. **Client ID** ve **Client secret** değerlerini kopyalayın
3. Bu değerleri güvenli bir yere kaydedin!

**Örnek:**
```
Client ID: 123456789-abc123def456.apps.googleusercontent.com
Client secret: GOCSPX-AbCdEf123456789
```

### Adım 7: Redirect URI'yi Ekleyin

1. Credentials listesinde oluşturduğunuz OAuth client üzerine tıklayın
2. **"Authorized redirect URIs"** bölümüne gidin
3. **"+ Add URI"** tıklayın
4. Şu URI'yi ekleyin: `http://localhost:8080/callback`
5. **"Save"** tıklayın

---

## 🔐 Microsoft OAuth2 Setup

### Adım 1: Azure Portal'a Giriş

1. https://portal.azure.com/ adresine gidin
2. Microsoft hesabınızla giriş yapın

### Adım 2: App Registration Oluşturun

1. Arama kutusuna **"App registrations"** yazın ve tıklayın
2. **"+ New registration"** tıklayın

**Kayıt bilgileri:**
- **Name:** `Owlivion Mail`
- **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts" seçin
- **Redirect URI:**
  - Platform: **"Public client/native (mobile & desktop)"** seçin
  - Redirect URI: `http://localhost:8080/callback`
- **"Register"** tıklayın

### Adım 3: Client ID'yi Kopyalayın

1. App registration oluşturulduktan sonra, **"Overview"** sayfasında:
2. **"Application (client) ID"** değerini kopyalayın
3. Bu değeri güvenli bir yere kaydedin!

**Örnek:**
```
Application (client) ID: 12345678-1234-1234-1234-123456789012
```

### Adım 4: Client Secret Oluşturun

1. Sol menüden **"Certificates & secrets"** tıklayın
2. **"Client secrets"** sekmesine gidin
3. **"+ New client secret"** tıklayın
4. Description: `Owlivion Mail Desktop Secret`
5. Expires: **"24 months"** (veya istediğiniz süre)
6. **"Add"** tıklayın
7. **Value** kolonundaki değeri hemen kopyalayın (tekrar göremezsiniz!)

**Örnek:**
```
Client secret: AbC~1234567890-XyZ_abcdefghijklmnop
```

### Adım 5: API Permissions Ekleyin

1. Sol menüden **"API permissions"** tıklayın
2. **"+ Add a permission"** tıklayın
3. **"Microsoft Graph"** seçin
4. **"Delegated permissions"** seçin
5. Şu permission'ları ekleyin:
   - `IMAP.AccessAsUser.All`
   - `SMTP.Send`
   - `offline_access`
   - `User.Read`
6. **"Add permissions"** tıklayın

### Adım 6: Redirect URI'yi Doğrulayın

1. Sol menüden **"Authentication"** tıklayın
2. **"Platform configurations"** altında "Mobile and desktop applications" göreceksiniz
3. Redirect URI'nin `http://localhost:8080/callback` olduğunu doğrulayın
4. **"Allow public client flows"** → **"Yes"** seçin (en altta)
5. **"Save"** tıklayın

---

## 🔧 Environment Variables

### Linux/macOS

`.env` dosyası oluşturun (proje root dizininde):

```bash
# Google OAuth2
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-google-client-secret"

# Microsoft OAuth2
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

**Veya terminal'de:**

```bash
export GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-google-client-secret"
export MICROSOFT_CLIENT_ID="your-microsoft-client-id"
export MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

### Windows

**PowerShell:**
```powershell
$env:GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="GOCSPX-your-google-client-secret"
$env:MICROSOFT_CLIENT_ID="your-microsoft-client-id"
$env:MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

**CMD:**
```cmd
set GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
set GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
set MICROSOFT_CLIENT_ID=your-microsoft-client-id
set MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

### Kalıcı Environment Variables (Önerilen)

**Linux/macOS:**
`~/.bashrc` veya `~/.zshrc` dosyasına ekleyin:

```bash
export GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-google-client-secret"
export MICROSOFT_CLIENT_ID="your-microsoft-client-id"
export MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

Sonra:
```bash
source ~/.bashrc  # veya source ~/.zshrc
```

**Windows:**
- System Properties → Advanced → Environment Variables
- User variables'a ekleyin
- Bilgisayarı yeniden başlatın

---

## 🧪 Testing

### OAuth2 Test Etme

1. Environment variables'ı ayarlayın
2. Uygulamayı başlatın:
   ```bash
   pnpm tauri dev
   ```
3. **Settings** → **Hesap Ekle**
4. **"Google ile giriş yap"** veya **"Microsoft ile giriş yap"** butonuna tıklayın
5. Browser açılacak, OAuth flow başlayacak
6. Hesabınızı seçin ve izinleri onaylayın
7. Tarayıcı "Authentication successful" mesajı gösterecek
8. Owlivion Mail'e dönün - hesap otomatik eklenecek

### Callback Server Test

OAuth callback server `http://localhost:8080` portunda çalışır. Eğer bu port meşgulse, farklı bir port kullanmanız gerekebilir.

**Port değiştirmek için:**
1. `src-tauri/src/oauth.rs` dosyasını açın
2. `redirect_uri` değerini değiştirin (örn: `http://localhost:9090/callback`)
3. Google Cloud Console ve Azure Portal'da Redirect URI'yi de güncelleyin

---

## 🔍 Troubleshooting

### "Invalid client" hatası

**Sebep:** Client ID veya Secret yanlış

**Çözüm:**
- Environment variables'ı kontrol edin
- Google Cloud Console / Azure Portal'da değerleri doğrulayın
- Kopyalarken boşluk kalmadığından emin olun

### "Redirect URI mismatch" hatası

**Sebep:** Redirect URI yapılandırması hatalı

**Çözüm:**
- Google/Microsoft console'da tam olarak `http://localhost:8080/callback` olduğundan emin olun
- HTTP (HTTPS değil) kullanıldığından emin olun
- Port numarasının doğru olduğunu kontrol edin

### "Access denied" hatası

**Sebep:** Kullanıcı OAuth flow'da izinleri reddetti veya hesap test users listesinde değil

**Çözüm:**
- Google: OAuth consent screen'de test users'a email ekleyin
- Microsoft: App permissions'ı kontrol edin
- OAuth flow'u tekrar deneyin

### Browser açılmıyor

**Sebep:** Sistem browser'ı açamıyor

**Çözüm:**
- Tauri'nin browser açma izni olduğundan emin olun
- URL'yi manuel olarak kopyalayıp tarayıcıya yapıştırın
- Logs'larda authorization URL'yi arayın

### Port 8080 meşgul

**Sebep:** Başka bir uygulama 8080 portunu kullanıyor

**Çözüm:**
```bash
# Linux/macOS
lsof -i :8080
kill -9 <PID>

# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

---

## 📝 Notlar

### Güvenlik
- Client secrets'ı asla Git'e commit etmeyin
- `.env` dosyasını `.gitignore`'a ekleyin
- Production için secrets'ları güvenli bir şekilde saklayın (örn: environment variables, secret manager)

### Limitler
- **Google:** Günlük 10,000 request quota (Gmail API)
- **Microsoft:** Rate limiting uygulanabilir
- Test users sınırlaması: Google'da 100 user, Microsoft'ta sınırsız

### OAuth Token Yenileme
- Access token'lar genellikle 1 saat geçerlidir
- Refresh token'lar kalıcıdır (offline_access scope gerekli)
- Uygulama otomatik token refresh yapacak şekilde geliştirilmelidir

---

## 🚀 Production Deployment

Production ortamında:
1. OAuth consent screen'i Google'da "Production" moduna alın
2. Domain verification yapın
3. Privacy policy ve Terms of service linkleri ekleyin
4. Secrets'ları güvenli bir şekilde yönetin (AWS Secrets Manager, Azure Key Vault, vb.)
5. HTTPS kullanın (production callback için)

---

## 📚 Referanslar

- [Google OAuth2 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Gmail API Overview](https://developers.google.com/gmail/api/guides)
- [Microsoft Graph Mail API](https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview)

---

**Yardım mı lazım?**
- GitHub Issues: https://github.com/babafpv/owlivion-mail/issues
- Email: babafpv@gmail.com
