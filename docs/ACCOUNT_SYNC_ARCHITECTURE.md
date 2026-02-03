# Owlivion Mail - Account Sync Architecture Design
**Version:** 1.0.0
**Date:** 2026-02-03
**Status:** Draft (Phase 1 - Architecture Design)

---

## 1. Executive Summary

Account Sync özelliği, Owlivion Mail kullanıcılarının ayarlarını, kişilerini ve tercihlerini birden fazla cihaz arasında senkronize etmelerini sağlayacak. Tüm data end-to-end encryption ile korunacak ve Owlivion VPS (31.97.216.36) üzerinde encrypted olarak saklanacak.

### Temel Prensipler
- **Zero-Knowledge Architecture**: Server hiçbir zaman plaintext data görmez
- **Privacy-First**: Kullanıcı verisi client-side'da encrypt edilir
- **Cross-Platform**: Windows, macOS, Linux desteği
- **Selective Sync**: Kullanıcı neyi sync edeceğini seçebilir

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT DEVICES                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Windows    │  │    macOS     │  │    Linux     │      │
│  │  Desktop App │  │  Desktop App │  │  Desktop App │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                ┌───────────▼───────────┐                     │
│                │   E2E Encryption      │                     │
│                │   (Client-Side)       │                     │
│                └───────────┬───────────┘                     │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTPS
                             │
                ┌────────────▼────────────┐
                │   Owlivion VPS API      │
                │   (31.97.216.36)        │
                │                         │
                │  ┌───────────────────┐  │
                │  │ Authentication    │  │
                │  │ (JWT Tokens)      │  │
                │  └───────────────────┘  │
                │                         │
                │  ┌───────────────────┐  │
                │  │ Encrypted Storage │  │
                │  │ (PostgreSQL)      │  │
                │  └───────────────────┘  │
                │                         │
                │  ┌───────────────────┐  │
                │  │ Sync Orchestrator │  │
                │  └───────────────────┘  │
                └─────────────────────────┘
```

### 2.2 Component Breakdown

#### **Client-Side Components**

1. **Crypto Module** (`src-tauri/src/sync/crypto.rs`)
   - E2E encryption/decryption
   - Key derivation from user password
   - Zeroize for memory safety
   - Uses existing `crypto.rs` as foundation

2. **Sync Manager** (`src-tauri/src/sync/manager.rs`)
   - Orchestrates sync operations
   - Handles conflict resolution
   - Queue management for offline scenarios
   - Progress tracking

3. **API Client** (`src-tauri/src/sync/api.rs`)
   - HTTP client for VPS communication
   - Request/response handling
   - Retry logic with exponential backoff
   - Error handling

4. **Data Adapters** (`src-tauri/src/sync/adapters/`)
   - `accounts.rs`: Account settings sync
   - `contacts.rs`: Contacts sync
   - `preferences.rs`: App preferences sync
   - `signatures.rs`: Email signatures sync

5. **UI Components** (`src/components/sync/`)
   - Sync status indicator
   - Login/register dialog
   - Sync settings panel
   - Conflict resolution UI

#### **Server-Side Components** (VPS)

1. **REST API** (Node.js/Express or Rust/Axum)
   - Authentication endpoints
   - Sync data endpoints
   - Device management
   - Audit logging

2. **Database** (PostgreSQL)
   - User accounts
   - Encrypted sync data
   - Device registry
   - Sync metadata

3. **Background Jobs**
   - Token cleanup
   - Inactive device pruning
   - Backup management

---

## 3. Data Models

### 3.1 Client-Side Models

#### **SyncConfig**
```rust
pub struct SyncConfig {
    pub enabled: bool,
    pub user_id: Option<String>,
    pub device_id: String,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub sync_interval_minutes: i32,
    pub sync_on_startup: bool,
    pub sync_accounts: bool,
    pub sync_contacts: bool,
    pub sync_preferences: bool,
    pub sync_signatures: bool,
}
```

#### **SyncPayload**
```rust
pub struct SyncPayload {
    pub data_type: SyncDataType,
    pub encrypted_data: Vec<u8>,  // AES-256-GCM encrypted
    pub nonce: [u8; 12],
    pub version: i32,
    pub device_id: String,
    pub timestamp: DateTime<Utc>,
    pub checksum: String,  // SHA-256 for integrity
}

pub enum SyncDataType {
    Accounts,
    Contacts,
    Preferences,
    Signatures,
}
```

#### **SyncData Structures**

```rust
// Accounts
#[derive(Serialize, Deserialize)]
pub struct AccountSyncData {
    pub accounts: Vec<AccountConfig>,
}

#[derive(Serialize, Deserialize)]
pub struct AccountConfig {
    pub email: String,
    pub display_name: String,
    pub imap_host: String,
    pub imap_port: i32,
    pub imap_security: String,
    pub smtp_host: String,
    pub smtp_port: i32,
    pub smtp_security: String,
    pub signature: String,
    pub sync_days: i32,
    // NOTE: Passwords are encrypted separately with device-specific key
    // They are NOT included in cross-device sync for security
}

// Contacts
#[derive(Serialize, Deserialize)]
pub struct ContactSyncData {
    pub contacts: Vec<ContactItem>,
}

#[derive(Serialize, Deserialize)]
pub struct ContactItem {
    pub email: String,
    pub name: Option<String>,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub is_favorite: bool,
}

// Preferences
#[derive(Serialize, Deserialize)]
pub struct PreferencesSyncData {
    pub theme: String,
    pub language: String,
    pub notifications_enabled: bool,
    pub notification_sound: bool,
    pub auto_mark_read: bool,
    pub gemini_api_key: Option<String>,  // Encrypted separately
    pub keyboard_shortcuts_enabled: bool,
    pub compact_list_view: bool,
    pub show_avatars: bool,
}

// Signatures
#[derive(Serialize, Deserialize)]
pub struct SignatureSyncData {
    pub signatures: HashMap<String, String>,  // email -> signature HTML
}
```

### 3.2 Server-Side Models (PostgreSQL Schema)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- Bcrypt
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    platform VARCHAR(50),  -- windows, macos, linux
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, device_id)
);

-- Sync data table (encrypted blobs)
CREATE TABLE sync_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL,  -- accounts, contacts, preferences, signatures
    encrypted_blob BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    device_id VARCHAR(255) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, data_type)
);

-- Sync history (audit trail)
CREATE TABLE sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- upload, download
    timestamp TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Indexes
CREATE INDEX idx_sync_data_user ON sync_data(user_id);
CREATE INDEX idx_sync_data_type ON sync_data(user_id, data_type);
CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_sync_history_user ON sync_history(user_id, timestamp DESC);
```

---

## 4. End-to-End Encryption Flow

### 4.1 Key Derivation

```
User Password (Master Password)
       ↓
   HKDF-SHA256
       ↓
┌──────────────────────┐
│  Sync Master Key     │  (32 bytes)
│  (Derived from pwd)  │
└──────────────────────┘
       ↓
   Per-Data-Type Keys
       ↓
┌──────────────────────────────────┐
│ Accounts Key   | Contacts Key    │
│ Preferences Key| Signatures Key  │
└──────────────────────────────────┘
```

**Implementation:**
```rust
pub fn derive_sync_master_key(password: &str, salt: &[u8; 32]) -> Result<[u8; 32], String> {
    let hkdf_salt = hkdf::Salt::new(hkdf::HKDF_SHA256, salt);
    let prk = hkdf_salt.extract(password.as_bytes());

    let info: &[&[u8]] = &[b"owlivion-mail-sync-master-key-v1"];
    let okm = prk.expand(info, MyKeyType(32))?;

    let mut key = [0u8; 32];
    okm.fill(&mut key)?;
    Ok(key)
}

pub fn derive_data_key(master_key: &[u8; 32], data_type: SyncDataType) -> Result<[u8; 32], String> {
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, master_key);
    let info = match data_type {
        SyncDataType::Accounts => b"accounts-v1",
        SyncDataType::Contacts => b"contacts-v1",
        SyncDataType::Preferences => b"preferences-v1",
        SyncDataType::Signatures => b"signatures-v1",
    };

    let prk = salt.extract(info);
    let okm = prk.expand(&[info], MyKeyType(32))?;

    let mut key = [0u8; 32];
    okm.fill(&mut key)?;
    Ok(key)
}
```

### 4.2 Encryption Process

```
1. User triggers sync
2. Collect data (e.g., contacts from SQLite)
3. Serialize to JSON
4. Derive data-specific key from master key
5. Generate random nonce (12 bytes)
6. Encrypt with AES-256-GCM
7. Compute SHA-256 checksum
8. Upload {encrypted_blob, nonce, checksum} to VPS
```

**Code:**
```rust
pub fn encrypt_sync_data(
    data: &impl Serialize,
    master_key: &[u8; 32],
    data_type: SyncDataType,
) -> Result<SyncPayload, String> {
    // Derive data-specific key
    let data_key = derive_data_key(master_key, data_type)?;

    // Serialize
    let json = serde_json::to_vec(data)
        .map_err(|e| format!("Serialization error: {}", e))?;

    // Encrypt
    let rng = SystemRandom::new();
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes)?;

    let unbound_key = UnboundKey::new(&AES_256_GCM, &data_key)?;
    let key = LessSafeKey::new(unbound_key);

    let mut encrypted = json.clone();
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    key.seal_in_place_append_tag(nonce, Aad::empty(), &mut encrypted)?;

    // Checksum
    let checksum = compute_sha256(&encrypted);

    Ok(SyncPayload {
        data_type,
        encrypted_data: encrypted,
        nonce: nonce_bytes,
        checksum,
        device_id: get_device_id()?,
        timestamp: Utc::now(),
        version: 1,
    })
}
```

### 4.3 Decryption Process

```
1. Download {encrypted_blob, nonce, checksum} from VPS
2. Verify checksum (integrity check)
3. Derive data-specific key from master key
4. Decrypt with AES-256-GCM
5. Deserialize JSON
6. Update local database
```

---

## 5. API Endpoint Design

### 5.1 Authentication Endpoints

#### **POST /api/v1/auth/register**
```json
Request:
{
  "email": "user@example.com",
  "password": "hashed_client_side",  // Argon2id client-side hash
  "device_id": "uuid-v4",
  "device_name": "My MacBook Pro",
  "platform": "macos"
}

Response:
{
  "user_id": "uuid",
  "access_token": "jwt_token",
  "refresh_token": "jwt_refresh",
  "expires_in": 3600
}
```

#### **POST /api/v1/auth/login**
```json
Request:
{
  "email": "user@example.com",
  "password": "hashed_client_side",
  "device_id": "uuid-v4"
}

Response:
{
  "user_id": "uuid",
  "access_token": "jwt_token",
  "refresh_token": "jwt_refresh",
  "expires_in": 3600
}
```

#### **POST /api/v1/auth/refresh**
```json
Request:
{
  "refresh_token": "jwt_refresh"
}

Response:
{
  "access_token": "new_jwt_token",
  "expires_in": 3600
}
```

### 5.2 Sync Endpoints

#### **POST /api/v1/sync/upload**
Upload encrypted data to server.

```json
Request:
{
  "data_type": "contacts",  // accounts | contacts | preferences | signatures
  "encrypted_blob": "base64_encoded_blob",
  "nonce": "base64_encoded_nonce",
  "checksum": "sha256_hex",
  "version": 1,
  "device_id": "uuid"
}

Response:
{
  "success": true,
  "version": 2,  // New version number
  "updated_at": "2026-02-03T10:30:00Z"
}
```

#### **GET /api/v1/sync/download?data_type=contacts**
Download encrypted data from server.

```json
Response:
{
  "data_type": "contacts",
  "encrypted_blob": "base64_encoded_blob",
  "nonce": "base64_encoded_nonce",
  "checksum": "sha256_hex",
  "version": 2,
  "device_id": "uuid",  // Device that last uploaded
  "updated_at": "2026-02-03T10:30:00Z"
}
```

#### **GET /api/v1/sync/status**
Get sync status for all data types.

```json
Response:
{
  "accounts": {
    "version": 1,
    "last_sync_at": "2026-02-03T09:00:00Z",
    "device_id": "device-1"
  },
  "contacts": {
    "version": 5,
    "last_sync_at": "2026-02-03T10:30:00Z",
    "device_id": "device-2"
  },
  "preferences": {
    "version": 3,
    "last_sync_at": "2026-02-03T08:00:00Z",
    "device_id": "device-1"
  },
  "signatures": null  // Not yet synced
}
```

### 5.3 Device Management

#### **GET /api/v1/devices**
List all registered devices.

```json
Response:
{
  "devices": [
    {
      "device_id": "uuid-1",
      "device_name": "MacBook Pro",
      "platform": "macos",
      "last_sync_at": "2026-02-03T10:30:00Z",
      "is_active": true
    },
    {
      "device_id": "uuid-2",
      "device_name": "Windows Desktop",
      "platform": "windows",
      "last_sync_at": "2026-02-02T15:20:00Z",
      "is_active": true
    }
  ]
}
```

#### **DELETE /api/v1/devices/:device_id**
Revoke device access.

```json
Response:
{
  "success": true,
  "message": "Device removed successfully"
}
```

---

## 6. Sync Strategy & Conflict Resolution

### 6.1 Sync Flow

```
1. Check local last_sync_at timestamp
2. GET /api/v1/sync/status
3. For each data type:
   a. Compare local version vs server version
   b. If server version > local version:
      - Download and decrypt
      - Check for conflicts
      - Merge or prompt user
   c. If local changes exist:
      - Encrypt and upload
      - Update local version
4. Update last_sync_at timestamp
```

### 6.2 Conflict Resolution Strategies

#### **Last-Write-Wins (LWW)**
- Default strategy for **Preferences**
- Server always keeps latest timestamp
- No user intervention needed

#### **Merge Strategy**
- Used for **Contacts**
- Union of both datasets
- Duplicate detection by email address
- Most recent `updated_at` wins per contact

#### **User Prompt**
- Used for **Accounts**
- Critical data, user must choose:
  - Keep local
  - Use server
  - Merge (if possible)

#### **Example: Contact Merge**
```rust
pub fn merge_contacts(
    local: Vec<ContactItem>,
    remote: Vec<ContactItem>,
) -> Vec<ContactItem> {
    let mut merged: HashMap<String, ContactItem> = HashMap::new();

    // Add all local contacts
    for contact in local {
        merged.insert(contact.email.clone(), contact);
    }

    // Merge remote contacts
    for contact in remote {
        if let Some(existing) = merged.get(&contact.email) {
            // Keep the one with most recent updated_at
            if contact.updated_at > existing.updated_at {
                merged.insert(contact.email.clone(), contact);
            }
        } else {
            merged.insert(contact.email.clone(), contact);
        }
    }

    merged.into_values().collect()
}
```

### 6.3 Offline Support

- Changes queue locally in `sync_queue` table:
```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_type TEXT NOT NULL,
    action TEXT NOT NULL,  -- upload, download
    encrypted_payload BLOB,
    created_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending'  -- pending, processing, failed
);
```

- When online, process queue in FIFO order
- Retry failed operations with exponential backoff

---

## 7. Security Considerations

### 7.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Server breach | E2E encryption - server never sees plaintext |
| MITM attack | HTTPS/TLS 1.3, certificate pinning |
| Password brute force | Argon2id client-side + bcrypt server-side |
| Replay attacks | JWT expiration, nonce validation |
| Account takeover | 2FA (future), device revocation |
| Key leakage | Zeroize sensitive memory, no key logging |

### 7.2 Security Best Practices

1. **Never transmit plaintext passwords** - Hash client-side with Argon2id
2. **Separate password encryption** - Device-specific passwords not synced
3. **Rate limiting** - 5 attempts per minute per IP
4. **Audit logging** - All sync operations logged
5. **Token rotation** - Access tokens expire in 1 hour
6. **Device fingerprinting** - Detect suspicious device additions

### 7.3 Password Handling

```rust
// Client-side password hashing before transmission
pub fn hash_password_for_auth(password: &str) -> String {
    use argon2::{Argon2, PasswordHasher};
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2.hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string()
}

// Server-side (VPS) additional bcrypt layer
// (Node.js example)
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(clientHash, 12);
```

---

## 8. Implementation Phases

### **Phase 1: Foundation** (Week 1-2)
- [ ] Create Rust sync module structure
- [ ] Implement E2E encryption with tests
- [ ] Design and implement sync database schema (client)
- [ ] Create basic API client with retry logic
- [ ] Setup VPS PostgreSQL database

### **Phase 2: Server API** (Week 3-4)
- [ ] Implement authentication endpoints (register, login, refresh)
- [ ] Implement sync upload/download endpoints
- [ ] Add device management endpoints
- [ ] Setup JWT authentication middleware
- [ ] Add rate limiting and security headers

### **Phase 3: Client Integration** (Week 5-6)
- [ ] Implement AccountSyncAdapter
- [ ] Implement ContactSyncAdapter
- [ ] Implement PreferencesSyncAdapter
- [ ] Implement SignatureSyncAdapter
- [ ] Add sync manager orchestration
- [ ] Implement conflict resolution logic

### **Phase 4: UI & UX** (Week 7-8)
- [ ] Create sync login/register dialog
- [ ] Add sync status indicator to UI
- [ ] Implement sync settings panel
- [ ] Add conflict resolution dialogs
- [ ] Create device management UI
- [ ] Add progress notifications

### **Phase 5: Testing & Polish** (Week 9-10)
- [ ] Unit tests for encryption/decryption
- [ ] Integration tests for sync flow
- [ ] Cross-platform testing (Win/Mac/Linux)
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation and user guide

---

## 9. File Structure

```
src-tauri/src/sync/
├── mod.rs                 # Module exports
├── crypto.rs              # E2E encryption/decryption
├── manager.rs             # Sync orchestration
├── api.rs                 # HTTP client for VPS
├── queue.rs               # Offline queue management
├── conflict.rs            # Conflict resolution logic
├── adapters/
│   ├── mod.rs
│   ├── accounts.rs        # Account sync adapter
│   ├── contacts.rs        # Contacts sync adapter
│   ├── preferences.rs     # Preferences sync adapter
│   └── signatures.rs      # Signatures sync adapter
└── models.rs              # Sync data structures

src/components/sync/
├── SyncLoginDialog.tsx    # Login/Register UI
├── SyncStatusBar.tsx      # Status indicator
├── SyncSettings.tsx       # Settings panel
├── ConflictDialog.tsx     # Conflict resolution UI
└── DeviceManager.tsx      # Device list/revoke
```

---

## 10. API Rate Limits

| Endpoint | Rate Limit |
|----------|-----------|
| `/auth/register` | 3 per hour per IP |
| `/auth/login` | 5 per minute per IP |
| `/sync/upload` | 10 per minute per user |
| `/sync/download` | 20 per minute per user |
| `/devices` | 10 per minute per user |

---

## 11. Performance Targets

- **Sync Time**: < 5 seconds for typical dataset (100 contacts, 5 accounts)
- **Encryption**: < 100ms for 1MB data
- **API Latency**: < 200ms average (VPS in Europe)
- **Offline Queue**: Support 1000 pending operations
- **Database Size**: Efficient storage, < 10MB per user on server

---

## 12. Future Enhancements

1. **2FA Support** - TOTP for account security
2. **Selective Sync** - Choose which accounts/folders to sync
3. **Conflict History** - View and revert sync conflicts
4. **Family Sharing** - Share contacts across family members
5. **Backup Export** - Download encrypted backup zip
6. **Webhook Notifications** - Real-time sync via WebSocket

---

## 13. Open Questions & Decisions Needed

### Q1: Password Storage for Email Accounts
**Question**: Email account passwords are device-specific (encrypted with machine ID). Should we:
- A) **Not sync passwords** - User re-enters on each device (RECOMMENDED)
- B) Sync with additional user master password
- C) Use device-specific keys per device

**Recommendation**: Option A - Don't sync passwords. Security-first approach.

### Q2: Sync Frequency
**Question**: How often should auto-sync run?
- Every 5 minutes?
- Every 30 minutes?
- Only on app startup + manual trigger?

**Recommendation**: Every 30 minutes + startup + manual. Configurable by user.

### Q3: Server Technology Stack
**Question**: VPS backend implementation:
- A) **Node.js + Express** - Fast development, mature ecosystem
- B) Rust + Axum - Performance, type safety, matches client
- C) Python + FastAPI - Rapid prototyping

**Recommendation**: Option A (Node.js) for faster initial development. Can migrate to Rust later if needed.

---

## 14. Success Metrics

- **Adoption Rate**: 70%+ users enable sync within 30 days
- **Sync Success Rate**: 99%+ successful sync operations
- **Conflict Rate**: < 5% of syncs result in conflicts
- **Performance**: 95th percentile sync time < 10 seconds
- **Security**: Zero plaintext data leaks, audit trail for all operations

---

## Appendix A: Example Sync Session

```
[App Startup]
1. Check if sync enabled: YES
2. Check network: ONLINE
3. Get local last_sync_at: 2026-02-03 08:00:00
4. GET /sync/status
   Response: contacts version=5, local version=4
5. GET /sync/download?data_type=contacts
6. Decrypt contacts data
7. Merge with local contacts (10 new, 2 updated)
8. Save to SQLite
9. Check for local changes: 1 new contact added
10. Encrypt local changes
11. POST /sync/upload (contacts)
12. Update last_sync_at: 2026-02-03 10:30:00
13. Show notification: "Sync complete - 12 contacts updated"
```

---

**Document Status**: Ready for review and approval
**Next Steps**:
1. Review this architecture design
2. Approve or request changes
3. Proceed to Phase 1 implementation
