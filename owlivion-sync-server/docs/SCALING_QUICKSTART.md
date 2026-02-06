# Owlivion Sync Server - Scaling Quick Start

> **Phase 6 için hızlı başlangıç rehberi**

## 🚀 30 Dakikada Monitoring Stack Kurulumu

### Adım 1: Gerekli Bağımlılıkları Yükle

```bash
cd owlivion-sync-server

# Node.js metrics kütüphanesini yükle
npm install prom-client

# Commit yap
git add package.json
git commit -m "Add prom-client for Prometheus metrics"
```

### Adım 2: Metrics Endpoint'ini Aktifleştir

`src/index.js` dosyasına şunu ekle:

```javascript
// En üste import ekle
import { metricsMiddleware, metricsEndpoint } from './utils/metrics.js';

// Middleware'leri ekle (diğer middleware'lerden SONRA)
app.use(metricsMiddleware);

// Metrics endpoint ekle (routes'tan ÖNCE)
app.get('/metrics', metricsEndpoint);
```

**Test et:**

```bash
# Uygulamayı yeniden başlat
pm2 restart owlivion-sync-server

# Metrics endpoint'ini kontrol et
curl http://localhost:3000/metrics
```

### Adım 3: Monitoring Stack'i Kur

**Option 1: Otomatik Kurulum (Önerilen)**

```bash
# VPS'e bağlan
ssh root@31.97.216.36

# Script'i çalıştır
cd /home/owlivion-sync-server
sudo bash scripts/setup-monitoring.sh

# PostgreSQL exporter şifresi iste - güçlü bir şifre gir
```

**Option 2: Docker ile Kurulum (Alternatif)**

```bash
# .env dosyası oluştur
cat > .env.monitoring <<EOF
PG_EXPORTER_PASSWORD=your_pg_password_here
GRAFANA_ADMIN_PASSWORD=your_grafana_password_here
EOF

# Docker Compose ile başlat
docker-compose -f docker-compose.monitoring.yml up -d

# Logları kontrol et
docker-compose -f docker-compose.monitoring.yml logs -f
```

### Adım 4: Grafana'yı Yapılandır

1. **Grafana'ya eriş:**
   - URL: http://31.97.216.36:3001
   - Kullanıcı: admin
   - Şifre: admin (ilk giriş - değiştir!)

2. **Prometheus Data Source Ekle:**
   - Configuration → Data Sources → Add data source
   - Prometheus seç
   - URL: `http://localhost:9090` (Docker ise: `http://prometheus:9090`)
   - Save & Test

3. **Dashboard'ları İçe Aktar:**
   - Dashboards → Import
   - `monitoring/grafana-dashboards/*.json` dosyalarını yükle

### Adım 5: Nginx Reverse Proxy (Grafana için)

Grafana'yı subdomain'de yayınla:

```bash
# Nginx config oluştur
cat > /etc/nginx/sites-available/grafana.owlivion.com <<'NGINX_CONFIG'
server {
    listen 443 ssl http2;
    server_name grafana.owlivion.com;

    ssl_certificate /etc/letsencrypt/live/owlivion.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/owlivion.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONFIG

# Aktifleştir
ln -s /etc/nginx/sites-available/grafana.owlivion.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

**DNS Kaydı Ekle:**
```
A record: grafana.owlivion.com → 31.97.216.36
```

### Adım 6: Alert Kanalı Ekle (Email)

1. Grafana → Alerting → Notification channels
2. Add channel
3. **Type:** Email
4. **Email addresses:** admin@owlivion.com
5. **Send test** → Verify
6. Save

---

## 📊 Load Balancing Kurulumu (1-2 Saat)

### Senaryo: Tek VPS'te Çoklu Node.js İnstansları

```bash
# PM2 cluster mode'a geç
pm2 delete owlivion-sync-server
pm2 start src/index.js -i 4 --name owlivion-sync-server

# 4 instance çalıştırıyor (CPU core sayısına göre ayarla)
pm2 status
```

### HAProxy Kurulumu (Çoklu VPS için)

```bash
# Script ile kur
sudo bash scripts/setup-haproxy.sh

# Veya manuel:
sudo apt-get install haproxy
sudo cp monitoring/haproxy.cfg /etc/haproxy/haproxy.cfg
sudo systemctl restart haproxy
```

**Stats Sayfası:**
- URL: http://31.97.216.36:8404/stats
- Kullanıcı: admin
- Şifre: (config dosyasında değiştir)

---

## 🌍 Multi-Region Deployment (Gelecek)

### İkinci VPS Kurulumu

1. **Yeni VPS Sat:**
   - Hetzner (Almanya): €4.51/ay
   - Vultr (Amsterdam): $6/ay

2. **PostgreSQL Replikasyon:**
   ```bash
   # Primary VPS'te
   sudo -u postgres psql -c "CREATE ROLE replicator WITH REPLICATION PASSWORD 'strong_password' LOGIN;"

   # Secondary VPS'te
   sudo -u postgres pg_basebackup -h PRIMARY_IP -D /var/lib/postgresql/14/main -U replicator -P -v -R
   ```

3. **Cloudflare Load Balancing:**
   - Cloudflare'de domain ekle
   - Load Balancing aktifleştir ($5/ay)
   - Pool 1: Primary VPS
   - Pool 2: Secondary VPS
   - Geo-routing: Turkey → Primary, Europe → Secondary

---

## 📈 Monitoring Özeti

### Erişim URL'leri

| Servis | URL | Varsayılan Port |
|--------|-----|-----------------|
| Prometheus | http://localhost:9090 | 9090 |
| Grafana | https://grafana.owlivion.com | 3001 |
| Node Exporter | http://localhost:9100/metrics | 9100 |
| PostgreSQL Exporter | http://localhost:9187/metrics | 9187 |
| HAProxy Stats | http://localhost:8404/stats | 8404 |
| App Metrics | http://localhost:3000/metrics | 3000 |

### Servis Durumunu Kontrol Et

```bash
# Tüm servisleri kontrol et
systemctl status prometheus
systemctl status node_exporter
systemctl status postgres_exporter
systemctl status grafana-server

# Veya hepsi birden
for service in prometheus node_exporter postgres_exporter grafana-server; do
  systemctl is-active --quiet $service && echo "✅ $service" || echo "❌ $service"
done
```

### Logları İzle

```bash
# Prometheus
journalctl -u prometheus -f

# Grafana
journalctl -u grafana-server -f

# HAProxy
tail -f /var/log/haproxy.log
```

---

## 🔧 Troubleshooting

### Metrics Endpoint Çalışmıyor

```bash
# App loglarını kontrol et
pm2 logs owlivion-sync-server --lines 50

# Metrics endpoint'ini test et
curl http://localhost:3000/metrics

# prom-client yüklü mü?
npm list prom-client
```

### Prometheus Scraping Yapmıyor

```bash
# Prometheus config'i kontrol et
cat /opt/prometheus/prometheus.yml

# Prometheus hedeflerini kontrol et
curl http://localhost:9090/api/v1/targets

# Prometheus'u yeniden başlat
systemctl restart prometheus
```

### Grafana Dashboard Boş

1. Data source doğru yapılandırıldı mı?
   - Configuration → Data Sources → Prometheus
   - Test connection

2. Zaman aralığı doğru mu?
   - Sağ üstten "Last 1 hour" seç

3. Metrics geliyor mu?
   - Explore → Prometheus → Metrics browser

### Alert Çalışmıyor

1. Alertmanager çalışıyor mu?
   ```bash
   systemctl status alertmanager
   ```

2. Email ayarları doğru mu?
   ```bash
   cat /opt/prometheus/alertmanager.yml
   ```

3. Test alert gönder:
   - Grafana → Alerting → Test

---

## 📋 Checklist

### Phase 6.1: Monitoring (1 Hafta)
- [ ] prom-client yüklendi
- [ ] Metrics middleware eklendi
- [ ] Prometheus kuruldu
- [ ] Node Exporter kuruldu
- [ ] PostgreSQL Exporter kuruldu
- [ ] Grafana kuruldu
- [ ] Dashboard'lar import edildi
- [ ] Alert kuralları yapılandırıldı
- [ ] Email alert kanalı eklendi
- [ ] Nginx reverse proxy yapılandırıldı (grafana.owlivion.com)

### Phase 6.2: Load Balancing (2-3 Hafta)
- [ ] PM2 cluster mode test edildi
- [ ] HAProxy kuruldu
- [ ] SSL sertifikası HAProxy'ye eklendi
- [ ] Health check çalışıyor
- [ ] Stats page erişilebilir
- [ ] Redis kuruldu (session storage)
- [ ] PgBouncer kuruldu (connection pooling)

### Phase 6.3: Multi-Region (4+ Hafta)
- [ ] İkinci VPS satın alındı
- [ ] PostgreSQL replikasyon kuruldu
- [ ] Uygulama ikinci VPS'e deploy edildi
- [ ] Cloudflare load balancing yapılandırıldı
- [ ] Failover test edildi
- [ ] Disaster recovery planı hazırlandı

---

## 🎯 Sonraki Adımlar

1. **Hemen Yap (Bu Hafta):**
   - ✅ Monitoring stack'i kur
   - ✅ Metrics endpoint'ini aktifleştir
   - ✅ Grafana dashboard'larını import et

2. **Kısa Vadede (2-3 Hafta):**
   - HAProxy ile load balancing ekle
   - PM2 cluster mode'a geç
   - Redis session storage ekle

3. **Uzun Vadede (1-2 Ay):**
   - İkinci VPS sat (multi-region)
   - PostgreSQL replikasyon kur
   - Disaster recovery planını uygula

---

**Detaylı dokümantasyon:**
- `docs/SCALING_GUIDE.md` - Tam rehber
- `monitoring/` - Tüm config dosyaları
- `scripts/` - Kurulum scriptleri
