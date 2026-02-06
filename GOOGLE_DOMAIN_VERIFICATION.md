# 🔐 Google Domain Verification - Owlivion.com

**Amaç:** Google'a owlivion.com domain'inin sana ait olduğunu kanıtlamak

---

## ❓ Neden Gerekli?

OAuth consent screen'de domain kullanıyorsan:
```
✅ Homepage:       https://owlivion.com
✅ Privacy policy: https://owlivion.com/privacy
✅ Terms:          https://owlivion.com/terms
```

**Google der ki:**
> "Bu domain'leri kullanıyorsan, sahip olduğunu kanıtla!"

**Verification olmadan:**
- ❌ OAuth consent screen kaydedilemez
- ❌ "Domain not verified" hatası
- ❌ Production'a geçemezsin

---

## 🎯 2 Verification Yöntemi

### Yöntem 1: Google Search Console (Önerilen) ⭐
- **Süre:** 5-10 dakika
- **Kolaylık:** Kolay
- **Kalıcı:** Evet

### Yöntem 2: Domain Provider (DNS)
- **Süre:** 5-10 dakika + DNS propagation (1-24 saat)
- **Kolaylık:** Orta
- **Kalıcı:** Evet

---

## 🚀 Yöntem 1: Google Search Console (Adım Adım)

### Adım 1.1: Google Search Console'a Git
```
🔗 https://search.google.com/search-console/
```

1. Google hesabınla giriş yap (owlivion.com sahibi)
2. **"Add property"** veya **"Add a property"** tıkla

### Adım 1.2: Property Type Seç
```
◉ Domain (Önerilen)
  └─ Tüm subdomain'leri kapslar
  └─ Verification: DNS TXT record
  └─ Örnek: owlivion.com → www.owlivion.com, blog.owlivion.com vb.

○ URL prefix
  └─ Sadece specific URL
  └─ Örnek: https://owlivion.com (www.owlivion.com ayrı)
```

**SEÇİM:** `Domain` seç (daha kapsamlı)

### Adım 1.3: Domain Gir
```
Domain: owlivion.com
```

**CONTINUE** tıkla

### Adım 1.4: DNS Verification
Google sana bir **TXT record** verecek:

```
Record Type:  TXT
Host:         @  (veya owlivion.com)
Value:        google-site-verification=XxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
TTL:          3600 (veya default)
```

**Bu değeri KOPYALA!** (pencereyi kapatma)

---

## 🌐 Adım 2: DNS Record Ekleme

### Domain Provider'ına Git
```
Örnek provider'lar:
- GoDaddy:      https://dcc.godaddy.com/domains/
- Namecheap:    https://ap.www.namecheap.com/domains/list/
- Cloudflare:   https://dash.cloudflare.com/
- Google Domains: https://domains.google.com/registrar/
- Name.com:     https://www.name.com/account/domain
```

### Adım 2.1: DNS Management Bul
```
Domain list → owlivion.com → DNS Management
veya
Manage → DNS → Advanced DNS
```

### Adım 2.2: TXT Record Ekle
```
Record Type:  TXT
Host/Name:    @
              (bazı provider'larda: owlivion.com veya boş bırak)
Value/Data:   google-site-verification=XxXxXxXxXxXxXxXxXxXx
              (Google Search Console'dan kopyaladığın)
TTL:          3600 (veya Automatic/Default)
```

**SAVE/ADD RECORD** tıkla

### Adım 2.3: Propagation Bekle
```
⏱️ Süre: 5 dakika - 24 saat (genellikle 10-30 dakika)

Kontrol et:
https://dnschecker.org/#TXT/owlivion.com
```

---

## ✅ Adım 3: Verification Tamamla

### Adım 3.1: Google Search Console'a Dön
```
Hala açık olan verification penceresi:
→ VERIFY tıkla
```

### Adım 3.2: Başarılı!
```
✅ Ownership verified
✅ Property added to Search Console
```

**Eğer hata alırsan:**
```
❌ "Verification failed"

Nedenler:
1. DNS henüz propagate olmadı → 10-30 dakika bekle, tekrar dene
2. TXT record yanlış girilmiş → Kontrol et, düzelt
3. Host/Name yanlış → @ veya boş olmalı
```

---

## 🔗 Adım 4: Google Cloud Console'a Bağla

### Adım 4.1: Cloud Console'da Domain Ekle
```
1. https://console.cloud.google.com/apis/credentials/consent

2. OAuth consent screen → EDIT APP

3. Authorized domains bölümüne:
   → owlivion.com ekle
   → SAVE

4. App information → App domain:
   → Homepage:       https://owlivion.com
   → Privacy policy: https://owlivion.com/privacy
   → Terms:          https://owlivion.com/terms
   → SAVE
```

### Adım 4.2: Verification Status
```
✅ Domain verified (green checkmark)
✅ Artık bu domain'i OAuth consent screen'de kullanabilirsin
```

---

## 📋 Verification Checklist

### Search Console Verification
- [ ] Google Search Console'a git
- [ ] Property ekle (Domain type)
- [ ] TXT record kopyala
- [ ] Domain provider'da DNS'e TXT record ekle
- [ ] 10-30 dakika bekle (propagation)
- [ ] Verification tamamla
- [ ] ✅ "Ownership verified" göründü

### Cloud Console Integration
- [ ] OAuth consent screen → Authorized domains → owlivion.com ekle
- [ ] App domain → Homepage, Privacy, Terms URL'leri ekle
- [ ] ✅ Green checkmark (verified) göründü
- [ ] SAVE AND CONTINUE

---

## 🐛 Troubleshooting

### "Verification failed" Hatası

#### 1. DNS Record Kontrol
```bash
# TXT record'u kontrol et
nslookup -type=TXT owlivion.com

# Veya online tool:
https://dnschecker.org/#TXT/owlivion.com
```

**Beklenen çıktı:**
```
owlivion.com text = "google-site-verification=XxXxXxXxXx..."
```

#### 2. Host/Name Değeri
```
❌ Yanlış: www, owlivion.com., subdomain
✅ Doğru: @ veya boş (provider'a göre)
```

#### 3. DNS Propagation
```
⏱️ Hala propagate olmamış olabilir
→ 30 dakika bekle
→ Tekrar dene
```

#### 4. Multiple TXT Records
```
✅ Aynı domain'de birden fazla TXT record olabilir
✅ Eski TXT record'ları silmene gerek yok
✅ Google sadece kendi verification code'unu arar
```

---

## 🔄 Alternative: HTML File Verification

**Eğer DNS erişimin yoksa:**

### Adım 1: Verification File İndir
```
Google Search Console → Verify → Alternative methods
→ HTML file download
→ google123abc.html dosyasını indir
```

### Adım 2: Website'ine Yükle
```
Upload to: https://owlivion.com/google123abc.html

Kontrol et:
curl https://owlivion.com/google123abc.html
(File content göründü mü?)
```

### Adım 3: Verify
```
Google Search Console → VERIFY
✅ Success!
```

**NOT:** HTML file method, DNS'den daha az kalıcı. File silinirse verification kaybolur.

---

## 🔄 Alternative: HTML Meta Tag

**Eğer sadece homepage'e erişimin varsa:**

### Adım 1: Meta Tag Kopyala
```html
<meta name="google-site-verification" content="XxXxXxXxXxXx..." />
```

### Adım 2: Homepage <head> Ekle
```html
<!-- owlivion.com/index.html -->
<head>
  <meta name="google-site-verification" content="XxXxXxXxXxXx..." />
  ...
</head>
```

### Adım 3: Verify
```
Google Search Console → VERIFY
✅ Success!
```

**NOT:** Meta tag, homepage'den kaldırılırsa verification kaybolur.

---

## ✅ Verification Sonrası

### Google Cloud Console'da
```
✅ Authorized domains: owlivion.com (verified)
✅ App domain URLs: Çalışıyor
✅ OAuth consent screen: Kaydedilebiliyor
```

### Artık Yapabilirsin:
```
✅ OAuth consent screen tamamlayabilirsin
✅ Publishing status: "In production" yapabilirsin
✅ Verification başvurusu yapabilirsin
✅ Production kullanıcılara açabilirsin
```

---

## 🎯 Özet: En Hızlı Yol (5-30 dakika)

```bash
1. Google Search Console → Add property (Domain)
   ⏱️ 1 dakika

2. TXT record kopyala
   ⏱️ 10 saniye

3. Domain provider → DNS → Add TXT record
   ⏱️ 2 dakika

4. Propagation bekle (dnschecker.org ile kontrol)
   ⏱️ 10-30 dakika

5. Google Search Console → VERIFY
   ⏱️ 10 saniye

6. Cloud Console → Authorized domains → owlivion.com ekle
   ⏱️ 1 dakika

✅ TAMAMLANDI!
```

---

## 📚 Kaynaklar

- [Google Search Console](https://search.google.com/search-console/)
- [Domain Verification Guide](https://support.google.com/webmasters/answer/9008080)
- [DNS Checker](https://dnschecker.org/)
- [OAuth Domain Verification](https://support.google.com/cloud/answer/9110914)

---

## ⚠️ Önemli Notlar

### Production İçin
```
✅ ZORUNLU:
   - Homepage URL (https://owlivion.com)
   - Privacy Policy URL (live ve erişilebilir)
   - Terms of Service URL (live ve erişilebilir)
   - Domain verification (Google Search Console)

⚠️ OPSIYONEL (ama önerilen):
   - App logo (120x120 px)
   - Support email
   - Developer contact
```

### Test/Development İçin
```
❌ GEREKLİ DEĞİL:
   - Domain verification yapman gerek yok
   - Placeholder URL'ler kullanabilirsin
   - Test users ile çalışır
```

**YANİ:**
- **Test için:** Domain verification SKIP
- **Production için:** Domain verification ZORUNLU

---

**Tamamlandı!** Domain verification artık kolay! 🎉
