# 🐧 Owlivion Mail - Linux Build Özeti

## ✅ Tamamlanan İşlemler

### 📦 Oluşturulan Dosyalar

```
owlivion-mail/
├── scripts/
│   ├── build-linux.sh              # Ana build scripti
│   └── check-build-deps.sh         # Bağımlılık kontrol scripti
├── src-tauri/
│   ├── owlivion-mail.desktop       # Linux desktop entry
│   ├── deb-scripts/
│   │   ├── postinst                # Post-install script
│   │   ├── prerm                   # Pre-remove script
│   │   └── postrm                  # Post-remove script
│   └── tauri.conf.json (güncellendi)
├── BUILD.md                        # Detaylı build klavuzu
├── LINUX_INSTALL.md                # Kullanıcı kurulum klavuzu
├── RELEASE_CHECKLIST.md            # Release kontrol listesi
└── CHANGELOG.md                    # Değişiklik kayıtları
```

### 🔧 Yapılandırma Güncellemeleri

#### `tauri.conf.json`
- ✅ Version: 1.0.0
- ✅ Linux .deb konfigürasyonu
- ✅ AppImage konfigürasyonu
- ✅ Desktop entry template
- ✅ Debian dependencies
- ✅ Bundle metadata

#### `package.json`
- ✅ Version: 1.0.0 (senkronize edildi)
- ✅ Build scriptleri eklendi:
  - `pnpm run build:linux` - Tüm paketler
  - `pnpm run build:deb` - Sadece .deb
  - `pnpm run build:appimage` - Sadece AppImage
  - `pnpm run check:deps` - Bağımlılık kontrolü

#### `src-tauri/Cargo.toml`
- ✅ Version: 1.0.0 (senkronize edildi)

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Kontrol Et

```bash
pnpm run check:deps
```

**Beklenen Çıktı:**
```
✅ Node.js: v22.x
✅ pnpm: v10.x
✅ Rust: rustc 1.93.x
✅ libwebkit2gtk-4.1: Installed
✅ libgtk-3: Installed
✅ All required dependencies are installed!
```

### 2. Build Yap

```bash
# Otomatik build (önerilen)
pnpm run build:linux

# veya manuel
pnpm install
pnpm tauri build
```

**Build Süresi:** ~5-10 dakika (ilk build)

### 3. Paketleri Bul

```bash
cd src-tauri/target/release/bundle

# .deb paketi
ls -lh deb/
# owlivion-mail_1.0.0_amd64.deb

# AppImage
ls -lh appimage/
# owlivion-mail_1.0.0_amd64.AppImage
```

## 📦 Paket Detayları

### .deb Paketi

| Özellik | Değer |
|---------|-------|
| **Boyut** | ~15-20 MB |
| **Mimari** | amd64 (x86_64) |
| **Kategori** | Network / Mail |
| **Bağımlılıklar** | libwebkit2gtk-4.1-0, libgtk-3-0, libayatana-appindicator3-1 |
| **Kurulum Konumu** | `/usr/bin/owlivion-mail` |
| **Desktop Entry** | `/usr/share/applications/` |

**Desteklenen Dağıtımlar:**
- Ubuntu 20.04, 22.04, 24.04
- Debian 11, 12
- Linux Mint 20+
- Pop!_OS 20.04+
- Elementary OS 6+

### AppImage

| Özellik | Değer |
|---------|-------|
| **Boyut** | ~20-25 MB |
| **Mimari** | x86_64 |
| **Bağımlılık** | FUSE2 veya FUSE3 |
| **Taşınabilir** | Evet |
| **Kurulum Gerekmez** | Evet |

**Desteklenen Dağıtımlar:**
- Tüm modern Linux dağıtımları

## 🧪 Test Etme

### .deb Paketi Test

```bash
# Kurulum
sudo dpkg -i src-tauri/target/release/bundle/deb/owlivion-mail_1.0.0_amd64.deb

# Test
owlivion-mail --version
owlivion-mail

# Desktop entegrasyonu kontrol
which owlivion-mail
ls /usr/share/applications/ | grep owlivion

# Kaldırma
sudo apt remove owlivion-mail
```

### AppImage Test

```bash
cd src-tauri/target/release/bundle/appimage

# Çalıştırılabilir yap
chmod +x owlivion-mail_1.0.0_amd64.AppImage

# Çalıştır
./owlivion-mail_1.0.0_amd64.AppImage

# veya masaüstüne entegre et
./owlivion-mail_1.0.0_amd64.AppImage --appimage-extract
./squashfs-root/AppRun
```

## 📊 Build Özeti

### Sistem Gereksinimleri

| Bileşen | Minimum | Önerilen |
|---------|---------|----------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 2 GB boş | 5 GB boş |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04+ |

### Build Çıktıları

```
src-tauri/target/release/bundle/
├── deb/
│   └── owlivion-mail_1.0.0_amd64.deb      (~15-20 MB)
└── appimage/
    └── owlivion-mail_1.0.0_amd64.AppImage (~20-25 MB)
```

## 🎯 Sonraki Adımlar

### Release için

1. **Fonksiyonel Testler**
   ```bash
   # Test checklist'i kullan
   cat RELEASE_CHECKLIST.md
   ```

2. **Checksums Oluştur**
   ```bash
   cd src-tauri/target/release/bundle
   sha256sum deb/*.deb appimage/*.AppImage > checksums.txt
   cat checksums.txt
   ```

3. **Git Tag Oluştur**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

4. **GitHub Release**
   ```bash
   gh release create v1.0.0 \
     deb/*.deb \
     appimage/*.AppImage \
     checksums.txt \
     --title "Owlivion Mail v1.0.0" \
     --notes-file ../../../../CHANGELOG.md
   ```

### Dağıtım için

- [ ] Website'e download linklerini ekle
- [ ] Sosyal medya duyurusu hazırla
- [ ] Dokümantasyonu güncelle
- [ ] Community bilgilendir

## 📝 Önemli Notlar

### Version Senkronizasyonu
Tüm version numaraları 1.0.0 olarak senkronize edildi:
- ✅ `package.json`
- ✅ `src-tauri/Cargo.toml`
- ✅ `src-tauri/tauri.conf.json`

### Desktop Integration
`.desktop` dosyası şunları içerir:
- ✅ Uygulama ismi (Türkçe + İngilizce)
- ✅ Icon tanımı
- ✅ MIME type handler (mailto:)
- ✅ Quick action: "Yeni E-posta Yaz"
- ✅ Kategori: Network/Email/Office

### Post-Install Scripts
Debian paketi otomatik olarak:
- ✅ Desktop database günceller
- ✅ Icon cache günceller
- ✅ MIME database günceller
- ✅ Kullanıcıya kurulum mesajı gösterir

## 🔍 Sorun Giderme

### Build Hataları

| Hata | Çözüm |
|------|-------|
| `webkit2gtk not found` | `sudo apt install libwebkit2gtk-4.1-dev` |
| `gtk3 not found` | `sudo apt install libgtk-3-dev` |
| `openssl not found` | `sudo apt install libssl-dev pkg-config` |
| `cargo not found` | Rust'ı yükle: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |

### Runtime Hataları

```bash
# Verbose log ile çalıştır
RUST_LOG=debug owlivion-mail

# veya AppImage için
RUST_LOG=debug ./owlivion-mail_*.AppImage
```

## 📞 Destek

- **Dokümantasyon:** `LINUX_INSTALL.md`, `BUILD.md`
- **Checklist:** `RELEASE_CHECKLIST.md`
- **Changelog:** `CHANGELOG.md`
- **Scripts:** `./scripts/`

## ✅ Hazır!

Owlivion Mail artık Linux için .deb ve AppImage formatlarında paketlenmeye hazır!

```bash
# Hemen başlayın
pnpm run build:linux
```

**Build başarılı olduğunda:**
- `.deb` paketi: `src-tauri/target/release/bundle/deb/`
- `AppImage`: `src-tauri/target/release/bundle/appimage/`

🎉 **İyi buildler!**
