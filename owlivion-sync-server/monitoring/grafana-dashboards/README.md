# Grafana Dashboards

Bu klasör Owlivion Sync Server için hazırlanmış Grafana dashboard'larını içerir.

## Dashboard'ları İçe Aktarma

1. Grafana'ya giriş yapın (http://grafana.owlivion.com veya http://localhost:3001)
2. Sol menüden **Dashboards** → **Import** seçin
3. **Upload JSON file** butonuna tıklayın
4. Bu klasördeki JSON dosyalarını seçin
5. **Prometheus** data source'unu seçin
6. **Import** butonuna tıklayın

## Mevcut Dashboard'lar

### 1. owlivion-sync-overview.json
**Genel Bakış Dashboard'u**
- Sistem metrikleri (CPU, Memory, Disk)
- API performans metrikleri
- Database metrikleri
- Aktif kullanıcılar
- Sync operasyonları

### 2. owlivion-sync-api.json (yakında)
**API Detaylı Dashboard'u**
- Endpoint bazlı performans
- Error rate analizi
- Request/Response süreleri
- Rate limiting istatistikleri

### 3. owlivion-sync-database.json (yakında)
**Database Dashboard'u**
- Query performansı
- Connection pool kullanımı
- Slow query analizi
- Replication lag (varsa)

## Dashboard Özelleştirme

Dashboard'ları düzenlemek için:
1. Dashboard'u açın
2. Sağ üstten **Settings** (⚙️) seçin
3. **Variables** bölümünden değişkenleri düzenleyin
4. **Save** butonuna tıklayın
5. JSON'u export edin: **Share** → **Export** → **Save to file**

## Prometheus Data Source Kurulumu

Eğer Prometheus data source eklenmemişse:

1. **Configuration** (⚙️) → **Data Sources** → **Add data source**
2. **Prometheus** seçin
3. Ayarları yapın:
   - **Name:** Prometheus
   - **URL:** http://localhost:9090
   - **Access:** Server (default)
4. **Save & Test** butonuna tıklayın

## Alert Kuralları

Dashboard'lardaki panel'lere alert eklemek için:
1. Panel'e tıklayın ve **Edit** seçin
2. **Alert** sekmesine geçin
3. **Create Alert** butonuna tıklayın
4. Koşulları belirleyin
5. Notification channel seçin
6. **Save** yapın

## Notification Channels

Alert'leri almak için notification channel ekleyin:

**Email:**
1. **Alerting** → **Notification channels** → **Add channel**
2. **Type:** Email
3. Email adreslerini ekleyin
4. **Test** ve **Save**

**Slack:**
1. Slack Incoming Webhook URL'i alın
2. **Type:** Slack
3. Webhook URL'i yapıştırın
4. **Test** ve **Save**

**Discord:**
1. Discord Webhook URL'i alın
2. **Type:** Discord
3. Webhook URL'i yapıştırın
4. **Test** ve **Save**

## Dashboard Refresh Ayarları

Dashboard'ların otomatik yenileme aralıkları:
- **Overview:** 10 saniye
- **API:** 5 saniye
- **Database:** 30 saniye

Sağ üstten değiştirebilirsiniz.

## Troubleshooting

**Dashboard yüklenmiyor:**
- Prometheus data source'unun çalıştığından emin olun
- Metrics endpoint'inin erişilebilir olduğunu kontrol edin: http://localhost:3000/metrics

**Grafik boş:**
- Prometheus'un metrikleri topladığından emin olun
- Zaman aralığını kontrol edin (son 1 saat, son 24 saat, vb.)

**Alert çalışmıyor:**
- Notification channel'ın doğru yapılandırıldığından emin olun
- Test gönderimi yapın
- Alert kurallarının koşullarını kontrol edin
