# GPU Permission Sorunu ve Çözümü

## 🐛 Sorun

Owlivion Mail başlatıldığında arayüz görünmüyor. Log'larda şu hatalar var:

```
KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: Permission denied
Failed to create GBM buffer of size 2560x1600: Permission denied
```

**Neden:** WebKit renderer GPU'ya erişemiyor (grafik sürücüsü izin sorunu).

---

## ✅ Geçici Çözüm (Hemen Çalışır)

### Software Rendering ile Başlat

```bash
LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 owlivion-mail
```

veya .deb kuruluysa:

```bash
LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 /usr/bin/owlivion-mail
```

---

## 🔧 Kalıcı Çözümler

### Çözüm 1: Kullanıcıyı video/render grubuna ekle (Önerilen)

```bash
# video grubuna ekle
sudo usermod -a -G video $USER

# render grubu varsa ekle
sudo usermod -a -G render $USER

# Değişikliklerin geçerli olması için logout/login yap
# veya
newgrp video
```

**Sonra test et:**
```bash
owlivion-mail
```

### Çözüm 2: Desktop Entry'yi güncelle

`.desktop` dosyasında Exec satırını değiştir:

```bash
sudo nano /usr/share/applications/owlivion-mail.desktop
```

```ini
[Desktop Entry]
# Eski:
# Exec=owlivion-mail %u

# Yeni (Software rendering ile):
Exec=env LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 owlivion-mail %u
```

Desktop cache'i güncelle:
```bash
update-desktop-database ~/.local/share/applications
```

### Çözüm 3: Launcher Script oluştur

```bash
sudo nano /usr/local/bin/owlivion-mail-launcher
```

İçeriği:
```bash
#!/bin/bash
export LIBGL_ALWAYS_SOFTWARE=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1
exec /usr/bin/owlivion-mail "$@"
```

Executable yap:
```bash
sudo chmod +x /usr/local/bin/owlivion-mail-launcher
```

Desktop entry'yi güncelle:
```bash
sudo nano /usr/share/applications/owlivion-mail.desktop
```

```ini
Exec=owlivion-mail-launcher %u
```

---

## 🔍 Sorun Teşhis

### GPU izinlerini kontrol et:

```bash
# Video grubu kontrolü
groups $USER | grep video

# Render grubu kontrolü (varsa)
groups $USER | grep render

# DRI devices
ls -la /dev/dri/

# GPU bilgisi
lspci | grep -i vga
lspci | grep -i nvidia
```

### Test:

```bash
# Software rendering test
LIBGL_ALWAYS_SOFTWARE=1 glxinfo | grep "OpenGL renderer"
# Beklenen: "llvmpipe" veya "software"

# Hardware rendering test (GPU var mı?)
glxinfo | grep "OpenGL renderer"
```

---

## 📦 .deb Paketi için Build-time Çözüm

Gelecek sürümlerde `.deb` paketi için desktop entry'yi güncelleyelim:

**src-tauri/owlivion-mail.desktop:**

```ini
[Desktop Entry]
Name=Owlivion Mail
Comment=Modern AI-powered email client
Comment[tr]=Modern yapay zeka destekli e-posta istemcisi
GenericName=Email Client
GenericName[tr]=E-posta İstemcisi
Exec=env LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 owlivion-mail %u
Icon=owlivion-mail
Terminal=false
Type=Application
Categories=Network;Email;Office;
Keywords=email;mail;imap;smtp;gmail;outlook;
MimeType=x-scheme-handler/mailto;
StartupNotify=true
StartupWMClass=Owlivion Mail
Actions=Compose;

[Desktop Action Compose]
Name=Compose New Email
Name[tr]=Yeni E-posta Yaz
Exec=env LIBGL_ALWAYS_SOFTWARE=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 owlivion-mail --compose
```

Sonra yeniden build:
```bash
pnpm run build:linux
```

---

## 🎯 Hangi Çözümü Kullanmalıyım?

| Durum | Önerilen Çözüm |
|-------|----------------|
| **Hızlı test** | Geçici çözüm (env variables ile çalıştır) |
| **Kişisel kullanım** | Çözüm 1 (video grubuna ekle) |
| **Çok kullanıcılı sistem** | Çözüm 3 (Launcher script) |
| **Yeni release** | Build-time çözüm (desktop entry güncelle) |

---

## 📝 Notlar

### Performans:

- **Hardware Rendering:** Daha hızlı (GPU kullanır)
- **Software Rendering:** Biraz yavaş ama uyumlu (CPU kullanır)

### Güvenlik:

- `video` grubuna ekleme güvenlidir
- Software rendering güvenlik riski oluşturmaz

### Uyumluluk:

- Software rendering tüm sistemlerde çalışır
- Özellikle:
  - Sanal makinelerde (VM)
  - WSL2'de
  - Eski GPU'larda
  - Proprietary sürücü olmayan sistemlerde

---

## 🐞 Hala Çalışmıyor mu?

### Diğer deneyebilecekleriniz:

1. **Mesa drivers güncelle:**
   ```bash
   sudo apt update && sudo apt install mesa-utils
   ```

2. **WebKitGTK güncelle:**
   ```bash
   sudo apt install --reinstall libwebkit2gtk-4.1-0
   ```

3. **Debug log ile çalıştır:**
   ```bash
   RUST_LOG=debug LIBGL_ALWAYS_SOFTWARE=1 owlivion-mail 2>&1 | tee owlivion-debug.log
   ```

4. **X11 permissions:**
   ```bash
   xhost +local:
   ```

---

## ✅ Kalıcı Çözüm Uygulandıktan Sonra

Test et:
```bash
# Menüden başlat
# veya
owlivion-mail

# Beklenlen: Arayüz açılmalı ve çalışmalı ✅
```

---

**Özet:** Bu GPU permission sorunu özellikle NVIDIA kartlarda, VM'lerde ve bazı grafik sürücülerinde yaygındır. Software rendering ile sorun çözülür.
