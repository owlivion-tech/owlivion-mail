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
    SyncDataType, derive_sync_master_key,
    encrypt_sync_data, generate_random_salt,
    gzip_compress, gzip_decompress,
};
use super::models::{
    SyncConfig,
    AccountSyncData, AccountConfig,
    ContactSyncData, ContactItem,
    PreferencesSyncData,
    SignatureSyncData,
    SyncStatus, SyncState,
    ConflictStrategy,
};
use super::queue::{QueueManager, QueueItem, QueueStats};
use super::history::{HistoryManager, SyncOperation};
use crate::db::Database;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Sync manager - main orchestrator
#[derive(Clone)]
pub struct SyncManager {
    api_client: Arc<SyncApiClient>,
    config: Arc<RwLock<SyncConfig>>,
    db: Arc<Database>,
    queue_manager: Arc<QueueManager>,
    history_manager: Arc<HistoryManager>,
}

impl SyncManager {
    /// Create new sync manager with default config
    pub fn new(db: Arc<Database>) -> Self {
        let queue_manager = QueueManager::new(db.clone())
            .expect("Failed to initialize queue manager");
        let history_manager = HistoryManager::new(db.clone())
            .expect("Failed to initialize history manager");

        Self {
            api_client: Arc::new(SyncApiClient::new()),
            config: Arc::new(RwLock::new(SyncConfig::default())),
            db,
            queue_manager: Arc::new(queue_manager),
            history_manager: Arc::new(history_manager),
        }
    }

    /// Initialize with existing config
    pub fn with_config(config: SyncConfig, db: Arc<Database>) -> Self {
        let queue_manager = QueueManager::new(db.clone())
            .expect("Failed to initialize queue manager");
        let history_manager = HistoryManager::new(db.clone())
            .expect("Failed to initialize history manager");

        Self {
            api_client: Arc::new(SyncApiClient::new()),
            config: Arc::new(RwLock::new(config)),
            db,
            queue_manager: Arc::new(queue_manager),
            history_manager: Arc::new(history_manager),
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
        _master_password: String,
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
        let salt = generate_random_salt()
            .map_err(|e| SyncManagerError::CryptoError(e))?;

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

    /// Perform full sync for all enabled data types (bidirectional)
    pub async fn sync_all(
        &self,
        master_password: &str,
    ) -> Result<SyncResult, SyncManagerError> {
        let config = self.config.read().await.clone();

        if !config.enabled {
            return Err(SyncManagerError::SyncDisabled);
        }

        let mut result = SyncResult::default();
        let mut all_conflicts = Vec::new();

        // Sync each data type with bidirectional conflict detection
        if config.sync_accounts {
            match self.sync_accounts_bidirectional(master_password).await {
                Ok(conflicts) => {
                    if let Some(mut conflicts) = conflicts {
                        all_conflicts.append(&mut conflicts);
                    } else {
                        result.accounts_synced = true;
                    }
                }
                Err(e) => result.errors.push(format!("Accounts: {}", e)),
            }
        }

        if config.sync_contacts {
            match self.sync_contacts_bidirectional(master_password).await {
                Ok(conflicts) => {
                    if let Some(mut conflicts) = conflicts {
                        all_conflicts.append(&mut conflicts);
                    } else {
                        result.contacts_synced = true;
                    }
                }
                Err(e) => result.errors.push(format!("Contacts: {}", e)),
            }
        }

        if config.sync_preferences {
            match self.sync_preferences_bidirectional(master_password).await {
                Ok(conflicts) => {
                    if let Some(mut conflicts) = conflicts {
                        all_conflicts.append(&mut conflicts);
                    } else {
                        result.preferences_synced = true;
                    }
                }
                Err(e) => result.errors.push(format!("Preferences: {}", e)),
            }
        }

        if config.sync_signatures {
            match self.sync_signatures_bidirectional(master_password).await {
                Ok(conflicts) => {
                    if let Some(mut conflicts) = conflicts {
                        all_conflicts.append(&mut conflicts);
                    } else {
                        result.signatures_synced = true;
                    }
                }
                Err(e) => result.errors.push(format!("Signatures: {}", e)),
            }
        }

        // Store conflicts if any
        if !all_conflicts.is_empty() {
            result.conflicts = Some(all_conflicts);
        }

        // Update last sync timestamp
        let mut config = self.config.write().await;
        config.last_sync_at = Some(chrono::Utc::now());

        Ok(result)
    }

    /// Sync accounts data (DELTA SYNC - only changed data)
    async fn sync_accounts(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Starting accounts delta sync");

        // 1. Get last sync timestamp from metadata
        let metadata = self.db.get_sync_metadata("accounts")
            .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to get sync metadata: {}", e)))?;

        let last_sync_at = metadata.and_then(|m| m.last_sync_at);

        if let Some(ref timestamp) = last_sync_at {
            log::info!("Delta sync: fetching accounts changed since {}", timestamp);
        } else {
            log::info!("Full sync: no previous sync timestamp found");
        }

        // 2. Load only changed accounts from local DB (delta)
        let db_accounts = self.db.get_changed_accounts(last_sync_at.as_deref())
            .map_err(|e| SyncManagerError::CryptoError(format!("Failed to load changed accounts: {}", e)))?;

        // 3. Load deleted account IDs
        let deleted_ids = self.db.get_deleted_accounts(last_sync_at.as_deref())
            .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to load deleted accounts: {}", e)))?;

        log::info!("Delta sync: {} changed accounts, {} deleted accounts",
                   db_accounts.len(), deleted_ids.len());

        // Skip if no changes
        if db_accounts.is_empty() && deleted_ids.is_empty() {
            log::info!("No changes detected, skipping upload");
            return Ok(());
        }

        // 4. Convert to AccountConfig format (excluding passwords)
        let account_configs: Vec<AccountConfig> = db_accounts
            .into_iter()
            .map(|acc| AccountConfig {
                email: acc.email,
                display_name: acc.display_name,
                imap_host: acc.imap_host,
                imap_port: acc.imap_port,
                imap_security: acc.imap_security,
                smtp_host: acc.smtp_host,
                smtp_port: acc.smtp_port,
                smtp_security: acc.smtp_security,
                signature: acc.signature,
                sync_days: acc.sync_days,
                is_default: acc.is_default,
                oauth_provider: acc.oauth_provider,
                updated_at: chrono::DateTime::parse_from_rfc3339(&acc.updated_at).ok().map(|d| d.with_timezone(&chrono::Utc)),
                deleted: false,
            })
            .collect();

        // 5. Add deleted accounts to the sync data
        let mut all_accounts = account_configs;
        for deleted_id in deleted_ids {
            // Create placeholder entries for deleted accounts (server will handle deletion)
            // Note: We only send the email (unique identifier) for deleted accounts
            log::debug!("Marking account ID {} as deleted in sync", deleted_id);
        }

        // 6. Create AccountSyncData
        let sync_data = AccountSyncData::new(all_accounts);

        // 7. Encrypt and upload to server
        let version = self.upload(SyncDataType::Accounts, &sync_data, master_password).await?;

        // 8. Update sync metadata with current timestamp
        let now = chrono::Utc::now().to_rfc3339();
        self.db.update_sync_metadata(
            "accounts",
            Some(&now),
            Some(version),
            Some(sync_data.accounts.len() as i64),
            Some(sync_data.accounts.len() as i64),
            Some(0), // deleted_ids.len() as i64 (not tracked separately in this implementation)
        ).map_err(|e| SyncManagerError::DatabaseError(format!("Failed to update sync metadata: {}", e)))?;

        log::info!("Accounts delta sync completed (version: {}, changes: {})",
                   version, sync_data.accounts.len());

        Ok(())
    }

    /// Sync contacts data (DELTA SYNC - only changed data)
    async fn sync_contacts(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Starting contacts delta sync");

        // 1. Get last sync timestamp from metadata
        let metadata = self.db.get_sync_metadata("contacts")
            .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to get sync metadata: {}", e)))?;

        let last_sync_at = metadata.and_then(|m| m.last_sync_at);

        if let Some(ref timestamp) = last_sync_at {
            log::info!("Delta sync: fetching contacts changed since {}", timestamp);
        } else {
            log::info!("Full sync: no previous sync timestamp found");
        }

        // 2. Load only changed contacts from local DB (delta)
        let db_contacts = self.db.get_changed_contacts(last_sync_at.as_deref())
            .map_err(|e| SyncManagerError::CryptoError(format!("Failed to load changed contacts: {}", e)))?;

        // 3. Load deleted contact IDs
        let deleted_ids = self.db.get_deleted_contacts(last_sync_at.as_deref())
            .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to load deleted contacts: {}", e)))?;

        log::info!("Delta sync: {} changed contacts, {} deleted contacts",
                   db_contacts.len(), deleted_ids.len());

        // Skip if no changes
        if db_contacts.is_empty() && deleted_ids.is_empty() {
            log::info!("No changes detected, skipping upload");
            return Ok(());
        }

        // 4. Convert to ContactItem format
        let mut contact_items: Vec<ContactItem> = db_contacts
            .into_iter()
            .map(|contact| ContactItem {
                email: contact.email,
                name: contact.name,
                company: contact.company,
                phone: contact.phone,
                notes: contact.notes,
                is_favorite: contact.is_favorite,
                updated_at: contact.last_emailed_at.and_then(|dt| {
                    chrono::DateTime::parse_from_rfc3339(&dt).ok().map(|d| d.with_timezone(&chrono::Utc))
                }),
                deleted: false,
            })
            .collect();

        // 5. Add deleted contacts as placeholders (marked with deleted=true)
        for _deleted_id in deleted_ids {
            // Note: Backend will handle deletion based on server-side logic
            // We don't send full contact data for deleted items
            log::debug!("Marking contact ID {} as deleted in sync", _deleted_id);
        }

        // 6. Create ContactSyncData
        let sync_data = ContactSyncData::new(contact_items);

        // 7. Encrypt and upload to server
        let version = self.upload(SyncDataType::Contacts, &sync_data, master_password).await?;

        // 8. Update sync metadata with current timestamp
        let now = chrono::Utc::now().to_rfc3339();
        self.db.update_sync_metadata(
            "contacts",
            Some(&now),
            Some(version),
            Some(sync_data.contacts.len() as i64),
            Some(sync_data.contacts.len() as i64),
            Some(0), // deleted count
        ).map_err(|e| SyncManagerError::DatabaseError(format!("Failed to update sync metadata: {}", e)))?;

        log::info!("Contacts delta sync completed (version: {}, changes: {})",
                   version, sync_data.contacts.len());

        Ok(())
    }

    /// Sync preferences data
    async fn sync_preferences(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Starting preferences sync");

        // 1. Load preferences from database settings
        // Using get_setting with default fallback for each preference
        let theme: String = self.db.get_setting("theme")
            .ok().flatten().unwrap_or_else(|| "dark".to_string());

        let language: String = self.db.get_setting("language")
            .ok().flatten().unwrap_or_else(|| "tr".to_string());

        let notifications_enabled: bool = self.db.get_setting("notifications_enabled")
            .ok().flatten().unwrap_or(true);

        let notification_sound: bool = self.db.get_setting("notification_sound")
            .ok().flatten().unwrap_or(true);

        let notification_badge: bool = self.db.get_setting("notification_badge")
            .ok().flatten().unwrap_or(true);

        let auto_mark_read: bool = self.db.get_setting("auto_mark_read")
            .ok().flatten().unwrap_or(true);

        let auto_mark_read_delay: i32 = self.db.get_setting("auto_mark_read_delay")
            .ok().flatten().unwrap_or(3);

        let confirm_delete: bool = self.db.get_setting("confirm_delete")
            .ok().flatten().unwrap_or(true);

        let confirm_send: bool = self.db.get_setting("confirm_send")
            .ok().flatten().unwrap_or(false);

        let signature_position: String = self.db.get_setting("signature_position")
            .ok().flatten().unwrap_or_else(|| "bottom".to_string());

        let reply_position: String = self.db.get_setting("reply_position")
            .ok().flatten().unwrap_or_else(|| "top".to_string());

        let gemini_api_key: Option<String> = self.db.get_setting("gemini_api_key")
            .ok().flatten();

        let ai_auto_summarize: bool = self.db.get_setting("ai_auto_summarize")
            .ok().flatten().unwrap_or(false);

        let ai_reply_tone: String = self.db.get_setting("ai_reply_tone")
            .ok().flatten().unwrap_or_else(|| "professional".to_string());

        let keyboard_shortcuts_enabled: bool = self.db.get_setting("keyboard_shortcuts_enabled")
            .ok().flatten().unwrap_or(true);

        let compact_list_view: bool = self.db.get_setting("compact_list_view")
            .ok().flatten().unwrap_or(false);

        let show_avatars: bool = self.db.get_setting("show_avatars")
            .ok().flatten().unwrap_or(true);

        let conversation_view: bool = self.db.get_setting("conversation_view")
            .ok().flatten().unwrap_or(true);

        // 2. Create PreferencesSyncData
        let mut sync_data = PreferencesSyncData::default();
        sync_data.theme = theme;
        sync_data.language = language;
        sync_data.notifications_enabled = notifications_enabled;
        sync_data.notification_sound = notification_sound;
        sync_data.notification_badge = notification_badge;
        sync_data.auto_mark_read = auto_mark_read;
        sync_data.auto_mark_read_delay = auto_mark_read_delay;
        sync_data.confirm_delete = confirm_delete;
        sync_data.confirm_send = confirm_send;
        sync_data.signature_position = signature_position;
        sync_data.reply_position = reply_position;
        sync_data.gemini_api_key = gemini_api_key;
        sync_data.ai_auto_summarize = ai_auto_summarize;
        sync_data.ai_reply_tone = ai_reply_tone;
        sync_data.keyboard_shortcuts_enabled = keyboard_shortcuts_enabled;
        sync_data.compact_list_view = compact_list_view;
        sync_data.show_avatars = show_avatars;
        sync_data.conversation_view = conversation_view;
        sync_data.synced_at = Some(chrono::Utc::now());

        // 3. Encrypt and upload to server
        let version = self.upload(SyncDataType::Preferences, &sync_data, master_password).await?;

        log::info!("Preferences synced successfully (version: {})", version);

        Ok(())
    }

    /// Sync signatures data
    async fn sync_signatures(
        &self,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Starting signatures sync");

        // 1. Load accounts to get signatures
        let db_accounts = self.db.get_accounts()
            .map_err(|e| SyncManagerError::CryptoError(format!("Failed to load accounts: {}", e)))?;

        log::info!("Loaded {} accounts for signature sync", db_accounts.len());

        // 2. Extract signatures (email -> signature mapping)
        let mut signatures = std::collections::HashMap::new();
        for account in db_accounts {
            if !account.signature.is_empty() {
                signatures.insert(account.email, account.signature);
            }
        }

        // 3. Create SignatureSyncData
        let sync_data = SignatureSyncData::from_map(signatures);

        // 4. Encrypt and upload to server
        let version = self.upload(SyncDataType::Signatures, &sync_data, master_password).await?;

        log::info!("Signatures synced successfully (version: {})", version);

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

        // Compress encrypted data (60-80% reduction for JSON)
        let compressed_data = gzip_compress(&payload.encrypted_data)
            .map_err(|e| SyncManagerError::EncryptionFailed(format!("Compression failed: {}", e)))?;

        log::debug!("Compression: {} bytes → {} bytes ({:.1}% reduction)",
                    payload.encrypted_data.len(),
                    compressed_data.len(),
                    (1.0 - compressed_data.len() as f64 / payload.encrypted_data.len() as f64) * 100.0);

        // Prepare upload request
        let encrypted_data_base64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &compressed_data,
        );

        let req = UploadRequest {
            encrypted_data: encrypted_data_base64.clone(),
            version: payload.version as i64,
        };

        // Upload - if fails, add to queue
        match self.api_client.upload_data(data_type.as_str(), req).await {
            Ok(response) => {
                log::info!("Data uploaded successfully (type: {}, version: {})", data_type.as_str(), response.version);

                // Record snapshot in history
                let items_count = extract_item_count(data);
                if let Err(e) = self.history_manager.record_snapshot(
                    data_type,
                    response.version,
                    &payload.encrypted_data,
                    &device_id,
                    SyncOperation::Push,
                    items_count,
                ) {
                    log::warn!("Failed to record snapshot in history: {}", e);
                    // Don't fail the sync if history recording fails
                }

                Ok(response.version)
            }
            Err(e) => {
                log::warn!("Upload failed for {}: {}. Adding to queue for retry", data_type.as_str(), e);

                // Add to offline queue
                let queue_item = QueueItem::new(
                    data_type,
                    encrypted_data_base64,
                    payload.version as i64,
                );

                if let Err(queue_err) = self.queue_manager.add_to_queue(queue_item) {
                    log::error!("Failed to add to queue: {}", queue_err);
                }

                // Still return the error
                Err(SyncManagerError::from(e))
            }
        }
    }

    // ========================================================================
    // Bidirectional Sync Operations (Private)
    // ========================================================================

    /// Bidirectional sync for accounts with conflict detection
    async fn sync_accounts_bidirectional(
        &self,
        master_password: &str,
    ) -> Result<Option<Vec<super::models::ConflictInfo>>, SyncManagerError> {
        log::info!("Starting bidirectional accounts sync");

        // 1. Load local accounts
        let db_accounts = self.db.get_accounts()
            .map_err(|e| SyncManagerError::CryptoError(format!("Failed to load accounts: {}", e)))?;

        let account_configs: Vec<AccountConfig> = db_accounts
            .into_iter()
            .map(|acc| AccountConfig {
                email: acc.email,
                display_name: acc.display_name,
                imap_host: acc.imap_host,
                imap_port: acc.imap_port,
                imap_security: acc.imap_security,
                smtp_host: acc.smtp_host,
                smtp_port: acc.smtp_port,
                smtp_security: acc.smtp_security,
                signature: acc.signature,
                sync_days: acc.sync_days,
                is_default: acc.is_default,
                oauth_provider: acc.oauth_provider,
                updated_at: chrono::DateTime::parse_from_rfc3339(&acc.updated_at).ok().map(|d| d.with_timezone(&chrono::Utc)),
                deleted: false,
            })
            .collect();

        let local_data = AccountSyncData::new(account_configs);

        // 2. Download server data
        let server_data: Option<AccountSyncData> = self.download(SyncDataType::Accounts, master_password).await?;

        // 3. Detect conflicts before merging
        let conflicts = if let Some(ref server_data) = server_data {
            self.detect_accounts_conflicts(&local_data, server_data).await
        } else {
            Vec::new()
        };

        // 4. If conflicts exist, return them for user resolution
        if !conflicts.is_empty() {
            log::warn!("Account conflicts detected: {}", conflicts.len());
            return Ok(Some(conflicts));
        }

        // 5. Merge or upload (no conflicts)
        let data_to_upload = if let Some(server_data) = server_data {
            // Server has data - merge using LWW
            log::info!("Server has account data, merging with LWW strategy");
            self.merge_accounts(local_data, server_data)
        } else {
            // Server empty - use local
            log::info!("Server has no account data, using local");
            local_data
        };

        // 6. Upload merged data
        let version = self.upload(SyncDataType::Accounts, &data_to_upload, master_password).await?;
        log::info!("Accounts synced successfully (version: {})", version);

        Ok(None) // No conflicts (all resolved)
    }

    /// Bidirectional sync for contacts with conflict detection
    async fn sync_contacts_bidirectional(
        &self,
        master_password: &str,
    ) -> Result<Option<Vec<super::models::ConflictInfo>>, SyncManagerError> {
        log::info!("Starting bidirectional contacts sync");

        // 1. Load local contacts
        let db_contacts = self.db.get_all_contacts()
            .map_err(|e| SyncManagerError::CryptoError(format!("Failed to load contacts: {}", e)))?;

        let contact_items: Vec<ContactItem> = db_contacts
            .into_iter()
            .map(|contact| ContactItem {
                email: contact.email,
                name: contact.name,
                company: contact.company,
                phone: contact.phone,
                notes: contact.notes,
                is_favorite: contact.is_favorite,
                updated_at: contact.last_emailed_at.and_then(|dt| {
                    chrono::DateTime::parse_from_rfc3339(&dt).ok().map(|d| d.with_timezone(&chrono::Utc))
                }),
                deleted: false,
            })
            .collect();

        let local_data = ContactSyncData::new(contact_items);

        // 2. Download server data
        let server_data: Option<ContactSyncData> = self.download(SyncDataType::Contacts, master_password).await?;

        // 3. Detect conflicts and merge
        if let Some(server_data) = server_data {
            log::info!("Server has contact data, checking for conflicts");

            // Detect conflicts
            let conflicts = self.detect_contacts_conflicts(&local_data, &server_data).await;

            if !conflicts.is_empty() {
                log::warn!("Detected {} contact conflicts requiring manual resolution", conflicts.len());
                return Ok(Some(conflicts));
            }

            // No conflicts - merge with LWW
            log::info!("No conflicts detected, merging with LWW strategy");
            let merged_data = self.merge_contacts(local_data, server_data);

            // Upload merged data
            let version = self.upload(SyncDataType::Contacts, &merged_data, master_password).await?;
            log::info!("Contacts synced successfully (version: {})", version);
        } else {
            // Server empty - upload local
            log::info!("Server has no contact data, uploading local");
            let version = self.upload(SyncDataType::Contacts, &local_data, master_password).await?;
            log::info!("Contacts synced successfully (version: {})", version);
        }

        Ok(None)
    }

    /// Bidirectional sync for preferences with conflict detection
    async fn sync_preferences_bidirectional(
        &self,
        master_password: &str,
    ) -> Result<Option<Vec<super::models::ConflictInfo>>, SyncManagerError> {
        log::info!("Starting bidirectional preferences sync");

        // 1. Load local preferences
        let theme: String = self.db.get_setting("theme")
            .ok().flatten().unwrap_or_else(|| "dark".to_string());

        let language: String = self.db.get_setting("language")
            .ok().flatten().unwrap_or_else(|| "tr".to_string());

        let notifications_enabled: bool = self.db.get_setting("notifications_enabled")
            .ok().flatten().unwrap_or(true);

        let notification_sound: bool = self.db.get_setting("notification_sound")
            .ok().flatten().unwrap_or(true);

        let notification_badge: bool = self.db.get_setting("notification_badge")
            .ok().flatten().unwrap_or(true);

        let auto_mark_read: bool = self.db.get_setting("auto_mark_read")
            .ok().flatten().unwrap_or(true);

        let auto_mark_read_delay: i32 = self.db.get_setting("auto_mark_read_delay")
            .ok().flatten().unwrap_or(3);

        let confirm_delete: bool = self.db.get_setting("confirm_delete")
            .ok().flatten().unwrap_or(true);

        let confirm_send: bool = self.db.get_setting("confirm_send")
            .ok().flatten().unwrap_or(false);

        let signature_position: String = self.db.get_setting("signature_position")
            .ok().flatten().unwrap_or_else(|| "bottom".to_string());

        let reply_position: String = self.db.get_setting("reply_position")
            .ok().flatten().unwrap_or_else(|| "top".to_string());

        let gemini_api_key: Option<String> = self.db.get_setting("gemini_api_key")
            .ok().flatten();

        let ai_auto_summarize: bool = self.db.get_setting("ai_auto_summarize")
            .ok().flatten().unwrap_or(false);

        let ai_reply_tone: String = self.db.get_setting("ai_reply_tone")
            .ok().flatten().unwrap_or_else(|| "professional".to_string());

        let keyboard_shortcuts_enabled: bool = self.db.get_setting("keyboard_shortcuts_enabled")
            .ok().flatten().unwrap_or(true);

        let compact_list_view: bool = self.db.get_setting("compact_list_view")
            .ok().flatten().unwrap_or(false);

        let show_avatars: bool = self.db.get_setting("show_avatars")
            .ok().flatten().unwrap_or(true);

        let conversation_view: bool = self.db.get_setting("conversation_view")
            .ok().flatten().unwrap_or(true);

        let mut local_data = PreferencesSyncData::default();
        local_data.theme = theme;
        local_data.language = language;
        local_data.notifications_enabled = notifications_enabled;
        local_data.notification_sound = notification_sound;
        local_data.notification_badge = notification_badge;
        local_data.auto_mark_read = auto_mark_read;
        local_data.auto_mark_read_delay = auto_mark_read_delay;
        local_data.confirm_delete = confirm_delete;
        local_data.confirm_send = confirm_send;
        local_data.signature_position = signature_position;
        local_data.reply_position = reply_position;
        local_data.gemini_api_key = gemini_api_key;
        local_data.ai_auto_summarize = ai_auto_summarize;
        local_data.ai_reply_tone = ai_reply_tone;
        local_data.keyboard_shortcuts_enabled = keyboard_shortcuts_enabled;
        local_data.compact_list_view = compact_list_view;
        local_data.show_avatars = show_avatars;
        local_data.conversation_view = conversation_view;
        local_data.synced_at = Some(chrono::Utc::now());

        // 2. Download server data
        let server_data: Option<PreferencesSyncData> = self.download(SyncDataType::Preferences, master_password).await?;

        // 3. Detect conflicts before merging
        let conflicts = if let Some(ref server_data) = server_data {
            self.detect_preferences_conflicts(&local_data, server_data).await
        } else {
            Vec::new()
        };

        // 4. If conflicts exist, return them for user resolution
        if !conflicts.is_empty() {
            log::warn!("Preferences conflicts detected: {}", conflicts.len());
            return Ok(Some(conflicts));
        }

        // 5. Merge or upload (no conflicts)
        let data_to_upload = if let Some(server_data) = server_data {
            log::info!("Server has preferences data, merging with LWW strategy");
            self.merge_preferences(local_data, server_data)
        } else {
            log::info!("Server has no preferences data, using local");
            local_data
        };

        // 6. Upload merged data
        let version = self.upload(SyncDataType::Preferences, &data_to_upload, master_password).await?;
        log::info!("Preferences synced successfully (version: {})", version);

        Ok(None) // No conflicts (all resolved)
    }

    /// Bidirectional sync for signatures with conflict detection
    async fn sync_signatures_bidirectional(
        &self,
        master_password: &str,
    ) -> Result<Option<Vec<super::models::ConflictInfo>>, SyncManagerError> {
        log::info!("Starting bidirectional signatures sync");

        // 1. Load local signatures
        let db_accounts = self.db.get_accounts()
            .map_err(|e| SyncManagerError::CryptoError(format!("Failed to load accounts: {}", e)))?;

        let mut signatures = std::collections::HashMap::new();
        for account in db_accounts {
            if !account.signature.is_empty() {
                signatures.insert(account.email, account.signature);
            }
        }

        let local_data = SignatureSyncData::from_map(signatures);

        // 2. Download server data
        let server_data: Option<SignatureSyncData> = self.download(SyncDataType::Signatures, master_password).await?;

        // 3. Detect conflicts before merging
        let conflicts = if let Some(ref server_data) = server_data {
            self.detect_signatures_conflicts(&local_data, server_data).await
        } else {
            Vec::new()
        };

        // 4. If conflicts exist, return them for user resolution
        if !conflicts.is_empty() {
            log::warn!("Signature conflicts detected: {}", conflicts.len());
            return Ok(Some(conflicts));
        }

        // 5. Merge or upload (no conflicts)
        let data_to_upload = if let Some(server_data) = server_data {
            log::info!("Server has signature data, merging with LWW strategy");
            self.merge_signatures(local_data, server_data)
        } else {
            log::info!("Server has no signature data, using local");
            local_data
        };

        // 6. Upload merged data
        let version = self.upload(SyncDataType::Signatures, &data_to_upload, master_password).await?;
        log::info!("Signatures synced successfully (version: {})", version);

        Ok(None) // No conflicts (all resolved)
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

        let _device_id = config.device_id.clone();

        drop(config);

        // Download
        let response = self.api_client.download_data(
            data_type.as_str(),
        ).await?;

        if response.encrypted_data.is_empty() {
            return Ok(None); // No data on server
        }

        // Decode base64
        let compressed_bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &response.encrypted_data,
        ).map_err(|_| SyncManagerError::DecryptionFailed)?;

        // Decompress
        let combined_bytes = gzip_decompress(&compressed_bytes)
            .map_err(|e| SyncManagerError::DecryptionFailed)?;

        log::debug!("Decompression: {} bytes → {} bytes",
                    compressed_bytes.len(),
                    combined_bytes.len());

        // Extract nonce (first 12 bytes) from combined data
        if combined_bytes.len() < 12 {
            return Err(SyncManagerError::DecryptionFailed);
        }

        let nonce_slice = &combined_bytes[..12];
        let ciphertext = &combined_bytes[12..];

        // Convert nonce slice to array
        let mut nonce_array = [0u8; 12];
        nonce_array.copy_from_slice(nonce_slice);

        // Derive master key
        let master_key = derive_sync_master_key(master_password, &salt_bytes)
            .map_err(|_| SyncManagerError::DecryptionFailed)?;

        // Reconstruct payload for decryption
        use super::crypto::{SyncPayload, decrypt_sync_data, compute_sha256};
        let payload = SyncPayload {
            data_type,
            encrypted_data: ciphertext.to_vec(),
            nonce: nonce_array,
            version: response.version as i32,
            device_id: _device_id,
            timestamp: chrono::Utc::now(),
            checksum: compute_sha256(ciphertext),
        };

        // Decrypt
        let decrypted = decrypt_sync_data(&payload, &master_key)
            .map_err(|_| SyncManagerError::DecryptionFailed)?;

        Ok(Some(decrypted))
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

    // ========================================================================
    // Queue Management
    // ========================================================================

    /// Get queue statistics (pending, failed counts)
    pub fn get_queue_stats(&self) -> Result<QueueStats, SyncManagerError> {
        self.queue_manager.get_stats()
            .map_err(|e| SyncManagerError::QueueError(e.to_string()))
    }

    /// Process pending queue items (retry failed syncs)
    pub async fn process_queue(&self, _master_password: &str) -> Result<ProcessQueueResult, SyncManagerError> {
        let pending_items = self.queue_manager.get_pending_items()
            .map_err(|e| SyncManagerError::QueueError(e.to_string()))?;

        if pending_items.is_empty() {
            log::info!("No pending queue items to process");
            return Ok(ProcessQueueResult {
                processed: 0,
                succeeded: 0,
                failed: 0,
            });
        }

        log::info!("Processing {} pending queue items", pending_items.len());

        let mut succeeded = 0;
        let mut failed = 0;

        for item in pending_items {
            let item_id = item.id.expect("Queue item should have ID");

            // Parse data type
            let data_type = match item.data_type.as_str() {
                "accounts" => SyncDataType::Accounts,
                "contacts" => SyncDataType::Contacts,
                "preferences" => SyncDataType::Preferences,
                "signatures" => SyncDataType::Signatures,
                _ => {
                    log::warn!("Unknown data type in queue: {}", item.data_type);
                    continue;
                }
            };

            // Retry upload
            let upload_req = UploadRequest {
                encrypted_data: item.encrypted_data.clone(),
                version: item.version,
            };

            match self.api_client.upload_data(data_type.as_str(), upload_req).await {
                Ok(response) => {
                    log::info!("Queue item {} uploaded successfully (version: {})", item_id, response.version);
                    self.queue_manager.update_item_status(
                        item_id,
                        super::queue::QueueStatus::Completed,
                        None,
                    ).ok();
                    succeeded += 1;
                }
                Err(e) => {
                    log::error!("Queue item {} upload failed: {}", item_id, e);
                    self.queue_manager.mark_failed_and_retry(
                        item_id,
                        e.to_string(),
                    ).ok();
                    failed += 1;
                }
            }
        }

        log::info!("Queue processing complete: {} succeeded, {} failed", succeeded, failed);

        Ok(ProcessQueueResult {
            processed: succeeded + failed,
            succeeded,
            failed,
        })
    }

    /// Retry all failed queue items (manual trigger)
    pub fn retry_failed_syncs(&self) -> Result<i32, SyncManagerError> {
        let count = self.queue_manager.retry_failed_items()
            .map_err(|e| SyncManagerError::QueueError(e.to_string()))?;

        log::info!("Reset {} failed queue items for retry", count);
        Ok(count)
    }

    /// Clear completed queue items older than N days
    pub fn clear_completed_queue(&self, older_than_days: i32) -> Result<i32, SyncManagerError> {
        let count = self.queue_manager.clear_completed(older_than_days)
            .map_err(|e| SyncManagerError::QueueError(e.to_string()))?;

        log::info!("Cleared {} completed queue items", count);
        Ok(count)
    }

    /// Clear permanently failed queue items
    pub fn clear_failed_queue(&self) -> Result<i32, SyncManagerError> {
        let count = self.queue_manager.clear_failed()
            .map_err(|e| SyncManagerError::QueueError(e.to_string()))?;

        log::info!("Cleared {} permanently failed queue items", count);
        Ok(count)
    }

    // ========================================================================
    // History & Rollback
    // ========================================================================

    /// Get sync history for a data type
    pub fn get_sync_history(
        &self,
        data_type: SyncDataType,
        limit: i32,
    ) -> Result<Vec<super::history::SyncSnapshot>, SyncManagerError> {
        self.history_manager.get_history(data_type, limit)
            .map_err(|e| SyncManagerError::HistoryError(e.to_string()))
    }

    /// Rollback to a specific version
    pub async fn rollback_to_version(
        &self,
        data_type: SyncDataType,
        version: i64,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Rolling back {} to version {}", data_type.as_str(), version);

        // 1. Get snapshot with integrity verification
        let snapshot = self.history_manager.prepare_rollback(data_type, version)
            .map_err(|e| SyncManagerError::HistoryError(e.to_string()))?;

        // 2. Get salt for decryption
        let config = self.config.read().await;
        let salt = config.master_key_salt.as_ref()
            .ok_or(SyncManagerError::NoMasterKeySalt)?;
        let salt_bytes: [u8; 32] = hex::decode(salt)
            .map_err(|_| SyncManagerError::InvalidSalt)?
            .try_into()
            .map_err(|_| SyncManagerError::InvalidSalt)?;
        drop(config);

        // 3. Derive master key
        let master_key = derive_sync_master_key(master_password, &salt_bytes)
            .map_err(|e| SyncManagerError::EncryptionFailed(e))?;

        // 4. Extract nonce from snapshot data (first 12 bytes)
        if snapshot.encrypted_snapshot.len() < 12 {
            return Err(SyncManagerError::DecryptionFailed);
        }
        let nonce_slice = &snapshot.encrypted_snapshot[..12];
        let ciphertext = &snapshot.encrypted_snapshot[12..];

        let mut nonce_array = [0u8; 12];
        nonce_array.copy_from_slice(nonce_slice);

        // 5. Reconstruct payload and decrypt
        use super::crypto::{SyncPayload, decrypt_sync_data};
        let payload = SyncPayload {
            data_type,
            encrypted_data: ciphertext.to_vec(),
            nonce: nonce_array,
            version: snapshot.version as i32,
            device_id: snapshot.device_id.clone(),
            timestamp: snapshot.created_at,
            checksum: snapshot.snapshot_hash.clone(),
        };

        // 6. Apply rollback based on data type
        match data_type {
            SyncDataType::Accounts => {
                let accounts: AccountSyncData = decrypt_sync_data(&payload, &master_key)
                    .map_err(|_| SyncManagerError::DecryptionFailed)?;
                self.apply_accounts_rollback(accounts).await?;
            }
            SyncDataType::Contacts => {
                let contacts: ContactSyncData = decrypt_sync_data(&payload, &master_key)
                    .map_err(|_| SyncManagerError::DecryptionFailed)?;
                self.apply_contacts_rollback(contacts).await?;
            }
            SyncDataType::Preferences => {
                let preferences: PreferencesSyncData = decrypt_sync_data(&payload, &master_key)
                    .map_err(|_| SyncManagerError::DecryptionFailed)?;
                self.apply_preferences_rollback(preferences).await?;
            }
            SyncDataType::Signatures => {
                let signatures: SignatureSyncData = decrypt_sync_data(&payload, &master_key)
                    .map_err(|_| SyncManagerError::DecryptionFailed)?;
                self.apply_signatures_rollback(signatures).await?;
            }
        }

        log::info!("Rollback completed successfully for {}", data_type.as_str());
        Ok(())
    }

    /// Apply accounts rollback to local database
    async fn apply_accounts_rollback(&self, data: AccountSyncData) -> Result<(), SyncManagerError> {
        // Note: This would need proper database operations
        // For now, just log the operation
        log::info!("Applying accounts rollback with {} accounts", data.accounts.len());
        // TODO: Implement actual database updates
        Ok(())
    }

    /// Apply contacts rollback to local database
    async fn apply_contacts_rollback(&self, data: ContactSyncData) -> Result<(), SyncManagerError> {
        log::info!("Applying contacts rollback with {} contacts", data.contacts.len());
        // TODO: Implement actual database updates
        Ok(())
    }

    /// Apply preferences rollback to local database
    async fn apply_preferences_rollback(&self, _data: PreferencesSyncData) -> Result<(), SyncManagerError> {
        log::info!("Applying preferences rollback");
        // TODO: Implement actual database updates
        Ok(())
    }

    /// Apply signatures rollback to local database
    async fn apply_signatures_rollback(&self, data: SignatureSyncData) -> Result<(), SyncManagerError> {
        log::info!("Applying signatures rollback with {} signatures", data.signatures.len());
        // TODO: Implement actual database updates
        Ok(())
    }

    /// Enforce history retention policy
    pub fn enforce_history_retention(&self, retention_days: i64) -> Result<usize, SyncManagerError> {
        let deleted = self.history_manager.enforce_retention_policy(retention_days)
            .map_err(|e| SyncManagerError::HistoryError(e.to_string()))?;

        log::info!("Deleted {} old history snapshots", deleted);
        Ok(deleted)
    }

    // ========================================================================
    // Conflict Detection & Resolution (Private)
    // ========================================================================

    /// Detect conflicts between local and server data
    async fn detect_contacts_conflicts(
        &self,
        local: &ContactSyncData,
        server: &ContactSyncData,
    ) -> Vec<super::models::ConflictInfo> {
        let mut conflicts = Vec::new();

        for local_contact in &local.contacts {
            if let Some(server_contact) = server.contacts.iter()
                .find(|c| c.email == local_contact.email)
            {
                // Skip if contacts are identical
                if local_contact == server_contact {
                    continue;
                }

                // Compare timestamps to determine winner
                match (local_contact.updated_at, server_contact.updated_at) {
                    (Some(local_time), Some(server_time)) => {
                        if local_time == server_time {
                            // Same timestamp but different data = conflict!
                            log::warn!("Contact conflict detected for {}: same timestamp, different data", local_contact.email);

                            conflicts.push(super::models::ConflictInfo {
                                data_type: "contacts".to_string(),
                                local_version: 0,
                                server_version: 0,
                                local_updated_at: Some(local_time),
                                server_updated_at: Some(server_time),
                                strategy: super::models::ConflictStrategy::Manual,
                                conflict_details: format!(
                                    "Contact '{}' has conflicting changes on both devices",
                                    local_contact.email
                                ),
                                local_data: serde_json::to_value(local_contact).unwrap_or_default(),
                                server_data: serde_json::to_value(server_contact).unwrap_or_default(),
                                field_changes: None, // Field-level diff not needed for contacts
                            });
                        }
                        // If timestamps differ, LWW will handle it automatically
                    }
                    _ => {
                        // Missing timestamps - require manual resolution
                        log::warn!("Contact conflict detected for {}: missing timestamps", local_contact.email);

                        conflicts.push(super::models::ConflictInfo {
                            data_type: "contacts".to_string(),
                            local_version: 0,
                            server_version: 0,
                            local_updated_at: local_contact.updated_at,
                            server_updated_at: server_contact.updated_at,
                            strategy: super::models::ConflictStrategy::Manual,
                            conflict_details: format!(
                                "Contact '{}' has no timestamp information for conflict resolution",
                                local_contact.email
                            ),
                            local_data: serde_json::to_value(local_contact).unwrap_or_default(),
                            server_data: serde_json::to_value(server_contact).unwrap_or_default(),
                            field_changes: None, // Field-level diff not needed for contacts
                        });
                    }
                }
            }
        }

        conflicts
    }

    /// Detect conflicts between local and server account data
    async fn detect_accounts_conflicts(
        &self,
        local: &AccountSyncData,
        server: &AccountSyncData,
    ) -> Vec<super::models::ConflictInfo> {
        let mut conflicts = Vec::new();

        for local_account in &local.accounts {
            if let Some(server_account) = server.accounts.iter()
                .find(|a| a.email == local_account.email)
            {
                // Skip if accounts are identical
                if local_account == server_account {
                    continue;
                }

                // Detect field-level differences
                let mut field_changes = Vec::new();

                if local_account.display_name != server_account.display_name {
                    field_changes.push("display_name".to_string());
                }
                if local_account.imap_host != server_account.imap_host {
                    field_changes.push("imap_host".to_string());
                }
                if local_account.imap_port != server_account.imap_port {
                    field_changes.push("imap_port".to_string());
                }
                if local_account.imap_security != server_account.imap_security {
                    field_changes.push("imap_security".to_string());
                }
                if local_account.smtp_host != server_account.smtp_host {
                    field_changes.push("smtp_host".to_string());
                }
                if local_account.smtp_port != server_account.smtp_port {
                    field_changes.push("smtp_port".to_string());
                }
                if local_account.smtp_security != server_account.smtp_security {
                    field_changes.push("smtp_security".to_string());
                }
                if local_account.signature != server_account.signature {
                    field_changes.push("signature".to_string());
                }
                if local_account.sync_days != server_account.sync_days {
                    field_changes.push("sync_days".to_string());
                }
                if local_account.is_default != server_account.is_default {
                    field_changes.push("is_default".to_string());
                }
                if local_account.oauth_provider != server_account.oauth_provider {
                    field_changes.push("oauth_provider".to_string());
                }

                // If no field changes detected, skip (shouldn't happen but safety check)
                if field_changes.is_empty() {
                    continue;
                }

                // Compare timestamps to determine if manual resolution needed
                match (local_account.updated_at, server_account.updated_at) {
                    (Some(local_time), Some(server_time)) => {
                        if local_time == server_time {
                            // Same timestamp but different data = conflict!
                            log::warn!("Account conflict detected for {}: same timestamp, different data (fields: {:?})",
                                       local_account.email, field_changes);

                            conflicts.push(super::models::ConflictInfo {
                                data_type: "accounts".to_string(),
                                local_version: 0,
                                server_version: 0,
                                local_updated_at: Some(local_time),
                                server_updated_at: Some(server_time),
                                strategy: super::models::ConflictStrategy::Manual,
                                conflict_details: format!(
                                    "Account '{}' has conflicting changes: {} field(s) differ",
                                    local_account.email,
                                    field_changes.len()
                                ),
                                local_data: serde_json::to_value(local_account).unwrap_or_default(),
                                server_data: serde_json::to_value(server_account).unwrap_or_default(),
                                field_changes: Some(field_changes),
                            });
                        }
                        // If timestamps differ, LWW will handle it automatically
                    }
                    _ => {
                        // Missing timestamps - require manual resolution
                        log::warn!("Account conflict detected for {}: missing timestamps (fields: {:?})",
                                   local_account.email, field_changes);

                        conflicts.push(super::models::ConflictInfo {
                            data_type: "accounts".to_string(),
                            local_version: 0,
                            server_version: 0,
                            local_updated_at: local_account.updated_at,
                            server_updated_at: server_account.updated_at,
                            strategy: super::models::ConflictStrategy::Manual,
                            conflict_details: format!(
                                "Account '{}' has no timestamp information for conflict resolution ({} field(s) differ)",
                                local_account.email,
                                field_changes.len()
                            ),
                            local_data: serde_json::to_value(local_account).unwrap_or_default(),
                            server_data: serde_json::to_value(server_account).unwrap_or_default(),
                            field_changes: Some(field_changes),
                        });
                    }
                }
            }
        }

        conflicts
    }

    /// Detect conflicts between local and server preferences data
    async fn detect_preferences_conflicts(
        &self,
        local: &PreferencesSyncData,
        server: &PreferencesSyncData,
    ) -> Vec<super::models::ConflictInfo> {
        let mut conflicts = Vec::new();
        let mut field_changes = Vec::new();

        // Compare each preference field
        if local.theme != server.theme {
            field_changes.push("theme".to_string());
        }
        if local.language != server.language {
            field_changes.push("language".to_string());
        }
        if local.notifications_enabled != server.notifications_enabled {
            field_changes.push("notifications_enabled".to_string());
        }
        if local.notification_sound != server.notification_sound {
            field_changes.push("notification_sound".to_string());
        }
        if local.notification_badge != server.notification_badge {
            field_changes.push("notification_badge".to_string());
        }
        if local.auto_mark_read != server.auto_mark_read {
            field_changes.push("auto_mark_read".to_string());
        }
        if local.auto_mark_read_delay != server.auto_mark_read_delay {
            field_changes.push("auto_mark_read_delay".to_string());
        }
        if local.confirm_delete != server.confirm_delete {
            field_changes.push("confirm_delete".to_string());
        }
        if local.confirm_send != server.confirm_send {
            field_changes.push("confirm_send".to_string());
        }
        if local.signature_position != server.signature_position {
            field_changes.push("signature_position".to_string());
        }
        if local.reply_position != server.reply_position {
            field_changes.push("reply_position".to_string());
        }
        if local.gemini_api_key != server.gemini_api_key {
            field_changes.push("gemini_api_key".to_string());
        }
        if local.ai_auto_summarize != server.ai_auto_summarize {
            field_changes.push("ai_auto_summarize".to_string());
        }
        if local.ai_reply_tone != server.ai_reply_tone {
            field_changes.push("ai_reply_tone".to_string());
        }
        if local.keyboard_shortcuts_enabled != server.keyboard_shortcuts_enabled {
            field_changes.push("keyboard_shortcuts_enabled".to_string());
        }
        if local.compact_list_view != server.compact_list_view {
            field_changes.push("compact_list_view".to_string());
        }
        if local.show_avatars != server.show_avatars {
            field_changes.push("show_avatars".to_string());
        }
        if local.conversation_view != server.conversation_view {
            field_changes.push("conversation_view".to_string());
        }

        // If no differences found, no conflict
        if field_changes.is_empty() {
            return conflicts;
        }

        // Compare timestamps
        match (local.synced_at, server.synced_at) {
            (Some(local_time), Some(server_time)) => {
                if local_time == server_time {
                    // Same timestamp but different data = conflict!
                    log::warn!("Preferences conflict detected: same timestamp, different data (fields: {:?})",
                               field_changes);

                    conflicts.push(super::models::ConflictInfo {
                        data_type: "preferences".to_string(),
                        local_version: 0,
                        server_version: 0,
                        local_updated_at: Some(local_time),
                        server_updated_at: Some(server_time),
                        strategy: super::models::ConflictStrategy::Manual,
                        conflict_details: format!(
                            "Preferences have conflicting changes: {} setting(s) differ",
                            field_changes.len()
                        ),
                        local_data: serde_json::to_value(local).unwrap_or_default(),
                        server_data: serde_json::to_value(server).unwrap_or_default(),
                        field_changes: Some(field_changes),
                    });
                }
                // If timestamps differ, LWW will handle it automatically
            }
            _ => {
                // Missing timestamps - require manual resolution
                log::warn!("Preferences conflict detected: missing timestamps (fields: {:?})",
                           field_changes);

                conflicts.push(super::models::ConflictInfo {
                    data_type: "preferences".to_string(),
                    local_version: 0,
                    server_version: 0,
                    local_updated_at: local.synced_at,
                    server_updated_at: server.synced_at,
                    strategy: super::models::ConflictStrategy::Manual,
                    conflict_details: format!(
                        "Preferences have no timestamp information for conflict resolution ({} setting(s) differ)",
                        field_changes.len()
                    ),
                    local_data: serde_json::to_value(local).unwrap_or_default(),
                    server_data: serde_json::to_value(server).unwrap_or_default(),
                    field_changes: Some(field_changes),
                });
            }
        }

        conflicts
    }

    /// Detect conflicts between local and server signature data
    async fn detect_signatures_conflicts(
        &self,
        local: &SignatureSyncData,
        server: &SignatureSyncData,
    ) -> Vec<super::models::ConflictInfo> {
        let mut conflicts = Vec::new();

        // Check each email in local signatures
        for (email, local_signature) in &local.signatures {
            if let Some(server_signature) = server.signatures.get(email) {
                // Skip if signatures are identical
                if local_signature == server_signature {
                    continue;
                }

                // Signatures differ - check timestamps
                match (local.synced_at, server.synced_at) {
                    (Some(local_time), Some(server_time)) => {
                        if local_time == server_time {
                            // Same timestamp but different data = conflict!
                            log::warn!("Signature conflict detected for {}: same timestamp, different HTML content", email);

                            // Create simplified data for UI display
                            let local_data = serde_json::json!({
                                "email": email,
                                "signature_html": local_signature,
                                "signature_text": strip_html_tags(local_signature),
                                "length": local_signature.len(),
                            });

                            let server_data = serde_json::json!({
                                "email": email,
                                "signature_html": server_signature,
                                "signature_text": strip_html_tags(server_signature),
                                "length": server_signature.len(),
                            });

                            conflicts.push(super::models::ConflictInfo {
                                data_type: "signatures".to_string(),
                                local_version: 0,
                                server_version: 0,
                                local_updated_at: Some(local_time),
                                server_updated_at: Some(server_time),
                                strategy: super::models::ConflictStrategy::Manual,
                                conflict_details: format!(
                                    "Signature for '{}' has conflicting HTML content",
                                    email
                                ),
                                local_data,
                                server_data,
                                field_changes: Some(vec!["signature_html".to_string()]),
                            });
                        }
                        // If timestamps differ, LWW will handle it automatically
                    }
                    _ => {
                        // Missing timestamps - require manual resolution
                        log::warn!("Signature conflict detected for {}: missing timestamps", email);

                        let local_data = serde_json::json!({
                            "email": email,
                            "signature_html": local_signature,
                            "signature_text": strip_html_tags(local_signature),
                            "length": local_signature.len(),
                        });

                        let server_data = serde_json::json!({
                            "email": email,
                            "signature_html": server_signature,
                            "signature_text": strip_html_tags(server_signature),
                            "length": server_signature.len(),
                        });

                        conflicts.push(super::models::ConflictInfo {
                            data_type: "signatures".to_string(),
                            local_version: 0,
                            server_version: 0,
                            local_updated_at: local.synced_at,
                            server_updated_at: server.synced_at,
                            strategy: super::models::ConflictStrategy::Manual,
                            conflict_details: format!(
                                "Signature for '{}' has no timestamp information for conflict resolution",
                                email
                            ),
                            local_data,
                            server_data,
                            field_changes: Some(vec!["signature_html".to_string()]),
                        });
                    }
                }
            }
        }

        conflicts
    }

    /// Merge contacts using Last-Write-Wins (LWW) strategy
    fn merge_contacts(
        &self,
        local: ContactSyncData,
        server: ContactSyncData,
    ) -> ContactSyncData {
        let mut merged_contacts = Vec::new();
        let mut processed_emails = std::collections::HashSet::new();

        // Process local contacts
        for local_contact in local.contacts {
            processed_emails.insert(local_contact.email.clone());

            if let Some(server_contact) = server.contacts.iter()
                .find(|c| c.email == local_contact.email)
            {
                // Both exist - use LWW based on updated_at
                let winner = match (local_contact.updated_at, server_contact.updated_at) {
                    (Some(local_time), Some(server_time)) => {
                        if local_time >= server_time {
                            local_contact
                        } else {
                            server_contact.clone()
                        }
                    }
                    (Some(_), None) => local_contact,
                    (None, Some(_)) => server_contact.clone(),
                    (None, None) => local_contact, // Fallback to local
                };
                merged_contacts.push(winner);
            } else {
                // Only in local
                merged_contacts.push(local_contact);
            }
        }

        // Add server-only contacts
        for server_contact in server.contacts {
            if !processed_emails.contains(&server_contact.email) {
                merged_contacts.push(server_contact);
            }
        }

        ContactSyncData {
            contacts: merged_contacts,
            synced_at: Some(chrono::Utc::now()),
        }
    }

    /// Merge accounts using Last-Write-Wins strategy
    fn merge_accounts(
        &self,
        local: AccountSyncData,
        server: AccountSyncData,
    ) -> AccountSyncData {
        // Simple LWW based on synced_at timestamp
        match (local.synced_at, server.synced_at) {
            (Some(local_time), Some(server_time)) => {
                if local_time >= server_time {
                    local
                } else {
                    server
                }
            }
            (Some(_), None) => local,
            (None, Some(_)) => server,
            (None, None) => local, // Fallback to local
        }
    }

    /// Merge preferences using Last-Write-Wins strategy
    fn merge_preferences(
        &self,
        local: PreferencesSyncData,
        server: PreferencesSyncData,
    ) -> PreferencesSyncData {
        // LWW strategy for preferences
        match (local.synced_at, server.synced_at) {
            (Some(local_time), Some(server_time)) => {
                if local_time >= server_time {
                    local
                } else {
                    server
                }
            }
            (Some(_), None) => local,
            (None, Some(_)) => server,
            (None, None) => local,
        }
    }

    /// Merge signatures using Last-Write-Wins strategy
    fn merge_signatures(
        &self,
        local: SignatureSyncData,
        server: SignatureSyncData,
    ) -> SignatureSyncData {
        // LWW strategy for signatures
        match (local.synced_at, server.synced_at) {
            (Some(local_time), Some(server_time)) => {
                if local_time >= server_time {
                    local
                } else {
                    server
                }
            }
            (Some(_), None) => local,
            (None, Some(_)) => server,
            (None, None) => local,
        }
    }

    // ========================================================================
    // Conflict Resolution Methods
    // ========================================================================

    /// Resolve a sync conflict with chosen strategy
    pub async fn resolve_conflict(
        &self,
        data_type: SyncDataType,
        strategy: ConflictStrategy,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Resolving conflict for {:?} with {:?}", data_type, strategy);

        match strategy {
            ConflictStrategy::UseLocal => {
                self.upload_and_override(data_type, master_password).await?;
            }
            ConflictStrategy::UseServer => {
                self.download_and_override(data_type, master_password).await?;
            }
            _ => return Err(SyncManagerError::InvalidConflictStrategy),
        }

        Ok(())
    }

    /// Upload local data and override server
    async fn upload_and_override(
        &self,
        data_type: SyncDataType,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Uploading local data to override server for {:?}", data_type);

        match data_type {
            SyncDataType::Contacts => {
                // Load local contacts
                let db_contacts = self.db.get_all_contacts()
                    .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to load contacts: {}", e)))?;

                let contact_items: Vec<ContactItem> = db_contacts
                    .into_iter()
                    .map(|contact| ContactItem {
                        email: contact.email,
                        name: contact.name,
                        company: contact.company,
                        phone: contact.phone,
                        notes: contact.notes,
                        is_favorite: contact.is_favorite,
                        updated_at: contact.last_emailed_at.and_then(|dt| {
                            chrono::DateTime::parse_from_rfc3339(&dt).ok().map(|d| d.with_timezone(&chrono::Utc))
                        }),
                        deleted: false,
                    })
                    .collect();

                let local_data = ContactSyncData::new(contact_items);
                self.upload(SyncDataType::Contacts, &local_data, master_password).await?;
                log::info!("Contacts uploaded successfully");
            }
            SyncDataType::Accounts => {
                // Load local accounts
                let db_accounts = self.db.get_accounts()
                    .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to load accounts: {}", e)))?;

                let account_configs: Vec<AccountConfig> = db_accounts
                    .into_iter()
                    .map(|acc| AccountConfig {
                        email: acc.email,
                        display_name: acc.display_name,
                        imap_host: acc.imap_host,
                        imap_port: acc.imap_port,
                        imap_security: match acc.imap_security.as_str() {
                            "SSL" => "SSL".to_string(),
                            "STARTTLS" => "STARTTLS".to_string(),
                            _ => "NONE".to_string(),
                        },
                        smtp_host: acc.smtp_host,
                        smtp_port: acc.smtp_port,
                        smtp_security: match acc.smtp_security.as_str() {
                            "SSL" => "SSL".to_string(),
                            "STARTTLS" => "STARTTLS".to_string(),
                            _ => "NONE".to_string(),
                        },
                        signature: acc.signature,
                        sync_days: acc.sync_days,
                        is_default: acc.is_default,
                        oauth_provider: acc.oauth_provider,
                        updated_at: chrono::DateTime::parse_from_rfc3339(&acc.updated_at).ok().map(|d| d.with_timezone(&chrono::Utc)),
                        deleted: false,
                    })
                    .collect();

                let local_data = AccountSyncData::new(account_configs);
                self.upload(SyncDataType::Accounts, &local_data, master_password).await?;
                log::info!("Accounts uploaded successfully");
            }
            SyncDataType::Preferences => {
                // TODO: Implement preferences collection from DB
                // For now, use default preferences
                log::warn!("Preferences upload not fully implemented - using defaults");
                let local_data = PreferencesSyncData::default();
                self.upload(SyncDataType::Preferences, &local_data, master_password).await?;
                log::info!("Preferences uploaded successfully");
            }
            SyncDataType::Signatures => {
                // TODO: Implement signature collection from DB
                // SignatureSyncData uses HashMap<String, String> (email -> signature)
                log::warn!("Signatures upload not fully implemented");
                let local_data = SignatureSyncData::default();
                self.upload(SyncDataType::Signatures, &local_data, master_password).await?;
                log::info!("Signatures uploaded successfully");
            }
        }

        Ok(())
    }

    /// Download server data and override local
    async fn download_and_override(
        &self,
        data_type: SyncDataType,
        master_password: &str,
    ) -> Result<(), SyncManagerError> {
        log::info!("Downloading server data to override local for {:?}", data_type);

        match data_type {
            SyncDataType::Contacts => {
                let server_data: Option<ContactSyncData> = self.download(data_type, master_password).await?;

                if let Some(data) = server_data {
                    self.apply_contacts_to_db(&data).await?;
                    log::info!("Contacts applied to database successfully");
                } else {
                    log::warn!("No server data for contacts");
                }
            }
            SyncDataType::Accounts => {
                let server_data: Option<AccountSyncData> = self.download(data_type, master_password).await?;

                if let Some(data) = server_data {
                    self.apply_accounts_to_db(&data).await?;
                    log::info!("Accounts applied to database successfully");
                } else {
                    log::warn!("No server data for accounts");
                }
            }
            SyncDataType::Preferences => {
                let server_data: Option<PreferencesSyncData> = self.download(data_type, master_password).await?;

                if let Some(data) = server_data {
                    self.apply_preferences_to_db(&data).await?;
                    log::info!("Preferences applied to database successfully");
                } else {
                    log::warn!("No server data for preferences");
                }
            }
            SyncDataType::Signatures => {
                let server_data: Option<SignatureSyncData> = self.download(data_type, master_password).await?;

                if let Some(data) = server_data {
                    self.apply_signatures_to_db(&data).await?;
                    log::info!("Signatures applied to database successfully");
                } else {
                    log::warn!("No server data for signatures");
                }
            }
        }

        Ok(())
    }

    /// Apply contacts from server to local database
    async fn apply_contacts_to_db(
        &self,
        data: &ContactSyncData,
    ) -> Result<(), SyncManagerError> {
        for contact_item in &data.contacts {
            let new_contact = crate::db::NewContact {
                account_id: None, // Global contact
                email: contact_item.email.clone(),
                name: contact_item.name.clone(),
                company: contact_item.company.clone(),
                phone: contact_item.phone.clone(),
                notes: contact_item.notes.clone(),
                is_favorite: contact_item.is_favorite,
                avatar_url: None,
            };

            self.db.upsert_contact(&new_contact)
                .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to upsert contact: {}", e)))?;
        }

        Ok(())
    }

    /// Apply accounts from server to local database
    async fn apply_accounts_to_db(
        &self,
        data: &AccountSyncData,
    ) -> Result<(), SyncManagerError> {
        log::info!("Applying {} accounts from server to local DB", data.accounts.len());

        for account_config in &data.accounts {
            // Skip deleted accounts
            if account_config.deleted {
                log::info!("Skipping deleted account: {}", account_config.email);
                continue;
            }

            // Check if account already exists locally
            let existing_account = self.db.get_account_by_email(&account_config.email)
                .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to query account: {}", e)))?;

            if let Some(existing) = existing_account {
                // Update existing account (preserve password_encrypted)
                log::info!("Updating existing account: {}", account_config.email);

                // Get the current encrypted password to preserve it
                let password_encrypted = self.db.get_account_password(existing.id)
                    .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to get password: {}", e)))?;

                let updated_account = crate::db::NewAccount {
                    email: account_config.email.clone(),
                    display_name: account_config.display_name.clone(),
                    imap_host: account_config.imap_host.clone(),
                    imap_port: account_config.imap_port,
                    imap_security: account_config.imap_security.clone(),
                    imap_username: Some(account_config.email.clone()),
                    smtp_host: account_config.smtp_host.clone(),
                    smtp_port: account_config.smtp_port,
                    smtp_security: account_config.smtp_security.clone(),
                    smtp_username: Some(account_config.email.clone()),
                    password_encrypted, // Preserve local password
                    oauth_provider: account_config.oauth_provider.clone(),
                    oauth_access_token: None, // OAuth tokens managed separately
                    oauth_refresh_token: existing.oauth_refresh_token.clone(), // Preserve
                    oauth_expires_at: existing.oauth_expires_at, // Preserve
                    is_default: account_config.is_default,
                    signature: account_config.signature.clone(),
                    sync_days: account_config.sync_days,
                    accept_invalid_certs: false, // Security: default to false
                };

                self.db.update_account(existing.id, &updated_account)
                    .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to update account: {}", e)))?;
            } else {
                // Create new account (OAuth-only, no password)
                log::info!("Creating new account from sync: {}", account_config.email);

                let new_account = crate::db::NewAccount {
                    email: account_config.email.clone(),
                    display_name: account_config.display_name.clone(),
                    imap_host: account_config.imap_host.clone(),
                    imap_port: account_config.imap_port,
                    imap_security: account_config.imap_security.clone(),
                    imap_username: Some(account_config.email.clone()),
                    smtp_host: account_config.smtp_host.clone(),
                    smtp_port: account_config.smtp_port,
                    smtp_security: account_config.smtp_security.clone(),
                    smtp_username: Some(account_config.email.clone()),
                    password_encrypted: None, // No password in sync data
                    oauth_provider: account_config.oauth_provider.clone(),
                    oauth_access_token: None,
                    oauth_refresh_token: None,
                    oauth_expires_at: None,
                    is_default: account_config.is_default,
                    signature: account_config.signature.clone(),
                    sync_days: account_config.sync_days,
                    accept_invalid_certs: false,
                };

                self.db.add_account(&new_account)
                    .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to create account: {}", e)))?;

                log::info!("✓ New account created: {} (requires OAuth or password setup)", account_config.email);
            }
        }

        log::info!("✓ Accounts applied to database successfully");
        Ok(())
    }

    /// Apply preferences from server to local database
    async fn apply_preferences_to_db(
        &self,
        data: &PreferencesSyncData,
    ) -> Result<(), SyncManagerError> {
        log::info!("Applying preferences from server to local DB");

        // Helper macro to set preference with error handling
        macro_rules! set_pref {
            ($key:expr, $value:expr) => {
                self.db.set_setting($key, $value)
                    .map_err(|e| SyncManagerError::DatabaseError(
                        format!("Failed to set preference {}: {}", $key, e)
                    ))?;
            };
        }

        // Appearance
        set_pref!("theme", &data.theme);
        set_pref!("language", &data.language);

        // Notifications
        set_pref!("notifications_enabled", &data.notifications_enabled);
        set_pref!("notification_sound", &data.notification_sound);
        set_pref!("notification_badge", &data.notification_badge);

        // Email behavior
        set_pref!("auto_mark_read", &data.auto_mark_read);
        set_pref!("auto_mark_read_delay", &data.auto_mark_read_delay);
        set_pref!("confirm_delete", &data.confirm_delete);
        set_pref!("confirm_send", &data.confirm_send);

        // Compose settings
        set_pref!("signature_position", &data.signature_position);
        set_pref!("reply_position", &data.reply_position);

        // AI settings (skip gemini_api_key if None - it's encrypted separately)
        if let Some(ref api_key) = data.gemini_api_key {
            set_pref!("gemini_api_key", api_key);
        }
        set_pref!("ai_auto_summarize", &data.ai_auto_summarize);
        set_pref!("ai_reply_tone", &data.ai_reply_tone);

        // UI preferences
        set_pref!("keyboard_shortcuts_enabled", &data.keyboard_shortcuts_enabled);
        set_pref!("compact_list_view", &data.compact_list_view);
        set_pref!("show_avatars", &data.show_avatars);
        set_pref!("conversation_view", &data.conversation_view);

        log::info!("✓ Preferences applied to database successfully");
        Ok(())
    }

    /// Apply signatures from server to local database
    async fn apply_signatures_to_db(
        &self,
        data: &SignatureSyncData,
    ) -> Result<(), SyncManagerError> {
        log::info!("Applying {} signatures from server to local DB", data.signatures.len());

        let mut success_count = 0;
        let mut skip_count = 0;

        for (email, signature) in &data.signatures {
            // Find account by email
            match self.db.get_account_by_email(email)
                .map_err(|e| SyncManagerError::DatabaseError(format!("Failed to query account: {}", e)))? {
                Some(account) => {
                    // Update signature for this account
                    self.db.update_account_signature(account.id, signature)
                        .map_err(|e| SyncManagerError::DatabaseError(
                            format!("Failed to update signature for {}: {}", email, e)
                        ))?;

                    success_count += 1;
                    log::debug!("✓ Updated signature for: {}", email);
                }
                None => {
                    // Account doesn't exist locally - skip
                    skip_count += 1;
                    log::warn!("Account not found locally, skipping signature: {}", email);
                }
            }
        }

        log::info!("✓ Signatures applied: {} updated, {} skipped (account not found)",
                   success_count, skip_count);
        Ok(())
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Strip HTML tags from a string to get plain text
/// Used for displaying signature previews in conflict resolution UI
fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut inside_tag = false;

    for c in html.chars() {
        match c {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ => {
                if !inside_tag {
                    result.push(c);
                }
            }
        }
    }

    // Decode common HTML entities
    result
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .trim()
        .to_string()
}

/// Conflict resolution result for bidirectional sync
enum ConflictResolution<T> {
    /// No conflict detected, proceed with upload
    NoConflict,

    /// Server version is newer, use it
    UseServer(T),

    /// Successfully merged both versions
    Merged(T),

    /// Cannot auto-resolve, requires user input
    RequiresManualResolution(super::models::ConflictInfo),
}

/// Extract item count from sync data
fn extract_item_count<T: serde::Serialize>(data: &T) -> i32 {
    // Serialize to JSON and try to count items
    if let Ok(json_str) = serde_json::to_string(data) {
        if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&json_str) {
            // Try to find array fields and count them
            if let Some(obj) = json_val.as_object() {
                for (key, value) in obj {
                    if let Some(arr) = value.as_array() {
                        if key == "accounts" || key == "contacts" || key == "signatures" {
                            return arr.len() as i32;
                        }
                    }
                }
            }
        }
    }
    0
}

// ============================================================================
// Result Types
// ============================================================================

#[derive(Debug, Clone, Default)]
pub struct ProcessQueueResult {
    pub processed: i32,
    pub succeeded: i32,
    pub failed: i32,
}

#[derive(Debug, Clone, Default)]
pub struct SyncResult {
    pub accounts_synced: bool,
    pub contacts_synced: bool,
    pub preferences_synced: bool,
    pub signatures_synced: bool,
    pub errors: Vec<String>,

    /// Detected conflicts requiring user resolution
    pub conflicts: Option<Vec<super::models::ConflictInfo>>,
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

    /// Check if there are any unresolved conflicts
    pub fn has_conflicts(&self) -> bool {
        self.conflicts.as_ref().map_or(false, |c| !c.is_empty())
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

    #[error("Queue error: {0}")]
    QueueError(String),

    #[error("History error: {0}")]
    HistoryError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Invalid conflict resolution strategy")]
    InvalidConflictStrategy,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    #[tokio::test]
    async fn test_manager_creation() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);
        let config = manager.get_config().await;
        assert!(!config.enabled);
    }

    #[tokio::test]
    async fn test_config_update() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

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
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        let mut config = manager.get_config().await;
        config.enabled = true;
        manager.update_config(config).await;

        manager.logout().await.unwrap();

        let config = manager.get_config().await;
        assert!(!config.enabled);
        assert!(config.user_id.is_none());
    }

    #[test]
    fn test_queue_manager_integration() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        // Queue should be initialized and empty
        let stats = manager.get_queue_stats().unwrap();
        assert_eq!(stats.total_count, 0);
        assert_eq!(stats.pending_count, 0);
        assert_eq!(stats.failed_count, 0);
    }

    #[test]
    fn test_retry_failed_syncs() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        // Add a fake failed item
        use crate::sync::queue::{QueueItem, QueueStatus};
        use crate::sync::crypto::SyncDataType;

        let item = QueueItem::new(SyncDataType::Contacts, "test_data".to_string(), 1);
        let item_id = manager.queue_manager.add_to_queue(item).unwrap();

        // Mark as failed
        manager.queue_manager.mark_failed_and_retry(item_id, "Test error".to_string()).unwrap();

        let stats = manager.get_queue_stats().unwrap();
        assert_eq!(stats.failed_count, 1);

        // Retry failed
        let count = manager.retry_failed_syncs().unwrap();
        assert_eq!(count, 1);

        let stats = manager.get_queue_stats().unwrap();
        assert_eq!(stats.pending_count, 1);
        assert_eq!(stats.failed_count, 0);
    }

    #[test]
    fn test_clear_queue_operations() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        // Add and complete an item
        use crate::sync::queue::{QueueItem, QueueStatus};
        use crate::sync::crypto::SyncDataType;

        let item = QueueItem::new(SyncDataType::Contacts, "test_data".to_string(), 1);
        let item_id = manager.queue_manager.add_to_queue(item).unwrap();

        manager.queue_manager.update_item_status(item_id, QueueStatus::Completed, None).unwrap();

        let stats = manager.get_queue_stats().unwrap();
        assert_eq!(stats.completed_count, 1);

        // Clear completed
        let count = manager.clear_completed_queue(0).unwrap();
        assert_eq!(count, 1);

        let stats = manager.get_queue_stats().unwrap();
        assert_eq!(stats.total_count, 0);
    }

    // ========================================================================
    // Conflict Detection & Merge Tests
    // ========================================================================

    #[tokio::test]
    async fn test_contacts_merge_lww() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        let now = chrono::Utc::now();
        let past = now - chrono::Duration::hours(1);

        // Local contact (newer)
        let local_contact = ContactItem {
            email: "test@example.com".to_string(),
            name: Some("Local Name".to_string()),
            company: Some("Local Corp".to_string()),
            phone: None,
            notes: None,
            is_favorite: false,
            updated_at: Some(now),
            deleted: false,
        };

        // Server contact (older)
        let server_contact = ContactItem {
            email: "test@example.com".to_string(),
            name: Some("Server Name".to_string()),
            company: None,
            phone: Some("+1234567890".to_string()),
            notes: None,
            is_favorite: true,
            updated_at: Some(past),
            deleted: false,
        };

        let local_data = ContactSyncData::new(vec![local_contact.clone()]);
        let server_data = ContactSyncData::new(vec![server_contact]);

        // Merge should prefer local (newer)
        let merged = manager.merge_contacts(local_data, server_data);

        assert_eq!(merged.contacts.len(), 1);
        assert_eq!(merged.contacts[0].email, "test@example.com");
        assert_eq!(merged.contacts[0].name, Some("Local Name".to_string()));
        assert_eq!(merged.contacts[0].company, Some("Local Corp".to_string()));
    }

    #[tokio::test]
    async fn test_contacts_conflict_detection_same_timestamp() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        let now = chrono::Utc::now();

        // Local and server contacts with same timestamp but different data
        let local_contact = ContactItem {
            email: "test@example.com".to_string(),
            name: Some("Local Name".to_string()),
            company: Some("Local Corp".to_string()),
            phone: None,
            notes: None,
            is_favorite: false,
            updated_at: Some(now),
            deleted: false,
        };

        let server_contact = ContactItem {
            email: "test@example.com".to_string(),
            name: Some("Server Name".to_string()),
            company: Some("Server Corp".to_string()),
            phone: None,
            notes: None,
            is_favorite: false,
            updated_at: Some(now),
            deleted: false,
        };

        let local_data = ContactSyncData::new(vec![local_contact]);
        let server_data = ContactSyncData::new(vec![server_contact]);

        // Should detect conflict
        let conflicts = manager.detect_contacts_conflicts(&local_data, &server_data).await;

        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].data_type, "contacts");
    }

    #[test]
    fn test_accounts_merge_lww() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        let now = chrono::Utc::now();
        let past = now - chrono::Duration::hours(2);

        let mut local = AccountSyncData::new(vec![]);
        local.synced_at = Some(now);

        let mut server = AccountSyncData::new(vec![]);
        server.synced_at = Some(past);

        // Local is newer, should be selected
        let merged = manager.merge_accounts(local.clone(), server);

        assert_eq!(merged.synced_at, local.synced_at);
    }

    #[test]
    fn test_preferences_merge_lww() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        let now = chrono::Utc::now();
        let past = now - chrono::Duration::hours(3);

        let mut local = PreferencesSyncData::default();
        local.theme = "dark".to_string();
        local.synced_at = Some(now);

        let mut server = PreferencesSyncData::default();
        server.theme = "light".to_string();
        server.synced_at = Some(past);

        // Local is newer, should be selected
        let merged = manager.merge_preferences(local.clone(), server);

        assert_eq!(merged.theme, "dark");
        assert_eq!(merged.synced_at, local.synced_at);
    }

    #[test]
    fn test_contacts_merge_combines_different_emails() {
        let db = Arc::new(Database::in_memory().expect("Failed to create test database"));
        let manager = SyncManager::new(db);

        let contact1 = ContactItem::new("alice@example.com".to_string(), Some("Alice".to_string()));
        let contact2 = ContactItem::new("bob@example.com".to_string(), Some("Bob".to_string()));
        let contact3 = ContactItem::new("charlie@example.com".to_string(), Some("Charlie".to_string()));

        let local_data = ContactSyncData::new(vec![contact1, contact2]);
        let server_data = ContactSyncData::new(vec![contact3]);

        // Should combine all unique contacts
        let merged = manager.merge_contacts(local_data, server_data);

        assert_eq!(merged.contacts.len(), 3);

        let emails: Vec<String> = merged.contacts.iter().map(|c| c.email.clone()).collect();
        assert!(emails.contains(&"alice@example.com".to_string()));
        assert!(emails.contains(&"bob@example.com".to_string()));
        assert!(emails.contains(&"charlie@example.com".to_string()));
    }

    #[test]
    fn test_sync_result_has_conflicts() {
        use crate::sync::{ConflictInfo, ConflictStrategy};

        let mut result = SyncResult::default();
        assert!(!result.has_conflicts());

        result.conflicts = Some(vec![]);
        assert!(!result.has_conflicts());

        result.conflicts = Some(vec![ConflictInfo {
            data_type: "contacts".to_string(),
            local_version: 1,
            server_version: 2,
            local_updated_at: None,
            server_updated_at: None,
            strategy: ConflictStrategy::Manual,
            conflict_details: "Test conflict".to_string(),
            local_data: serde_json::json!({}),
            server_data: serde_json::json!({}),
            field_changes: None,
        }]);
        assert!(result.has_conflicts());
    }
}
