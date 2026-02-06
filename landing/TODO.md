# 🚀 Owlivion Mail Landing Page - Production Checklist

**Target URL:** https://owlivion.com/mail
**Purpose:** Google OAuth Production Consent Screen Approval
**Deadline:** Before OAuth verification submission

---

## 📊 Overview

```
✅ MEVCUT:
  - Landing page (index.html) - Modern, dark theme ✓
  - Privacy Policy (privacy/index.html) - 13.5K ✓
  - Logo assets (logo.png, macbook.png) ✓

❌ EKSİK:
  - Terms of Service - ZORUNLU (Google OAuth için)
  - /mail subdirectory için path düzeltmeleri
  - Google OAuth consent screen compliance review
  - Production deployment configuration
```

**Priority:** 🔴 CRITICAL - Terms of Service eksik olduğu için OAuth approval alamazsın!

---

## 🎯 Sections

1. [Site Yapısı Güncellemeleri](#1-site-yapısı-güncellemeleri) - 2-3 saat
2. [Google OAuth Gereksinimler](#2-google-oauth-gereksinimler-zorunlu) - 4-6 saat
3. [İçerik Review & Güncellemeler](#3-i̇çerik-review--güncellemeler) - 1-2 saat
4. [Teknik Deployment](#4-teknik-deployment) - 1-2 saat
5. [Testing & Verification](#5-testing--verification) - 1 saat
6. [Google OAuth Integration](#6-google-oauth-integration) - 30 dakika

**TOPLAM SÜRE:** ~10-15 saat

---

## 1️⃣ Site Yapısı Güncellemeleri

### Task 1.1: Subdirectory Path Düzeltmeleri
**Hedef:** owlivion.com/mail subdirectory'de çalışması için path'leri düzelt

#### 1.1.1. index.html Path Düzeltmeleri
```bash
# Değiştirilecek dosya: landing/index.html

ÖNCE:
  <link rel="stylesheet" href="/style.css">
  <img src="/logo.png">
  <script src="/script.js"></script>

SONRA:
  <link rel="stylesheet" href="/mail/style.css">
  <img src="/mail/logo.png">
  <script src="/mail/script.js"></script>

# VEYA relative paths kullan:
  <link rel="stylesheet" href="./style.css">
  <img src="./logo.png">
  <script src="./script.js"></script>
```

**Action Items:**
- [ ] `landing/index.html` dosyasını aç
- [ ] Tüm `/` ile başlayan absolute path'leri bul
- [ ] `/mail/` prefix ekle veya relative path'e çevir
- [ ] Asset yüklemelerini kontrol et: CSS, JS, images
- [ ] Internal link'leri güncelle (privacy, terms, download links)

**Test:**
```bash
# Local test server ile test et:
cd landing
python3 -m http.server 8000
# Browser: http://localhost:8000/

# Tüm asset'lerin yüklendiğini kontrol et (DevTools Network tab)
```

---

#### 1.1.2. Privacy Policy Path Düzeltmeleri
```bash
# Değiştirilecek dosya: landing/privacy/index.html

ÖNCE:
  <a href="/">Ana Sayfa</a>
  <link rel="stylesheet" href="/style.css">

SONRA:
  <a href="/mail/">Ana Sayfa</a>
  <link rel="stylesheet" href="/mail/style.css">

# VEYA relative paths:
  <a href="../">Ana Sayfa</a>
  <link rel="stylesheet" href="../style.css">
```

**Action Items:**
- [ ] `landing/privacy/index.html` dosyasını aç
- [ ] Tüm link ve asset path'lerini düzelt
- [ ] Ana sayfaya dönüş link'ini test et

---

#### 1.1.3. Base Tag Ekleme (Alternatif Çözüm)
```html
<!-- landing/index.html <head> içine ekle: -->
<base href="/mail/">

<!-- Bu sayede tüm relative path'ler /mail/ base'inde çalışır -->
<!-- Asset'ler: href="style.css" → /mail/style.css -->
```

**Action Items:**
- [ ] **KARAR:** Base tag mı, yoksa manuel path update mi?
  - **Base tag:** Kolay, tek satır, tüm relative path'ler düzelir
  - **Manuel:** Daha kontrollü, her path'i biliyor olursun

**Öneri:** Base tag kullan (daha pratik) ✅

---

### Task 1.2: Asset Klasör Yapısı
**Mevcut yapı:**
```
landing/
├── index.html
├── privacy/
│   └── index.html
├── assets/
│   ├── logo.png
│   └── macbook.png
└── (muhtemelen style.css, script.js var?)
```

**Action Items:**
- [ ] Tüm asset'leri listele: `ls -R landing/`
- [ ] CSS/JS dosyalarını bul
- [ ] `/mail/` subdirectory'de çalışacak yapıda organize et

---

## 2️⃣ Google OAuth Gereksinimler (ZORUNLU)

### 🔴 CRITICAL: Terms of Service Eksik!

**Google Requirement:**
> OAuth consent screen için 3 URL ZORUNLU:
> 1. ✅ Homepage: https://owlivion.com/mail
> 2. ✅ Privacy Policy: https://owlivion.com/privacy (MEVCUT)
> 3. ❌ Terms of Service: https://owlivion.com/terms (EKSİK!)

**Detaylı Guide:** `GOOGLE_OAUTH_SETUP.md` → Section 3.4

---

### Task 2.1: Terms of Service Oluştur
**Hedef:** Google OAuth compliance için yasal bir ToS belgesi oluştur

#### 2.1.1. ToS Klasör Yapısı Oluştur
```bash
cd landing
mkdir -p terms
```

**Action Items:**
- [ ] `landing/terms/` klasörü oluştur
- [ ] `landing/terms/index.html` dosyası oluştur

---

#### 2.1.2. ToS İçeriği Hazırla
**Template:** Email client için standart Terms of Service

**Minimum içerik gereksinimleri:**
1. **Service Description**
   - Owlivion Mail nedir?
   - Sunulan özellikler (email client, AI phishing detection, encryption)

2. **User Obligations**
   - Yasal email kullanımı
   - Spam gönderme yasağı
   - Üçüncü parti hesap bilgileri (IMAP/SMTP credentials)

3. **Privacy & Data**
   - "Kişisel verileriniz yerel olarak saklanır"
   - "Google OAuth kullanımı - Privacy Policy'e referans"
   - Gemini API kullanımı (phishing detection)

4. **Liability**
   - Email kaybı sorumluluk reddi
   - Üçüncü parti servisler (Gmail, Outlook) sorumluluk reddi

5. **Account Termination**
   - Kullanıcı isterse hesap silebilir (local app, server-side account yok)

6. **Changes to Terms**
   - ToS değişiklik hakkı

7. **Contact**
   - İletişim bilgisi (support email)

**Action Items:**
- [ ] `landing/terms/index.html` dosyasını oluştur
- [ ] Privacy policy'nin stil/yapısını kopyala (consistency)
- [ ] Türkçe yaz (privacy policy gibi)
- [ ] Yasal review (varsa hukuk danışmanı ile)

**Template örnek:**
```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Kullanım Koşulları - Owlivion Mail</title>
  <base href="/mail/">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Kullanım Koşulları</h1>
    <p class="updated">Son Güncelleme: [DATE]</p>

    <h2>1. Hizmet Tanımı</h2>
    <p>Owlivion Mail, [...]</p>

    <h2>2. Kullanıcı Yükümlülükleri</h2>
    <p>[...]</p>

    <!-- ... daha fazla section ... -->

    <h2>8. İletişim</h2>
    <p>Email: support@owlivion.com</p>
  </div>
</body>
</html>
```

**Resources:**
- Privacy policy'den stil kopyala: `landing/privacy/index.html`
- ToS generator tools: https://www.termsofservicegenerator.net/
- Email client ToS examples: Gmail ToS, Outlook ToS, ProtonMail ToS

---

#### 2.1.3. ToS Link Eklemeleri
```bash
# Eklenmesi gereken yerler:

1. landing/index.html (footer):
   <a href="/mail/terms/">Kullanım Koşulları</a>

2. landing/privacy/index.html (footer):
   <a href="/mail/terms/">Kullanım Koşulları</a>

3. Owlivion Mail app içinde (Settings → About):
   # Bu frontend'de zaten var mı kontrol et
   src/App.tsx veya src/components/Settings.tsx
```

**Action Items:**
- [ ] Ana sayfanın footer'ına ToS link ekle
- [ ] Privacy Policy'nin footer'ına ToS link ekle
- [ ] Owlivion Mail app içinde ToS link kontrolü

---

### Task 2.2: Privacy Policy Review & Update
**Hedef:** Google OAuth compliance için Privacy Policy'yi review et

**Google Requirements:**
- ✅ Must disclose how app accesses, uses, stores, and shares Google user data
- ✅ Must be hosted on secure (HTTPS) domain
- ✅ Must be publicly accessible without login

**Action Items:**
- [ ] `landing/privacy/index.html` dosyasını oku
- [ ] Google OAuth data usage açıklamasını kontrol et:
  - [ ] "Gmail API kullanıyoruz"
  - [ ] "Email okuma/gönderme izinleri"
  - [ ] "Veriler yerel olarak saklanır (encrypted)"
  - [ ] "Google'a veri göndermiyoruz"
- [ ] Gemini API kullanımını açıkla:
  - [ ] "Phishing detection için Gemini AI kullanıyoruz"
  - [ ] "Email subject/sender bilgisi Gemini'ye gönderilir"
  - [ ] "Email body content Google'a gönderilmez"
- [ ] Son güncelleme tarihini güncelle
- [ ] Contact email ekle (support@owlivion.com?)

**Checklist: Google OAuth Privacy Policy Requirements**
- [ ] Clearly states "We use Gmail API to access your emails"
- [ ] Explains data storage (local, encrypted with AES-256-GCM)
- [ ] Explains data retention (user controls, delete anytime)
- [ ] Explains third-party sharing (none, except Gemini for phishing detection)
- [ ] Link to Google's Privacy Policy: https://policies.google.com/privacy
- [ ] Contact information for privacy questions

**Resources:**
- Google OAuth Privacy Policy guide: https://support.google.com/cloud/answer/9110914
- `GOOGLE_OAUTH_SETUP.md` → Section 3.4

---

### Task 2.3: Homepage Content Review
**Hedef:** Ana sayfanın Google OAuth için uygun olduğunu doğrula

**Google Requirements:**
- ✅ Clear description of the app
- ✅ Professional appearance
- ✅ No misleading information
- ✅ Working links (privacy, terms, download)

**Action Items:**
- [ ] Ana sayfa copy'sini oku
- [ ] App açıklamasının doğru/güncel olduğunu kontrol et
- [ ] Feature list'i güncelle (en son özelliklerle)
- [ ] Screenshot/mockup'ları kontrol et (güncel mi?)
- [ ] Download button/link'lerini kontrol et (nereden indiriliyor?)
- [ ] "Contact Us" veya support email ekle

**İçerik Checklist:**
- [ ] App name: "Owlivion Mail"
- [ ] Clear tagline (örn: "Secure Desktop Email Client with AI Protection")
- [ ] Key features prominently displayed
- [ ] Privacy/security vurgusu (encryption, local storage)
- [ ] CTA button (Download, Get Started, etc.)
- [ ] Footer links: Privacy, Terms, Contact

---

## 3️⃣ İçerik Review & Güncellemeler

### Task 3.1: Landing Page Copy Review
**Hedef:** İçeriğin production-ready olduğunu garanti et

**Action Items:**
- [ ] Typo kontrolü (yazım hataları)
- [ ] Grammar kontrolü
- [ ] Tone consistency (professional but friendly)
- [ ] Türkçe karakter kontrolü (ı, ş, ğ, ü, ö, ç)
- [ ] Link'lerin çalıştığını kontrol et

---

### Task 3.2: Feature List Güncelleme
**Mevcut özellikler (proje dokümantasyonundan):**
- ✅ Multiple IMAP/SMTP accounts
- ✅ OAuth2 support (Google, Microsoft)
- ✅ AI phishing detection (Gemini)
- ✅ Tracking pixel blocker
- ✅ End-to-end encryption (AES-256-GCM)
- ✅ Local storage (SQLite + FTS5 search)
- ✅ Dark/Light theme
- ✅ 2FA support
- ✅ Email filters & rules
- ✅ Conflict resolution (multi-device sync)
- ✅ LRU cache (3x faster email access)
- ✅ Priority fetching (unread emails first)

**Son özelliklerden (git commit history):**
- ✅ LRU Email Cache & Progressive Loading - 3x Faster
- ✅ Database Optimization - 10x Faster Sync
- ✅ Multi-Account Features - Badges & Priority Fetching
- ✅ Email Filters & Advanced Search (18 tests)

**Action Items:**
- [ ] Landing page'deki feature list'i yukarıdakilerle karşılaştır
- [ ] Eksik özellikler varsa ekle
- [ ] Güncel olmayan özellikler varsa güncelle
- [ ] Her özelliğe kısa, açıklayıcı description yaz

---

### Task 3.3: Screenshots & Mockups
**Hedef:** Uygulamanın güncel görsel materyallerini ekle

**Action Items:**
- [ ] Mevcut screenshot'ları kontrol et (`landing/assets/`)
- [ ] Uygulamanın güncel screenshot'larını al:
  - [ ] Ana ekran (email list)
  - [ ] Email okuma ekranı
  - [ ] Compose window
  - [ ] Settings panel
  - [ ] Dark mode örneği
- [ ] Screenshot'ları optimize et (WebP format, compression)
- [ ] Landing page'e screenshot gallery ekle

**Screenshot Önerileri:**
- Resolution: 1920x1080 (retina için 2x)
- Format: WebP (daha küçük boyut)
- Watermark: Opsiyonel (Owlivion logo köşede)

---

## 4️⃣ Teknik Deployment

### Task 4.1: Server Configuration
**Hedef:** owlivion.com/mail subdirectory routing'i yapılandır

**Server:** Owlivion VPS (31.97.216.36)

**Action Items:**
- [ ] SSH ile sunucuya bağlan: `ssh user@31.97.216.36`
- [ ] Web server nedir? (Nginx, Apache, Caddy?)
- [ ] `/mail` subdirectory için routing config yaz

**Nginx örnek config:**
```nginx
# /etc/nginx/sites-available/owlivion.com

server {
    server_name owlivion.com;
    root /var/www/owlivion.com;

    # Ana site (mevcut)
    location / {
        try_files $uri $uri/ =404;
    }

    # /mail subdirectory
    location /mail/ {
        alias /var/www/owlivion.com/mail/;
        try_files $uri $uri/ /mail/index.html;
        index index.html;
    }

    # Privacy policy
    location /privacy {
        alias /var/www/owlivion.com/mail/privacy/;
        try_files $uri $uri/ /privacy/index.html;
    }

    # Terms of service
    location /terms {
        alias /var/www/owlivion.com/mail/terms/;
        try_files $uri $uri/ /terms/index.html;
    }

    # SSL configuration (Let's Encrypt)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/owlivion.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/owlivion.com/privkey.pem;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name owlivion.com;
    return 301 https://$server_name$request_uri;
}
```

**Action Items:**
- [ ] Web server config dosyasını bul
- [ ] `/mail` routing ekle
- [ ] Config'i test et: `nginx -t` (veya `apache2ctl configtest`)
- [ ] Reload: `systemctl reload nginx`

---

### Task 4.2: SSL/TLS Certificate
**Hedef:** HTTPS zorunlu (Google OAuth requirement)

**Action Items:**
- [ ] SSL certificate var mı kontrol et: `https://owlivion.com`
- [ ] Let's Encrypt kullanılıyor mu?
- [ ] Certificate expiry date kontrolü
- [ ] Auto-renewal çalışıyor mu?

**Let's Encrypt setup (eğer yoksa):**
```bash
# Certbot kurulumu
sudo apt install certbot python3-certbot-nginx

# Certificate al
sudo certbot --nginx -d owlivion.com -d www.owlivion.com

# Auto-renewal test
sudo certbot renew --dry-run
```

**Action Items:**
- [ ] `https://owlivion.com` erişilebilir mi?
- [ ] Certificate valid mi? (SSL Labs test: https://www.ssllabs.com/ssltest/)
- [ ] HTTP → HTTPS redirect çalışıyor mu?

---

### Task 4.3: File Upload & Deployment
**Hedef:** Landing page dosyalarını sunucuya yükle

**Action Items:**
- [ ] Landing page dosyalarını hazırla (local'de test edilmiş)
- [ ] Sunucuda target directory oluştur:
  ```bash
  ssh user@31.97.216.36
  sudo mkdir -p /var/www/owlivion.com/mail
  sudo chown $USER:$USER /var/www/owlivion.com/mail
  ```
- [ ] rsync ile dosyaları yükle:
  ```bash
  rsync -avz --delete landing/ user@31.97.216.36:/var/www/owlivion.com/mail/
  ```
- [ ] File permissions kontrol et:
  ```bash
  ssh user@31.97.216.36
  chmod -R 755 /var/www/owlivion.com/mail
  find /var/www/owlivion.com/mail -type f -exec chmod 644 {} \;
  ```

**Deployment Checklist:**
- [ ] index.html yüklendi
- [ ] privacy/index.html yüklendi
- [ ] terms/index.html yüklendi
- [ ] Assets (CSS, JS, images) yüklendi
- [ ] File permissions doğru (644 for files, 755 for dirs)

---

## 5️⃣ Testing & Verification

### Task 5.1: Local Testing
**Hedef:** Deployment öncesi local'de her şeyi test et

**Test Server:**
```bash
cd landing
python3 -m http.server 8000 --bind 127.0.0.1
# Test: http://localhost:8000/
```

**Test Checklist:**
- [ ] Ana sayfa yükleniyor: http://localhost:8000/
- [ ] CSS/JS yükleniyor (DevTools Network tab)
- [ ] Logo/resimler görünüyor
- [ ] Privacy Policy link çalışıyor: http://localhost:8000/privacy/
- [ ] Terms of Service link çalışıyor: http://localhost:8000/terms/
- [ ] Internal navigation çalışıyor (privacy → home, terms → home)
- [ ] Download button/link çalışıyor (varsa)
- [ ] Mobile responsive (DevTools → Toggle device toolbar)
- [ ] Dark mode çalışıyor (theme toggle varsa)

**Browser Test:**
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (macOS'ta)

---

### Task 5.2: Production Testing
**Hedef:** Deployment sonrası production URL'leri test et

**Test URL'ler:**
- https://owlivion.com/mail/
- https://owlivion.com/privacy/
- https://owlivion.com/terms/

**Test Checklist:**
- [ ] Ana sayfa erişilebilir: https://owlivion.com/mail/
- [ ] HTTPS çalışıyor (yeşil kilit ikonu)
- [ ] Privacy Policy erişilebilir: https://owlivion.com/privacy/
- [ ] Terms of Service erişilebilir: https://owlivion.com/terms/
- [ ] Tüm asset'ler yükleniyor (CSS, JS, images)
- [ ] Link'ler çalışıyor (internal navigation)
- [ ] Mobile'da çalışıyor (gerçek cihazda test)
- [ ] Console'da error yok (DevTools → Console)
- [ ] 404 hatası yok (Network tab)

**SSL Test:**
- [ ] SSL Labs test: https://www.ssllabs.com/ssltest/analyze.html?d=owlivion.com
- [ ] Certificate valid
- [ ] A+ rating hedefle

**Performance Test:**
- [ ] PageSpeed Insights: https://pagespeed.web.dev/
- [ ] Performance score > 90
- [ ] Accessibility score > 90

---

### Task 5.3: Google OAuth URL Verification
**Hedef:** Google OAuth consent screen'de kullanılacak URL'leri doğrula

**Test:**
1. Browser'da aç (incognito mode):
   - https://owlivion.com/mail/
   - https://owlivion.com/privacy/
   - https://owlivion.com/terms/

2. Kontrol et:
   - [ ] Login gerekmeden erişilebilir mi? (public)
   - [ ] Sayfa fully yükleniyor mu? (broken link yok)
   - [ ] İçerik görünüyor mu? (CSS problem yok)
   - [ ] Mobile'da erişilebilir mi?

3. Google'ın bot'u gibi test et:
   ```bash
   # User-agent: Googlebot
   curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
     https://owlivion.com/mail/

   # 200 OK dönmeli, HTML content olmalı
   ```

**Action Items:**
- [ ] Her 3 URL'yi browser'da test et
- [ ] Her 3 URL'yi curl ile test et
- [ ] Google Search Console'da "Fetch as Google" test yap (opsiyonel)

---

## 6️⃣ Google OAuth Integration

### Task 6.1: OAuth Consent Screen Update
**Hedef:** Google Cloud Console'da OAuth consent screen'i güncelle

**Pre-requisite:**
- ✅ Domain verification tamamlanmış olmalı (GOOGLE_DOMAIN_VERIFICATION.md)
- ✅ Landing page live olmalı (https://owlivion.com/mail/)
- ✅ Privacy Policy live olmalı (https://owlivion.com/privacy/)
- ✅ Terms of Service live olmalı (https://owlivion.com/terms/)

**Steps:**
1. **Google Cloud Console'a git:**
   ```
   https://console.cloud.google.com/apis/credentials/consent
   ```

2. **OAuth consent screen → EDIT APP**

3. **App information:**
   ```
   App name:            Owlivion Mail
   User support email:  [your-email@gmail.com]
   App logo:            Upload src-tauri/icons/128x128.png (teal owl logo)
   ```

4. **App domain:**
   ```
   Homepage:            https://owlivion.com/mail
   Privacy policy:      https://owlivion.com/privacy
   Terms of service:    https://owlivion.com/terms
   ```

5. **Authorized domains:**
   ```
   owlivion.com  (verified ✅)
   ```

6. **SAVE AND CONTINUE**

**Action Items:**
- [ ] Domain verification tamamla (GOOGLE_DOMAIN_VERIFICATION.md → DNS TXT record)
- [ ] OAuth consent screen'e git
- [ ] Homepage URL güncelle: `https://owlivion.com/mail`
- [ ] Privacy Policy URL güncelle: `https://owlivion.com/privacy`
- [ ] Terms of Service URL ekle: `https://owlivion.com/terms`
- [ ] App logo yükle (128x128.png)
- [ ] SAVE
- [ ] Green checkmark (verified) göründüğünü doğrula

**Verification Check:**
```
✅ App domain URLs verified (green checkmark)
✅ Authorized domains verified (owlivion.com)
✅ Scopes configured (https://mail.google.com/, userinfo.email, userinfo.profile)
✅ Test users added
```

---

### Task 6.2: Test OAuth Flow
**Hedef:** OAuth login'in production domain'lerle çalıştığını test et

**Test:**
1. Owlivion Mail uygulamasını aç
2. "Sign in with Google" tıkla
3. Google OAuth consent screen görünmeli
4. URL'leri kontrol et:
   - Homepage link → https://owlivion.com/mail/ açmalı
   - Privacy Policy link → https://owlivion.com/privacy/ açmalı
   - Terms link → https://owlivion.com/terms/ açmalı
5. Tüm link'ler çalışmalı (404 error olmamalı)

**Action Items:**
- [ ] OAuth login test et
- [ ] Consent screen'de 3 link'i de kontrol et
- [ ] Her link doğru sayfaya yönlendiriyor mu?
- [ ] Link'ler çalışmazsa, OAuth consent screen'i tekrar güncelle

---

### Task 6.3: Production Approval Submission
**Hedef:** Google OAuth verification başvurusu yap (opsiyonel)

**Note:** "External" user type ile 100 test user'a kadar verification olmadan çalışabilirsin.

**Production Verification (100+ user için):**
- Gereken: OAuth consent screen fully configured
- Gereken: Privacy Policy compliance review
- Gereken: App demo video (YouTube)
- Gereken: Verification form doldurma
- Süre: 4-6 hafta

**Action Items (Production için):**
- [ ] **KARAR:** 100+ user olacak mı?
  - Hayır → Verification SKIP, test users ile devam ✅
  - Evet → GOOGLE_OAUTH_SETUP.md → Section 5-6'ya bak

**Resources:**
- Verification guide: `GOOGLE_OAUTH_SETUP.md` → Section 5
- Verification form: https://support.google.com/code/contact/oauth_app_verification

---

## 📋 Final Checklist

### CRITICAL (Deployment Blockers)
- [ ] **Terms of Service oluşturuldu** (landing/terms/index.html)
- [ ] **Privacy Policy reviewed** (Google OAuth compliance)
- [ ] **Path'ler düzeltildi** (/mail subdirectory için)
- [ ] **Server routing configured** (Nginx/Apache)
- [ ] **SSL certificate valid** (HTTPS çalışıyor)

### HIGH (Google OAuth Requirements)
- [ ] **Homepage live:** https://owlivion.com/mail/
- [ ] **Privacy Policy live:** https://owlivion.com/privacy/
- [ ] **Terms of Service live:** https://owlivion.com/terms/
- [ ] **Domain verified:** Google Search Console
- [ ] **OAuth consent screen updated:** 3 URL eklendi

### MEDIUM (Content Quality)
- [ ] **Landing page content reviewed** (typos, grammar)
- [ ] **Feature list updated** (en son özellikler)
- [ ] **Screenshots güncel** (app'in son hali)
- [ ] **Contact info eklendi** (support email)

### LOW (Nice to Have)
- [ ] **Mobile responsive test** (gerçek cihazda)
- [ ] **Performance optimization** (PageSpeed Insights)
- [ ] **SEO optimization** (meta tags, description)
- [ ] **Analytics ekleme** (Google Analytics, opsiyonel)

---

## 🚀 Quick Start (1-2 Gün İçin)

Eğer hızlıca deployment yapmak istiyorsan, bu minimum checklist'i takip et:

### Day 1: Content (4-6 saat)
1. ✅ **Terms of Service oluştur** (2-3 saat)
   - landing/terms/index.html
   - Privacy policy'yi template olarak kullan
   - Email client için standart ToS yaz

2. ✅ **Path'leri düzelt** (1 saat)
   - landing/index.html → <base href="/mail/">
   - landing/privacy/index.html → Link'leri düzelt
   - landing/terms/index.html → Link'leri düzelt

3. ✅ **Privacy Policy review** (1 saat)
   - Google OAuth data usage ekle
   - Gemini API usage ekle
   - Contact info ekle

4. ✅ **Local test** (30 dakika)
   - python3 -m http.server 8000
   - Tüm link'leri test et

### Day 2: Deployment (2-3 saat)
5. ✅ **Server config** (1 saat)
   - Nginx/Apache config yaz
   - /mail routing ekle
   - SSL check

6. ✅ **File upload** (30 dakika)
   - rsync ile dosyaları yükle
   - Permissions düzelt

7. ✅ **Production test** (30 dakika)
   - https://owlivion.com/mail/ test et
   - 3 URL'yi browser'da kontrol et

8. ✅ **OAuth consent screen update** (30 dakika)
   - Google Cloud Console'da URL'leri güncelle
   - Green checkmark bekle

9. ✅ **OAuth login test** (30 dakika)
   - Owlivion Mail'de Google login dene
   - Consent screen link'leri test et

**TAMAMLANDI! 🎉**

---

## 📚 Resources

### Internal Documentation
- `GOOGLE_OAUTH_SETUP.md` - Full OAuth setup guide (15 sections)
- `GOOGLE_OAUTH_QUICKSTART.md` - Quick test setup (5-10 min)
- `GOOGLE_DOMAIN_VERIFICATION.md` - Domain verification guide
- `GOOGLE_OAUTH_TROUBLESHOOTING.md` - Common issues & fixes
- `SECURITY_FIXES_COMPLETE.md` - Recent security updates

### External Resources
- Google OAuth Guide: https://support.google.com/cloud/answer/6158849
- Privacy Policy Requirements: https://support.google.com/cloud/answer/9110914
- Domain Verification: https://support.google.com/webmasters/answer/9008080
- SSL Labs Test: https://www.ssllabs.com/ssltest/
- PageSpeed Insights: https://pagespeed.web.dev/

### Tools
- Terms of Service Generator: https://www.termsofservicegenerator.net/
- Privacy Policy Generator: https://www.privacypolicygenerator.info/
- DNS Checker: https://dnschecker.org/
- SSL Checker: https://www.ssllabs.com/ssltest/

---

## 🆘 Support & Questions

**Stuck? Check these first:**
1. Landing page path issues → Section 1.1
2. Terms of Service template → Section 2.1.2
3. Server routing config → Section 4.1 (Nginx example)
4. OAuth consent screen errors → GOOGLE_OAUTH_TROUBLESHOOTING.md

**Still stuck?**
- Re-read GOOGLE_OAUTH_SETUP.md (very comprehensive)
- Google Cloud Console support docs
- Open issue on GitHub (if public repo)

---

**Good luck! Deployment başarılı olsun! 🚀**
