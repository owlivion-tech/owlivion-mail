# Owlivion Mail - Build Guide

## 🚀 Quick Start

### Bağımlılıkları Kontrol Et
```bash
./scripts/check-build-deps.sh
```

### Linux Paketlerini Derle
```bash
# Tüm paketler (.deb + AppImage)
pnpm run build:linux

# Sadece .deb
pnpm run build:deb

# Sadece AppImage
pnpm run build:appimage
```

## 📦 Build Çıktıları

Derleme tamamlandığında paketler şurada bulunur:

```
src-tauri/target/release/bundle/
├── deb/
│   └── owlivion-mail_1.0.0_amd64.deb
└── appimage/
    └── owlivion-mail_1.0.0_amd64.AppImage
```

## 🧪 Test Etme

### .deb Paketini Test Et

```bash
# Kurulum
sudo dpkg -i src-tauri/target/release/bundle/deb/owlivion-mail_*.deb

# Çalıştır
owlivion-mail

# Kaldır
sudo apt remove owlivion-mail
```

### AppImage'i Test Et

```bash
cd src-tauri/target/release/bundle/appimage
chmod +x owlivion-mail_*.AppImage
./owlivion-mail_*.AppImage
```

## 🔍 Build Detayları

### Paket Boyutları
- `.deb`: ~15-20 MB
- `AppImage`: ~20-25 MB (tüm bağımlılıklar dahil)

### Desteklenen Dağıtımlar

#### .deb Paketi
- Ubuntu 20.04+
- Debian 11+
- Linux Mint 20+
- Pop!_OS 20.04+
- Elementary OS 6+

#### AppImage
- Tüm modern Linux dağıtımları
- FUSE2 veya FUSE3 gerektirir

## 🛠️ Build Sorunlarını Giderme

### WebKit Hatası
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### GTK Hatası
```bash
sudo apt install libgtk-3-dev
```

### OpenSSL Hatası
```bash
sudo apt install libssl-dev pkg-config
```

### Rust Toolchain Hatası
```bash
rustup update stable
rustup default stable
```

## 📋 Build Checklist

Release öncesi kontrol listesi:

- [ ] Versiyon numarası güncellendi (`tauri.conf.json`, `Cargo.toml`, `package.json`)
- [ ] CHANGELOG.md güncellendi
- [ ] Tüm testler geçti (`cargo test`)
- [ ] Frontend build başarılı (`pnpm build`)
- [ ] .deb paketi kurulup test edildi
- [ ] AppImage test edildi
- [ ] Desktop integration çalışıyor (icon, menu entry)
- [ ] Uygulama temiz başlatılıp kapanıyor

## 🎯 Build Otomasyonu

### GitHub Actions (Gelecek)

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: |
          ./scripts/check-build-deps.sh
          pnpm run build:linux
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-packages
          path: src-tauri/target/release/bundle/
```

## 📊 Build Performansı

Ortalama derleme süreleri (2023 M2 MacBook Pro / i7 Linux):

- **İlk build:** 5-10 dakika
- **Incremental build:** 2-5 dakika
- **Release build:** 5-15 dakika

## 🔐 Release İmzalama (Opsiyonel)

```bash
# GPG anahtarı oluştur
gpg --full-generate-key

# .deb paketini imzala
dpkg-sig --sign builder owlivion-mail_*.deb

# İmzayı doğrula
dpkg-sig --verify owlivion-mail_*.deb
```

## 📦 Dağıtım

### GitHub Releases
```bash
gh release create v1.0.0 \
  src-tauri/target/release/bundle/deb/*.deb \
  src-tauri/target/release/bundle/appimage/*.AppImage \
  --title "Owlivion Mail v1.0.0" \
  --notes-file CHANGELOG.md
```

### APT Repository (Gelecek)
```bash
# Packages.gz oluştur
dpkg-scanpackages . /dev/null | gzip -9c > Packages.gz

# Release file oluştur
apt-ftparchive release . > Release
gpg --clearsign -o InRelease Release
```

## 🌐 Cross-Platform Build

### macOS için
```bash
# macOS'ta çalıştır
pnpm tauri build --target universal-apple-darwin
```

### Windows için
```bash
# Windows'ta çalıştır
pnpm tauri build --target x86_64-pc-windows-msvc
```

## 🔄 Continuous Integration

Build'i otomatikleştirmek için önerilen araçlar:

1. **GitHub Actions** - Otomatik release builds
2. **Docker** - Tutarlı build ortamı
3. **AppImage Builder** - AppImage otomasyonu
4. **dpkg-buildpackage** - Debian paket otomasyonu

## 📝 Notlar

- Her build'den önce `pnpm install` çalıştırın
- Rust bağımlılıkları `Cargo.lock` ile kilitlidir
- Frontend bağımlılıkları `pnpm-lock.yaml` ile kilitlidir
- Build cache temizlemek için: `cargo clean && rm -rf node_modules`
