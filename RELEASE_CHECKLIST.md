# Owlivion Mail - Release Checklist

## 📋 Release Hazırlık Listesi

### 1. Versiyon Güncellemeleri

- [ ] `package.json` - version: "1.0.0"
- [ ] `src-tauri/Cargo.toml` - version = "1.0.0"
- [ ] `src-tauri/tauri.conf.json` - version: "1.0.0"
- [ ] CHANGELOG.md güncellendi

### 2. Kod Kalitesi

- [ ] Tüm TypeScript hataları düzeltildi
  ```bash
  pnpm build
  ```

- [ ] Tüm Rust testleri geçti
  ```bash
  cd src-tauri && cargo test
  ```

- [ ] Linting temiz
  ```bash
  cd src-tauri && cargo clippy
  ```

### 3. Build Kontrolü

- [ ] Bağımlılıklar kontrol edildi
  ```bash
  pnpm run check:deps
  ```

- [ ] Development build başarılı
  ```bash
  pnpm tauri:dev
  ```

- [ ] Production build başarılı
  ```bash
  pnpm run build:linux
  ```

### 4. Paket Testleri

#### .deb Paketi
- [ ] Paket oluşturuldu
- [ ] Paket meta verileri doğru (version, description, dependencies)
- [ ] Kurulum başarılı
  ```bash
  sudo dpkg -i src-tauri/target/release/bundle/deb/owlivion-mail_*.deb
  ```
- [ ] Uygulama menüde görünüyor
- [ ] Icon doğru görünüyor
- [ ] Uygulama başlıyor ve çalışıyor
- [ ] Kaldırma başarılı
  ```bash
  sudo apt remove owlivion-mail
  ```

#### AppImage
- [ ] AppImage oluşturuldu
- [ ] Çalıştırılabilir
  ```bash
  chmod +x owlivion-mail_*.AppImage
  ./owlivion-mail_*.AppImage
  ```
- [ ] Uygulama başlıyor ve çalışıyor

### 5. Fonksiyonel Testler

- [ ] E-posta hesabı ekleme çalışıyor
- [ ] E-posta gönderme çalışıyor
- [ ] E-posta alma çalışıyor
- [ ] AI phishing detection çalışıyor
- [ ] Tracking pixel blocker çalışıyor
- [ ] Dark/Light tema geçişi çalışıyor
- [ ] Bildirimler çalışıyor
- [ ] Dosya ekleri çalışıyor

### 6. Güvenlik

- [ ] Şifre şifreleme çalışıyor
- [ ] Hassas veriler zeroize ediliyor
- [ ] CSP politikaları aktif
- [ ] Harici bağlantılar güvenli

### 7. Dokümantasyon

- [ ] README.md güncel
- [ ] LINUX_INSTALL.md güncel
- [ ] BUILD.md güncel
- [ ] CHANGELOG.md güncel
- [ ] Screenshots güncel

### 8. Release Hazırlığı

- [ ] Git tag oluşturuldu
  ```bash
  git tag -a v1.0.0 -m "Release v1.0.0"
  git push origin v1.0.0
  ```

- [ ] GitHub Release notları hazır
- [ ] Release assets hazır:
  - owlivion-mail_1.0.0_amd64.deb
  - owlivion-mail_1.0.0_amd64.AppImage
  - checksums.txt
  - CHANGELOG.md

### 9. Post-Release

- [ ] GitHub Release yayınlandı
- [ ] Website güncellendi
- [ ] Sosyal medya duyurusu yapıldı
- [ ] Community bilgilendirildi

## 🚀 Release Komutu

```bash
# 1. Son kontroller
pnpm run check:deps
pnpm build
cd src-tauri && cargo test && cd ..

# 2. Build
pnpm run build:linux

# 3. Checksum oluştur
cd src-tauri/target/release/bundle
sha256sum deb/*.deb appimage/*.AppImage > checksums.txt

# 4. GitHub Release
gh release create v1.0.0 \
  deb/*.deb \
  appimage/*.AppImage \
  checksums.txt \
  --title "Owlivion Mail v1.0.0" \
  --notes-file ../../../../CHANGELOG.md
```

## 📊 Release Metrikleri

- **Build Time:** ~10 dakika
- **Package Size:**
  - .deb: ~15-20 MB
  - AppImage: ~20-25 MB
- **Supported Platforms:**
  - Ubuntu 20.04+
  - Debian 11+
  - Other Linux distros (via AppImage)

## 🔍 Hotfix Prosedürü

Kritik bug için:

1. Hotfix branch oluştur
   ```bash
   git checkout -b hotfix/v1.0.1
   ```

2. Bug'ı düzelt ve test et

3. Version bump (1.0.0 → 1.0.1)

4. Build ve test

5. Merge ve release
   ```bash
   git checkout main
   git merge hotfix/v1.0.1
   git tag -a v1.0.1 -m "Hotfix v1.0.1"
   ```

## 📝 Notlar

- Her release için checksums.txt oluştur
- GPG imzalama (opsiyonel):
  ```bash
  gpg --detach-sign --armor owlivion-mail_*.deb
  ```
- Release notes template kullan
- Community feedback topla
