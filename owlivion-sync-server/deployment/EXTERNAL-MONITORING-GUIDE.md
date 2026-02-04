# External Monitoring Setup - Quick Start Guide

Bu rehber, production VPS için harici monitoring servislerinin kurulumunu adım adım açıklar.

---

## 1. UptimeRobot (Uptime Monitoring) ⏱️

**Amaç:** API endpoint'lerinizin 7/24 uptime izlemesi ve downtime durumunda anında uyarı

### Adım 1: Hesap Oluştur

1. https://uptimerobot.com/signUp adresine git
2. Email ile ücretsiz hesap oluştur
3. Email doğrulama yap

### Adım 2: İlk Monitor Ekle

**Dashboard → Add New Monitor**

```
Monitor Type: HTTP(s)
Friendly Name: Owlivion API Health
URL: https://owlivion.com/api/v1/health
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-04T10:00:00.000Z"
}
```

### Adım 3: Uyarı Ayarları

1. **My Settings → Alert Contacts**
   - Email adresinizi ekleyin
   - SMS (opsiyonel, ücretli)
   - Webhook (opsiyonel)

2. **Monitor Settings → Alert Contacts**
   - "Send alerts when DOWN" ✅
   - "Send alerts when SSL expires" ✅
   - Alert frequency: "Immediately"

### Adım 4: Ek Monitor'lar (Opsiyonel)

Ana domain için:
```
URL: https://owlivion.com
Type: HTTP(s)
Name: Owlivion Main Site
```

SSL sertifika kontrolü:
```
URL: https://owlivion.com
Type: Keyword
Keyword: "owlivion"
Name: SSL Certificate Check
```

### Adım 5: Public Status Page (Opsiyonel)

1. **My Settings → Public Status Pages**
2. "Create Public Status Page" tıkla
3. Monitörleri seç
4. Custom domain (opsiyonel): status.owlivion.com
5. Paylaş: `https://stats.uptimerobot.com/YOUR_ID`

### Test

- Dashboard'da monitor durumunu kontrol et
- "Pause Monitor" → "Resume" yaparak test notification gönder
- Email inbox'ınızı kontrol et

---

## 2. PM2 Plus (Process Monitoring) 📊

**Amaç:** Node.js uygulamanızın real-time performans takibi (CPU, RAM, HTTP latency)

### Adım 1: PM2 Plus Hesabı

1. https://app.pm2.io/register adresine git
2. GitHub veya Email ile kayıt ol
3. Free tier seç (1 server, ömür boyu ücretsiz)

### Adım 2: Bucket Oluştur

1. Dashboard → "Create New Bucket"
2. Name: `Owlivion Production`
3. Region: `Europe (Amsterdam)` (en yakın)

### Adım 3: PM2'yi Bağla

Dashboard'da **Public Key** ve **Secret Key** görünecek.

**VPS'de şu komutu çalıştır:**

```bash
ssh root@31.97.216.36

# PM2'yi PM2 Plus'a bağla
pm2 link <SECRET_KEY> <PUBLIC_KEY> owlivion-production

# Örnek:
# pm2 link abc123def456 xyz789uvw012 owlivion-production
```

**Doğrulama:**
```bash
pm2 list
# "Agent" sütununda "online" görmelisin
```

### Adım 4: Monitoring Özellikleri

PM2 Plus dashboard'da göreceğin metrikler:

- **Process Status:** Online/offline, uptime, restart count
- **CPU Usage:** Real-time CPU kullanımı
- **Memory:** Heap kullanımı, memory leaks
- **HTTP Monitoring:** Request rate, latency, status codes
- **Event Loop:** Event loop delay (Node.js performans)
- **Logs:** Real-time log streaming

### Adım 5: Alert Kuralları

**Dashboard → Settings → Alerts**

Önerilen alert kuralları:

```
1. Process Restart
   Condition: Process restarts
   Threshold: 3 times in 5 minutes
   Action: Send email

2. High CPU
   Condition: CPU > 80%
   Duration: 5 minutes
   Action: Send email

3. High Memory
   Condition: Memory > 500MB
   Duration: 5 minutes
   Action: Send email

4. Exception Rate
   Condition: Exceptions > 10
   Duration: 1 minute
   Action: Send email
```

### Adım 6: Custom Metrics (Opsiyonel)

Eğer sync operation metriklerini takip etmek istersen:

**src/app.js dosyasına ekle:**

```javascript
const io = require('@pm2/io');

// Custom metrics
const syncCounter = io.metric({
  name: 'Total Syncs',
  id: 'app/sync/total'
});

const activeSyncs = io.counter({
  name: 'Active Syncs',
  id: 'app/sync/active'
});

// Sync başladığında
activeSyncs.inc();
syncCounter.inc();

// Sync bittiğinde
activeSyncs.dec();
```

**Package yükle:**
```bash
cd /opt/owlivion-sync-server
npm install @pm2/io
pm2 restart owlivion-sync
```

### Adım 7: Log Viewing

PM2 Plus'da log'ları canlı görmek için:

1. Dashboard → Select Process → "Logs" tab
2. Real-time log streaming
3. Search ve filter özelliği

**Alternatif (CLI):**
```bash
# Terminal'den real-time logs
pm2 logs owlivion-sync

# Son 100 satır
pm2 logs owlivion-sync --lines 100

# Sadece error logs
pm2 logs owlivion-sync --err
```

### Test

1. Dashboard'da process'in "online" göründüğünü kontrol et
2. CPU/Memory grafiklerinin güncellendiğini gör
3. Manuel restart test: `pm2 restart owlivion-sync`
4. Alert geldiğini kontrol et

---

## 3. Entegrasyon Test

Her iki servisi kurduktan sonra test senaryosu:

### Test 1: API Down Senaryosu

```bash
# VPS'de PM2'yi durdur
ssh root@31.97.216.36
pm2 stop owlivion-sync

# Bekle: 5-10 dakika içinde UptimeRobot email gönderecek
# Başlık: "[Down] Owlivion API Health"

# PM2 Plus: Dashboard'da "stopped" göreceksin

# Geri başlat
pm2 start owlivion-sync

# UptimeRobot: "[Up] Owlivion API Health" email gelecek
```

### Test 2: High CPU Senaryosu

```bash
# Yük testi (opsiyonel)
sudo apt-get install apache2-utils

# 100 concurrent request
ab -n 1000 -c 100 https://owlivion.com/api/v1/health

# PM2 Plus dashboard'da CPU spike göreceksin
# Eğer threshold geçerse alert alacaksın
```

### Test 3: Manual Health Check

```bash
# VPS'de health check çalıştır
ssh root@31.97.216.36
sudo /opt/owlivion-sync-server/deployment/healthcheck.sh --verbose

# Tüm checkler "OK" olmalı
```

---

## 4. Dashboard'ları Favorilere Ekle

Hızlı erişim için:

- **UptimeRobot:** https://dashboard.uptimerobot.com/
- **PM2 Plus:** https://app.pm2.io/
- **VPS Health Log:** SSH ile `/var/log/owlivion-health.log`

### Tavsiye edilen workflow:

1. **Günlük:** PM2 Plus dashboard hızlı kontrol (1 dakika)
2. **Haftalık:** UptimeRobot uptime report (email otomatik gelir)
3. **Aylık:** Backup durumu ve disk space kontrolü
4. **Alert geldiğinde:** Immediate investigation

---

## 5. Alert Örnekleri

### UptimeRobot Email:

```
Subject: [Down] Owlivion API Health

Monitor: Owlivion API Health
Status: DOWN
URL: https://owlivion.com/api/v1/health
Reason: Connection timeout (30s)
Time: 2026-02-04 14:30:00 UTC
Duration: 5 minutes

View Details: [Link]
```

### PM2 Plus Email:

```
Subject: [Alert] owlivion-sync restarted 3 times

Process: owlivion-sync
Alert: Process Restart
Count: 3 restarts in 5 minutes
Server: owlivion-production
Time: 2026-02-04 14:30:00 UTC

View Dashboard: [Link]
```

---

## 6. Troubleshooting

### UptimeRobot monitor "DOWN" gösteriyor ama site çalışıyor

**Sebep:** Firewall, SSL sertifika sorunu, yavaş yanıt

**Çözüm:**
```bash
# Manuel test
curl -I https://owlivion.com/api/v1/health

# Response time kontrolü
time curl https://owlivion.com/api/v1/health

# SSL sertifika kontrolü
openssl s_client -connect owlivion.com:443
```

### PM2 Plus "Agent offline" gösteriyor

**Sebep:** Network sorunu, PM2 link kaybı

**Çözüm:**
```bash
ssh root@31.97.216.36

# PM2 agent durumu
pm2 list

# Yeniden bağlan
pm2 unlink
pm2 link <SECRET_KEY> <PUBLIC_KEY> owlivion-production
```

### Email alert gelmiyor

**Sebep:** Email servisi yapılandırılmamış

**Çözüm:**
```bash
# mailutils kurulumu
sudo apt-get install mailutils

# Test email
echo "Test" | mail -s "Test Alert" your@email.com

# Postfix log kontrolü
sudo tail -f /var/log/mail.log
```

---

## 7. Checklist

Setup tamamlandıktan sonra:

- [ ] UptimeRobot hesabı oluşturuldu
- [ ] API health monitor eklendi (5 dakika interval)
- [ ] Email alerts yapılandırıldı
- [ ] Test notification gönderildi
- [ ] PM2 Plus hesabı oluşturuldu
- [ ] PM2 link komutu çalıştırıldı
- [ ] PM2 Plus dashboard'da process görünüyor
- [ ] PM2 Plus alert kuralları eklendi
- [ ] Entegrasyon test senaryoları çalıştırıldı
- [ ] Dashboard'lar favorilere eklendi

---

## 8. Sonraki Adımlar

Monitoring kurulumu tamamlandıktan sonra:

1. **1 hafta bekle:** Baseline metrics oluştur
2. **Alert threshold'ları ayarla:** False positive'leri azalt
3. **Custom metrics ekle:** Sync operations, API response time
4. **Operational runbook yaz:** Alert response prosedürleri
5. **Grafana entegrasyonu (opsiyonel):** Advanced dashboards

---

## Yardım ve Destek

- **UptimeRobot Docs:** https://uptimerobot.com/help/
- **PM2 Plus Docs:** https://pm2.io/docs/plus/overview/
- **Owlivion Support:** GitHub Issues

---

**Son Güncelleme:** 2026-02-04
**Doküman Sahibi:** Owlivion Team
