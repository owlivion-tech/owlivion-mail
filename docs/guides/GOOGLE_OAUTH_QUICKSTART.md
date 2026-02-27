# ⚡ Google OAuth Quick Start - 5 Dakika

Owlivion Mail'i hızlıca test etmek için minimum setup rehberi.

---

## 🎯 Hedef: Development Test Setup (5-10 dakika)

---

## ✅ Adım 1: Google Cloud Project (2 dakika)

### 1.1. Giriş Yap
```
https://console.cloud.google.com/
```

### 1.2. Yeni Project
```
Sol üst → Project seçici → NEW PROJECT

Project name: Owlivion Mail Test
Project ID:   owlivion-mail-test-[otomatik]
Location:     No organization

→ CREATE
```

---

## ✅ Adım 2: OAuth Consent Screen (2 dakika)

### 2.1. Console'da
```
APIs & Services → OAuth consent screen
```

### 2.2. Setup
```
User Type:  ◉ External → CREATE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Page 1/4 - App Information
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App name:            Owlivion Mail Test
User support email:  [your-email@gmail.com]

App logo:            (skip for now)

App domain:
  Homepage:           https://owlivion.com
  Privacy policy:     https://owlivion.com/privacy
  Terms:              https://owlivion.com/terms

Developer contact:   [your-email@gmail.com]

→ SAVE AND CONTINUE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Page 2/4 - Scopes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+ ADD OR REMOVE SCOPES

Manually add scopes:
  https://mail.google.com/
  https://www.googleapis.com/auth/userinfo.email
  https://www.googleapis.com/auth/userinfo.profile
  openid

→ UPDATE → SAVE AND CONTINUE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Page 3/4 - Test users
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+ ADD USERS

Email:  [your-email@gmail.com]

→ ADD → SAVE AND CONTINUE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Page 4/4 - Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ BACK TO DASHBOARD
```

---

## ✅ Adım 3: OAuth Credentials (1 dakika)

### 3.1. Create Credentials
```
APIs & Services → Credentials

+ CREATE CREDENTIALS → OAuth client ID

Application type:  Desktop app
Name:             Owlivion Mail Desktop

→ CREATE
```

### 3.2. Credentials Kaydet
```
Client ID:     [COPY THIS]
Client secret: [COPY THIS]

→ DOWNLOAD JSON (backup)
→ OK
```

### 3.3. Redirect URI Ekle
```
Created client'a tıkla

Authorized redirect URIs:
  + ADD URI → http://localhost:8080/callback

→ SAVE
```

---

## ✅ Adım 4: Gmail API Enable (30 saniye)

```
APIs & Services → Library

Search: Gmail API → Gmail API

→ ENABLE
```

---

## ✅ Adım 5: .env Update (30 saniye)

```bash
# Proje dizininde
cd /home/owlivion/Dev/owlivion-mail

# .env dosyasını aç
nano .env

# Güncelle:
GOOGLE_CLIENT_ID=[ADIM 3.2'DEKİ CLIENT ID]
GOOGLE_CLIENT_SECRET=[ADIM 3.2'DEKİ CLIENT SECRET]

# Kaydet (Ctrl+X → Y → Enter)

# İzinleri koru
chmod 600 .env
```

---

## ✅ Adım 6: Test! (1 dakika)

```bash
# Dev mode'da başlat
pnpm tauri dev

# Owlivion Mail açılacak
# → Google OAuth ile giriş yap
# → Test user email'ini kullan
# → "This app is not verified" uyarısı gelecek
# → Advanced → Go to Owlivion Mail (unsafe)
# → Allow permissions
# → ✅ BAŞARILI!
```

---

## 🎉 TAMAMLANDI!

Owlivion Mail artık test için hazır!

**⚠️ NOT:**
- Bu setup sadece development/test içindir
- Production için: `GOOGLE_OAUTH_SETUP.md` dosyasına bak
- Verification süreci: 4-6 hafta

---

## 🐛 Sorun mu var?

### "redirect_uri_mismatch" Hatası
```
Çözüm:
1. Credentials → Client aç
2. Redirect URIs → http://localhost:8080/callback ekle
3. SAVE
```

### "Access blocked" Hatası
```
Çözüm:
1. OAuth consent screen tamamen doldurulmuş mu?
2. Test user eklendi mi?
3. Scopes doğru mu?
```

### "This app is not verified"
```
Normal:
- Development test için sorun değil
- "Advanced" → "Continue" diyebilirsin
- Production için verification gerekli
```

---

## 📚 Detaylı Dokümantasyon

- **Full Setup:** `GOOGLE_OAUTH_SETUP.md`
- **Troubleshooting:** `GOOGLE_OAUTH_TROUBLESHOOTING.md`
- **Production:** `GOOGLE_OAUTH_SETUP.md` → Section 5-6

---

**Başarılı testler! 🚀**
