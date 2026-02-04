# PM2 Plus Quick Start

> 5 dakikada PM2 Plus kurulumu ve yapılandırması

## 🚀 Quick Setup (3 Steps)

### 1. PM2 Plus Hesabı Oluştur

```bash
# Ziyaret et: https://pm2.io/
# Ücretsiz hesap oluştur (4 server'a kadar destekler)
```

### 2. Server'ı Bağla

```bash
# PM2 Plus Dashboard'dan secret ve public key'leri al:
# Bucket Settings → General → Connect to PM2 Plus

# VPS'te çalıştır:
cd /opt/owlivion-sync-server/deployment
./setup-pm2-plus.sh <SECRET_KEY> <PUBLIC_KEY>
```

### 3. Dashboard'u Kontrol Et

```bash
# Ziyaret et: https://app.pm2.io/
# Server ve process'leri görebilmelisin
```

## 📊 Key Features

### Real-Time Monitoring
- **CPU Usage**: Anlık CPU kullanımı
- **Memory**: RAM kullanımı ve trend
- **Event Loop**: Node.js event loop latency
- **HTTP Requests**: Request rate ve latency

### Alerts & Notifications
- **Threshold Alerts**: CPU/Memory limitleri
- **Exception Tracking**: Otomatik hata yakalama
- **Process Monitoring**: Restart/crash bildirimleri
- **Custom Alerts**: Özel metrik alarmları

### Metrics & Analytics
- **Custom Metrics**: İş mantığı metrikleri
- **Transaction Tracing**: Yavaş işlem tespiti
- **Historical Data**: Geçmiş performans analizi
- **Comparison**: Multi-process karşılaştırma

## 🔔 Recommended Alerts

Dashboard'da aşağıdaki alert'leri kur:

```bash
# 1. CPU Alert
Alert Name: High CPU Usage
Condition: CPU > 80%
Duration: 5 minutes
Action: Email/Slack

# 2. Memory Alert
Alert Name: High Memory Usage
Condition: Memory > 400MB
Duration: 2 minutes
Action: Email

# 3. Restart Alert
Alert Name: Frequent Restarts
Condition: Restarts > 3
Duration: 10 minutes
Action: Email/SMS

# 4. Exception Alert
Alert Name: Error Spike
Condition: Exceptions > 5
Duration: 5 minutes
Action: Email/Slack
```

## 📱 Mobile App

Dashboard'u telefonundan takip et:

- **iOS**: https://apps.apple.com/app/pm2-plus/id1456946515
- **Android**: https://play.google.com/store/apps/details?id=io.keymetrics.mobile

## 🎯 Essential Commands

```bash
# PM2 Plus'a bağlan
pm2 link <secret> <public> owlivion-sync-server

# Bağlantıyı kontrol et
pm2 info | grep -i "agent status"

# Real-time monitoring
pm2 monit

# Process detayları
pm2 describe owlivion-sync

# PM2 Plus'tan ayrıl
pm2 unlink
```

## 🔧 Custom Metrics (Optional)

Server koduna custom metric eklemek için:

```javascript
// src/index.js
const pmx = require('@pm2/io');

// Aktif sync sayısını göster
const activeSyncs = pmx.metric({
  name: 'Active Syncs',
  type: 'gauge'
});

// Değeri güncelle
activeSyncs.set(getCurrentSyncCount());

// Toplam sync sayacı
const totalSyncs = pmx.counter({
  name: 'Total Syncs'
});

// Her sync'te artır
totalSyncs.inc();
```

## 🎨 Dashboard Customization

### Widgets Ekle

1. **Overview Tab**: CPU, Memory, Event Loop graphs
2. **Metrics Tab**: Custom metrics dashboard
3. **Exceptions Tab**: Error tracking
4. **Transactions Tab**: Slow requests

### Notification Channels

**Email:**
- Settings → Notifications → Email
- Email adresi ekle
- Bildirim sıklığını ayarla

**Slack:**
- Settings → Integrations → Slack
- Workspace bağla
- Kanal seç (#alerts önerilen)
- Alert level'ı ayarla

**Webhook:**
- Settings → Integrations → Webhook
- Webhook URL ekle (Discord, Teams, vs.)
- Payload format seç

## 💰 Pricing

### Free Tier (Mevcut)
- ✅ 4 server'a kadar
- ✅ 1 gün data retention
- ✅ Tüm temel özellikler
- ✅ Email/Slack notifications
- ❌ Advanced analytics
- ❌ Long-term retention

### Paid Tiers (İleride gerekirse)
- **Business** ($59/ay): 20 server, 7 gün retention
- **Enterprise** ($199/ay): Unlimited, 30 gün retention

## ⚠️ Troubleshooting

### Bağlantı Sorunu

```bash
# PM2'yi güncelle
npm install -g pm2@latest

# PM2'yi yeniden başlat
pm2 kill
pm2 resurrect

# Tekrar bağlan
pm2 link <secret> <public>
```

### Dashboard'da Data Yok

```bash
# @pm2/io modülünü kur
cd /opt/owlivion-sync-server
npm install @pm2/io

# Process'leri reload et
pm2 reload ecosystem.config.js

# Logları kontrol et
pm2 logs owlivion-sync | grep -i pmx
```

### Agent Disconnected

```bash
# PM2 daemon'u yeniden başlat
pm2 kill
pm2 start ecosystem.config.js

# Bağlantıyı kontrol et
pm2 info | grep "Agent status"
```

## 🔐 Security Notes

- 🔒 Public/Secret key'ler sadece server-side kullanılır
- 🔒 Kaynak kod gönderilmez, sadece metrikler
- 🔒 HTTPS üzerinden şifreli iletişim
- ⚠️ Log'larda hassas veri olmamasına dikkat et

## 📚 Resources

- **Dashboard**: https://app.pm2.io/
- **Docs**: https://pm2.io/docs/
- **Support**: support@pm2.io
- **Full Guide**: See `PM2_PLUS_SETUP.md`

## ✅ Next Steps

1. ✅ Setup PM2 Plus account
2. ✅ Link server with script
3. ✅ Configure alerts in dashboard
4. ⏳ Setup Slack/Email notifications
5. ⏳ Install mobile app
6. ⏳ Add custom metrics (optional)

---

**Kurulum sonrası**: Dashboard'u https://app.pm2.io/ adresinden kontrol et!
