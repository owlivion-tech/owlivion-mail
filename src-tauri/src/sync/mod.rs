//! Sync Module - Cross-Device Account Synchronization
//!
//! Provides end-to-end encrypted sync for:
//! - Account settings (IMAP/SMTP configs, not passwords)
//! - Contacts (address book)
//! - Preferences (theme, language, settings)
//! - Email signatures
//!
//! Architecture:
//! - Zero-Knowledge: Server never sees plaintext
//! - E2E Encryption: AES-256-GCM with per-data-type keys
//! - Conflict Resolution: LWW, merge, or user prompt strategies

pub mod crypto;
pub mod models;
pub mod manager;
pub mod api;
pub mod queue;
pub mod history;
pub mod scheduler;
// pub mod conflict;
// pub mod adapters;

#[cfg(test)]
mod tests;

// Re-export commonly used types
pub use crypto::{
    SyncDataType, SyncPayload, derive_sync_master_key, derive_data_key,
    encrypt_sync_data, decrypt_sync_data, generate_random_salt,
    compute_sha256, encode_base64, decode_base64,
};

pub use models::{
    SyncConfig, Platform,
    AccountSyncData, AccountConfig,
    ContactSyncData, ContactItem,
    PreferencesSyncData,
    SignatureSyncData,
    SyncStatus, SyncState,
    ConflictStrategy, ConflictInfo,
};

pub use manager::{SyncManager, SyncResult, SyncManagerError};
pub use api::{SyncApiClient, SyncApiError, DeviceResponse};
pub use queue::{QueueManager, QueueItem, QueueStatus, QueueStats, QueueError};
pub use history::{HistoryManager, SyncSnapshot, SyncOperation, HistoryStats, HistoryError};
pub use scheduler::{BackgroundScheduler, SchedulerConfig, SchedulerError};
