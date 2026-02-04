# Owlivion Mail - Linux Kurulum Klavuzu

## 📋 Sistem Gereksinimleri

- **İşletim Sistemi:** Ubuntu 20.04+, Debian 11+, Fedora 36+, veya diğer modern Linux dağıtımları
- **RAM:** Minimum 2 GB (4 GB önerilir)
- **Disk Alanı:** 500 MB
- **Bağımlılıklar:**
  - libwebkit2gtk-4.1-0
  - libgtk-3-0
  - libayatana-appindicator3-1

## 🚀 Kurulum Seçenekleri

### Seçenek 1: .deb Paketi (Debian/Ubuntu)

1. **Paketi indirin:**
   ```bash
   # Build dizininden
   cd src-tauri/target/release/bundle/deb
   ```

2. **Kurulumu yapın:**
   ```bash
   sudo dpkg -i owlivion-mail_*.deb
   ```

3. **Eksik bağımlılıkları düzeltin (gerekirse):**
   ```bash
   sudo apt-get install -f
   ```

4. **Uygulamayı başlatın:**
   ```bash
   owlivion-mail
   # veya uygulama menüsünden "Owlivion Mail" arayın
   ```

### Seçenek 2: AppImage (Tüm Dağıtımlar)

1. **AppImage'i indirin:**
   ```bash
   cd src-tauri/target/release/bundle/appimage
   ```

2. **Çalıştırılabilir yapın:**
   ```bash
   chmod +x owlivion-mail_*.AppImage
   ```

3. **Uygulamayı başlatın:**
   ```bash
   ./owlivion-mail_*.AppImage
   ```

## 🛠️ Kaynak Koddan Derleme

### Gereksinimler

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

# Fedora
sudo dnf install -y \
    webkit2gtk4.1-devel \
    openssl-devel \
    curl \
    wget \
    file \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel

# Arch Linux
sudo pacman -S --needed \
    webkit2gtk-4.1 \
    base-devel \
    curl \
    wget \
    file \
    openssl \
    gtk3 \
    libappindicator-gtk3 \
    librsvg
```

### Rust Kurulumu

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Node.js ve pnpm Kurulumu

```bash
# Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm
```

### Derleme

```bash
# Projeyi klonlayın
git clone https://github.com/owlivion/owlivion-mail.git
cd owlivion-mail

# Bağımlılıkları yükleyin
pnpm install

# Linux paketlerini derleyin
pnpm run build:linux

# veya sadece .deb paketi
pnpm run build:deb

# veya sadece AppImage
pnpm run build:appimage
```

Derleme tamamlandığında paketler şu dizinde olacaktır:
- `.deb`: `src-tauri/target/release/bundle/deb/`
- `AppImage`: `src-tauri/target/release/bundle/appimage/`

## 📦 Paket İçeriği

.deb paketi kurulduğunda:
- **Binary:** `/usr/bin/owlivion-mail`
- **Desktop Entry:** `/usr/share/applications/owlivion-mail.desktop`
- **Icons:** `/usr/share/icons/hicolor/*/apps/owlivion-mail.*`
- **Uygulama Verileri:** `~/.local/share/com.owlivion.mail/`
- **Yapılandırma:** `~/.config/com.owlivion.mail/`

## 🔧 Kaldırma

### .deb Paketi

```bash
sudo apt remove owlivion-mail
# veya
sudo dpkg -r owlivion-mail
```

### AppImage

```bash
# Sadece dosyayı silin
rm owlivion-mail_*.AppImage
```

### Kullanıcı Verilerini Temizleme

```bash
rm -rf ~/.local/share/com.owlivion.mail
rm -rf ~/.config/com.owlivion.mail
```

## 🐛 Sorun Giderme

### Uygulama başlamıyor

```bash
# Terminalde çalıştırıp hata mesajlarını görün
owlivion-mail
```

### Bağımlılık hataları (.deb)

```bash
sudo apt-get install -f
sudo apt update && sudo apt upgrade
```

### WebKit hataları

```bash
# WebKit2GTK güncellemesi
sudo apt install --reinstall libwebkit2gtk-4.1-0
```

### İzin sorunları

```bash
# Yapılandırma dizinlerini düzeltin
sudo chown -R $USER:$USER ~/.local/share/com.owlivion.mail
sudo chown -R $USER:$USER ~/.config/com.owlivion.mail
```

## 📞 Destek

- **GitHub Issues:** https://github.com/owlivion/owlivion-mail/issues
- **Website:** https://owlivion.com
- **Email:** support@owlivion.com

## 📄 Lisans

MIT License - Detaylar için LICENSE dosyasına bakınız.
