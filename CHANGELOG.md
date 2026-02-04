# Changelog

All notable changes to Owlivion Mail will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### 🎉 Initial Release

#### ✨ Features

**Email Management**
- Multi-account support (Gmail, Outlook, Yahoo, IMAP/SMTP)
- Fast email synchronization
- Rich text email composer with formatting
- File attachments support
- Search and filter capabilities
- Folder management

**Security & Privacy**
- 🔐 AES-256-GCM encryption for local storage
- 🛡️ AI-powered phishing detection (Gemini API)
- 🚫 Tracking pixel blocker
- 🔒 Zeroize memory wiping for sensitive data
- End-to-end secure email handling

**User Interface**
- 🌓 Dark/Light theme support
- Modern, clean design with Tauri v2
- Responsive layout
- System notifications
- Native desktop integration

**Cross-Platform Sync** (Beta)
- Account settings synchronization
- Contacts sync
- Preferences sync
- Secure cloud storage

#### 🐛 Bug Fixes
- N/A (Initial release)

#### 📦 Technical Details
- Built with Tauri v2 for optimal performance
- React 18 + TypeScript frontend
- Rust backend for security and speed
- SQLite for local data storage

#### 🌐 Platform Support
- **Linux:** Ubuntu 20.04+, Debian 11+, and other distros
  - `.deb` package for Debian-based systems
  - `AppImage` for universal Linux support

#### 📝 Known Issues
- None reported yet

---

## Release Notes Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

### ✨ Added
- New feature description

### 🔧 Changed
- Changed feature description

### 🐛 Fixed
- Bug fix description

### 🗑️ Deprecated
- Deprecated feature description

### ❌ Removed
- Removed feature description

### 🔒 Security
- Security improvement description
```

---

## Version History

- **1.0.0** (2026-02-04) - Initial public release
  - Core email functionality
  - AI phishing detection
  - Multi-platform support
  - Linux packaging (.deb, AppImage)
