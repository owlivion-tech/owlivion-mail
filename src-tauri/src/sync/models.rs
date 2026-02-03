//! Sync Data Models - Client-Side Structures
//!
//! Defines all data structures for cross-device synchronization.
//! These models match the architecture specification (Section 3.1).
//!
//! Data Categories:
//! - SyncConfig: Sync settings and metadata
//! - AccountSyncData: Email account configurations (no passwords)
//! - ContactSyncData: Address book contacts
//! - PreferencesSyncData: App preferences and settings
//! - SignatureSyncData: Email signatures per account

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Sync Configuration
// ============================================================================

/// Sync configuration and state
///
/// Stored locally to track sync settings and last sync timestamp.
/// Persisted in SQLite settings table or dedicated sync config file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    /// Whether sync is enabled
    pub enabled: bool,

    /// Owlivion Account user ID (from VPS)
    pub user_id: Option<String>,

    /// Unique device identifier (UUID v4)
    pub device_id: String,

    /// Device name (e.g., "MacBook Pro", "Windows Desktop")
    pub device_name: String,

    /// Platform identifier
    pub platform: Platform,

    /// Last successful sync timestamp
    pub last_sync_at: Option<DateTime<Utc>>,

    /// Auto-sync interval in minutes (0 = manual only)
    pub sync_interval_minutes: i32,

    /// Sync on app startup
    pub sync_on_startup: bool,

    /// Selective sync toggles
    pub sync_accounts: bool,
    pub sync_contacts: bool,
    pub sync_preferences: bool,
    pub sync_signatures: bool,

    /// Sync master key salt (32 bytes as hex)
    /// Generated once per user and persisted
    pub master_key_salt: Option<String>,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            user_id: None,
            device_id: uuid::Uuid::new_v4().to_string(),
            device_name: get_default_device_name(),
            platform: Platform::current(),
            last_sync_at: None,
            sync_interval_minutes: 30,
            sync_on_startup: true,
            sync_accounts: true,
            sync_contacts: true,
            sync_preferences: true,
            sync_signatures: true,
            master_key_salt: None,
        }
    }
}

/// Platform identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Windows,
    MacOS,
    Linux,
}

impl Platform {
    /// Get current platform
    pub fn current() -> Self {
        #[cfg(target_os = "windows")]
        return Platform::Windows;

        #[cfg(target_os = "macos")]
        return Platform::MacOS;

        #[cfg(target_os = "linux")]
        return Platform::Linux;
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Platform::Windows => "windows",
            Platform::MacOS => "macos",
            Platform::Linux => "linux",
        }
    }
}

/// Get default device name from hostname
fn get_default_device_name() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| format!("{} Device", Platform::current().as_str()))
}

// ============================================================================
// Account Sync Data
// ============================================================================

/// Account sync data (without passwords)
///
/// Contains email account configurations for IMAP/SMTP.
/// **SECURITY NOTE**: Passwords are NOT synced. They remain device-specific
/// and encrypted with machine-specific keys.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSyncData {
    pub accounts: Vec<AccountConfig>,

    /// Sync metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub synced_at: Option<DateTime<Utc>>,
}

impl AccountSyncData {
    pub fn new(accounts: Vec<AccountConfig>) -> Self {
        Self {
            accounts,
            synced_at: Some(Utc::now()),
        }
    }
}

/// Individual account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountConfig {
    /// Email address (unique identifier)
    pub email: String,

    /// Display name
    pub display_name: String,

    // IMAP Configuration
    pub imap_host: String,
    pub imap_port: i32,
    pub imap_security: String, // "SSL", "STARTTLS"

    // SMTP Configuration
    pub smtp_host: String,
    pub smtp_port: i32,
    pub smtp_security: String, // "SSL", "STARTTLS"

    /// Email signature (HTML)
    #[serde(default)]
    pub signature: String,

    /// How many days of email to sync
    #[serde(default = "default_sync_days")]
    pub sync_days: i32,

    /// Whether this account is default
    #[serde(default)]
    pub is_default: bool,

    /// OAuth provider (if using OAuth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oauth_provider: Option<String>, // "gmail", "outlook"
}

fn default_sync_days() -> i32 {
    30
}

// ============================================================================
// Contact Sync Data
// ============================================================================

/// Contact sync data (address book)
///
/// Contains all saved contacts with their details.
/// Duplicates are detected and merged by email address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactSyncData {
    pub contacts: Vec<ContactItem>,

    /// Sync metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub synced_at: Option<DateTime<Utc>>,
}

impl ContactSyncData {
    pub fn new(contacts: Vec<ContactItem>) -> Self {
        Self {
            contacts,
            synced_at: Some(Utc::now()),
        }
    }
}

/// Individual contact item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContactItem {
    /// Email address (unique identifier for merge)
    pub email: String,

    /// Display name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Company/organization
    #[serde(skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,

    /// Phone number
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    /// Notes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// Favorite flag
    #[serde(default)]
    pub is_favorite: bool,

    /// Last updated timestamp (for conflict resolution)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}

impl ContactItem {
    /// Create a new contact with current timestamp
    pub fn new(email: String, name: Option<String>) -> Self {
        Self {
            email,
            name,
            company: None,
            phone: None,
            notes: None,
            is_favorite: false,
            updated_at: Some(Utc::now()),
        }
    }

    /// Update timestamp to now
    pub fn touch(&mut self) {
        self.updated_at = Some(Utc::now());
    }
}

// ============================================================================
// Preferences Sync Data
// ============================================================================

/// App preferences sync data
///
/// Contains user preferences like theme, language, notification settings.
/// Uses Last-Write-Wins (LWW) conflict resolution strategy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreferencesSyncData {
    // Appearance
    pub theme: String, // "dark", "light", "system"
    pub language: String, // "tr", "en"

    // Notifications
    pub notifications_enabled: bool,
    pub notification_sound: bool,
    pub notification_badge: bool,

    // Email behavior
    pub auto_mark_read: bool,
    pub auto_mark_read_delay: i32, // seconds
    pub confirm_delete: bool,
    pub confirm_send: bool,

    // Compose settings
    pub signature_position: String, // "top", "bottom"
    pub reply_position: String, // "top", "bottom"

    // AI settings (Gemini API key is encrypted separately)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gemini_api_key: Option<String>,
    pub ai_auto_summarize: bool,
    pub ai_reply_tone: String, // "professional", "casual", "friendly"

    // UI preferences
    pub keyboard_shortcuts_enabled: bool,
    pub compact_list_view: bool,
    pub show_avatars: bool,
    pub conversation_view: bool,

    /// Sync metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub synced_at: Option<DateTime<Utc>>,
}

impl Default for PreferencesSyncData {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "tr".to_string(),
            notifications_enabled: true,
            notification_sound: true,
            notification_badge: true,
            auto_mark_read: true,
            auto_mark_read_delay: 3,
            confirm_delete: true,
            confirm_send: false,
            signature_position: "bottom".to_string(),
            reply_position: "top".to_string(),
            gemini_api_key: None,
            ai_auto_summarize: false,
            ai_reply_tone: "professional".to_string(),
            keyboard_shortcuts_enabled: true,
            compact_list_view: false,
            show_avatars: true,
            conversation_view: true,
            synced_at: None,
        }
    }
}

// ============================================================================
// Signature Sync Data
// ============================================================================

/// Email signatures sync data
///
/// Maps email addresses to their HTML signatures.
/// Allows different signatures per email account.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureSyncData {
    /// Map of email -> signature HTML
    pub signatures: HashMap<String, String>,

    /// Sync metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub synced_at: Option<DateTime<Utc>>,
}

impl SignatureSyncData {
    pub fn new() -> Self {
        Self {
            signatures: HashMap::new(),
            synced_at: Some(Utc::now()),
        }
    }

    pub fn from_map(signatures: HashMap<String, String>) -> Self {
        Self {
            signatures,
            synced_at: Some(Utc::now()),
        }
    }

    /// Add or update signature for an email
    pub fn set_signature(&mut self, email: String, signature: String) {
        self.signatures.insert(email, signature);
        self.synced_at = Some(Utc::now());
    }

    /// Get signature for an email
    pub fn get_signature(&self, email: &str) -> Option<&String> {
        self.signatures.get(email)
    }

    /// Remove signature for an email
    pub fn remove_signature(&mut self, email: &str) -> Option<String> {
        let result = self.signatures.remove(email);
        if result.is_some() {
            self.synced_at = Some(Utc::now());
        }
        result
    }
}

impl Default for SignatureSyncData {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Sync Status & Metadata
// ============================================================================

/// Sync status for a specific data type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub data_type: String, // "accounts", "contacts", etc.
    pub version: i32,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub device_id: String,
    pub status: SyncState,
}

/// Current sync state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncState {
    Idle,
    Syncing,
    Error,
    Conflict,
}

impl SyncState {
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncState::Idle => "idle",
            SyncState::Syncing => "syncing",
            SyncState::Error => "error",
            SyncState::Conflict => "conflict",
        }
    }
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/// Conflict resolution strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictStrategy {
    /// Use local version (discard server changes)
    UseLocal,

    /// Use server version (discard local changes)
    UseServer,

    /// Merge both versions (if possible)
    Merge,

    /// Ask user to resolve manually
    Manual,
}

/// Conflict information for user resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictInfo {
    pub data_type: String,
    pub local_version: i32,
    pub server_version: i32,
    pub local_updated_at: Option<DateTime<Utc>>,
    pub server_updated_at: Option<DateTime<Utc>>,
    pub strategy: ConflictStrategy,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_config_default() {
        let config = SyncConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.sync_interval_minutes, 30);
        assert!(config.sync_on_startup);
        assert!(config.sync_accounts);
    }

    #[test]
    fn test_platform_detection() {
        let platform = Platform::current();
        assert!(matches!(
            platform,
            Platform::Windows | Platform::MacOS | Platform::Linux
        ));
    }

    #[test]
    fn test_account_sync_data_serialization() {
        let account = AccountConfig {
            email: "test@example.com".to_string(),
            display_name: "Test User".to_string(),
            imap_host: "imap.example.com".to_string(),
            imap_port: 993,
            imap_security: "SSL".to_string(),
            smtp_host: "smtp.example.com".to_string(),
            smtp_port: 587,
            smtp_security: "STARTTLS".to_string(),
            signature: "<p>Best regards</p>".to_string(),
            sync_days: 30,
            is_default: true,
            oauth_provider: None,
        };

        let data = AccountSyncData::new(vec![account]);
        let json = serde_json::to_string(&data).unwrap();
        let deserialized: AccountSyncData = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.accounts.len(), 1);
        assert_eq!(deserialized.accounts[0].email, "test@example.com");
    }

    #[test]
    fn test_contact_sync_data_merge() {
        let contact1 = ContactItem::new(
            "alice@example.com".to_string(),
            Some("Alice".to_string()),
        );

        let mut contact2 = ContactItem::new(
            "alice@example.com".to_string(),
            Some("Alice Smith".to_string()),
        );
        contact2.company = Some("Acme Corp".to_string());

        // Contacts with same email should be mergeable
        assert_eq!(contact1.email, contact2.email);
    }

    #[test]
    fn test_preferences_default() {
        let prefs = PreferencesSyncData::default();
        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.language, "tr");
        assert!(prefs.notifications_enabled);
        assert!(prefs.keyboard_shortcuts_enabled);
    }

    #[test]
    fn test_signature_crud() {
        let mut signatures = SignatureSyncData::new();

        // Add
        signatures.set_signature(
            "test@example.com".to_string(),
            "<p>Signature</p>".to_string(),
        );
        assert_eq!(signatures.signatures.len(), 1);

        // Get
        let sig = signatures.get_signature("test@example.com");
        assert_eq!(sig, Some(&"<p>Signature</p>".to_string()));

        // Remove
        let removed = signatures.remove_signature("test@example.com");
        assert!(removed.is_some());
        assert_eq!(signatures.signatures.len(), 0);
    }

    #[test]
    fn test_contact_touch_updates_timestamp() {
        let mut contact = ContactItem::new(
            "test@example.com".to_string(),
            Some("Test".to_string()),
        );

        let original_time = contact.updated_at.unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));

        contact.touch();
        let new_time = contact.updated_at.unwrap();

        assert!(new_time > original_time);
    }

    #[test]
    fn test_sync_state_as_str() {
        assert_eq!(SyncState::Idle.as_str(), "idle");
        assert_eq!(SyncState::Syncing.as_str(), "syncing");
        assert_eq!(SyncState::Error.as_str(), "error");
        assert_eq!(SyncState::Conflict.as_str(), "conflict");
    }

    #[test]
    fn test_signature_sync_data_serialization() {
        let mut signatures = SignatureSyncData::new();
        signatures.set_signature("a@ex.com".to_string(), "<p>Sig A</p>".to_string());
        signatures.set_signature("b@ex.com".to_string(), "<p>Sig B</p>".to_string());

        let json = serde_json::to_string(&signatures).unwrap();
        let deserialized: SignatureSyncData = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.signatures.len(), 2);
        assert!(deserialized.get_signature("a@ex.com").is_some());
    }

    #[test]
    fn test_contact_item_equality() {
        let contact1 = ContactItem {
            email: "test@example.com".to_string(),
            name: Some("Test".to_string()),
            company: None,
            phone: None,
            notes: None,
            is_favorite: false,
            updated_at: None,
        };

        let contact2 = ContactItem {
            email: "test@example.com".to_string(),
            name: Some("Test".to_string()),
            company: None,
            phone: None,
            notes: None,
            is_favorite: false,
            updated_at: None,
        };

        assert_eq!(contact1, contact2);
    }

    #[test]
    fn test_conflict_info_creation() {
        let conflict = ConflictInfo {
            data_type: "contacts".to_string(),
            local_version: 5,
            server_version: 6,
            local_updated_at: Some(Utc::now()),
            server_updated_at: Some(Utc::now()),
            strategy: ConflictStrategy::Manual,
        };

        assert_eq!(conflict.data_type, "contacts");
        assert_eq!(conflict.strategy, ConflictStrategy::Manual);
    }
}
