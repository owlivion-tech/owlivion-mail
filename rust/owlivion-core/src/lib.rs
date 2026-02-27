//! # Owlivion Core
//!
//! Platform-agnostic core library for Owlivion Mail.
//! Used by Tauri (desktop/WebView mobile) and KMP (native mobile) via UniFFI.

pub mod cache;
pub mod crypto;
pub mod db;
pub mod ffi;
pub mod filters;
pub mod mail;
pub mod oauth;
pub mod sync;

// UniFFI scaffolding - MUST be at crate root
uniffi::setup_scaffolding!();

use db::{Database, EmailSummary, NewAccount as DbNewAccount};
use mail::{AsyncImapClient, ImapClient, ImapConfig, SecurityType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use zeroize::Zeroize;

// Re-export key types for consumers
pub use db::{Account, Attachment, NewAttachment, NewEmail, SearchFilters, SearchResult};
pub use mail::{
    AttachmentData, AutoConfig, AutoConfigDebug, EmailSummary as MailEmailSummary, Folder,
    FetchResult, MultiAccountFetchResult, ParsedEmail,
};
pub use sync::{SyncConfig, SyncDataType, ConflictStrategy};
pub use cache::CacheStats;
pub use filters::EmailFilter;

// ============================================================================
// Configuration
// ============================================================================

/// Core configuration passed at initialization
#[derive(Debug, Clone)]
pub struct CoreConfig {
    /// Path to app data directory (for database, crypto keys, etc.)
    pub data_dir: PathBuf,
    /// Path to app cache directory (for drafts, temp files)
    pub cache_dir: PathBuf,
}

// ============================================================================
// Error Type
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("IMAP error: {0}")]
    Imap(String),
    #[error("SMTP error: {0}")]
    Smtp(String),
    #[error("Crypto error: {0}")]
    Crypto(String),
    #[error("Sync error: {0}")]
    Sync(String),
    #[error("OAuth error: {0}")]
    OAuth(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Rate limited: {0}")]
    RateLimited(String),
    #[error("IO error: {0}")]
    Io(String),
    #[error("{0}")]
    Other(String),
}

impl From<String> for CoreError {
    fn from(s: String) -> Self {
        CoreError::Other(s)
    }
}

// ============================================================================
// Rate Limiting
// ============================================================================

struct ConnectionRateLimiter {
    attempts: Mutex<HashMap<String, Vec<Instant>>>,
    max_attempts: usize,
    window: Duration,
}

impl ConnectionRateLimiter {
    fn new(max_attempts: usize, window_secs: u64) -> Self {
        Self {
            attempts: Mutex::new(HashMap::new()),
            max_attempts,
            window: Duration::from_secs(window_secs),
        }
    }

    fn check_rate_limit(&self, key: &str) -> Result<(), CoreError> {
        let mut attempts = self.attempts.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();

        if let Some(timestamps) = attempts.get_mut(key) {
            timestamps.retain(|t| now.duration_since(*t) < self.window);
            if timestamps.len() >= self.max_attempts {
                return Err(CoreError::RateLimited(format!(
                    "Too many connection attempts. Please wait {} seconds.",
                    self.window.as_secs()
                )));
            }
            timestamps.push(now);
        } else {
            attempts.insert(key.to_string(), vec![now]);
        }

        Ok(())
    }
}

lazy_static::lazy_static! {
    static ref CONNECTION_RATE_LIMITER: ConnectionRateLimiter =
        ConnectionRateLimiter::new(5, 60);
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RECIPIENTS: usize = 100;
const MAX_PAGE_SIZE: u32 = 100;

// ============================================================================
// DTO Types (for UniFFI export)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentPath {
    pub path: String,
    pub filename: String,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSyncResult {
    pub fetch_result: mail::FetchResult,
    pub new_emails_count: usize,
    pub filters_applied_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthCompleteResult {
    pub email: String,
    pub display_name: Option<String>,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub imap_host: String,
    pub imap_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResultDto {
    pub accounts_synced: bool,
    pub contacts_synced: bool,
    pub preferences_synced: bool,
    pub signatures_synced: bool,
    pub errors: Vec<String>,
    pub conflicts: Option<Vec<ConflictInfoDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictInfoDto {
    pub data_type: String,
    pub local_version: i32,
    pub server_version: i32,
    pub local_updated_at: Option<String>,
    pub server_updated_at: Option<String>,
    pub strategy: String,
    pub conflict_details: String,
    pub local_data: serde_json::Value,
    pub server_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfigDto {
    pub enabled: bool,
    pub user_id: Option<String>,
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub last_sync_at: Option<String>,
    pub sync_accounts: bool,
    pub sync_contacts: bool,
    pub sync_preferences: bool,
    pub sync_signatures: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatusDto {
    pub data_type: String,
    pub version: i32,
    pub last_sync_at: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfoDto {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub last_seen_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStatsDto {
    pub pending_count: i32,
    pub in_progress_count: i32,
    pub failed_count: i32,
    pub completed_count: i32,
    pub total_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessQueueResultDto {
    pub processed: i32,
    pub succeeded: i32,
    pub failed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncSnapshotDto {
    pub id: i64,
    pub data_type: String,
    pub version: i64,
    pub snapshot_hash: String,
    pub device_id: String,
    pub operation: String,
    pub items_count: i32,
    pub sync_status: String,
    pub error_message: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerStatusDto {
    pub enabled: bool,
    pub running: bool,
    pub interval_minutes: u64,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftEmailData {
    pub id: Option<i64>,
    pub account_id: i64,
    pub to_addresses: String,
    pub cc_addresses: String,
    pub bcc_addresses: String,
    pub subject: String,
    pub body_text: String,
    pub body_html: String,
    pub reply_to_email_id: Option<i64>,
    pub forward_email_id: Option<i64>,
    pub compose_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftAttachmentData {
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub local_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftListItem {
    pub id: i64,
    pub account_id: i64,
    pub subject: String,
    pub to_addresses: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftDetail {
    pub id: i64,
    pub account_id: i64,
    pub to_addresses: String,
    pub cc_addresses: String,
    pub bcc_addresses: String,
    pub subject: String,
    pub body_text: String,
    pub body_html: String,
    pub reply_to_email_id: Option<i64>,
    pub forward_email_id: Option<i64>,
    pub compose_type: String,
    pub created_at: String,
    pub updated_at: String,
    pub attachments: Vec<DraftAttachmentData>,
}

// ============================================================================
// Validation Helpers
// ============================================================================

fn parse_security(s: &str) -> SecurityType {
    match s.to_uppercase().as_str() {
        "SSL" | "TLS" => SecurityType::SSL,
        "STARTTLS" => SecurityType::STARTTLS,
        _ => SecurityType::NONE,
    }
}

fn validate_security_type(s: &str) -> Result<(), CoreError> {
    match s.to_uppercase().as_str() {
        "SSL" | "TLS" | "STARTTLS" => Ok(()),
        "NONE" => Err(CoreError::Validation("Insecure connections (NONE) are not allowed".into())),
        _ => Err(CoreError::Validation(format!("Invalid security type: {}. Use SSL, TLS, or STARTTLS", s))),
    }
}

fn validate_host(host: &str) -> Result<(), CoreError> {
    let host_lower = host.to_lowercase();

    if host_lower == "localhost"
        || host_lower == "127.0.0.1"
        || host_lower == "::1"
        || host_lower.starts_with("127.")
        || host_lower == "0.0.0.0"
    {
        return Err(CoreError::Validation("Localhost connections are not allowed".into()));
    }

    if let Ok(ip) = host.parse::<std::net::IpAddr>() {
        match ip {
            std::net::IpAddr::V4(ipv4) => {
                if ipv4.is_private() || ipv4.is_loopback() || ipv4.is_link_local()
                    || ipv4.is_broadcast() || ipv4.is_unspecified()
                {
                    return Err(CoreError::Validation("Private/reserved IP addresses are not allowed".into()));
                }
            }
            std::net::IpAddr::V6(ipv6) => {
                if ipv6.is_loopback() || ipv6.is_unspecified() {
                    return Err(CoreError::Validation("Loopback/unspecified IPv6 addresses are not allowed".into()));
                }
            }
        }
    }

    if host.is_empty() || host.len() > 253 {
        return Err(CoreError::Validation("Invalid hostname length".into()));
    }

    for c in host.chars() {
        if !c.is_ascii_alphanumeric() && c != '.' && c != '-' {
            return Err(CoreError::Validation("Invalid characters in hostname".into()));
        }
    }

    Ok(())
}

fn validate_port(port: u16) -> Result<(), CoreError> {
    const ALLOWED_PORTS: [u16; 8] = [25, 143, 465, 587, 993, 995, 110, 2525];
    if ALLOWED_PORTS.contains(&port) {
        Ok(())
    } else {
        Err(CoreError::Validation(format!(
            "Port {} is not allowed. Use standard email ports: {:?}",
            port, ALLOWED_PORTS
        )))
    }
}

fn sanitize_error_message(error: &str) -> String {
    let error_lower = error.to_lowercase();

    if error_lower.contains("authentication") || error_lower.contains("invalid credentials") || error_lower.contains("login") {
        return "Authentication failed. Please check your email and password.".to_string();
    }
    if error_lower.contains("connection refused") || error_lower.contains("connect error") {
        return "Could not connect to server. Please check the host and port.".to_string();
    }
    if error_lower.contains("timeout") || error_lower.contains("timed out") {
        return "Connection timed out. Server may be unavailable.".to_string();
    }
    if error_lower.contains("certificate") || error_lower.contains("ssl") || error_lower.contains("tls") {
        return "SSL/TLS error. Server certificate may be invalid.".to_string();
    }
    if error_lower.contains("dns") || error_lower.contains("resolve") || error_lower.contains("hostname") {
        return "Could not resolve server address. Please check the hostname.".to_string();
    }

    "Connection error. Please check your settings and try again.".to_string()
}

fn validate_email(email: &str) -> Result<(), CoreError> {
    if email.is_empty() {
        return Err(CoreError::Validation("Email address cannot be empty".into()));
    }
    if email.len() > 254 {
        return Err(CoreError::Validation("Email address too long".into()));
    }
    if !email.contains('@') {
        return Err(CoreError::Validation("Invalid email format".into()));
    }
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err(CoreError::Validation("Invalid email format".into()));
    }
    if parts[0].len() > 64 {
        return Err(CoreError::Validation("Email local part too long".into()));
    }
    if !parts[1].contains('.') {
        return Err(CoreError::Validation("Invalid email domain".into()));
    }
    if email.contains('\r') || email.contains('\n') || email.contains('\0') {
        return Err(CoreError::Validation("Invalid characters in email".into()));
    }
    Ok(())
}

fn get_current_folder_safe(
    current_folder: &Mutex<HashMap<String, String>>,
    account_id: &str,
) -> String {
    current_folder
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get(account_id)
        .cloned()
        .unwrap_or_else(|| "INBOX".to_string())
}

#[allow(dead_code)]
fn generate_account_color(email: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    email.hash(&mut hasher);
    let hash = hasher.finish();
    let hue = (hash % 360) as i32;
    format!("hsl({}, 70%, 60%)", hue)
}

fn sync_folder_to_db(
    db: &Database,
    account_id: i64,
    folder_name: &str,
) -> Result<i64, CoreError> {
    let folder_id = db
        .query_row(
            "SELECT id FROM folders WHERE account_id = ?1 AND remote_name = ?2 LIMIT 1",
            rusqlite::params![account_id, folder_name],
            |row| row.get::<_, i64>(0),
        )
        .ok();

    if let Some(id) = folder_id {
        return Ok(id);
    }

    let folder_type = match folder_name.to_uppercase().as_str() {
        "INBOX" => "inbox",
        "SENT" | "SENT ITEMS" | "[GMAIL]/SENT MAIL" => "sent",
        "DRAFTS" | "[GMAIL]/DRAFTS" => "drafts",
        "TRASH" | "DELETED" | "[GMAIL]/TRASH" => "trash",
        "SPAM" | "JUNK" | "[GMAIL]/SPAM" => "spam",
        "ARCHIVE" | "[GMAIL]/ALL MAIL" => "archive",
        "STARRED" | "[GMAIL]/STARRED" => "starred",
        _ => "custom",
    };

    let display_name = folder_name
        .replace("[Gmail]/", "")
        .replace("[GMAIL]/", "");

    db.execute(
        r#"INSERT INTO folders (account_id, name, remote_name, folder_type)
           VALUES (?1, ?2, ?3, ?4)"#,
        rusqlite::params![account_id, display_name, folder_name, folder_type],
    )
    .map_err(|e| CoreError::Database(format!("Failed to insert folder: {}", e)))?;

    let new_folder_id = db
        .query_row(
            "SELECT id FROM folders WHERE account_id = ?1 AND remote_name = ?2 LIMIT 1",
            rusqlite::params![account_id, folder_name],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| CoreError::Database(format!("Failed to get new folder ID: {}", e)))?;

    Ok(new_folder_id)
}

#[allow(dead_code)]
fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect()
}

fn parse_sync_data_type(data_type: &str) -> Result<sync::SyncDataType, CoreError> {
    match data_type {
        "accounts" => Ok(sync::SyncDataType::Accounts),
        "contacts" => Ok(sync::SyncDataType::Contacts),
        "preferences" => Ok(sync::SyncDataType::Preferences),
        "signatures" => Ok(sync::SyncDataType::Signatures),
        _ => Err(CoreError::Validation(format!("Invalid data type: {}", data_type))),
    }
}

use std::sync::Mutex as StdMutex;

// ============================================================================
// OwlivionCore - Platform-agnostic core
// ============================================================================

/// The main entry point for all Owlivion Mail operations.
/// Thread-safe, Arc-wrapped internally.
pub struct OwlivionCore {
    db: Arc<Database>,
    async_imap_clients: tokio::sync::Mutex<HashMap<String, AsyncImapClient>>,
    current_folder: Mutex<HashMap<String, String>>,
    sync_manager: Arc<StdMutex<Option<sync::SyncManager>>>,
    background_scheduler: Arc<sync::BackgroundScheduler>,
    email_cache: cache::EmailCache,
    #[allow(dead_code)]
    config: CoreConfig,
}

impl OwlivionCore {
    /// Create a new OwlivionCore instance.
    /// Initializes the database and crypto module.
    pub fn new(config: CoreConfig) -> Result<Arc<Self>, CoreError> {
        // Initialize Android logger if on Android
        #[cfg(target_os = "android")]
        {
            android_logger::init_once(
                android_logger::Config::default()
                    .with_max_level(log::LevelFilter::Info)
                    .with_tag("OwlivionCore"),
            );
        }

        // Install rustls crypto provider (ring)
        let _ = rustls::crypto::ring::default_provider().install_default();

        // Ensure data directory exists
        std::fs::create_dir_all(&config.data_dir)
            .map_err(|e| CoreError::Io(format!("Failed to create data directory: {}", e)))?;

        // Set app data dir for crypto module
        crypto::set_app_data_dir(config.data_dir.clone());

        // Initialize database
        let db_path = config.data_dir.join("owlivion.db");
        log::info!("Database path: {:?}", db_path);

        let db = Database::new(db_path)
            .map_err(|e| CoreError::Database(format!("Database initialization failed: {}", e)))?;
        log::info!("Database initialized successfully");

        let db_arc = Arc::new(db);
        let sync_manager = Arc::new(StdMutex::new(Some(sync::SyncManager::new(db_arc.clone()))));
        let background_scheduler = Arc::new(sync::BackgroundScheduler::new(db_arc.clone()));

        Ok(Arc::new(Self {
            db: db_arc,
            async_imap_clients: tokio::sync::Mutex::new(HashMap::new()),
            current_folder: Mutex::new(HashMap::new()),
            sync_manager,
            background_scheduler,
            email_cache: cache::EmailCache::new(),
            config,
        }))
    }

    /// Get database reference (for Tauri wrapper's direct DB access)
    pub fn db(&self) -> &Arc<Database> {
        &self.db
    }

    /// Get sync manager instance
    fn get_sync_manager(&self) -> Result<sync::SyncManager, CoreError> {
        let guard = self.sync_manager.lock()
            .map_err(|e| CoreError::Sync(format!("Lock error: {}", e)))?;
        guard.as_ref()
            .cloned()
            .ok_or_else(|| CoreError::Sync("Sync manager not initialized".into()))
    }

    // ========================================================================
    // Account Management
    // ========================================================================

    pub async fn autoconfig_detect(&self, email: String) -> Result<AutoConfig, CoreError> {
        mail::fetch_autoconfig(&email).await.map_err(CoreError::from)
    }

    pub async fn autoconfig_detect_debug(&self, email: String) -> Result<AutoConfigDebug, CoreError> {
        mail::fetch_autoconfig_debug(&email).await.map_err(CoreError::from)
    }

    pub async fn account_test_imap(
        &self,
        host: String,
        port: u16,
        security: String,
        email: String,
        mut password: String,
    ) -> Result<(), CoreError> {
        let rate_key = format!("imap:{}:{}", host, email);
        CONNECTION_RATE_LIMITER.check_rate_limit(&rate_key)?;

        validate_host(&host)?;
        validate_port(port)?;
        validate_email(&email)?;
        validate_security_type(&security)?;

        let sec = parse_security(&security);
        let config = ImapConfig {
            host: host.clone(),
            port,
            security: sec,
            username: email.clone(),
            password: password.clone(),
            accept_invalid_certs: true,
            oauth_provider: None,
        };
        password.zeroize();

        let result = tokio::task::spawn_blocking(move || {
            let mut client = ImapClient::new(config);
            client.test_connection()
        })
        .await;

        match result {
            Ok(Ok(())) => Ok(()),
            Ok(Err(e)) => Err(CoreError::Imap(sanitize_error_message(&e.to_string()))),
            Err(e) => Err(CoreError::Imap(format!("Connection test failed: {:?}", e))),
        }
    }

    pub async fn account_test_smtp(
        &self,
        host: String,
        port: u16,
        security: String,
        email: String,
        mut password: String,
    ) -> Result<(), CoreError> {
        let rate_key = format!("smtp:{}:{}", host, email);
        CONNECTION_RATE_LIMITER.check_rate_limit(&rate_key)?;

        validate_host(&host)?;
        validate_port(port)?;
        validate_email(&email)?;
        validate_security_type(&security)?;

        use lettre::{transport::smtp::authentication::Credentials, AsyncSmtpTransport};

        if host.is_empty() || email.is_empty() || password.is_empty() {
            return Err(CoreError::Validation("Invalid SMTP configuration".into()));
        }

        let creds = Credentials::new(email.clone(), password.clone());
        let security_type = parse_security(&security);
        password.zeroize();

        let mailer: AsyncSmtpTransport<lettre::Tokio1Executor> = match security_type {
            SecurityType::SSL => {
                AsyncSmtpTransport::<lettre::Tokio1Executor>::relay(&host)
                    .map_err(|e| CoreError::Smtp(sanitize_error_message(&format!("{}", e))))?
                    .credentials(creds)
                    .port(port)
                    .build()
            }
            SecurityType::STARTTLS => {
                AsyncSmtpTransport::<lettre::Tokio1Executor>::starttls_relay(&host)
                    .map_err(|e| CoreError::Smtp(sanitize_error_message(&format!("{}", e))))?
                    .credentials(creds)
                    .port(port)
                    .build()
            }
            SecurityType::NONE => {
                return Err(CoreError::Smtp("Insecure SMTP not supported".into()));
            }
        };

        mailer.test_connection().await
            .map_err(|e| CoreError::Smtp(sanitize_error_message(&format!("{}", e))))?;

        Ok(())
    }

    pub async fn account_add(
        &self,
        email: String,
        display_name: String,
        password: String,
        imap_host: String,
        imap_port: u16,
        imap_security: String,
        smtp_host: String,
        smtp_port: u16,
        smtp_security: String,
        is_default: bool,
        accept_invalid_certs: Option<bool>,
        oauth_provider: Option<String>,
    ) -> Result<String, CoreError> {
        let encrypted_password = crypto::encrypt_password(&password)
            .map_err(|e| CoreError::Crypto(format!("Password encryption failed: {}", e)))?;

        let new_account = DbNewAccount {
            email: email.clone(),
            display_name,
            imap_host,
            imap_port: imap_port as i32,
            imap_security,
            imap_username: Some(email.clone()),
            smtp_host,
            smtp_port: smtp_port as i32,
            smtp_security,
            smtp_username: Some(email),
            password_encrypted: Some(encrypted_password),
            oauth_provider: oauth_provider.clone(),
            oauth_access_token: if oauth_provider.is_some() { Some(password.clone()) } else { None },
            oauth_refresh_token: None,
            oauth_expires_at: None,
            is_default,
            signature: String::new(),
            sync_days: 30,
            accept_invalid_certs: accept_invalid_certs.unwrap_or(false),
        };

        let account_id = self.db.add_account(&new_account)
            .map_err(|e| CoreError::Database(format!("Database error: {}", e)))?;

        Ok(account_id.to_string())
    }

    pub async fn account_list(&self) -> Result<Vec<db::Account>, CoreError> {
        self.db.get_accounts()
            .map_err(|e| CoreError::Database(format!("Database error: {}", e)))
    }

    pub async fn account_connect(&self, account_id: String) -> Result<(), CoreError> {
        let id: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;

        let account = self.db.get_account(id)
            .map_err(|_| CoreError::Database("Database error".into()))?;

        validate_host(&account.imap_host)?;
        validate_port(account.imap_port as u16)?;
        validate_security_type(&account.imap_security)?;

        let encrypted_password = self.db.get_account_password(id)
            .map_err(|_| CoreError::Database("Database error".into()))?
            .ok_or_else(|| CoreError::NotFound("No password stored".into()))?;

        let mut password = crypto::decrypt_password(&encrypted_password)
            .map_err(|_| CoreError::Crypto("Password decryption failed".into()))?;

        // OAuth token refresh logic
        if account.oauth_provider.is_some() {
            if let Some(expires_at) = account.oauth_expires_at {
                let now = chrono::Utc::now().timestamp();
                if expires_at - now < 300 {
                    if let Some(refresh_token) = &account.oauth_refresh_token {
                        let oauth_config = match account.oauth_provider.as_deref() {
                            Some("google") => oauth::gmail_config(),
                            Some("microsoft") => oauth::microsoft_config(),
                            _ => return Err(CoreError::OAuth("Unknown OAuth provider".into())),
                        };

                        match oauth::refresh_access_token(&oauth_config, refresh_token).await {
                            Ok(result) => {
                                password.zeroize();
                                password = result.access_token.clone();

                                let encrypted_new_token = crypto::encrypt_password(&result.access_token)
                                    .map_err(|e| CoreError::Crypto(format!("Encryption failed: {}", e)))?;

                                self.db.update_oauth_access_token(id, &encrypted_new_token)
                                    .map_err(|e| CoreError::Database(format!("Database error: {}", e)))?;

                                let new_expires_at = chrono::Utc::now().timestamp() + 3600;
                                self.db.update_oauth_expires_at(id, new_expires_at)
                                    .map_err(|e| CoreError::Database(format!("Database error: {}", e)))?;

                                if let Some(new_refresh) = result.refresh_token {
                                    self.db.update_oauth_refresh_token(id, &new_refresh)
                                        .map_err(|e| CoreError::Database(format!("Database error: {}", e)))?;
                                }
                            }
                            Err(e) => {
                                return Err(CoreError::OAuth(format!("Token expired. Please re-add account: {}", e)));
                            }
                        }
                    } else {
                        return Err(CoreError::OAuth("OAuth refresh token not found".into()));
                    }
                }
            }
        }

        let config = ImapConfig {
            host: account.imap_host.clone(),
            port: account.imap_port as u16,
            security: parse_security(&account.imap_security),
            username: account.imap_username.clone().unwrap_or(account.email.clone()),
            password: password.clone(),
            accept_invalid_certs: account.accept_invalid_certs,
            oauth_provider: account.oauth_provider.clone(),
        };
        password.zeroize();

        let mut async_client = AsyncImapClient::new(config);
        async_client.connect().await.map_err(|e| CoreError::Imap(sanitize_error_message(&e.to_string())))?;

        let mut async_clients = self.async_imap_clients.lock().await;
        async_clients.insert(account_id.clone(), async_client);

        Ok(())
    }

    pub async fn account_delete(&self, account_id: String) -> Result<(), CoreError> {
        let id: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;

        let mut async_clients = self.async_imap_clients.lock().await;
        async_clients.remove(&account_id);
        drop(async_clients);

        self.db.delete_account(id)
            .map_err(|e| CoreError::Database(format!("Database error: {}", e)))
    }

    pub async fn account_update_signature(&self, account_id: String, signature: String) -> Result<(), CoreError> {
        let id: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;
        self.db.update_account_signature(id, &signature)
            .map_err(|e| CoreError::Database(format!("Database error: {}", e)))
    }

    pub async fn account_get_priority_fetch(&self, account_id: i64) -> Result<bool, CoreError> {
        self.db.get_account_priority_setting(account_id)
            .map_err(|e| CoreError::Database(format!("Failed to get priority setting: {}", e)))
    }

    pub async fn account_set_priority_fetch(&self, account_id: i64, enabled: bool) -> Result<(), CoreError> {
        self.db.set_account_priority_setting(account_id, enabled)
            .map_err(|e| CoreError::Database(format!("Failed to set priority setting: {}", e)))
    }

    // ========================================================================
    // Email Operations
    // ========================================================================

    pub async fn folder_list(&self, account_id: String) -> Result<Vec<mail::Folder>, CoreError> {
        let mut async_clients = self.async_imap_clients.lock().await;
        let client = async_clients
            .get_mut(&account_id)
            .ok_or_else(|| CoreError::Imap("Account not connected".into()))?;

        client.list_folders().await.map_err(|e| CoreError::Imap(e.to_string()))
    }

    pub async fn email_list(
        &self,
        account_id: String,
        folder: Option<String>,
        page: u32,
        page_size: u32,
    ) -> Result<mail::FetchResult, CoreError> {
        let safe_page_size = page_size.min(MAX_PAGE_SIZE).max(1);
        let folder_path = folder.unwrap_or_else(|| "INBOX".to_string());

        {
            let mut current = self.current_folder.lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            current.insert(account_id.clone(), folder_path.clone());
        }

        let mut async_clients = self.async_imap_clients.lock().await;
        if !async_clients.contains_key(&account_id) {
            return Err(CoreError::Imap("Account not connected".into()));
        }
        let client = async_clients.get_mut(&account_id).unwrap();

        let result = client
            .fetch_emails(&folder_path, page, safe_page_size)
            .await
            .map_err(|e| CoreError::Imap(format!("Failed to fetch emails: {}", e)))?;

        drop(async_clients);

        let account_id_num: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;
        let folder_id = sync_folder_to_db(&self.db, account_id_num, &folder_path).unwrap_or(1);

        // Batch sync emails to database
        if !result.emails.is_empty() {
            let new_emails: Vec<db::NewEmail> = result.emails.iter().map(|es| {
                db::NewEmail {
                    account_id: account_id_num,
                    folder_id,
                    message_id: es.message_id.clone().unwrap_or_else(|| format!("uid-{}", es.uid)),
                    uid: es.uid,
                    from_address: es.from.clone(),
                    from_name: es.from_name.clone(),
                    to_addresses: "[]".to_string(),
                    cc_addresses: "[]".to_string(),
                    bcc_addresses: "[]".to_string(),
                    reply_to: None,
                    subject: es.subject.clone(),
                    preview: es.preview.clone(),
                    body_text: None,
                    body_html: None,
                    date: es.date.clone(),
                    is_read: es.is_read,
                    is_starred: es.is_starred,
                    is_deleted: false,
                    is_spam: false,
                    is_draft: false,
                    is_answered: false,
                    is_forwarded: false,
                    has_attachments: es.has_attachments,
                    has_inline_images: false,
                    thread_id: None,
                    in_reply_to: None,
                    references_header: None,
                    raw_headers: None,
                    raw_size: 0,
                    priority: 3,
                    labels: "[]".to_string(),
                }
            }).collect();

            if let Ok(new_email_ids) = self.db.batch_upsert_emails(&new_emails) {
                // Apply filters to new emails
                if !new_email_ids.is_empty() {
                    use filters::FilterEngine;
                    let engine = FilterEngine::new(self.db.clone());
                    for email_id in new_email_ids {
                        if let Ok(email) = self.db.get_email(email_id) {
                            if let Ok(actions) = engine.apply_filters(&email).await {
                                if !actions.is_empty() {
                                    let _ = engine.execute_actions(email_id, actions).await;
                                }
                            }
                        }
                    }
                }
            }
        }

        let mut result_with_account_id = result;
        for email in &mut result_with_account_id.emails {
            email.account_id = Some(account_id.clone());
        }

        Ok(result_with_account_id)
    }

    pub async fn email_get(
        &self,
        account_id: String,
        uid: u32,
        folder: Option<String>,
    ) -> Result<mail::ParsedEmail, CoreError> {
        let folder_path = folder.unwrap_or_else(|| {
            get_current_folder_safe(&self.current_folder, &account_id)
        });

        let account_id_num: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;
        let account = self.db.get_account(account_id_num)
            .map_err(|e| CoreError::Database(format!("Failed to get account: {}", e)))?;
        let encrypted_password = self.db.get_account_password(account_id_num)
            .map_err(|e| CoreError::Database(format!("Failed to get password: {}", e)))?
            .ok_or_else(|| CoreError::NotFound("No password found".into()))?;

        let password = crypto::decrypt_password(&encrypted_password)
            .map_err(|e| CoreError::Crypto(format!("Password decryption failed: {}", e)))?;

        let security = match account.imap_security.to_uppercase().as_str() {
            "SSL" => SecurityType::SSL,
            "STARTTLS" => SecurityType::STARTTLS,
            _ => SecurityType::SSL,
        };

        let config = ImapConfig {
            host: account.imap_host.clone(),
            port: account.imap_port as u16,
            security,
            username: account.email.clone(),
            password,
            accept_invalid_certs: account.accept_invalid_certs,
            oauth_provider: account.oauth_provider.clone(),
        };

        let mut fresh_client = AsyncImapClient::new(config);
        fresh_client.connect().await.map_err(|e| CoreError::Imap(format!("Failed to connect: {}", e)))?;

        let fetch_result = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            fresh_client.fetch_email(&folder_path, uid)
        ).await;

        let email = match fetch_result {
            Ok(Ok(email)) => email,
            Ok(Err(e)) => return Err(CoreError::Imap(format!("Fetch error: {}", e))),
            Err(_) => return Err(CoreError::Imap("Fetch timeout".into())),
        };

        Ok(email)
    }

    pub async fn email_search(&self, account_id: String, query: String) -> Result<Vec<EmailSummary>, CoreError> {
        if query.trim().is_empty() {
            return Err(CoreError::Validation("Search query cannot be empty".into()));
        }
        if query.len() > 500 {
            return Err(CoreError::Validation("Search query too long".into()));
        }

        let account_id_num: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;
        self.db.search_emails(account_id_num, &query, 100)
            .map_err(|e| CoreError::Database(format!("Search failed: {}", e)))
    }

    pub async fn email_search_advanced(
        &self,
        account_id: String,
        filters: db::SearchFilters,
        limit: i32,
        offset: i32,
    ) -> Result<db::SearchResult, CoreError> {
        let account_id_num: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;
        self.db.search_emails_advanced(account_id_num, &filters, limit, offset)
            .map_err(|e| CoreError::Database(format!("Advanced search failed: {}", e)))
    }

    pub async fn email_mark_read(
        &self,
        account_id: String,
        uid: u32,
        read: bool,
        folder: Option<String>,
    ) -> Result<(), CoreError> {
        let folder_path = folder.unwrap_or_else(|| {
            get_current_folder_safe(&self.current_folder, &account_id)
        });

        let mut async_clients = self.async_imap_clients.lock().await;
        let client = async_clients
            .get_mut(&account_id)
            .ok_or_else(|| CoreError::Imap("Account not connected".into()))?;

        client.set_read(&folder_path, uid, read).await.map_err(|e| CoreError::Imap(e.to_string()))
    }

    pub async fn email_mark_starred(
        &self,
        account_id: String,
        uid: u32,
        starred: bool,
        folder: Option<String>,
    ) -> Result<(), CoreError> {
        let folder_path = folder.unwrap_or_else(|| {
            get_current_folder_safe(&self.current_folder, &account_id)
        });

        let mut async_clients = self.async_imap_clients.lock().await;
        let client = async_clients
            .get_mut(&account_id)
            .ok_or_else(|| CoreError::Imap("Account not connected".into()))?;

        client.set_starred(&folder_path, uid, starred).await.map_err(|e| CoreError::Imap(e.to_string()))
    }

    pub async fn email_move(
        &self,
        account_id: String,
        uid: u32,
        target_folder: String,
        folder: Option<String>,
    ) -> Result<(), CoreError> {
        let folder_path = folder.unwrap_or_else(|| {
            get_current_folder_safe(&self.current_folder, &account_id)
        });

        let mut async_clients = self.async_imap_clients.lock().await;
        let client = async_clients
            .get_mut(&account_id)
            .ok_or_else(|| CoreError::Imap("Account not connected".into()))?;

        client.move_email(&folder_path, uid, &target_folder).await.map_err(|e| CoreError::Imap(e.to_string()))
    }

    pub async fn email_delete(
        &self,
        account_id: String,
        uid: u32,
        permanent: bool,
        folder: Option<String>,
    ) -> Result<(), CoreError> {
        let folder_path = folder.unwrap_or_else(|| {
            get_current_folder_safe(&self.current_folder, &account_id)
        });

        let mut async_clients = self.async_imap_clients.lock().await;
        let client = async_clients
            .get_mut(&account_id)
            .ok_or_else(|| CoreError::Imap("Account not connected".into()))?;

        client.delete_email(&folder_path, uid, permanent).await.map_err(|e| CoreError::Imap(e.to_string()))
    }

    // ========================================================================
    // Send Email
    // ========================================================================

    pub async fn email_send(
        &self,
        account_id: String,
        to: Vec<String>,
        cc: Vec<String>,
        bcc: Vec<String>,
        subject: String,
        body_text: Option<String>,
        body_html: Option<String>,
        attachment_paths: Vec<AttachmentPath>,
    ) -> Result<(), CoreError> {
        let id: i64 = account_id.parse().map_err(|_| CoreError::Validation("Invalid account ID".into()))?;
        if id <= 0 {
            return Err(CoreError::Validation("Invalid account ID".into()));
        }

        // Validate recipients
        let total_recipients = to.len() + cc.len() + bcc.len();
        if total_recipients == 0 {
            return Err(CoreError::Validation("At least one recipient is required".into()));
        }
        if total_recipients > MAX_RECIPIENTS {
            return Err(CoreError::Validation(format!("Too many recipients (max {})", MAX_RECIPIENTS)));
        }
        for email in to.iter().chain(cc.iter()).chain(bcc.iter()) {
            validate_email(email)?;
        }

        // Validate subject
        if subject.len() > 998 {
            return Err(CoreError::Validation("Subject too long (max 998 characters)".into()));
        }
        if subject.contains('\r') || subject.contains('\n') {
            return Err(CoreError::Validation("Invalid characters in subject".into()));
        }

        let account = self.db.get_account(id)
            .map_err(|e| CoreError::Database(format!("Database error: {}", e)))?;

        let encrypted_password = self.db.get_account_password(id)
            .map_err(|e| CoreError::Database(format!("Database error: {}", e)))?
            .ok_or_else(|| CoreError::NotFound("No password stored".into()))?;

        let password = crypto::decrypt_password(&encrypted_password)
            .map_err(|e| CoreError::Crypto(format!("Password decryption failed: {}", e)))?;

        // Load attachment data from paths
        let mut attachments_data = Vec::new();
        for att_path in &attachment_paths {
            let data = tokio::fs::read(&att_path.path).await
                .map_err(|e| CoreError::Io(format!("Failed to read attachment {}: {}", att_path.filename, e)))?;
            attachments_data.push(mail::smtp_oauth::AttachmentData {
                filename: att_path.filename.clone(),
                content_type: att_path.content_type.clone(),
                data,
            });
        }

        // OAuth accounts use XOAUTH2 SMTP
        if account.oauth_provider.is_some() {
            let (body_str, is_html) = if let Some(html) = body_html {
                (html, true)
            } else {
                (body_text.unwrap_or_default(), false)
            };

            return mail::smtp_oauth::send_email_oauth(
                &account.smtp_host,
                account.smtp_port as u16,
                &account.email,
                &password,
                &account.email,
                &to,
                &cc,
                &bcc,
                &subject,
                &body_str,
                is_html,
                &attachments_data,
            )
            .await
            .map_err(|e| CoreError::Smtp(sanitize_error_message(&e.to_string())));
        }

        // Regular SMTP via lettre
        use lettre::{
            message::{header::ContentType, Mailbox, MultiPart, SinglePart},
            transport::smtp::authentication::Credentials,
            AsyncSmtpTransport, AsyncTransport, Message,
        };

        let from: Mailbox = account.email.parse()
            .map_err(|e: lettre::address::AddressError| CoreError::Smtp(e.to_string()))?;

        let mut email_builder = Message::builder()
            .from(from)
            .subject(&subject);

        for r in &to {
            let m: Mailbox = r.parse().map_err(|e: lettre::address::AddressError| CoreError::Smtp(e.to_string()))?;
            email_builder = email_builder.to(m);
        }
        for r in &cc {
            let m: Mailbox = r.parse().map_err(|e: lettre::address::AddressError| CoreError::Smtp(e.to_string()))?;
            email_builder = email_builder.cc(m);
        }
        for r in &bcc {
            let m: Mailbox = r.parse().map_err(|e: lettre::address::AddressError| CoreError::Smtp(e.to_string()))?;
            email_builder = email_builder.bcc(m);
        }

        let email = if !attachments_data.is_empty() {
            let mut final_multipart = if let (Some(text), Some(html)) = (&body_text, &body_html) {
                MultiPart::mixed().multipart(
                    MultiPart::alternative()
                        .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(text.clone()))
                        .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html.clone())),
                )
            } else if let Some(html) = &body_html {
                MultiPart::mixed().singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html.clone()))
            } else {
                MultiPart::mixed().singlepart(
                    SinglePart::builder().header(ContentType::TEXT_PLAIN).body(body_text.clone().unwrap_or_default()),
                )
            };

            for att in &attachments_data {
                let ct: ContentType = att.content_type.parse()
                    .unwrap_or_else(|_| ContentType::parse("application/octet-stream").expect("valid content type"));
                final_multipart = final_multipart.singlepart(
                    lettre::message::Attachment::new(att.filename.clone()).body(att.data.clone(), ct),
                );
            }

            email_builder.multipart(final_multipart).map_err(|e| CoreError::Smtp(e.to_string()))?
        } else if let Some(html) = &body_html {
            email_builder
                .header(ContentType::TEXT_HTML)
                .body(html.clone())
                .map_err(|e| CoreError::Smtp(e.to_string()))?
        } else {
            email_builder
                .header(ContentType::TEXT_PLAIN)
                .body(body_text.unwrap_or_default())
                .map_err(|e| CoreError::Smtp(e.to_string()))?
        };

        let creds = Credentials::new(
            account.smtp_username.unwrap_or(account.email.clone()),
            password,
        );

        let security_type = parse_security(&account.smtp_security);
        let mailer: AsyncSmtpTransport<lettre::Tokio1Executor> = match security_type {
            SecurityType::SSL => {
                AsyncSmtpTransport::<lettre::Tokio1Executor>::relay(&account.smtp_host)
                    .map_err(|e| CoreError::Smtp(sanitize_error_message(&format!("{}", e))))?
                    .credentials(creds)
                    .port(account.smtp_port as u16)
                    .build()
            }
            SecurityType::STARTTLS => {
                AsyncSmtpTransport::<lettre::Tokio1Executor>::starttls_relay(&account.smtp_host)
                    .map_err(|e| CoreError::Smtp(sanitize_error_message(&format!("{}", e))))?
                    .credentials(creds)
                    .port(account.smtp_port as u16)
                    .build()
            }
            SecurityType::NONE => {
                return Err(CoreError::Smtp("Insecure SMTP not supported".into()));
            }
        };

        mailer.send(email).await
            .map_err(|e| CoreError::Smtp(sanitize_error_message(&format!("{}", e))))?;

        Ok(())
    }

    // ========================================================================
    // Attachment Operations
    // ========================================================================

    pub async fn write_temp_attachment(
        &self,
        filename: String,
        content_type: String,
        data: Vec<u8>,
    ) -> Result<AttachmentPath, CoreError> {
        if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
            return Err(CoreError::Validation("Invalid filename".into()));
        }
        const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;
        if data.len() > MAX_FILE_SIZE {
            return Err(CoreError::Validation("File too large (max 50MB)".into()));
        }

        let temp_dir = std::env::temp_dir().join("owlivion-mail-attachments");
        tokio::fs::create_dir_all(&temp_dir).await
            .map_err(|e| CoreError::Io(format!("Failed to create temp directory: {}", e)))?;

        let unique_name = format!("{}_{}", uuid::Uuid::new_v4(), filename);
        let temp_path = temp_dir.join(&unique_name);

        tokio::fs::write(&temp_path, data).await
            .map_err(|e| CoreError::Io(format!("Failed to write temp file: {}", e)))?;

        Ok(AttachmentPath {
            path: temp_path.to_string_lossy().to_string(),
            filename,
            content_type,
        })
    }

    pub async fn get_email_attachments(&self, email_id: i64) -> Result<Vec<db::Attachment>, CoreError> {
        self.db.get_attachments_for_email(email_id)
            .map_err(|e| CoreError::Database(format!("Failed to get attachments: {}", e)))
    }

    // ========================================================================
    // Sync Operations
    // ========================================================================

    pub async fn sync_register(&self, email: String, password: String, master_password: String) -> Result<(), CoreError> {
        let manager = self.get_sync_manager()?;
        manager.register(email, password, master_password).await
            .map_err(|e| CoreError::Sync(format!("Registration failed: {}", e)))
    }

    pub async fn sync_login(&self, email: String, password: String) -> Result<(), CoreError> {
        let manager = self.get_sync_manager()?;
        manager.login(email, password).await
            .map_err(|e| CoreError::Sync(format!("Login failed: {}", e)))
    }

    pub async fn sync_logout(&self) -> Result<(), CoreError> {
        let manager = self.get_sync_manager()?;
        manager.logout().await
            .map_err(|e| CoreError::Sync(format!("Logout failed: {}", e)))
    }

    pub async fn sync_start(&self, master_password: String) -> Result<SyncResultDto, CoreError> {
        let manager = self.get_sync_manager()?;
        let result = manager.sync_all(&master_password).await
            .map_err(|e| CoreError::Sync(format!("Sync failed: {}", e)))?;

        Ok(SyncResultDto {
            accounts_synced: result.accounts_synced,
            contacts_synced: result.contacts_synced,
            preferences_synced: result.preferences_synced,
            signatures_synced: result.signatures_synced,
            errors: result.errors,
            conflicts: result.conflicts.map(|conflicts| {
                conflicts.into_iter().map(|c| ConflictInfoDto {
                    data_type: c.data_type,
                    local_version: c.local_version,
                    server_version: c.server_version,
                    local_updated_at: c.local_updated_at.map(|t| t.to_rfc3339()),
                    server_updated_at: c.server_updated_at.map(|t| t.to_rfc3339()),
                    strategy: format!("{:?}", c.strategy),
                    conflict_details: c.conflict_details,
                    local_data: c.local_data,
                    server_data: c.server_data,
                }).collect()
            }),
        })
    }

    pub async fn sync_get_config(&self) -> Result<SyncConfigDto, CoreError> {
        let manager = self.get_sync_manager()?;
        let config = manager.get_config().await;
        Ok(SyncConfigDto {
            enabled: config.enabled,
            user_id: config.user_id,
            device_id: config.device_id,
            device_name: config.device_name,
            platform: config.platform.as_str().to_string(),
            last_sync_at: config.last_sync_at.map(|t| t.to_rfc3339()),
            sync_accounts: config.sync_accounts,
            sync_contacts: config.sync_contacts,
            sync_preferences: config.sync_preferences,
            sync_signatures: config.sync_signatures,
        })
    }

    pub async fn sync_get_status(&self) -> Result<Vec<SyncStatusDto>, CoreError> {
        let manager = self.get_sync_manager()?;
        let statuses = manager.get_status().await
            .map_err(|e| CoreError::Sync(format!("Failed to get status: {}", e)))?;
        Ok(statuses.into_iter().map(|s| SyncStatusDto {
            data_type: s.data_type,
            version: s.version,
            last_sync_at: s.last_sync_at.map(|t| t.to_rfc3339()),
            status: s.status.as_str().to_string(),
        }).collect())
    }

    pub async fn sync_list_devices(&self) -> Result<Vec<DeviceInfoDto>, CoreError> {
        let manager = self.get_sync_manager()?;
        let devices = manager.list_devices().await
            .map_err(|e| CoreError::Sync(format!("Failed to list devices: {}", e)))?;
        Ok(devices.into_iter().map(|d| DeviceInfoDto {
            device_id: d.device_id,
            device_name: d.device_name,
            platform: d.platform,
            last_seen_at: d.last_seen_at,
            created_at: d.created_at,
        }).collect())
    }

    pub async fn sync_revoke_device(&self, device_id: String) -> Result<(), CoreError> {
        let manager = self.get_sync_manager()?;
        manager.revoke_device(&device_id).await
            .map_err(|e| CoreError::Sync(format!("Failed to revoke device: {}", e)))
    }

    pub fn sync_get_queue_stats(&self) -> Result<QueueStatsDto, CoreError> {
        let manager = self.get_sync_manager()?;
        let stats = manager.get_queue_stats()
            .map_err(|e| CoreError::Sync(format!("Failed to get queue stats: {}", e)))?;
        Ok(QueueStatsDto {
            pending_count: stats.pending_count,
            in_progress_count: stats.in_progress_count,
            failed_count: stats.failed_count,
            completed_count: stats.completed_count,
            total_count: stats.total_count,
        })
    }

    pub fn sync_retry_failed(&self) -> Result<i32, CoreError> {
        let manager = self.get_sync_manager()?;
        manager.retry_failed_syncs()
            .map_err(|e| CoreError::Sync(format!("Failed to retry: {}", e)))
    }

    pub fn sync_clear_completed_queue(&self, older_than_days: i32) -> Result<i32, CoreError> {
        let manager = self.get_sync_manager()?;
        manager.clear_completed_queue(older_than_days)
            .map_err(|e| CoreError::Sync(format!("Failed to clear: {}", e)))
    }

    pub fn sync_clear_failed_queue(&self) -> Result<i32, CoreError> {
        let manager = self.get_sync_manager()?;
        manager.clear_failed_queue()
            .map_err(|e| CoreError::Sync(format!("Failed to clear: {}", e)))
    }

    pub async fn get_sync_history(&self, data_type: String, limit: i32) -> Result<Vec<SyncSnapshotDto>, CoreError> {
        let manager = self.get_sync_manager()?;
        let data_type_enum = parse_sync_data_type(&data_type)?;
        let snapshots = manager.get_sync_history(data_type_enum, limit)
            .map_err(|e| CoreError::Sync(format!("Failed to get history: {}", e)))?;
        Ok(snapshots.into_iter().map(|s| SyncSnapshotDto {
            id: s.id.unwrap_or(0),
            data_type: s.data_type,
            version: s.version,
            snapshot_hash: s.snapshot_hash,
            device_id: s.device_id,
            operation: format!("{:?}", s.operation).to_lowercase(),
            items_count: s.items_count,
            sync_status: format!("{:?}", s.sync_status).to_lowercase(),
            error_message: s.error_message,
            created_at: s.created_at.to_rfc3339(),
        }).collect())
    }

    // ========================================================================
    // Scheduler
    // ========================================================================

    pub async fn scheduler_start(&self) -> Result<(), CoreError> {
        self.background_scheduler
            .start(self.sync_manager.clone())
            .await
            .map_err(|e| CoreError::Sync(format!("Failed to start scheduler: {}", e)))
    }

    pub async fn scheduler_stop(&self) -> Result<(), CoreError> {
        self.background_scheduler
            .stop()
            .await
            .map_err(|e| CoreError::Sync(format!("Failed to stop scheduler: {}", e)))
    }

    pub async fn scheduler_get_status(&self) -> Result<SchedulerStatusDto, CoreError> {
        let config = self.background_scheduler.get_config().await;
        let running = self.background_scheduler.is_running();
        let next_run = if let Some(ref last_run_str) = config.last_run {
            if let Ok(last_run) = chrono::DateTime::parse_from_rfc3339(last_run_str) {
                let next = last_run + chrono::Duration::minutes(config.interval_minutes as i64);
                Some(next.to_rfc3339())
            } else { None }
        } else { None };

        Ok(SchedulerStatusDto {
            enabled: config.enabled,
            running,
            interval_minutes: config.interval_minutes,
            last_run: config.last_run,
            next_run,
        })
    }

    // ========================================================================
    // Filter Operations
    // ========================================================================

    pub async fn filter_list(&self, account_id: i64) -> Result<Vec<filters::EmailFilter>, CoreError> {
        self.db.get_filters(account_id)
            .map_err(|e| CoreError::Database(format!("Failed to list filters: {}", e)))
    }

    pub async fn filter_get(&self, filter_id: i64) -> Result<filters::EmailFilter, CoreError> {
        self.db.get_filter(filter_id)
            .map_err(|e| CoreError::Database(format!("Failed to get filter: {}", e)))
    }

    pub async fn filter_delete(&self, filter_id: i64) -> Result<(), CoreError> {
        self.db.delete_filter(filter_id)
            .map_err(|e| CoreError::Database(format!("Failed to delete filter: {}", e)))
    }

    pub async fn filter_toggle(&self, filter_id: i64) -> Result<(), CoreError> {
        self.db.toggle_filter(filter_id)
            .map_err(|e| CoreError::Database(format!("Failed to toggle filter: {}", e)))
    }

    pub async fn filter_add(&self, filter: filters::NewEmailFilter) -> Result<i64, CoreError> {
        self.db.add_filter(&filter)
            .map_err(|e| CoreError::Database(format!("Failed to add filter: {}", e)))
    }

    pub async fn filter_update(&self, filter_id: i64, filter: filters::NewEmailFilter) -> Result<(), CoreError> {
        self.db.update_filter(filter_id, &filter)
            .map_err(|e| CoreError::Database(format!("Failed to update filter: {}", e)))
    }

    // ========================================================================
    // Template Operations
    // ========================================================================

    pub async fn template_list(&self, account_id: i64) -> Result<Vec<db::EmailTemplate>, CoreError> {
        self.db.get_templates(account_id)
            .map_err(|e| CoreError::Database(format!("Failed to list templates: {}", e)))
    }

    pub async fn template_get(&self, template_id: i64) -> Result<db::EmailTemplate, CoreError> {
        self.db.get_template(template_id)
            .map_err(|e| CoreError::Database(format!("Failed to get template: {}", e)))
    }

    pub async fn template_delete(&self, template_id: i64) -> Result<(), CoreError> {
        self.db.delete_template(template_id)
            .map_err(|e| CoreError::Database(format!("Failed to delete template: {}", e)))
    }

    pub async fn template_add(&self, template: db::NewEmailTemplate) -> Result<i64, CoreError> {
        self.db.add_template(&template)
            .map_err(|e| CoreError::Database(format!("Failed to add template: {}", e)))
    }

    pub async fn template_update(&self, template_id: i64, template: db::NewEmailTemplate) -> Result<(), CoreError> {
        self.db.update_template(template_id, &template)
            .map_err(|e| CoreError::Database(format!("Failed to update template: {}", e)))
    }

    pub async fn template_toggle(&self, template_id: i64) -> Result<(), CoreError> {
        self.db.toggle_template(template_id)
            .map_err(|e| CoreError::Database(format!("Failed to toggle template: {}", e)))
    }

    pub async fn template_toggle_favorite(&self, template_id: i64) -> Result<(), CoreError> {
        self.db.toggle_template_favorite(template_id)
            .map_err(|e| CoreError::Database(format!("Failed to toggle template favorite: {}", e)))
    }

    pub async fn template_increment_usage(&self, template_id: i64) -> Result<(), CoreError> {
        self.db.increment_template_usage(template_id)
            .map_err(|e| CoreError::Database(format!("Failed to increment template usage: {}", e)))
    }

    pub async fn template_search(&self, account_id: i64, query: String, limit: i32) -> Result<Vec<db::EmailTemplate>, CoreError> {
        self.db.search_templates(account_id, &query, limit)
            .map_err(|e| CoreError::Database(format!("Failed to search templates: {}", e)))
    }

    // ========================================================================
    // OAuth Operations
    // ========================================================================

    /// Start OAuth flow for a provider. Returns (auth_url, csrf_state).
    pub fn oauth_start_flow(&self, provider: String) -> Result<(String, String), CoreError> {
        let config = match provider.to_lowercase().as_str() {
            "google" | "gmail" => oauth::gmail_config(),
            "microsoft" | "outlook" => oauth::microsoft_config(),
            _ => return Err(CoreError::OAuth(format!("Unknown OAuth provider: {}", provider))),
        };
        let (auth_url, csrf_token) = oauth::start_oauth_flow(&config)
            .map_err(|e| CoreError::OAuth(format!("Failed to start OAuth flow: {}", e)))?;
        Ok((auth_url, csrf_token.secret().clone()))
    }

    /// Handle OAuth callback. Returns complete result with IMAP/SMTP config.
    pub async fn oauth_handle_callback(
        &self,
        provider: String,
        authorization_code: String,
        csrf_state: String,
    ) -> Result<OAuthCompleteResult, CoreError> {
        let config = match provider.to_lowercase().as_str() {
            "google" | "gmail" => oauth::gmail_config(),
            "microsoft" | "outlook" => oauth::microsoft_config(),
            _ => return Err(CoreError::OAuth(format!("Unknown OAuth provider: {}", provider))),
        };
        let result = oauth::handle_oauth_callback(&config, authorization_code, csrf_state)
            .await
            .map_err(|e| CoreError::OAuth(format!("OAuth callback failed: {}", e)))?;

        // Provider-specific IMAP/SMTP settings
        let (imap_host, imap_port, smtp_host, smtp_port) = match provider.to_lowercase().as_str() {
            "google" | "gmail" => ("imap.gmail.com".to_string(), 993u16, "smtp.gmail.com".to_string(), 465u16),
            "microsoft" | "outlook" => ("outlook.office365.com".to_string(), 993u16, "smtp.office365.com".to_string(), 587u16),
            _ => unreachable!(),
        };

        Ok(OAuthCompleteResult {
            email: result.email,
            display_name: result.display_name,
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            imap_host,
            imap_port,
            smtp_host,
            smtp_port,
        })
    }

    // ========================================================================
    // Label Operations
    // ========================================================================

    pub fn label_create(&self, account_id: Option<i64>, name: String, color: String) -> Result<db::Label, CoreError> {
        self.db.label_create(account_id, &name, &color).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn label_list(&self, account_id: Option<i64>) -> Result<Vec<db::Label>, CoreError> {
        self.db.label_list(account_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn label_update(&self, id: i64, name: Option<String>, color: Option<String>) -> Result<db::Label, CoreError> {
        self.db.label_update(id, name.as_deref(), color.as_deref()).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn label_delete(&self, id: i64) -> Result<(), CoreError> {
        self.db.label_delete(id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn email_add_label(&self, email_id: i64, label_id: i64) -> Result<(), CoreError> {
        self.db.email_add_label(email_id, label_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn email_remove_label(&self, email_id: i64, label_id: i64) -> Result<(), CoreError> {
        self.db.email_remove_label(email_id, label_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn email_get_labels(&self, email_id: i64) -> Result<Vec<db::Label>, CoreError> {
        self.db.email_get_labels(email_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn label_get_email_ids(&self, label_id: i64) -> Result<Vec<i64>, CoreError> {
        self.db.label_get_email_ids(label_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    // ========================================================================
    // Alias Operations
    // ========================================================================

    pub fn alias_add(&self, account_id: i64, alias_email: String, alias_name: Option<String>) -> Result<i64, CoreError> {
        self.db.alias_add(account_id, &alias_email, alias_name.as_deref()).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn alias_list(&self, account_id: i64) -> Result<Vec<db::EmailAlias>, CoreError> {
        self.db.alias_list(account_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn alias_update(&self, alias_id: i64, alias_email: Option<String>, alias_name: Option<String>) -> Result<(), CoreError> {
        self.db.alias_update(alias_id, alias_email.as_deref(), alias_name.as_deref()).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn alias_delete(&self, alias_id: i64) -> Result<(), CoreError> {
        self.db.alias_delete(alias_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn alias_toggle(&self, alias_id: i64) -> Result<(), CoreError> {
        self.db.alias_toggle(alias_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    pub fn alias_set_default(&self, alias_id: i64, account_id: i64) -> Result<(), CoreError> {
        self.db.alias_set_default(alias_id, account_id).map_err(|e| CoreError::Database(e.to_string()))
    }

    // ========================================================================
    // Cache Operations
    // ========================================================================

    pub async fn cache_get_stats(&self) -> Result<CacheStats, CoreError> {
        Ok(self.email_cache.stats().await)
    }

    pub async fn cache_clear(&self) -> Result<(), CoreError> {
        self.email_cache.clear().await;
        Ok(())
    }
}
