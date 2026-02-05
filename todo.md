# Owlivion Mail - TODO & Roadmap

## 🚀 Active Tasks (Öncelikli)

### System Tray / Panel Icon
**Status**: 🟡 Partially Implemented (Core features done)
**Priority**: 🔥 CRITICAL
**Estimated Effort**: ~~Medium (2-3 days)~~ → 1-2 days remaining

Uygulamanın arka planda çalışması ve sistem panelinde kalıcı ikon gösterimi.

**Features:**
- ✅ **Panel İkonu**: Owlivion Mail logosu (monochrome/adaptif)
  - ✅ Uygulama kapatılsa bile arka planda çalışmaya devam
  - ✅ Panel ikonundan pencere açılır (menü ile - 2 tık)
  - ⚠️ **TODO**: Telegram mode - tek tık ile direkt aç (GNOME AppIndicator sorunu)
  - ✅ 64x64 icon (GNOME visibility)
- ⚠️ **Email Notification**: (Partially - notification sounds exist)
  - ❌ Yeni email geldiğinde sistem bildirimi
  - ❌ Bildirime tıklanınca ilgili email açılacak
  - ✅ Ses bildirimi (mevcut)
- ❌ **Badge/Counter**:
  - ❌ Panel ikonunda okunmamış email sayısı
  - ❌ Uygulamadaki sayaçlarla senkronize
  - ❌ Örn: "5" badge gösterimi
- ✅ **Context Menu** (sağ tık):
  - ✅ "Show/Hide Window" - Pencere toggle
  - ✅ "New Email" - Yeni email compose
  - ✅ "Settings" - Ayarlar
  - ✅ "Quit" - Uygulamadan çık

**Technical Stack:**
- ✅ `tauri-plugin-notification` (already installed)
- ✅ Tauri 2.x System Tray API
- ✅ Platform Support: Linux, Windows, macOS

**Implementation Steps:**
1. [x] System tray icon setup (Tauri tray API) ✅
2. [x] Window close to tray behavior ✅ **NEW**
3. [x] Tray menu (minimal - "Owlivion Mail" to open) ✅
4. [x] Window show from tray (works with 2 clicks) ✅
5. [x] 64x64 icon for GNOME visibility ✅
6. [ ] **Telegram mode:** Single-click to open (research needed)
   - GNOME AppIndicator limitation: click events not working
   - Possible solutions: Production build test, Tauri GitHub issue, KDE test
7. [ ] Background service implementation
8. [ ] New email polling mechanism
9. [ ] Notification integration (desktop notifications)
10. [ ] Badge counter sync

**References:**
- Tauri System Tray: https://v2.tauri.app/reference/javascript/api/namespacetray/
- Notification Plugin: https://v2.tauri.app/plugin/notification/

---

## 📋 Backlog (Sonraki Özellikler)

### High Priority

#### 1. Draft Email Support
**Status**: 🔴 Not Started
**Priority**: ⭐⭐⭐
**Estimated Effort**: Medium

Taslak email kaydetme ve düzenleme desteği.

**Features:**
- [ ] Draft folder support (IMAP Drafts folder)
- [ ] Auto-save while composing (every 30s)
- [ ] Resume draft from list
- [ ] Draft counter in sidebar
- [ ] Delete draft on send

**Technical Notes:**
- IMAP APPEND command for saving drafts
- SQLite local cache for offline drafts
- Sync mechanism between local/server

---

#### 2. Email Attachment Preview
**Status**: 🔴 Not Started
**Priority**: ⭐⭐⭐
**Estimated Effort**: Large

Email eklentilerini önizleme ve indirme.

**Features:**
- [ ] Attachment list in email view
- [ ] File type icons (PDF, DOCX, PNG, etc.)
- [ ] Quick preview (images, PDFs)
- [ ] Download attachment
- [ ] Download all (zip)
- [ ] Attachment size display
- [ ] Virus scan integration (optional)

**Technical Notes:**
- MIME multipart parsing (already exists)
- File type detection
- Preview renderer for common formats
- Temporary file management

---

#### 3. Advanced Search & Filtering
**Status**: 🟡 Partially Implemented
**Priority**: ⭐⭐⭐
**Estimated Effort**: Medium

Gelişmiş email arama ve filtreleme özellikleri.

**Current State:**
- ✅ Basic IMAP search implemented
- ❌ UI search interface needs improvement
- ❌ Advanced filters not implemented

**Features:**
- [ ] Search UI improvements
  - [ ] Search bar in header
  - [ ] Quick filters (unread, starred, has attachment)
  - [ ] Date range picker
  - [ ] Sender/recipient filter
- [ ] Advanced search operators
  - [ ] `from:user@example.com`
  - [ ] `subject:keyword`
  - [ ] `has:attachment`
  - [ ] `before:2024-01-01`
  - [ ] `after:2024-01-01`
- [ ] Saved searches
- [ ] Search history

**Technical Notes:**
- Extend existing `search()` IMAP function
- Build query parser for operators
- SQLite FTS5 for local search cache

---

### Medium Priority

#### 4. Email Categories / Labels
**Status**: 🔴 Not Started
**Priority**: ⭐⭐
**Estimated Effort**: Large

Gmail-style labels veya kategori sistemi.

**Features:**
- [ ] Label CRUD (create, update, delete)
- [ ] Apply multiple labels to email
- [ ] Label colors
- [ ] Sidebar label list
- [ ] Filter by label
- [ ] Auto-labeling rules

**Technical Notes:**
- Gmail: Use IMAP X-GM-LABELS
- Other providers: Custom SQLite mapping
- Sync labels across devices

---

#### 5. Keyboard Shortcuts
**Status**: 🔴 Not Started
**Priority**: ⭐⭐
**Estimated Effort**: Small

Hızlı erişim için klavye kısayolları.

**Shortcuts:**
- [ ] `C` - Compose new email
- [ ] `R` - Reply
- [ ] `A` - Reply all
- [ ] `F` - Forward
- [ ] `E` - Archive
- [ ] `#` / `Delete` - Delete
- [ ] `S` - Toggle star
- [ ] `U` - Mark unread
- [ ] `J` / `K` - Navigate emails (vi-style)
- [ ] `/` - Focus search
- [ ] `Esc` - Close modal/dialog
- [ ] `Ctrl+Enter` - Send email

**Technical Notes:**
- React keyboard event handlers
- Global shortcuts (Tauri)
- Customizable shortcuts (settings)

---

#### 6. Theme Toggle (Dark/Light)
**Status**: 🟡 Both Themes Implemented
**Priority**: ⭐⭐
**Estimated Effort**: Small

**Current State:**
- ✅ Dark theme fully implemented
- ✅ Light theme fully implemented
- ❌ Toggle button missing

**Implementation:**
- [ ] Add theme toggle button (header)
- [ ] Save preference to localStorage
- [ ] System theme detection (auto)
- [ ] Theme transition animation

---

### Low Priority

#### 7. Email Templates
**Status**: 🔴 Not Started
**Priority**: ⭐
**Estimated Effort**: Medium

Önceden tanımlanmış email şablonları.

**Features:**
- [ ] Template library
- [ ] Create/edit templates
- [ ] Variables support (`{name}`, `{email}`)
- [ ] Quick insert while composing
- [ ] Default templates (greeting, signature, etc.)

---

#### 8. Signature Manager UI Improvements
**Status**: 🟡 Basic Implementation Exists
**Priority**: ⭐
**Estimated Effort**: Small

**Current State:**
- ✅ Signature saving works
- ❌ UI needs improvement

**Improvements:**
- [ ] Rich text editor for signature
- [ ] Multiple signatures per account
- [ ] Default signature selection
- [ ] Preview before save

---

#### 9. Multiple Account Sync Priority
**Status**: 🔴 Not Started
**Priority**: ⭐
**Estimated Effort**: Small

Birden fazla hesap varsa senkronizasyon önceliği.

**Features:**
- [ ] Set account sync priority (drag & drop)
- [ ] Enable/disable auto-sync per account
- [ ] Sync interval per account
- [ ] Manual sync button per account

---

## 📖 Roadmap (Uzun Vadeli Özellikler)

### Account Sync (Owlivion Cloud)
**Status**: 🔵 Planned
**Target**: Q2 2026
**Priority**: 🔥 HIGH

Cross-platform sync via Owlivion Account.

**Features:**
- [ ] Owlivion Account registration
- [ ] Device management
- [ ] Sync account settings
- [ ] Sync contacts
- [ ] Sync preferences
- [ ] Sync signatures
- [ ] End-to-end encryption (mandatory)

**Infrastructure:**
- Server: Owlivion VPS (31.97.216.36)
- Protocol: REST API + WebSocket
- Encryption: AES-256-GCM
- Authentication: JWT tokens

**Technical Notes:**
- Already implemented: Sync manager (`src-tauri/src/sync/`)
- Needs: Server deployment, conflict resolution testing

---

### AI Features Enhancement
**Status**: 🔵 Planned
**Target**: Q3 2026

**Features:**
- [ ] Smart compose (AI suggestions)
- [ ] Email summarization
- [ ] Auto-categorization
- [ ] Spam detection improvements
- [ ] Sentiment analysis

**Technical Notes:**
- Current: Gemini API for phishing detection
- Future: GPT-4 / Claude integration
- Privacy: Local processing option

---

### Calendar Integration
**Status**: 🔵 Planned
**Target**: Q4 2026

**Features:**
- [ ] View calendar events
- [ ] Create events from email
- [ ] Meeting invite support (.ics)
- [ ] Reminders

---

## ✅ Completed (Tamamlanan)

### Window Close to Tray
**Completed**: 2026-02-05 ✅

Pencere kapatıldığında uygulamayı system tray'e gönderme özelliği.

**Implemented:**
- ✅ Window close event handler
- ✅ Close to tray behavior (configurable)
- ✅ Settings toggle ("System Tray'e Minimize Et")
- ✅ Database migration for `close_to_tray` setting
- ✅ Tray icon click → Direct window show (no toggle)
- ✅ Improved tray icons (light/dark theme)
- ✅ `unminimize()` support for proper window restoration

**Technical Implementation:**
- Window close event captured in `lib.rs`
- `close_to_tray` setting stored in database
- Tray icon behavior: left-click always shows window
- Menu "Show/Hide" option for toggle functionality
- Default: enabled (can be disabled in settings)

---

### OAuth2 Full Implementation
**Completed**: 2026-02-05 ✅

Tüm OAuth2 operasyonları çalışıyor.

**Implemented:**
- ✅ OAuth2 PKCE authentication flow
- ✅ Gmail OAuth2 integration
- ✅ IMAP OAuth2 (9 operations)
  - `connect()`, `fetch_emails()`, `fetch_email()`
  - `list_folders()`, `set_read()`, `set_starred()`
  - `search()`, `move_email()`, `delete_email()`
- ✅ SMTP OAuth2 (custom implementation)
  - Port 465 (direct TLS)
  - XOAUTH2 SASL authentication
- ✅ Token refresh mechanism
  - Auto-refresh 5 minutes before expiry
  - Refresh token storage
  - Database token updates

**Technical Solution:**
- async-imap bug workaround: rust-imap + `tokio::spawn_blocking`
- Custom SMTP client (`src-tauri/src/mail/smtp_oauth.rs`)
- Port 465 for Gmail OAuth SMTP (direct TLS)

---

### Email Core Features
**Completed**: 2025-2026 ✅

- ✅ IMAP/SMTP support
- ✅ Multiple accounts
- ✅ Email list (pagination)
- ✅ Email compose/send
- ✅ Reply/Reply all/Forward
- ✅ Mark read/unread
- ✅ Star/unstar
- ✅ Delete email
- ✅ Move email (folders)
- ✅ Folder navigation
- ✅ Search emails (basic)

---

### Security & Privacy
**Completed**: 2025-2026 ✅

- ✅ Local storage encryption (AES-256-GCM)
- ✅ Password encryption (HKDF key derivation)
- ✅ Zeroize memory wiping
- ✅ AI Phishing Detection (Gemini)
- ✅ Tracking pixel blocker
- ✅ SSL/TLS support

---

### UI/UX
**Completed**: 2025-2026 ✅

- ✅ Dark theme
- ✅ Light theme
- ✅ Responsive design
- ✅ Email compose modal
- ✅ Settings panel
- ✅ Account management
- ✅ Rich text editor (HTML compose)
- ✅ Notification sounds

---

## 📊 Progress Tracking

### Overall Progress
```
Core Features:        ████████████████████ 100% (20/20)
OAuth2:              ████████████████████ 100% (10/10)
Security:            ████████████████████ 100% (6/6)
UI/UX:               ████████████████████ 100% (20/20) ⬆️
System Tray:         ████████████░░░░░░░░  60% (5/9) ⬆️ NEW
Advanced Features:   ████░░░░░░░░░░░░░░░░  20% (2/10)
Cloud/Sync:          ░░░░░░░░░░░░░░░░░░░░   0% (0/8)
```

### Next Milestone: v1.5
**Target**: Q1 2026

**Required:**
- ✅ OAuth2 implementation (DONE)
- 🟡 System Tray (60% DONE - core features working) ⬆️
- 🔴 Draft email support
- 🔴 Attachment preview
- 🔴 Advanced search UI

---

## 🔧 Technical Debt

### Code Improvements
- [ ] Remove unused code (XOAuth2 struct, etc.)
- [ ] Fix Rust warnings (8 warnings total)
- [ ] Add unit tests for OAuth
- [ ] Add integration tests
- [ ] Performance optimization (email list rendering)

### Documentation
- [x] MEMORY.md updated
- [x] Code comments added
- [ ] User documentation (Turkish)
- [ ] API documentation (Rust docs)

---

## 📝 Notes

### Development Priorities
1. **First**: System Tray (most requested feature)
2. **Second**: Draft support (essential email feature)
3. **Third**: Attachment preview (usability)
4. **Fourth**: Advanced search (productivity)

### Design Philosophy
- **Privacy First**: All sensitive data encrypted locally
- **User Control**: No telemetry, no tracking
- **Simplicity**: Clean UI, no bloat
- **Performance**: Fast, lightweight, native

### Platform Support
- ✅ Linux (primary)
- ✅ Windows
- ✅ macOS

---

**Last Updated**: 2026-02-05 (17:00)
**Version**: 1.0.0 (OAuth2 Complete)
**Current Work**: System Tray (60% complete - window close to tray ✅)
**Next Version**: 1.5.0 (System Tray + Drafts)
