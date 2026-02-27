# 🔐 Google OAuth Setup - Owlivion Mail

**Hedef:** Owlivion Mail uygulamasını Google OAuth ile production'a hazırlamak

---

## 📋 İçindekiler

1. [Google Cloud Project Oluşturma](#1-google-cloud-project-oluşturma)
2. [OAuth Consent Screen Yapılandırması](#2-oauth-consent-screen-yapılandırması)
3. [OAuth Client Credentials Oluşturma](#3-oauth-client-credentials-oluşturma)
4. [Gmail API Etkinleştirme](#4-gmail-api-etkinleştirme)
5. [Production İçin Yayınlama](#5-production-için-yayınlama)
6. [Google Verification Süreci](#6-google-verification-süreci)
7. [Test Kullanıcıları Ekleme](#7-test-kullanıcıları-ekleme)

---

## 1️⃣ Google Cloud Project Oluşturma

### Adım 1.1: Google Cloud Console'a Git
```
🔗 https://console.cloud.google.com/
```

### Adım 1.2: Yeni Project Oluştur
1. Sol üst köşede **Project seçici**'ye tıkla
2. **"NEW PROJECT"** butonuna tıkla
3. Project bilgileri:
   ```
   Project Name: Owlivion Mail
   Project ID:   owlivion-mail-[benzersiz-id]
   Location:     No organization
   ```
4. **"CREATE"** tıkla
5. Project oluşturulmasını bekle (30 saniye)

### Adım 1.3: Project'i Seç
- Project seçici'den **"Owlivion Mail"** project'ini seç

---

## 2️⃣ OAuth Consent Screen Yapılandırması

### Adım 2.1: OAuth Consent Screen Sayfasına Git
```
Navigation: APIs & Services → OAuth consent screen
URL: https://console.cloud.google.com/apis/credentials/consent
```

### Adım 2.2: User Type Seç
```
◉ External (Kullanıcılar için)
  - Herkes kullanabilir
  - Google verification gerekli (production için)

○ Internal (Sadece Google Workspace organizasyon için)
  - Sadece workspace kullanıcıları
  - Verification gerekmez
```

**Seçim:** `External` seç → **"CREATE"**

### Adım 2.3: App Information (Sayfa 1/4)

#### Required Fields:
```
App name:                Owlivion Mail
User support email:      [senin-email@gmail.com]
```

#### App Logo (Opsiyonel ama önerilen):
```
- Format:  PNG, JPG, GIF
- Boyut:   120x120 px önerilen
- Max:     1MB
- Yükle:   icons/128x128.png
```

#### App Domain (Önemli!):
```
Application home page:     https://owlivion.com
Application privacy policy: https://owlivion.com/privacy
Application terms of service: https://owlivion.com/terms
```

**NOT:** Bu URL'ler gerçek ve erişilebilir olmalı!

#### Developer Contact:
```
Developer contact information:
  - Email: [senin-email@gmail.com]
```

**"SAVE AND CONTINUE"** tıkla

### Adım 2.4: Scopes (Sayfa 2/4)

**"ADD OR REMOVE SCOPES"** butonuna tıkla

#### Required Scopes for Owlivion Mail:

**Manually add scopes** bölümüne ekle:

```
1. Email Read/Write/Send:
   https://mail.google.com/

2. User Info - Email:
   https://www.googleapis.com/auth/userinfo.email

3. User Info - Profile:
   https://www.googleapis.com/auth/userinfo.profile

4. OpenID:
   openid
```

**Neden bu scope'lar?**
- `mail.google.com` - Gmail okuma, yazma, gönderme (Email client için gerekli)
- `userinfo.email` - Kullanıcı email adresini alma
- `userinfo.profile` - Kullanıcı profil bilgisi (ad, resim)
- `openid` - OAuth2 OpenID Connect için

**"UPDATE"** → **"SAVE AND CONTINUE"** tıkla

### Adım 2.5: Test Users (Sayfa 3/4)

**Development sırasında:** Test kullanıcıları ekle

```
+ ADD USERS

Email addresses:
  - [senin-email@gmail.com]
  - [test-user@gmail.com]
  - [beta-tester@gmail.com]
```

**NOT:**
- Test mode'da sadece bu kullanıcılar uygulamayı kullanabilir
- Production'a geçince bu kısıtlama kalkar
- Maximum 100 test user eklenebilir

**"SAVE AND CONTINUE"** tıkla

### Adım 2.6: Summary (Sayfa 4/4)

Tüm bilgileri kontrol et ve **"BACK TO DASHBOARD"** tıkla

---

## 3️⃣ OAuth Client Credentials Oluşturma

### Adım 3.1: Credentials Sayfasına Git
```
Navigation: APIs & Services → Credentials
URL: https://console.cloud.google.com/apis/credentials
```

### Adım 3.2: Create Credentials
1. **"+ CREATE CREDENTIALS"** butonuna tıkla
2. **"OAuth client ID"** seç

### Adım 3.3: Application Type Seç
```
Application type: Desktop app
Name:            Owlivion Mail Desktop Client
```

**"CREATE"** tıkla

### Adım 3.4: Credentials Kaydet
Popup'ta gösterilen credentials'ları **KOPYALA**:

```
Client ID:     [YOUR_CLIENT_ID].apps.googleusercontent.com
Client Secret: GOCSPX-[YOUR_CLIENT_SECRET]
```

**"DOWNLOAD JSON"** butonuna tıkla (backup için)

### Adım 3.5: Redirect URI Ekle (Önemli!)

1. Yeni oluşturulan client'a tıkla
2. **"Authorized redirect URIs"** bölümüne git
3. **"+ ADD URI"** tıkla
4. Ekle:
   ```
   http://localhost:8080/callback
   ```
5. **"SAVE"** tıkla

**NOT:** Desktop app için redirect URI opsiyonel olabilir, ama Owlivion Mail için gerekli!

---

## 4️⃣ Gmail API Etkinleştirme

### Adım 4.1: API Library'ye Git
```
Navigation: APIs & Services → Library
URL: https://console.cloud.google.com/apis/library
```

### Adım 4.2: Gmail API'yi Bul
1. Arama kutusuna: **"Gmail API"** yaz
2. **Gmail API** kartına tıkla

### Adım 4.3: Enable API
**"ENABLE"** butonuna tıkla

**Etkinleştirilen API'ler:**
- ✅ Gmail API
- ✅ Google OAuth2 API (otomatik)
- ✅ Google People API (user info için, otomatik)

---

## 5️⃣ Production İçin Yayınlama

### Publishing Status

**Development Mode (Test):**
```
Status:  🟡 Testing
Users:   Sadece test kullanıcıları (max 100)
Limit:   Günlük API quota düşük
Warning: "This app is not verified" gösterilir
```

**Production Mode:**
```
Status:  🟢 In Production
Users:   Herkes kullanabilir
Limit:   Normal API quotas
Warning: Yok (verification sonrası)
```

### Adım 5.1: PUBLISH APP

1. OAuth consent screen sayfasına git
2. **"PUBLISH APP"** butonuna tıkla
3. Confirmation popup → **"CONFIRM"**

**⚠️ ÖNEMLİ:**
Publishing yapar yapmaz uygulama herkese açılır ama **"unverified"** uyarısı gösterilir. Kullanıcılar "Advanced" → "Go to Owlivion Mail (unsafe)" diyerek devam edebilir.

---

## 6️⃣ Google Verification Süreci

### Neden Verification Gerekli?

**Sensitive scopes kullanıyorsanız (Gmail gibi):**
- Google'ın güvenlik incelemesinden geçmelisiniz
- Verification olmadan "unverified app" uyarısı gösterilir
- Production kullanıcılar için güven problemi

### Verification Gereksinimleri

**Minimum Gereksinimler:**
```
✅ OAuth consent screen tam doldurulmuş
✅ Privacy policy URL çalışıyor
✅ Terms of service URL çalışıyor
✅ Homepage URL çalışıyor
✅ App logo eklenmiş
✅ Uygulama test edilebilir durumda
```

**Dokümantasyon:**
```
✅ App nasıl çalışır? (video veya screenshots)
✅ Neden bu scope'lar gerekli?
✅ Kullanıcı verisi nasıl korunuyor?
✅ Privacy policy detaylı
```

### Adım 6.1: Verification Başvurusu

1. OAuth consent screen → **"PREPARE FOR VERIFICATION"**
2. Formu doldur:
   ```
   - App domain verification (DNS record)
   - Demo video (YouTube)
   - Screenshots (app kullanımı)
   - Privacy policy explanation
   - Scope justification (neden Gmail access?)
   ```

3. **"SUBMIT FOR VERIFICATION"**

### Verification Süresi
```
⏱️ 4-6 hafta (ortalama)
📧 Google'dan update mailler gelir
🔍 Google team incelemesi
✅ Onay sonrası "verified" badge
```

### ⚠️ Verification Olmadan Kullanım

**Geçici çözüm (Development/Beta için):**
```
1. Publishing status: "Testing" bırak
2. Test users ekle (max 100)
3. Beta testers'a özel link ver
4. "Unverified app" uyarısını kabul etmelerini iste
```

**Risk:**
- Kullanıcılar "unsafe" uyarısı görür
- Trust problemi (endişe verici görünür)
- Production için uygun değil

**Önerilen Yaklaşım:**
1. İlk olarak test kullanıcılarla beta test
2. Geri bildirim topla ve uygulamayı iyileştir
3. Verification başvurusu yap
4. Verification onayı gelene kadar beta mod devam

---

## 7️⃣ Test Kullanıcıları Ekleme

### Test Mode'da Kullanım

**Test kullanıcısı eklemek için:**

1. OAuth consent screen → **Edit App**
2. **Test users** sekmesine git
3. **+ ADD USERS**
4. Email adresleri ekle:
   ```
   test1@gmail.com
   test2@gmail.com
   beta-user@gmail.com
   ```
5. **SAVE**

### Test Kullanıcısı Olarak Giriş

```bash
# Owlivion Mail'i aç
pnpm tauri dev

# Google OAuth ile giriş yap
# Test user email'i kullan
```

**Beklenen:**
- ✅ "This app is not verified" uyarısı görünür
- ✅ "Advanced" → "Go to Owlivion Mail (unsafe)" ile devam
- ✅ Permissions onayı iste
- ✅ Başarılı giriş

---

## 8️⃣ .env Dosyasını Güncelleme

### Credentials'ları Kaydet

```bash
# .env dosyasını aç
nano .env
```

### Güncelle:
```bash
# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=[3. ADIMDA OLUŞTURDUĞUN CLIENT ID]
GOOGLE_CLIENT_SECRET=[3. ADIMDA OLUŞTURDUĞUN CLIENT SECRET]

# Microsoft OAuth2 (henüz yapılmadıysa placeholder bırak)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Gemini API Key
GEMINI_API_KEY=[GEMINI CONSOLE'DAN ALINAN KEY]
```

### Dosya İzinlerini Koru
```bash
chmod 600 .env
```

---

## 9️⃣ Test Senaryoları

### Test Checklist

**OAuth Flow:**
- [ ] Google login butonu çalışıyor
- [ ] Popup açılıyor (veya browser tab)
- [ ] Email/password girişi başarılı
- [ ] Permission screen gösteriliyor
- [ ] "Allow" tıklayınca redirect çalışıyor
- [ ] Access token alınıyor
- [ ] Refresh token kaydediliyor

**Gmail Integration:**
- [ ] Inbox emails listeleniyor
- [ ] Email detay açılıyor
- [ ] Email gönderme çalışıyor
- [ ] Folders listeleniyor
- [ ] Search çalışıyor
- [ ] Attachments indiriliyor

**Error Handling:**
- [ ] Invalid credentials → error message
- [ ] Token expiry → auto refresh
- [ ] Permission denied → uygun hata mesajı
- [ ] Network error → retry mekanizması

---

## 🔟 Troubleshooting

### Sık Karşılaşılan Hatalar

#### 1. "redirect_uri_mismatch"
```
❌ Error: redirect_uri_mismatch
```

**Çözüm:**
- Google Console → Credentials → Client'ı aç
- Authorized redirect URIs → `http://localhost:8080/callback` ekle
- SAVE

#### 2. "Access blocked: This app's request is invalid"
```
❌ Error: Access blocked
```

**Çözüm:**
- OAuth consent screen tam doldurulmuş mu?
- Privacy policy URL çalışıyor mu?
- Scopes doğru eklenmiş mi?

#### 3. "This app is not verified"
```
⚠️ Warning: This app is not verified
```

**Çözüm (geçici):**
- "Advanced" → "Go to Owlivion Mail (unsafe)" tıkla
- Sadece development/testing için

**Çözüm (kalıcı):**
- Google verification başvurusu yap (4-6 hafta)

#### 4. "Access denied: User canceled authentication"
```
❌ Error: User canceled
```

**Çözüm:**
- Normal davranış (kullanıcı cancel etti)
- Uygun error message göster
- Tekrar deneme seçeneği sun

#### 5. "Invalid grant: Token has been expired or revoked"
```
❌ Error: Invalid grant
```

**Çözüm:**
- Refresh token kullanarak yeni access token al
- Eğer refresh token da invalid → kullanıcıdan yeniden login iste

---

## 1️⃣1️⃣ Production Deployment Checklist

### Verification Öncesi

**Technical Requirements:**
- [ ] OAuth consent screen tamamen doldurulmuş
- [ ] Privacy policy live ve erişilebilir
- [ ] Terms of service live ve erişilebilir
- [ ] Homepage live
- [ ] App logo eklenmiş (120x120 px)
- [ ] All scopes justified (neden gerekli?)
- [ ] Error handling comprehensive
- [ ] Token refresh working
- [ ] Logout fonksiyonu var
- [ ] Data deletion fonksiyonu var (GDPR)

**Documentation:**
- [ ] User guide hazır
- [ ] Privacy policy detaylı (data collection, usage, retention)
- [ ] Demo video (2-3 dakika, YouTube)
- [ ] Screenshots (key features)
- [ ] Scope justification document
- [ ] Security measures documented

**Testing:**
- [ ] 10+ test users ile test edildi
- [ ] Edge cases test edildi
- [ ] Error scenarios test edildi
- [ ] Token expiry/refresh test edildi
- [ ] Multiple accounts test edildi

### Verification Sonrası

**Go-Live:**
- [ ] Verification approved (email geldi)
- [ ] "PUBLISH APP" yapıldı
- [ ] Test users kaldırıldı (veya genişletildi)
- [ ] Production credentials updated (.env)
- [ ] Monitoring setup (API usage, errors)
- [ ] Support email setup
- [ ] User feedback mechanism

---

## 1️⃣2️⃣ API Quotas & Limits

### Gmail API Default Quotas

```
Quota Type                    Limit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Queries per day               1,000,000,000
Queries per 100 seconds       25,000
Queries per user per second   250
Send messages per day         Free: 500
                             Paid: 1,000 - 10,000
```

### Quota Artırma

**Eğer limitler yetersiz:**
1. Google Cloud Console → APIs & Services → Gmail API
2. Quotas → Request increase
3. Business justification yaz
4. Google approval bekle (1-2 hafta)

---

## 1️⃣3️⃣ Best Practices

### Security

```
✅ YAPILMASI GEREKENLER:
- Access tokens short-lived (1 hour)
- Refresh tokens secure storage (encrypted)
- Token rotation implement
- HTTPS only (production)
- PKCE flow kullan (OAuth 2.1)
- Scope minimize (sadece gerekli olanlar)
- Regular security audits

❌ YAPILMAMASI GEREKENLER:
- Client secret commit etme
- Access tokens log'lama
- Refresh tokens URL'de gönderme
- HTTP kullanma (production)
- Sensitive data plain text storage
```

### User Experience

```
✅ YAPILMASI GEREKENLER:
- Clear permission explanations
- Easy logout
- Token refresh transparent
- Offline mode (cache)
- Clear error messages
- Privacy controls

❌ YAPILMAMASI GEREKENLER:
- Over-requesting permissions
- Hiding what data collected
- No way to delete data
- Confusing OAuth flow
```

---

## 1️⃣4️⃣ Monitoring & Analytics

### Metrics to Track

```
📊 OAuth Metrics:
- Login success rate
- Token refresh failures
- Permission denial rate
- Average login time

📊 API Usage:
- Gmail API calls per day
- Quota usage percentage
- Error rate
- Response times

📊 User Metrics:
- Active users
- Daily active users (DAU)
- Retention rate
- Churn rate
```

### Tools

```
Google Cloud Monitoring:
- API usage dashboard
- Quota monitoring
- Error tracking
- Performance metrics

Application Monitoring:
- Sentry (error tracking)
- Google Analytics (user behavior)
- Custom logging (auth events)
```

---

## 1️⃣5️⃣ Resources

### Official Documentation
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API](https://developers.google.com/gmail/api)
- [OAuth Verification](https://support.google.com/cloud/answer/9110914)
- [Brand verification](https://support.google.com/cloud/answer/10311615)

### Useful Links
- [OAuth Playground](https://developers.google.com/oauthplayground/)
- [API Explorer](https://developers.google.com/gmail/api/reference/rest)
- [Quotas & Limits](https://developers.google.com/gmail/api/reference/quota)

---

## ✅ Quick Start Summary

**5 Dakikada Test Setup:**

```bash
1. Google Cloud Console → New Project
2. OAuth consent screen → External → Basic info
3. Credentials → Create OAuth client (Desktop)
4. Copy client ID & secret
5. Enable Gmail API
6. Add test user (your email)
7. Update .env
8. Test: pnpm tauri dev
```

**Production için (4-6 hafta):**

```bash
1. Privacy policy & ToS yayınla
2. Demo video hazırla
3. Screenshots al
4. Verification başvurusu yap
5. Google approval bekle
6. Publish app
7. Production credentials update
8. Go live! 🚀
```

---

**Tamamlandı!** Owlivion Mail artık Google OAuth ile kullanıma hazır! 🎉

**Sorular?** GOOGLE_OAUTH_TROUBLESHOOTING.md dosyasına bakabilirsin.
