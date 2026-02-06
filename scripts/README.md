# Owlivion Mail - Development Scripts

Bu dizin, otomatik proje takibi ve raporlama scriptlerini içerir.

## 📊 Mevcut Scriptler

### 1. `track-progress.sh` - Proje Metrikleri
Proje genelinde istatistikleri otomatik olarak toplar ve JSON formatında dışa aktarır.

**Toplanan Metrikler:**
- 📝 Kod istatistikleri (Rust, TypeScript, toplam dosya sayısı)
- ✅ Test coverage (geçen, başarısız, ignore edilen testler)
- 📦 Git istatistikleri (commit sayısı, değişen dosyalar)
- 📚 Dokümantasyon (dosya ve satır sayısı)
- 📋 TODO ilerleme durumu (tamamlanan/bekleyen görevler)

**Kullanım:**
```bash
bash scripts/track-progress.sh
```

**Çıktı:**
- Konsol çıktısı (renkli, formatlanmış)
- `.progress-stats.json` dosyası (otomatik oluşturulur)

---

### 2. `test-coverage.sh` - Test Raporları
Detaylı test coverage raporu oluşturur.

**Özellikler:**
- Tüm testleri çalıştırır (cargo test)
- Test sonuçlarını modül bazında gruplar
- Başarısız testlerin detaylarını gösterir
- Geçiş oranını hesaplar

**Kullanım:**
```bash
bash scripts/test-coverage.sh
```

**Çıktı:**
- Konsol raporu (başarı/başarısızlık detayları)
- `.test-coverage-report.txt` dosyası

**Exit Kodları:**
- `0` - Tüm testler başarılı
- `1` - Bir veya daha fazla test başarısız

---

### 3. `update-todo-stats.sh` - TODO Güncelleyici
`TODO.md` dosyasını en son istatistiklerle günceller.

**Kullanım:**
```bash
bash scripts/update-todo-stats.sh
```

**Ne Yapar:**
1. `track-progress.sh` çalıştırır
2. `.progress-stats.json` dosyasını okur
3. İstatistikleri konsola yazdırır
4. Manuel commit için hatırlatıcı gösterir

---

## 🪝 Git Hooks

### `.githooks/pre-commit`
Her commit öncesinde otomatik olarak çalışır.

**Ne Yapar:**
- `track-progress.sh` scriptini çalıştırır
- `.progress-stats.json` dosyasını commit'e ekler

**Etkinleştirme:**
```bash
git config core.hooksPath .githooks
```

### `.githooks/post-commit`
Her commit sonrasında çalışır.

**Ne Yapar:**
- Commit bilgilerini `.commit-history.log` dosyasına ekler
- Son 100 commit kaydını tutar

---

## 📄 Oluşturulan Dosyalar

| Dosya | Açıklama | Boyut | Git'e Eklenir? |
|-------|----------|-------|----------------|
| `.progress-stats.json` | Proje metrikleri (JSON) | ~500B | Evet |
| `.test-coverage-report.txt` | Test raporu (text) | ~2KB | Hayır |
| `.commit-history.log` | Commit geçmişi (log) | ~10KB | Hayır |

---

## 🎯 Hızlı Başlangıç

### İlk Kurulum
```bash
# Git hooks'u etkinleştir
git config core.hooksPath .githooks

# Tüm scriptleri executable yap
chmod +x scripts/*.sh .githooks/*

# İlk metrikleri oluştur
bash scripts/track-progress.sh
```

### Günlük Kullanım
```bash
# Proje durumunu kontrol et
bash scripts/track-progress.sh

# Test coverage raporu al
bash scripts/test-coverage.sh

# JSON stats'ı oku
cat .progress-stats.json | jq
```

### Otomasyonla Kullanım
```bash
# Commit öncesi otomatik çalışır (pre-commit hook)
git commit -m "Feature added"

# Manuel çalıştırma
bash scripts/update-todo-stats.sh
```

---

## 📊 Örnek Çıktı

### `track-progress.sh`
```
📊 Owlivion Mail - Progress Tracking
================================================

📝 Code Statistics
  - Rust code: 17,550 lines
  - TypeScript/React: 15,469 lines
  - Total files: 71

✅ Test Coverage
  - Total tests: 94
  - Passed: 77 (81.9%)
  - Failed: 9
  - Ignored: 8

📦 Git Statistics
  - Total commits: 44
  - Today's commits: 2
  - Files changed (last commit): 24

📚 Documentation
  - Documentation files: 5
  - Documentation lines: 3,810

📋 TODO Progress
  - Completed tasks: 16 / 24 (66.7%)
  - Pending tasks: 8
```

### `.progress-stats.json`
```json
{
  "timestamp": "2026-02-05T23:36:25+03:00",
  "code": {
    "rust_lines": 17550,
    "typescript_lines": 15469,
    "total_files": 71
  },
  "tests": {
    "total": 94,
    "passed": 77,
    "failed": 9,
    "ignored": 8,
    "pass_rate": 81.9
  },
  "git": {
    "total_commits": 44,
    "today_commits": 2,
    "changed_files": 24
  },
  "documentation": {
    "files": 5,
    "lines": 3810
  },
  "todo": {
    "completed": 16,
    "pending": 8,
    "completion_rate": 66.7
  }
}
```

---

## 🔧 Sorun Giderme

### Script çalışmıyor
```bash
# Execute izni ver
chmod +x scripts/track-progress.sh

# Manuel çalıştır
bash scripts/track-progress.sh
```

### Git hooks çalışmıyor
```bash
# Hooks path'i kontrol et
git config core.hooksPath

# Yeniden ayarla
git config core.hooksPath .githooks

# Hook dosyasını executable yap
chmod +x .githooks/pre-commit
```

### JSON parse hatası
```bash
# jq kurulu mu kontrol et
which jq || sudo apt install jq

# JSON dosyasını validate et
cat .progress-stats.json | jq
```

---

## 📝 Notlar

- Tüm scriptler `bash` ile uyumludur
- `jq` bağımlılığı opsiyoneldir (JSON okumak için)
- Scriptler **non-destructive**'dir (dosya silmez)
- Git hooks otomatik çalışır (commit öncesi/sonrası)
- `.progress-stats.json` her commit'te güncellenir

---

## 🚀 Gelecek Geliştirmeler

- [ ] CI/CD entegrasyonu (GitHub Actions)
- [ ] Grafik raporlar (HTML çıktı)
- [ ] E-posta bildirimleri (test başarısızlıkları)
- [ ] Slack/Discord webhook entegrasyonu
- [ ] Otomatik changelog oluşturma
- [ ] Code quality metrics (clippy, eslint)

---

**Son Güncelleme:** 2026-02-05
**Versiyon:** 1.0.0
**Bakımcı:** Owlivion Mail Dev Team
