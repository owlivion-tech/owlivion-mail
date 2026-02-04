# PM2 Plus Deployment Checklist

> VPS'te PM2 Plus kurulumu için adım adım rehber

## ✅ Ön Hazırlık (Tamamlandı)

Aşağıdaki dosyalar oluşturuldu ve hazır:

```
✅ ecosystem.config.js          - PM2 Plus enabled (automation: true)
✅ setup-pm2-plus.sh            - Otomatik setup scripti
✅ PM2_PLUS_SETUP.md            - Detaylı dokümantasyon
✅ pm2-plus-quickstart.md       - Hızlı başlangıç rehberi
✅ MONITORING_README.md         - Genel monitoring overview
✅ setup-monitoring.sh          - Ana monitoring setup (güncellendi)
```

## 🚀 VPS'te Kurulum Adımları

### Adım 1: PM2 Plus Hesabı Oluştur

```bash
# Tarayıcıda aç:
https://pm2.io/

# Ücretsiz hesap oluştur (GitHub/Google ile giriş yapabilirsin)
```

**Not**: Free tier 4 server'a kadar destekliyor, bu yeterli.

### Adım 2: Secret ve Public Key Al

```bash
# PM2 Plus Dashboard'da:
1. Bucket Settings → General
2. "Connect to PM2 Plus" bölümünü bul
3. Secret Key ve Public Key'i kopyala

# Örnek format:
SECRET: abcd1234efgh5678ijkl...
PUBLIC: mnop9012qrst3456uvwx...
```

### Adım 3: VPS'e Bağlan

```bash
# Local makinenden:
ssh owlivion@31.97.216.36

# Veya root olarak:
ssh root@31.97.216.36
```

### Adım 4: Deployment Dosyalarını VPS'e Gönder

```bash
# Local makinenden (owlivion-mail klasöründe):
cd owlivion-sync-server/deployment

# SCP ile dosyaları gönder:
scp setup-pm2-plus.sh owlivion@31.97.216.36:/opt/owlivion-sync-server/deployment/
scp PM2_PLUS_SETUP.md owlivion@31.97.216.36:/opt/owlivion-sync-server/deployment/
scp pm2-plus-quickstart.md owlivion@31.97.216.36:/opt/owlivion-sync-server/deployment/
scp MONITORING_README.md owlivion@31.97.216.36:/opt/owlivion-sync-server/deployment/
scp ecosystem.config.js owlivion@31.97.216.36:/opt/owlivion-sync-server/deployment/

# Veya tüm klasörü senkronize et (rsync):
rsync -avz --exclude 'node_modules' \
  owlivion-sync-server/ \
  owlivion@31.97.216.36:/opt/owlivion-sync-server/
```

### Adım 5: PM2 Plus Setup Scriptini Çalıştır

```bash
# VPS'te:
cd /opt/owlivion-sync-server/deployment

# Script'e execute izni ver
chmod +x setup-pm2-plus.sh

# Setup'ı çalıştır (kendi key'lerinle değiştir)
./setup-pm2-plus.sh YOUR_SECRET_KEY YOUR_PUBLIC_KEY

# Örnek:
# ./setup-pm2-plus.sh abcd1234efgh5678 mnop9012qrst3456
```

### Adım 6: Kurulumu Doğrula

```bash
# PM2 agent durumunu kontrol et
pm2 info | grep -i "agent status"
# Çıktı: "Agent status: connected" olmalı

# Process'leri kontrol et
pm2 list

# Real-time monitoring
pm2 monit
```

### Adım 7: PM2 Plus Dashboard'u Kontrol Et

```bash
# Tarayıcıda aç:
https://app.pm2.io/

# Göreceğin şeyler:
✓ Server: owlivion-sync-server (yeşil - online)
✓ Process: owlivion-sync (2 instances)
✓ Metrics: CPU, Memory grafikleri
```

## 🔔 Alert Konfigürasyonu

### Dashboard'da Alert Kur (Önerilen)

```bash
# PM2 Plus Dashboard → Alerts → Create Alert

Alert 1: High CPU
-----------------
Name: High CPU Usage
Metric: CPU
Condition: > 80%
Duration: 5 minutes
Action: Email to your@email.com

Alert 2: High Memory
--------------------
Name: High Memory Usage
Metric: Memory
Condition: > 400 MB
Duration: 2 minutes
Action: Email to your@email.com

Alert 3: Frequent Restarts
--------------------------
Name: Frequent Restarts
Metric: Restart Count
Condition: > 3 restarts
Duration: 10 minutes
Action: Email + Slack (optional)

Alert 4: Exception Spike
------------------------
Name: Error Spike
Metric: Exception Count
Condition: > 5 exceptions
Duration: 5 minutes
Action: Email + Slack (optional)
```

### Email Notification Setup

```bash
# Dashboard → Settings → Notifications → Email
1. Add Email: your@email.com
2. Verify email (check inbox)
3. Set notification frequency: "Immediately"
```

### Slack Integration (Opsiyonel)

```bash
# Dashboard → Settings → Integrations → Slack
1. Click "Connect to Slack"
2. Choose workspace
3. Select channel: #alerts (önerilen)
4. Authorize
5. Test notification
```

## 📱 Mobile App (Opsiyonel)

```bash
# iOS
https://apps.apple.com/app/pm2-plus/id1456946515

# Android
https://play.google.com/store/apps/details?id=io.keymetrics.mobile

# App'i aç
1. PM2 Plus hesabınla giriş yap
2. Server'ı görebilmelisin
3. Push notification'ları aktifleştir
```

## ✅ Kurulum Tamamlandı!

### Kontrol Listesi

- [ ] PM2 Plus hesabı oluşturuldu
- [ ] Secret/Public key alındı
- [ ] VPS'e deployment dosyaları gönderildi
- [ ] `setup-pm2-plus.sh` çalıştırıldı
- [ ] Dashboard'da server görünüyor
- [ ] 4 alert kuralı eklendi
- [ ] Email notification aktif
- [ ] (Opsiyonel) Slack entegrasyonu yapıldı
- [ ] (Opsiyonel) Mobile app kuruldu

### Test Et

```bash
# VPS'te:

# 1. Manuel CPU yükleme (test için)
stress-ng --cpu 4 --timeout 10s
# Dashboard'da CPU spike görmelisin

# 2. Process'i restart et
pm2 restart owlivion-sync
# Dashboard'da restart görmelisin

# 3. Log'ları kontrol et
pm2 logs owlivion-sync --lines 20
# Hata yoksa her şey OK
```

## 🎯 Dashboard Kullanımı

### Overview Tab

```bash
# Gösterir:
- Server health (online/offline)
- CPU usage (real-time graph)
- Memory usage (real-time graph)
- Event loop latency
- Active processes
```

### Metrics Tab

```bash
# Custom metrics:
- Active Syncs (ileride eklenecek)
- Queue Size (ileride eklenecek)
- HTTP Request Rate
- Response Time
```

### Exceptions Tab

```bash
# Otomatik yakalar:
- Uncaught exceptions
- Unhandled promise rejections
- HTTP 500 errors

# Her exception için gösterir:
- Stack trace
- Occurrence count
- First/Last occurrence
- Affected route
```

### Transactions Tab

```bash
# Yavaş transaction'ları gösterir:
- Request URL
- Duration
- Database queries
- External API calls
```

## 🔧 Troubleshooting

### "Agent status: disconnected" Görüyorum

```bash
# 1. PM2'yi güncelle
npm install -g pm2@latest

# 2. PM2'yi yeniden başlat
pm2 kill
pm2 resurrect

# 3. Tekrar link et
pm2 unlink
pm2 link YOUR_SECRET YOUR_PUBLIC

# 4. Process'leri reload et
pm2 reload ecosystem.config.js
```

### Dashboard'da Data Yok

```bash
# 1. @pm2/io modülünü kontrol et
cd /opt/owlivion-sync-server
npm list @pm2/io

# Yoksa kur:
npm install --save @pm2/io

# 2. Ecosystem config'i kontrol et
cat deployment/ecosystem.config.js | grep automation
# Çıktı: automation: true olmalı

# 3. Process'leri reload et
pm2 reload deployment/ecosystem.config.js

# 4. 1-2 dakika bekle, data gelmeye başlamalı
```

### Alert'ler Gelmiyor

```bash
# 1. Email doğrulandı mı kontrol et
Dashboard → Settings → Notifications
# Email'in yanında "verified" yazmalı

# 2. Alert kuralları aktif mi?
Dashboard → Alerts
# Her kural "enabled" olmalı

# 3. Test alert gönder
Dashboard → Settings → Notifications → Test
```

## 📊 Monitoring Strategy

### Real-Time (PM2 Plus)

- ✅ CPU/Memory grafikleri
- ✅ Exception tracking
- ✅ Instant alerts
- ✅ Mobile notifications

### Periodic (Cron Jobs)

- ✅ Health checks (5 dakikada bir)
- ✅ Database backups (günlük)
- ✅ Log rotation (günlük)

### External (UptimeRobot - İleride)

- ⏳ HTTP endpoint monitoring
- ⏳ SSL certificate monitoring
- ⏳ Multi-region checks

## 🎓 Best Practices

### 1. Alert Fatigue'den Kaçın

```bash
# ❌ Kötü: Çok hassas alert
CPU > 50% for 1 minute

# ✅ İyi: Mantıklı threshold ve duration
CPU > 80% for 5 minutes
```

### 2. Notification Channels

```bash
# Critical alerts: Email + SMS + Slack
# Warning alerts: Email + Slack
# Info alerts: Dashboard only
```

### 3. Dashboard Monitoring

```bash
# Günlük: Hızlı kontrol (mobil app)
# Haftalık: Detaylı analiz (web dashboard)
# Aylık: Trend analizi ve kapasite planlaması
```

### 4. Alert Response

```bash
# High CPU alert → Check PM2 logs
# High Memory alert → Check for memory leaks
# Restart alert → Investigate crash reason
# Exception alert → Check stack trace
```

## 📚 Resources

### Documentation

- **Full Guide**: `PM2_PLUS_SETUP.md`
- **Quick Start**: `pm2-plus-quickstart.md`
- **Overview**: `MONITORING_README.md`

### Links

- **Dashboard**: https://app.pm2.io/
- **PM2 Docs**: https://pm2.io/docs/
- **Support**: support@pm2.io

### Commands Cheat Sheet

```bash
# PM2 Plus Management
pm2 link <secret> <public>        # Link to PM2 Plus
pm2 unlink                         # Unlink from PM2 Plus
pm2 info | grep "Agent status"     # Check connection

# Process Management
pm2 list                           # List all processes
pm2 describe owlivion-sync         # Process details
pm2 monit                          # Real-time monitoring
pm2 logs owlivion-sync             # View logs

# Restart & Reload
pm2 restart owlivion-sync          # Hard restart
pm2 reload owlivion-sync           # Zero-downtime reload
pm2 reload ecosystem.config.js     # Reload with config
```

## 🎉 Congratulations!

PM2 Plus kurulumu tamamlandı! Artık:

- 📊 Real-time monitoring
- 🚨 Proactive alerts
- 🐛 Exception tracking
- 📱 Mobile monitoring

özellikleri aktif.

**Next**: Dashboard'u keşfet, alert'leri test et ve rahat uyu! 😴

---

**Deployment Date**: 2026-02-04
**Status**: ✅ Ready for deployment
**Estimated Setup Time**: ~15 minutes
