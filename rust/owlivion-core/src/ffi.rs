//! # UniFFI Foreign Function Interface
//!
//! This module provides the FFI layer for Kotlin (Android) and Swift (iOS) bindings.
//! Uses UniFFI 0.28 proc-macro approach - no UDL file needed.
//!
//! All types here are UniFFI-compatible wrappers around internal types.

use std::sync::Arc;
use crate::{OwlivionCore, CoreConfig, CoreError};
use crate::db;
use crate::mail;
use crate::cache;

// Note: uniffi::setup_scaffolding!() is in lib.rs (must be at crate root)

// ============================================================================
// FFI Configuration
// ============================================================================

/// Configuration for initializing the Owlivion core engine.
/// Paths are provided as strings for cross-platform compatibility.
#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiCoreConfig {
    /// Absolute path to app data directory (database, keys, etc.)
    pub data_dir: String,
    /// Absolute path to cache directory (drafts, temp files)
    pub cache_dir: String,
}

// ============================================================================
// FFI Error
// ============================================================================

/// FFI-compatible error type.
/// Uses flat_error to convert all variants to string messages on the FFI boundary.
#[derive(Debug, thiserror::Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum FfiError {
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

impl From<CoreError> for FfiError {
    fn from(e: CoreError) -> Self {
        match e {
            CoreError::Database(s) => FfiError::Database(s),
            CoreError::Imap(s) => FfiError::Imap(s),
            CoreError::Smtp(s) => FfiError::Smtp(s),
            CoreError::Crypto(s) => FfiError::Crypto(s),
            CoreError::Sync(s) => FfiError::Sync(s),
            CoreError::OAuth(s) => FfiError::OAuth(s),
            CoreError::Validation(s) => FfiError::Validation(s),
            CoreError::NotFound(s) => FfiError::NotFound(s),
            CoreError::RateLimited(s) => FfiError::RateLimited(s),
            CoreError::Io(s) => FfiError::Io(s),
            CoreError::Other(s) => FfiError::Other(s),
        }
    }
}

// ============================================================================
// FFI Record Types (Data Transfer Objects)
// ============================================================================

// --- Account ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiAccount {
    pub id: i64,
    pub email: String,
    pub display_name: String,
    pub imap_host: String,
    pub imap_port: i32,
    pub imap_security: String,
    pub imap_username: Option<String>,
    pub smtp_host: String,
    pub smtp_port: i32,
    pub smtp_security: String,
    pub smtp_username: Option<String>,
    pub oauth_provider: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub signature: String,
    pub sync_days: i32,
    pub accept_invalid_certs: bool,
    pub enable_priority_fetch: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<db::Account> for FfiAccount {
    fn from(a: db::Account) -> Self {
        Self {
            id: a.id,
            email: a.email,
            display_name: a.display_name,
            imap_host: a.imap_host,
            imap_port: a.imap_port,
            imap_security: a.imap_security,
            imap_username: a.imap_username,
            smtp_host: a.smtp_host,
            smtp_port: a.smtp_port,
            smtp_security: a.smtp_security,
            smtp_username: a.smtp_username,
            oauth_provider: a.oauth_provider,
            is_active: a.is_active,
            is_default: a.is_default,
            signature: a.signature,
            sync_days: a.sync_days,
            accept_invalid_certs: a.accept_invalid_certs,
            enable_priority_fetch: a.enable_priority_fetch,
            created_at: a.created_at,
            updated_at: a.updated_at,
        }
    }
}

// --- AutoConfig ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiAutoConfig {
    pub provider: Option<String>,
    pub display_name: Option<String>,
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_security: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: String,
    pub detection_method: Option<String>,
}

fn security_type_to_string(st: &mail::SecurityType) -> String {
    match st {
        mail::SecurityType::SSL => "SSL".to_string(),
        mail::SecurityType::STARTTLS => "STARTTLS".to_string(),
        mail::SecurityType::NONE => "NONE".to_string(),
    }
}

impl From<mail::AutoConfig> for FfiAutoConfig {
    fn from(ac: mail::AutoConfig) -> Self {
        Self {
            provider: ac.provider,
            display_name: ac.display_name,
            imap_host: ac.imap_host,
            imap_port: ac.imap_port,
            imap_security: security_type_to_string(&ac.imap_security),
            smtp_host: ac.smtp_host,
            smtp_port: ac.smtp_port,
            smtp_security: security_type_to_string(&ac.smtp_security),
            detection_method: ac.detection_method,
        }
    }
}

// --- AutoConfigDebug ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiAutoConfigDebug {
    pub email: String,
    pub domain: String,
    pub preset_tried: bool,
    pub preset_result: Option<String>,
    pub isp_autoconfig_tried: bool,
    pub isp_autoconfig_result: Option<String>,
    pub wellknown_tried: bool,
    pub wellknown_result: Option<String>,
    pub ispdb_tried: bool,
    pub ispdb_result: Option<String>,
    pub mx_lookup_tried: bool,
    pub mx_lookup_result: Option<String>,
    pub guessing_tried: bool,
    pub guessing_result: Option<String>,
    pub final_config: Option<FfiAutoConfig>,
    pub total_duration_ms: u64,
}

impl From<mail::AutoConfigDebug> for FfiAutoConfigDebug {
    fn from(d: mail::AutoConfigDebug) -> Self {
        Self {
            email: d.email,
            domain: d.domain,
            preset_tried: d.preset_tried,
            preset_result: d.preset_result,
            isp_autoconfig_tried: d.isp_autoconfig_tried,
            isp_autoconfig_result: d.isp_autoconfig_result,
            wellknown_tried: d.wellknown_tried,
            wellknown_result: d.wellknown_result,
            ispdb_tried: d.ispdb_tried,
            ispdb_result: d.ispdb_result,
            mx_lookup_tried: d.mx_lookup_tried,
            mx_lookup_result: d.mx_lookup_result,
            guessing_tried: d.guessing_tried,
            guessing_result: d.guessing_result,
            final_config: d.final_config.map(FfiAutoConfig::from),
            total_duration_ms: d.total_duration_ms as u64,
        }
    }
}

// --- Folder ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiFolder {
    pub name: String,
    pub path: String,
    pub folder_type: String,
    pub delimiter: String,
    pub is_subscribed: bool,
    pub is_selectable: bool,
    pub unread_count: u32,
    pub total_count: u32,
}

impl From<mail::Folder> for FfiFolder {
    fn from(f: mail::Folder) -> Self {
        Self {
            name: f.name,
            path: f.path,
            folder_type: format!("{:?}", f.folder_type),
            delimiter: f.delimiter,
            is_subscribed: f.is_subscribed,
            is_selectable: f.is_selectable,
            unread_count: f.unread_count,
            total_count: f.total_count,
        }
    }
}

// --- Email Summary (IMAP) ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiMailEmailSummary {
    pub uid: u32,
    pub message_id: Option<String>,
    pub from: String,
    pub from_name: Option<String>,
    pub subject: String,
    pub preview: String,
    pub date: String,
    pub is_read: bool,
    pub is_starred: bool,
    pub has_attachments: bool,
    pub account_id: Option<String>,
    pub account_email: Option<String>,
    pub account_name: Option<String>,
    pub account_color: Option<String>,
}

impl From<mail::EmailSummary> for FfiMailEmailSummary {
    fn from(e: mail::EmailSummary) -> Self {
        Self {
            uid: e.uid,
            message_id: e.message_id,
            from: e.from,
            from_name: e.from_name,
            subject: e.subject,
            preview: e.preview,
            date: e.date,
            is_read: e.is_read,
            is_starred: e.is_starred,
            has_attachments: e.has_attachments,
            account_id: e.account_id,
            account_email: e.account_email,
            account_name: e.account_name,
            account_color: e.account_color,
        }
    }
}

// --- Fetch Result ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiFetchResult {
    pub emails: Vec<FfiMailEmailSummary>,
    pub total: u32,
    pub has_more: bool,
}

impl From<mail::FetchResult> for FfiFetchResult {
    fn from(r: mail::FetchResult) -> Self {
        Self {
            emails: r.emails.into_iter().map(FfiMailEmailSummary::from).collect(),
            total: r.total,
            has_more: r.has_more,
        }
    }
}

// --- Parsed Email ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiEmailAttachment {
    pub filename: String,
    pub content_type: String,
    pub size: u32,
    pub index: u64,
    pub content_id: Option<String>,
    pub is_inline: bool,
}

impl From<mail::EmailAttachment> for FfiEmailAttachment {
    fn from(a: mail::EmailAttachment) -> Self {
        Self {
            filename: a.filename,
            content_type: a.content_type,
            size: a.size,
            index: a.index as u64,
            content_id: a.content_id,
            is_inline: a.is_inline,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiParsedEmail {
    pub uid: u32,
    pub message_id: Option<String>,
    pub from: String,
    pub from_name: Option<String>,
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub subject: String,
    pub date: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub attachments: Vec<FfiEmailAttachment>,
}

impl From<mail::ParsedEmail> for FfiParsedEmail {
    fn from(e: mail::ParsedEmail) -> Self {
        Self {
            uid: e.uid,
            message_id: e.message_id,
            from: e.from,
            from_name: e.from_name,
            to: e.to,
            cc: e.cc,
            subject: e.subject,
            date: e.date,
            body_text: e.body_text,
            body_html: e.body_html,
            is_read: e.is_read,
            is_starred: e.is_starred,
            attachments: e.attachments.into_iter().map(FfiEmailAttachment::from).collect(),
        }
    }
}

// --- DB Email Summary (search results) ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiDbEmailSummary {
    pub id: i64,
    pub message_id: String,
    pub uid: u32,
    pub from_address: String,
    pub from_name: Option<String>,
    pub subject: String,
    pub preview: String,
    pub date: String,
    pub is_read: bool,
    pub is_starred: bool,
    pub has_attachments: bool,
    pub has_inline_images: bool,
}

impl From<db::EmailSummary> for FfiDbEmailSummary {
    fn from(e: db::EmailSummary) -> Self {
        Self {
            id: e.id,
            message_id: e.message_id,
            uid: e.uid,
            from_address: e.from_address,
            from_name: e.from_name,
            subject: e.subject,
            preview: e.preview,
            date: e.date,
            is_read: e.is_read,
            is_starred: e.is_starred,
            has_attachments: e.has_attachments,
            has_inline_images: e.has_inline_images,
        }
    }
}

// --- Attachment ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiAttachment {
    pub id: i64,
    pub email_id: i64,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub content_id: Option<String>,
    pub is_inline: bool,
    pub local_path: Option<String>,
    pub is_downloaded: bool,
    pub created_at: String,
}

impl From<db::Attachment> for FfiAttachment {
    fn from(a: db::Attachment) -> Self {
        Self {
            id: a.id,
            email_id: a.email_id,
            filename: a.filename,
            content_type: a.content_type,
            size: a.size,
            content_id: a.content_id,
            is_inline: a.is_inline,
            local_path: a.local_path,
            is_downloaded: a.is_downloaded,
            created_at: a.created_at,
        }
    }
}

// --- Email Filter ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiEmailFilter {
    pub id: i64,
    pub account_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_enabled: bool,
    pub priority: i32,
    pub match_logic: String,
    pub conditions_json: String,
    pub actions_json: String,
    pub matched_count: i32,
    pub last_matched_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::filters::EmailFilter> for FfiEmailFilter {
    fn from(f: crate::filters::EmailFilter) -> Self {
        Self {
            id: f.id,
            account_id: f.account_id,
            name: f.name,
            description: f.description,
            is_enabled: f.is_enabled,
            priority: f.priority,
            match_logic: f.match_logic.as_str().to_string(),
            conditions_json: serde_json::to_string(&f.conditions).unwrap_or_default(),
            actions_json: serde_json::to_string(&f.actions).unwrap_or_default(),
            matched_count: f.matched_count,
            last_matched_at: f.last_matched_at,
            created_at: f.created_at,
            updated_at: f.updated_at,
        }
    }
}

// --- Email Template ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiEmailTemplate {
    pub id: i64,
    pub account_id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub subject_template: String,
    pub body_html_template: String,
    pub body_text_template: Option<String>,
    pub tags_json: String,
    pub is_enabled: bool,
    pub is_favorite: bool,
    pub usage_count: i64,
    pub last_used_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<db::EmailTemplate> for FfiEmailTemplate {
    fn from(t: db::EmailTemplate) -> Self {
        Self {
            id: t.id,
            account_id: t.account_id,
            name: t.name,
            description: t.description,
            category: t.category,
            subject_template: t.subject_template,
            body_html_template: t.body_html_template,
            body_text_template: t.body_text_template,
            tags_json: serde_json::to_string(&t.tags).unwrap_or_default(),
            is_enabled: t.is_enabled,
            is_favorite: t.is_favorite,
            usage_count: t.usage_count,
            last_used_at: t.last_used_at,
            created_at: t.created_at,
            updated_at: t.updated_at,
        }
    }
}

// --- Attachment Path (temp file write result) ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiAttachmentPath {
    pub path: String,
    pub filename: String,
    pub content_type: String,
}

// --- Cache Stats ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiCacheStats {
    pub hits: u64,
    pub misses: u64,
    pub total_requests: u64,
    pub hit_rate: f64,
    pub entry_count: u64,
    pub weighted_size: u64,
}

impl From<cache::CacheStats> for FfiCacheStats {
    fn from(s: cache::CacheStats) -> Self {
        Self {
            hits: s.hits,
            misses: s.misses,
            total_requests: s.total_requests,
            hit_rate: s.hit_rate,
            entry_count: s.entry_count,
            weighted_size: s.weighted_size,
        }
    }
}

// --- Sync Types ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiSyncResult {
    pub accounts_synced: bool,
    pub contacts_synced: bool,
    pub preferences_synced: bool,
    pub signatures_synced: bool,
    pub errors: Vec<String>,
    pub conflicts_json: String,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiSyncConfig {
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

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiSyncStatus {
    pub data_type: String,
    pub version: i32,
    pub last_sync_at: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiDeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub last_seen_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiQueueStats {
    pub pending_count: i32,
    pub in_progress_count: i32,
    pub failed_count: i32,
    pub completed_count: i32,
    pub total_count: i32,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiSyncSnapshot {
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

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiSchedulerStatus {
    pub enabled: bool,
    pub running: bool,
    pub interval_minutes: u64,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
}

// --- OAuth Types ---

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiOAuthStartResult {
    pub auth_url: String,
    pub csrf_state: String,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiOAuthCompleteResult {
    pub email: String,
    pub display_name: Option<String>,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub imap_host: String,
    pub imap_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
}

// ============================================================================
// Label & Alias FFI Types
// ============================================================================

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiLabel {
    pub id: i64,
    pub account_id: Option<i64>,
    pub name: String,
    pub color: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::db::Label> for FfiLabel {
    fn from(l: crate::db::Label) -> Self {
        FfiLabel {
            id: l.id,
            account_id: l.account_id,
            name: l.name,
            color: l.color,
            sort_order: l.sort_order,
            created_at: l.created_at,
            updated_at: l.updated_at,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiEmailAlias {
    pub id: i64,
    pub account_id: i64,
    pub alias_email: String,
    pub alias_name: Option<String>,
    pub is_default: bool,
    pub is_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::db::EmailAlias> for FfiEmailAlias {
    fn from(a: crate::db::EmailAlias) -> Self {
        FfiEmailAlias {
            id: a.id,
            account_id: a.account_id,
            alias_email: a.alias_email,
            alias_name: a.alias_name,
            is_default: a.is_default,
            is_enabled: a.is_enabled,
            created_at: a.created_at,
            updated_at: a.updated_at,
        }
    }
}

// ============================================================================
// FFI Object - Main Entry Point
// ============================================================================

/// The main Owlivion Mail engine, exposed to Kotlin/Swift via UniFFI.
/// Thread-safe, reference-counted via Arc.
#[derive(uniffi::Object)]
pub struct FfiOwlivionCore {
    inner: Arc<OwlivionCore>,
}

// ============================================================================
// Exported Methods
// ============================================================================

#[uniffi::export(async_runtime = "tokio")]
impl FfiOwlivionCore {
    // --- Constructor ---

    /// Initialize the Owlivion Mail engine with the given configuration.
    #[uniffi::constructor]
    pub fn new(config: FfiCoreConfig) -> Result<Arc<Self>, FfiError> {
        let core_config = CoreConfig {
            data_dir: config.data_dir.into(),
            cache_dir: config.cache_dir.into(),
        };
        let inner = OwlivionCore::new(core_config).map_err(FfiError::from)?;
        Ok(Arc::new(Self { inner }))
    }

    // --- Account Management ---

    /// Auto-detect mail server configuration for an email address.
    pub async fn autoconfig_detect(&self, email: String) -> Result<FfiAutoConfig, FfiError> {
        self.inner
            .autoconfig_detect(email)
            .await
            .map(FfiAutoConfig::from)
            .map_err(FfiError::from)
    }

    /// Auto-detect with detailed debug information.
    pub async fn autoconfig_detect_debug(&self, email: String) -> Result<FfiAutoConfigDebug, FfiError> {
        self.inner
            .autoconfig_detect_debug(email)
            .await
            .map(FfiAutoConfigDebug::from)
            .map_err(FfiError::from)
    }

    /// Test IMAP connection with given credentials.
    pub async fn account_test_imap(
        &self,
        host: String,
        port: u16,
        security: String,
        email: String,
        password: String,
    ) -> Result<(), FfiError> {
        self.inner
            .account_test_imap(host, port, security, email, password)
            .await
            .map_err(FfiError::from)
    }

    /// Test SMTP connection with given credentials.
    pub async fn account_test_smtp(
        &self,
        host: String,
        port: u16,
        security: String,
        email: String,
        password: String,
    ) -> Result<(), FfiError> {
        self.inner
            .account_test_smtp(host, port, security, email, password)
            .await
            .map_err(FfiError::from)
    }

    /// Add a new email account. Returns the account ID as string.
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
    ) -> Result<String, FfiError> {
        self.inner
            .account_add(
                email,
                display_name,
                password,
                imap_host,
                imap_port,
                imap_security,
                smtp_host,
                smtp_port,
                smtp_security,
                is_default,
                accept_invalid_certs,
                oauth_provider,
            )
            .await
            .map_err(FfiError::from)
    }

    /// List all configured email accounts.
    pub async fn account_list(&self) -> Result<Vec<FfiAccount>, FfiError> {
        self.inner
            .account_list()
            .await
            .map(|accounts| accounts.into_iter().map(FfiAccount::from).collect())
            .map_err(FfiError::from)
    }

    /// Connect to an account's IMAP server.
    pub async fn account_connect(&self, account_id: String) -> Result<(), FfiError> {
        self.inner
            .account_connect(account_id)
            .await
            .map_err(FfiError::from)
    }

    /// Delete an email account by ID.
    pub async fn account_delete(&self, account_id: String) -> Result<(), FfiError> {
        self.inner
            .account_delete(account_id)
            .await
            .map_err(FfiError::from)
    }

    /// Update an account's email signature.
    pub async fn account_update_signature(
        &self,
        account_id: String,
        signature: String,
    ) -> Result<(), FfiError> {
        self.inner
            .account_update_signature(account_id, signature)
            .await
            .map_err(FfiError::from)
    }

    /// Get priority fetch setting for an account.
    pub async fn account_get_priority_fetch(&self, account_id: i64) -> Result<bool, FfiError> {
        self.inner
            .account_get_priority_fetch(account_id)
            .await
            .map_err(FfiError::from)
    }

    /// Set priority fetch setting for an account.
    pub async fn account_set_priority_fetch(
        &self,
        account_id: i64,
        enabled: bool,
    ) -> Result<(), FfiError> {
        self.inner
            .account_set_priority_fetch(account_id, enabled)
            .await
            .map_err(FfiError::from)
    }

    // --- Email Operations ---

    /// List folders for a connected account.
    pub async fn folder_list(&self, account_id: String) -> Result<Vec<FfiFolder>, FfiError> {
        self.inner
            .folder_list(account_id)
            .await
            .map(|folders| folders.into_iter().map(FfiFolder::from).collect())
            .map_err(FfiError::from)
    }

    /// Fetch emails from a folder with pagination.
    pub async fn email_list(
        &self,
        account_id: String,
        folder: Option<String>,
        page: u32,
        page_size: u32,
    ) -> Result<FfiFetchResult, FfiError> {
        self.inner
            .email_list(account_id, folder, page, page_size)
            .await
            .map(FfiFetchResult::from)
            .map_err(FfiError::from)
    }

    /// Fetch a full email by UID.
    pub async fn email_get(
        &self,
        account_id: String,
        uid: u32,
        folder: Option<String>,
    ) -> Result<FfiParsedEmail, FfiError> {
        self.inner
            .email_get(account_id, uid, folder)
            .await
            .map(FfiParsedEmail::from)
            .map_err(FfiError::from)
    }

    /// Search emails by query string.
    pub async fn email_search(
        &self,
        account_id: String,
        query: String,
    ) -> Result<Vec<FfiDbEmailSummary>, FfiError> {
        self.inner
            .email_search(account_id, query)
            .await
            .map(|emails| emails.into_iter().map(FfiDbEmailSummary::from).collect())
            .map_err(FfiError::from)
    }

    /// Mark an email as read or unread.
    pub async fn email_mark_read(
        &self,
        account_id: String,
        uid: u32,
        read: bool,
        folder: Option<String>,
    ) -> Result<(), FfiError> {
        self.inner
            .email_mark_read(account_id, uid, read, folder)
            .await
            .map_err(FfiError::from)
    }

    /// Mark an email as starred or unstarred.
    pub async fn email_mark_starred(
        &self,
        account_id: String,
        uid: u32,
        starred: bool,
        folder: Option<String>,
    ) -> Result<(), FfiError> {
        self.inner
            .email_mark_starred(account_id, uid, starred, folder)
            .await
            .map_err(FfiError::from)
    }

    /// Move an email to another folder.
    pub async fn email_move(
        &self,
        account_id: String,
        uid: u32,
        target_folder: String,
        folder: Option<String>,
    ) -> Result<(), FfiError> {
        self.inner
            .email_move(account_id, uid, target_folder, folder)
            .await
            .map_err(FfiError::from)
    }

    /// Delete an email (move to trash or permanent delete).
    pub async fn email_delete(
        &self,
        account_id: String,
        uid: u32,
        permanent: bool,
        folder: Option<String>,
    ) -> Result<(), FfiError> {
        self.inner
            .email_delete(account_id, uid, permanent, folder)
            .await
            .map_err(FfiError::from)
    }

    // --- Send Email ---

    /// Send an email via SMTP (regular or OAuth2).
    pub async fn email_send(
        &self,
        account_id: String,
        to: Vec<String>,
        cc: Vec<String>,
        bcc: Vec<String>,
        subject: String,
        body_text: Option<String>,
        body_html: Option<String>,
        attachment_paths: Vec<FfiAttachmentPath>,
    ) -> Result<(), FfiError> {
        let paths: Vec<crate::AttachmentPath> = attachment_paths
            .into_iter()
            .map(|p| crate::AttachmentPath {
                path: p.path,
                filename: p.filename,
                content_type: p.content_type,
            })
            .collect();
        self.inner
            .email_send(account_id, to, cc, bcc, subject, body_text, body_html, paths)
            .await
            .map_err(FfiError::from)
    }

    // --- Attachment Operations ---

    /// Write attachment data to a temporary file. Returns the file path info.
    pub async fn write_temp_attachment(
        &self,
        filename: String,
        content_type: String,
        data: Vec<u8>,
    ) -> Result<FfiAttachmentPath, FfiError> {
        let result = self
            .inner
            .write_temp_attachment(filename, content_type, data)
            .await
            .map_err(FfiError::from)?;
        Ok(FfiAttachmentPath {
            path: result.path,
            filename: result.filename,
            content_type: result.content_type,
        })
    }

    /// Get attachments for an email.
    pub async fn get_email_attachments(
        &self,
        email_id: i64,
    ) -> Result<Vec<FfiAttachment>, FfiError> {
        self.inner
            .get_email_attachments(email_id)
            .await
            .map(|attachments| attachments.into_iter().map(FfiAttachment::from).collect())
            .map_err(FfiError::from)
    }

    // --- Filter Operations ---

    /// List all filters for an account.
    pub async fn filter_list(&self, account_id: i64) -> Result<Vec<FfiEmailFilter>, FfiError> {
        self.inner
            .filter_list(account_id)
            .await
            .map(|filters| filters.into_iter().map(FfiEmailFilter::from).collect())
            .map_err(FfiError::from)
    }

    /// Get a single filter by ID.
    pub async fn filter_get(&self, filter_id: i64) -> Result<FfiEmailFilter, FfiError> {
        self.inner
            .filter_get(filter_id)
            .await
            .map(FfiEmailFilter::from)
            .map_err(FfiError::from)
    }

    /// Add a new filter. Conditions and actions are JSON arrays.
    pub async fn filter_add(
        &self,
        account_id: i64,
        name: String,
        description: Option<String>,
        is_enabled: bool,
        priority: i32,
        match_logic: String,
        conditions_json: String,
        actions_json: String,
    ) -> Result<i64, FfiError> {
        use crate::filters::{NewEmailFilter, MatchLogic, FilterCondition, FilterAction};

        let match_logic = match match_logic.to_lowercase().as_str() {
            "any" => MatchLogic::Any,
            _ => MatchLogic::All,
        };
        let conditions: Vec<FilterCondition> = serde_json::from_str(&conditions_json)
            .map_err(|e| FfiError::Validation(format!("Invalid conditions JSON: {}", e)))?;
        let actions: Vec<FilterAction> = serde_json::from_str(&actions_json)
            .map_err(|e| FfiError::Validation(format!("Invalid actions JSON: {}", e)))?;

        let filter = NewEmailFilter {
            account_id,
            name,
            description,
            is_enabled,
            priority,
            match_logic,
            conditions,
            actions,
        };
        self.inner.filter_add(filter).await.map_err(FfiError::from)
    }

    /// Update an existing filter.
    pub async fn filter_update(
        &self,
        filter_id: i64,
        account_id: i64,
        name: String,
        description: Option<String>,
        is_enabled: bool,
        priority: i32,
        match_logic: String,
        conditions_json: String,
        actions_json: String,
    ) -> Result<(), FfiError> {
        use crate::filters::{NewEmailFilter, MatchLogic, FilterCondition, FilterAction};

        let match_logic = match match_logic.to_lowercase().as_str() {
            "any" => MatchLogic::Any,
            _ => MatchLogic::All,
        };
        let conditions: Vec<FilterCondition> = serde_json::from_str(&conditions_json)
            .map_err(|e| FfiError::Validation(format!("Invalid conditions JSON: {}", e)))?;
        let actions: Vec<FilterAction> = serde_json::from_str(&actions_json)
            .map_err(|e| FfiError::Validation(format!("Invalid actions JSON: {}", e)))?;

        let filter = NewEmailFilter {
            account_id,
            name,
            description,
            is_enabled,
            priority,
            match_logic,
            conditions,
            actions,
        };
        self.inner.filter_update(filter_id, filter).await.map_err(FfiError::from)
    }

    /// Delete a filter by ID.
    pub async fn filter_delete(&self, filter_id: i64) -> Result<(), FfiError> {
        self.inner.filter_delete(filter_id).await.map_err(FfiError::from)
    }

    /// Toggle a filter's enabled state.
    pub async fn filter_toggle(&self, filter_id: i64) -> Result<(), FfiError> {
        self.inner.filter_toggle(filter_id).await.map_err(FfiError::from)
    }

    // --- Template Operations ---

    /// List all templates for an account.
    pub async fn template_list(&self, account_id: i64) -> Result<Vec<FfiEmailTemplate>, FfiError> {
        self.inner
            .template_list(account_id)
            .await
            .map(|templates| templates.into_iter().map(FfiEmailTemplate::from).collect())
            .map_err(FfiError::from)
    }

    /// Get a single template by ID.
    pub async fn template_get(&self, template_id: i64) -> Result<FfiEmailTemplate, FfiError> {
        self.inner
            .template_get(template_id)
            .await
            .map(FfiEmailTemplate::from)
            .map_err(FfiError::from)
    }

    /// Add a new template.
    pub async fn template_add(
        &self,
        account_id: Option<i64>,
        name: String,
        description: Option<String>,
        category: String,
        subject_template: String,
        body_html_template: String,
        body_text_template: Option<String>,
        tags_json: String,
        is_enabled: bool,
        is_favorite: bool,
    ) -> Result<i64, FfiError> {
        let tags: Vec<String> = serde_json::from_str(&tags_json)
            .map_err(|e| FfiError::Validation(format!("Invalid tags JSON: {}", e)))?;
        let template = db::NewEmailTemplate {
            account_id,
            name,
            description,
            category,
            subject_template,
            body_html_template,
            body_text_template,
            tags,
            is_enabled,
            is_favorite,
        };
        self.inner.template_add(template).await.map_err(FfiError::from)
    }

    /// Update an existing template.
    pub async fn template_update(
        &self,
        template_id: i64,
        account_id: Option<i64>,
        name: String,
        description: Option<String>,
        category: String,
        subject_template: String,
        body_html_template: String,
        body_text_template: Option<String>,
        tags_json: String,
        is_enabled: bool,
        is_favorite: bool,
    ) -> Result<(), FfiError> {
        let tags: Vec<String> = serde_json::from_str(&tags_json)
            .map_err(|e| FfiError::Validation(format!("Invalid tags JSON: {}", e)))?;
        let template = db::NewEmailTemplate {
            account_id,
            name,
            description,
            category,
            subject_template,
            body_html_template,
            body_text_template,
            tags,
            is_enabled,
            is_favorite,
        };
        self.inner.template_update(template_id, template).await.map_err(FfiError::from)
    }

    /// Delete a template by ID.
    pub async fn template_delete(&self, template_id: i64) -> Result<(), FfiError> {
        self.inner.template_delete(template_id).await.map_err(FfiError::from)
    }

    /// Toggle a template's enabled state.
    pub async fn template_toggle(&self, template_id: i64) -> Result<(), FfiError> {
        self.inner.template_toggle(template_id).await.map_err(FfiError::from)
    }

    /// Toggle a template's favorite status.
    pub async fn template_toggle_favorite(&self, template_id: i64) -> Result<(), FfiError> {
        self.inner.template_toggle_favorite(template_id).await.map_err(FfiError::from)
    }

    /// Increment template usage counter.
    pub async fn template_increment_usage(&self, template_id: i64) -> Result<(), FfiError> {
        self.inner.template_increment_usage(template_id).await.map_err(FfiError::from)
    }

    /// Search templates by query.
    pub async fn template_search(
        &self,
        account_id: i64,
        query: String,
        limit: i32,
    ) -> Result<Vec<FfiEmailTemplate>, FfiError> {
        self.inner
            .template_search(account_id, query, limit)
            .await
            .map(|templates| templates.into_iter().map(FfiEmailTemplate::from).collect())
            .map_err(FfiError::from)
    }

    // --- Cache Operations ---

    /// Get email cache statistics.
    pub async fn cache_get_stats(&self) -> Result<FfiCacheStats, FfiError> {
        self.inner
            .cache_get_stats()
            .await
            .map(FfiCacheStats::from)
            .map_err(FfiError::from)
    }

    /// Clear the email cache.
    pub async fn cache_clear(&self) -> Result<(), FfiError> {
        self.inner.cache_clear().await.map_err(FfiError::from)
    }

    // --- Sync Operations ---

    /// Register a new Owlivion sync account.
    pub async fn sync_register(
        &self,
        email: String,
        password: String,
        master_password: String,
    ) -> Result<(), FfiError> {
        self.inner.sync_register(email, password, master_password).await.map_err(FfiError::from)
    }

    /// Login to Owlivion sync account.
    pub async fn sync_login(&self, email: String, password: String) -> Result<(), FfiError> {
        self.inner.sync_login(email, password).await.map_err(FfiError::from)
    }

    /// Logout from Owlivion sync account.
    pub async fn sync_logout(&self) -> Result<(), FfiError> {
        self.inner.sync_logout().await.map_err(FfiError::from)
    }

    /// Start full bidirectional sync.
    pub async fn sync_start(&self, master_password: String) -> Result<FfiSyncResult, FfiError> {
        let result = self.inner.sync_start(master_password).await.map_err(FfiError::from)?;
        let conflicts_json = result.conflicts
            .map(|c| serde_json::to_string(&c).unwrap_or_default())
            .unwrap_or_else(|| "[]".to_string());
        Ok(FfiSyncResult {
            accounts_synced: result.accounts_synced,
            contacts_synced: result.contacts_synced,
            preferences_synced: result.preferences_synced,
            signatures_synced: result.signatures_synced,
            errors: result.errors,
            conflicts_json,
        })
    }

    /// Get sync configuration.
    pub async fn sync_get_config(&self) -> Result<FfiSyncConfig, FfiError> {
        let config = self.inner.sync_get_config().await.map_err(FfiError::from)?;
        Ok(FfiSyncConfig {
            enabled: config.enabled,
            user_id: config.user_id,
            device_id: config.device_id,
            device_name: config.device_name,
            platform: config.platform,
            last_sync_at: config.last_sync_at,
            sync_accounts: config.sync_accounts,
            sync_contacts: config.sync_contacts,
            sync_preferences: config.sync_preferences,
            sync_signatures: config.sync_signatures,
        })
    }

    /// Get per-data-type sync status.
    pub async fn sync_get_status(&self) -> Result<Vec<FfiSyncStatus>, FfiError> {
        let statuses = self.inner.sync_get_status().await.map_err(FfiError::from)?;
        Ok(statuses.into_iter().map(|s| FfiSyncStatus {
            data_type: s.data_type,
            version: s.version,
            last_sync_at: s.last_sync_at,
            status: s.status,
        }).collect())
    }

    /// List all registered devices.
    pub async fn sync_list_devices(&self) -> Result<Vec<FfiDeviceInfo>, FfiError> {
        let devices = self.inner.sync_list_devices().await.map_err(FfiError::from)?;
        Ok(devices.into_iter().map(|d| FfiDeviceInfo {
            device_id: d.device_id,
            device_name: d.device_name,
            platform: d.platform,
            last_seen_at: d.last_seen_at,
            created_at: d.created_at,
        }).collect())
    }

    /// Revoke a device from sync.
    pub async fn sync_revoke_device(&self, device_id: String) -> Result<(), FfiError> {
        self.inner.sync_revoke_device(device_id).await.map_err(FfiError::from)
    }

    /// Get sync queue statistics.
    pub fn sync_get_queue_stats(&self) -> Result<FfiQueueStats, FfiError> {
        let stats = self.inner.sync_get_queue_stats().map_err(FfiError::from)?;
        Ok(FfiQueueStats {
            pending_count: stats.pending_count,
            in_progress_count: stats.in_progress_count,
            failed_count: stats.failed_count,
            completed_count: stats.completed_count,
            total_count: stats.total_count,
        })
    }

    /// Retry failed sync queue items.
    pub fn sync_retry_failed(&self) -> Result<i32, FfiError> {
        self.inner.sync_retry_failed().map_err(FfiError::from)
    }

    /// Clear completed sync queue items older than N days.
    pub fn sync_clear_completed_queue(&self, older_than_days: i32) -> Result<i32, FfiError> {
        self.inner.sync_clear_completed_queue(older_than_days).map_err(FfiError::from)
    }

    /// Clear all failed sync queue items.
    pub fn sync_clear_failed_queue(&self) -> Result<i32, FfiError> {
        self.inner.sync_clear_failed_queue().map_err(FfiError::from)
    }

    /// Get sync history for a data type.
    pub async fn sync_get_history(
        &self,
        data_type: String,
        limit: i32,
    ) -> Result<Vec<FfiSyncSnapshot>, FfiError> {
        let snapshots = self.inner.get_sync_history(data_type, limit).await.map_err(FfiError::from)?;
        Ok(snapshots.into_iter().map(|s| FfiSyncSnapshot {
            id: s.id,
            data_type: s.data_type,
            version: s.version,
            snapshot_hash: s.snapshot_hash,
            device_id: s.device_id,
            operation: s.operation,
            items_count: s.items_count,
            sync_status: s.sync_status,
            error_message: s.error_message,
            created_at: s.created_at,
        }).collect())
    }

    // --- Scheduler Operations ---

    /// Start background sync scheduler.
    pub async fn scheduler_start(&self) -> Result<(), FfiError> {
        self.inner.scheduler_start().await.map_err(FfiError::from)
    }

    /// Stop background sync scheduler.
    pub async fn scheduler_stop(&self) -> Result<(), FfiError> {
        self.inner.scheduler_stop().await.map_err(FfiError::from)
    }

    /// Get scheduler status.
    pub async fn scheduler_get_status(&self) -> Result<FfiSchedulerStatus, FfiError> {
        let status = self.inner.scheduler_get_status().await.map_err(FfiError::from)?;
        Ok(FfiSchedulerStatus {
            enabled: status.enabled,
            running: status.running,
            interval_minutes: status.interval_minutes,
            last_run: status.last_run,
            next_run: status.next_run,
        })
    }

    // --- Label Operations ---

    /// Create a new label
    pub fn label_create(&self, account_id: Option<i64>, name: String, color: String) -> Result<FfiLabel, FfiError> {
        let label = self.inner.label_create(account_id, name, color).map_err(FfiError::from)?;
        Ok(label.into())
    }

    /// List labels for an account
    pub fn label_list(&self, account_id: Option<i64>) -> Result<Vec<FfiLabel>, FfiError> {
        let labels = self.inner.label_list(account_id).map_err(FfiError::from)?;
        Ok(labels.into_iter().map(|l| l.into()).collect())
    }

    /// Update a label
    pub fn label_update(&self, id: i64, name: Option<String>, color: Option<String>) -> Result<FfiLabel, FfiError> {
        let label = self.inner.label_update(id, name, color).map_err(FfiError::from)?;
        Ok(label.into())
    }

    /// Delete a label
    pub fn label_delete(&self, id: i64) -> Result<(), FfiError> {
        self.inner.label_delete(id).map_err(FfiError::from)
    }

    /// Add a label to an email
    pub fn email_add_label(&self, email_id: i64, label_id: i64) -> Result<(), FfiError> {
        self.inner.email_add_label(email_id, label_id).map_err(FfiError::from)
    }

    /// Remove a label from an email
    pub fn email_remove_label(&self, email_id: i64, label_id: i64) -> Result<(), FfiError> {
        self.inner.email_remove_label(email_id, label_id).map_err(FfiError::from)
    }

    /// Get labels for an email
    pub fn email_get_labels(&self, email_id: i64) -> Result<Vec<FfiLabel>, FfiError> {
        let labels = self.inner.email_get_labels(email_id).map_err(FfiError::from)?;
        Ok(labels.into_iter().map(|l| l.into()).collect())
    }

    /// Get email IDs for a label
    pub fn label_get_email_ids(&self, label_id: i64) -> Result<Vec<i64>, FfiError> {
        self.inner.label_get_email_ids(label_id).map_err(FfiError::from)
    }

    // --- Alias Operations ---

    /// Add an email alias
    pub fn alias_add(&self, account_id: i64, alias_email: String, alias_name: Option<String>) -> Result<i64, FfiError> {
        self.inner.alias_add(account_id, alias_email, alias_name).map_err(FfiError::from)
    }

    /// List aliases for an account
    pub fn alias_list(&self, account_id: i64) -> Result<Vec<FfiEmailAlias>, FfiError> {
        let aliases = self.inner.alias_list(account_id).map_err(FfiError::from)?;
        Ok(aliases.into_iter().map(|a| a.into()).collect())
    }

    /// Update an alias
    pub fn alias_update(&self, alias_id: i64, alias_email: Option<String>, alias_name: Option<String>) -> Result<(), FfiError> {
        self.inner.alias_update(alias_id, alias_email, alias_name).map_err(FfiError::from)
    }

    /// Delete an alias
    pub fn alias_delete(&self, alias_id: i64) -> Result<(), FfiError> {
        self.inner.alias_delete(alias_id).map_err(FfiError::from)
    }

    /// Toggle alias enabled/disabled
    pub fn alias_toggle(&self, alias_id: i64) -> Result<(), FfiError> {
        self.inner.alias_toggle(alias_id).map_err(FfiError::from)
    }

    /// Set an alias as default
    pub fn alias_set_default(&self, alias_id: i64, account_id: i64) -> Result<(), FfiError> {
        self.inner.alias_set_default(alias_id, account_id).map_err(FfiError::from)
    }

    // --- OAuth Operations ---

    /// Start OAuth flow for a provider (google/microsoft). Returns auth URL + CSRF state.
    pub fn oauth_start_flow(&self, provider: String) -> Result<FfiOAuthStartResult, FfiError> {
        let (auth_url, csrf_state) = self.inner.oauth_start_flow(provider).map_err(FfiError::from)?;
        Ok(FfiOAuthStartResult { auth_url, csrf_state })
    }

    /// Handle OAuth callback. Returns complete result with IMAP/SMTP config.
    pub async fn oauth_handle_callback(
        &self,
        provider: String,
        authorization_code: String,
        csrf_state: String,
    ) -> Result<FfiOAuthCompleteResult, FfiError> {
        let result = self.inner.oauth_handle_callback(provider, authorization_code, csrf_state)
            .await.map_err(FfiError::from)?;
        Ok(FfiOAuthCompleteResult {
            email: result.email,
            display_name: result.display_name,
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            imap_host: result.imap_host,
            imap_port: result.imap_port,
            smtp_host: result.smtp_host,
            smtp_port: result.smtp_port,
        })
    }
}
