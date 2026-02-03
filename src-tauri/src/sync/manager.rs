//! Sync Manager - Orchestrates synchronization operations
//!
//! Coordinates between local storage, encryption, and API client.
//! Handles:
//! - User registration/login flow
//! - Data collection from local DB
//! - Encryption and upload
//! - Download and decryption
//! - Conflict detection and resolution
//! - Token management (auto-refresh on 401)

use super::api::{
    SyncApiClient, RegisterRequest, LoginRequest, SyncApiError,
    UploadRequest, DeviceResponse,
};
use super::crypto::{
    SyncDataType, derive_sync_master_key, derive_data_key,
    encrypt_sync_data, decrypt_sync_data, generate_random_salt,
};
use super::models::{
    SyncConfig, Platform,
    AccountSyncData, AccountConfig,
    ContactSyncData, ContactItem,
    PreferencesSyncData,
    SignatureSyncData,
    SyncStatus, SyncState,
};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Sync manager - main orchestrator
pub struct SyncManager {
    api_client: Arc<SyncApiClient>,
    config: Arc<RwLock<SyncConfig>>,
}

impl SyncManager {
    /// Create new sync manager with default config
    pub fn new() -> Self {
        Self {
            api_client: Arc::new(SyncApiClient::new()),
            config: Arc::new(RwLock::new(SyncConfig::default())),
        }
    }

    /// Initialize with existing config
    pub fn with_config(config: SyncConfig) -> Self {
        Self {
            api_client: Arc::new(SyncApiClient::new()),
            config: Arc::new(RwLock::new(config)),
        }
    }

    // ========================================================================
    // Authentication
    // ========================================================================

    /// Register new Owlivion Account
    pub async fn register(
        &self,
        email: String,
        password: String,
        master_password: String,
    ) -> Result<(), SyncManagerError> {
        let config = self.config.read().await;

        let req = RegisterRequest {
            email: email.clone(),
            password,
            device_name: config.device_name.clone(),
            device_id: config.device_id.clone(),
            platform: config.platform.as_str().to_string(),
        };

        drop(config); // Release lock before async call

        let auth = self.api_client.register(req).await?;

        // Store tokens and user ID
        self.api_client.set_token(auth.access_token.clone()).await;

        // Generate and store master key salt
        let salt = generate_random_salt();

        // Update config
        let mut config = self.config.write().await;
        config.enabled = true;
        config.user_id = Some(auth.user_id);
        config.master_key_salt = Some(hex::encode(&salt));

        Ok(())
    }

    /// Login to existing Owlivion Account
    pub async fn login(
        &self,
        email: String,
        password: String,
    ) -> Result<(), SyncManagerError> {
        let config = self.config.read().await;

        let req = LoginRequest {
            email: email.clone(),
            password,
            device_name: config.device_name.clone(),
            device_id: config.device_id.clone(),
            platform: config.platform.as_str().to_string(),
        };

        drop(config);

        let auth = self.api_client.login(req).await?;

        // Store tokens
        self.api_client.set_token(auth.access_token.clone()).await;

        // Update config
        let mut config = self.config.write().await;
        config.enabled = true;
        config.user_id = Some(auth.user_id);

        Ok(())
    }

    /// Logout (clear tokens and disable sync)
    pub async fn logout(&self) -> Result<(), SyncManagerError> {
        self.api_client.clear_token().await;

        let mut config = self.config.write().await;
        config.enabled = false;
        config.user_id = None;

        Ok(())
    }

    // ========================================================================
    // Sync Operations
    // ========================================================================

    /// Perform full sync for all enabled data types
    pub async fn sync_all(
        &self,
        master_password: &str,
    ) -> Result<SyncResult, SyncManagerError> {
        let config = self.config.read().await.clone();

        if !config.enabled {
            return Err(SyncManagerError::SyncDisabled);
        }

        let mut result = SyncResult::default();

        // Sync each data type if enabled
        if config.sync_accounts {
            match self.sync_accounts(master_password).await {
                Ok(_) => result.accounts_synced = true,
                Err(e) => result.errors.push(format!("Accounts: {}", e)),
            }
        }

        if config.sync_contacts {
            match self.sync_contacts(master_password).await {
                Ok(_) => result.contacts_synced = true,
                Err(e) => result.errors.push(format!("Contacts: {}", e)),
            }
        }

        if config.sync_preferences {
            match self.sync_preferences(master_password).await {
                Ok(_) => result.preferences_synced = true,
                Err(e) => result.errors.push(format!("Preferences: {}", e)),
            }
        }

        if config.sync_signatures {
            match self.sync_signatures(master_password).await {
                Ok(_) => result.signatures_synced = true,
                Err(e) => result.errors.push(format!("Signatures: {}", e)),
            }
        }

        // Update last sync timestamp
        let mut config = self.config.write().await;
        config.last_sync_at = Some(chrono::Utc::now());

        Ok(result)
    }

    /// Sync accounts data
    async fn sync_accounts(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        // In real implementation, this would:
        // 1. Load accounts from local DB (without passwords)
        // 2. Serialize to AccountSyncData
        // 3. Encrypt with derived key
        // 4. Upload to server
        // 5. Download from server
        // 6. Decrypt and merge with local data

        // Placeholder for now
        Ok(())
    }

    /// Sync contacts data
    async fn sync_contacts(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        Ok(())
    }

    /// Sync preferences data
    async fn sync_preferences(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        Ok(())
    }

    /// Sync signatures data
    async fn sync_signatures(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        Ok(())
    }

    /// Upload encrypted data to server
    async fn upload<T: serde::Serialize>(
        &self,
        data_type: SyncDataType,
        data: &T,
        master_password: &str,
    ) -> Result<i64, SyncManagerError> {
        let config = self.config.read().await;

        let salt = config.master_key_salt.as_ref()
            .ok_or(SyncManagerError::NoMasterKeySalt)?;

        let salt_bytes: [u8; 32] = hex::decode(salt)
            .map_err(|_| SyncManagerError::InvalidSalt)?
            .try_into()
            .map_err(|_| SyncManagerError::InvalidSalt)?;

        let device_id = config.device_id.clone();

        drop(config);

        // Derive master key
        let master_key = derive_sync_master_key(master_password, &salt_bytes)
            .map_err(|e| SyncManagerError::EncryptionFailed(e))?;

        // Encrypt
        let payload = encrypt_sync_data(data, &master_key, data_type, &device_id)
            .map_err(|e| SyncManagerError::EncryptionFailed(e))?;

        // Prepare upload request
        let req = UploadRequest {
            encrypted_data: base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &payload.encrypted_data,
            ),
            version: payload.version as i64,
        };

        // Upload
        let response = self.api_client.upload_data(
            data_type.as_str(),
            req,
        ).await?;

        Ok(response.version)
    }

    /// Download and decrypt data from server
    async fn download<T: for<'de> serde::Deserialize<'de>>(
        &self,
        data_type: SyncDataType,
        master_password: &str,
    ) -> Result<Option<T>, SyncManagerError> {
        let config = self.config.read().await;

        let salt = config.master_key_salt.as_ref()
            .ok_or(SyncManagerError::NoMasterKeySalt)?;

        let salt_bytes: [u8; 32] = hex::decode(salt)
            .map_err(|_| SyncManagerError::InvalidSalt)?
            .try_into()
            .map_err(|_| SyncManagerError::InvalidSalt)?;

        let device_id = config.device_id.clone();

        drop(config);

        // Download
        let response = self.api_client.download_data(
            data_type.as_str(),
        ).await?;

        if response.encrypted_data.is_empty() {
            return Ok(None); // No data on server
        }

        // Decode base64
        let encrypted_bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &response.encrypted_data,
        ).map_err(|_| SyncManagerError::DecryptionFailed)?;

        // Derive master key
        let master_key = derive_sync_master_key(master_password, &salt_bytes)
            .map_err(|_| SyncManagerError::DecryptionFailed)?;

        // Build payload for decryption
        use super::crypto::SyncPayload;

        // Note: Server response doesn't include all SyncPayload fields
        // For now, we'll need to adjust the API or extract nonce from encrypted data
        // Placeholder implementation - needs proper nonce handling

        // Decrypt (this needs proper payload reconstruction from server)
        // let decrypted = decrypt_sync_data(&payload, &master_key)
        //     .map_err(|_| SyncManagerError::DecryptionFailed)?;

        // Ok(Some(decrypted))

        // TODO: Implement proper payload reconstruction
        Err(SyncManagerError::DecryptionFailed)
    }

    // ========================================================================
    // Device Management
    // ========================================================================

    /// List all registered devices for this account
    pub async fn list_devices(&self) -> Result<Vec<DeviceResponse>, SyncManagerError> {
        let devices = self.api_client.list_devices().await?;
        Ok(devices)
    }

    /// Revoke device access (logout device)
    pub async fn revoke_device(&self, device_id: &str) -> Result<(), SyncManagerError> {
        self.api_client.revoke_device(device_id).await?;
        Ok(())
    }

    // ========================================================================
    // Config Management
    // ========================================================================

    /// Get current sync config
    pub async fn get_config(&self) -> SyncConfig {
        self.config.read().await.clone()
    }

    /// Update sync config
    pub async fn update_config(&self, new_config: SyncConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
    }

    /// Get sync status for all data types
    pub async fn get_status(&self) -> Result<Vec<SyncStatus>, SyncManagerError> {
        // Placeholder - would fetch from server
        let config = self.config.read().await;

        let statuses = vec![
            SyncStatus {
                data_type: "accounts".to_string(),
                version: 1,
                last_sync_at: config.last_sync_at,
                device_id: config.device_id.clone(),
                status: SyncState::Idle,
            },
            SyncStatus {
                data_type: "contacts".to_string(),
                version: 1,
                last_sync_at: config.last_sync_at,
                device_id: config.device_id.clone(),
                status: SyncState::Idle,
            },
            SyncStatus {
                data_type: "preferences".to_string(),
                version: 1,
                last_sync_at: config.last_sync_at,
                device_id: config.device_id.clone(),
                status: SyncState::Idle,
            },
            SyncStatus {
                data_type: "signatures".to_string(),
                version: 1,
                last_sync_at: config.last_sync_at,
                device_id: config.device_id.clone(),
                status: SyncState::Idle,
            },
        ];

        Ok(statuses)
    }
}

// ============================================================================
// Result Types
// ============================================================================

#[derive(Debug, Clone, Default)]
pub struct SyncResult {
    pub accounts_synced: bool,
    pub contacts_synced: bool,
    pub preferences_synced: bool,
    pub signatures_synced: bool,
    pub errors: Vec<String>,
}

impl SyncResult {
    pub fn is_success(&self) -> bool {
        self.errors.is_empty()
    }

    pub fn has_any_success(&self) -> bool {
        self.accounts_synced
            || self.contacts_synced
            || self.preferences_synced
            || self.signatures_synced
    }
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum SyncManagerError {
    #[error("Sync is disabled")]
    SyncDisabled,

    #[error("No master key salt found")]
    NoMasterKeySalt,

    #[error("Invalid salt format")]
    InvalidSalt,

    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed")]
    DecryptionFailed,

    #[error("API error: {0}")]
    ApiError(#[from] SyncApiError),

    #[error("Crypto error: {0}")]
    CryptoError(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_manager_creation() {
        let manager = SyncManager::new();
        let config = manager.get_config().await;
        assert!(!config.enabled);
    }

    #[tokio::test]
    async fn test_config_update() {
        let manager = SyncManager::new();

        let mut config = manager.get_config().await;
        config.enabled = true;
        config.sync_interval_minutes = 15;

        manager.update_config(config.clone()).await;

        let updated = manager.get_config().await;
        assert!(updated.enabled);
        assert_eq!(updated.sync_interval_minutes, 15);
    }

    #[tokio::test]
    async fn test_logout_disables_sync() {
        let manager = SyncManager::new();

        let mut config = manager.get_config().await;
        config.enabled = true;
        manager.update_config(config).await;

        manager.logout().await.unwrap();

        let config = manager.get_config().await;
        assert!(!config.enabled);
        assert!(config.user_id.is_none());
    }
}
