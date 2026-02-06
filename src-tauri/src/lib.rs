//! # Owlivion Mail
//!
//! A modern, AI-powered email client built with Tauri and React.

pub mod crypto;
pub mod db;
pub mod filters;
pub mod mail;
pub mod oauth;
pub mod sync;
pub mod tray;

use db::{Database, EmailSummary, EmailTemplate, NewAccount as DbNewAccount, NewEmailTemplate};
use mail::{fetch_autoconfig, fetch_autoconfig_debug, AsyncImapClient, AutoConfig, AutoConfigDebug, ImapClient, ImapConfig, SecurityType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Manager, State};
use zeroize::Zeroize;

// ============================================================================
// Rate Limiting for Connection Attempts
// ============================================================================

/// SECURITY: Rate limiter to prevent brute-force and DoS attacks
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

    fn check_rate_limit(&self, key: &str) -> Result<(), String> {
        let mut attempts = self.attempts.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();

        // Clean up old entries
        if let Some(timestamps) = attempts.get_mut(key) {
            timestamps.retain(|t| now.duration_since(*t) < self.window);

            if timestamps.len() >= self.max_attempts {
                return Err(format!(
                    "Too many connection attempts. Please wait {} seconds.",
                    self.window.as_secs()
                ));
            }
            timestamps.push(now);
        } else {
            attempts.insert(key.to_string(), vec![now]);
        }

        Ok(())
    }
}

lazy_static::lazy_static! {
    /// Global rate limiter: max 5 connection attempts per minute per account
    static ref CONNECTION_RATE_LIMITER: ConnectionRateLimiter =
        ConnectionRateLimiter::new(5, 60);
}

/// Result wrapper for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

/// Stored account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAccount {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub password: String,
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_security: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: String,
    pub is_default: bool,
}

/// Application state for managing accounts and connections
pub struct AppState {
    db: Arc<Database>,
    async_imap_clients: tokio::sync::Mutex<HashMap<String, AsyncImapClient>>,
    current_folder: Mutex<HashMap<String, String>>,
    sync_manager: Arc<StdMutex<Option<sync::SyncManager>>>,
    background_scheduler: Arc<sync::BackgroundScheduler>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        let db_arc = Arc::new(db);
        let sync_manager = Arc::new(StdMutex::new(Some(sync::SyncManager::new(db_arc.clone()))));
        let background_scheduler = Arc::new(sync::BackgroundScheduler::new(db_arc.clone()));

        Self {
            db: db_arc,
            async_imap_clients: tokio::sync::Mutex::new(HashMap::new()),
            current_folder: Mutex::new(HashMap::new()),
            sync_manager,
            background_scheduler,
        }
    }

    /// Get or create sync manager instance
    fn get_sync_manager(&self) -> Result<sync::SyncManager, String> {
        let guard = self.sync_manager.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        guard.as_ref()
            .cloned()
            .ok_or_else(|| "Sync manager not initialized".to_string())
    }
}

fn parse_security(s: &str) -> SecurityType {
    match s.to_uppercase().as_str() {
        "SSL" | "TLS" => SecurityType::SSL,
        "STARTTLS" => SecurityType::STARTTLS,
        _ => SecurityType::NONE,
    }
}

/// SECURITY: Validate security type string before parsing
fn validate_security_type(s: &str) -> Result<(), String> {
    match s.to_uppercase().as_str() {
        "SSL" | "TLS" | "STARTTLS" => Ok(()),
        "NONE" => Err("Insecure connections (NONE) are not allowed".to_string()),
        _ => Err(format!("Invalid security type: {}. Use SSL, TLS, or STARTTLS", s)),
    }
}

// ============================================================================
// Input Validation (SSRF Prevention)
// ============================================================================

/// Validate host to prevent SSRF attacks
/// Blocks: localhost, private IPs, loopback addresses
fn validate_host(host: &str) -> Result<(), String> {
    let host_lower = host.to_lowercase();

    // Block localhost and variations
    if host_lower == "localhost"
        || host_lower == "127.0.0.1"
        || host_lower == "::1"
        || host_lower.starts_with("127.")
        || host_lower == "0.0.0.0"
    {
        return Err("Localhost connections are not allowed".to_string());
    }

    // Block private IP ranges (RFC 1918)
    if let Ok(ip) = host.parse::<std::net::IpAddr>() {
        match ip {
            std::net::IpAddr::V4(ipv4) => {
                if ipv4.is_private()
                    || ipv4.is_loopback()
                    || ipv4.is_link_local()
                    || ipv4.is_broadcast()
                    || ipv4.is_unspecified()
                {
                    return Err("Private/reserved IP addresses are not allowed".to_string());
                }
                // Additional checks for common internal ranges
                let octets = ipv4.octets();
                // 10.0.0.0/8
                if octets[0] == 10 {
                    return Err("Private IP range 10.0.0.0/8 is not allowed".to_string());
                }
                // 172.16.0.0/12
                if octets[0] == 172 && (octets[1] >= 16 && octets[1] <= 31) {
                    return Err("Private IP range 172.16.0.0/12 is not allowed".to_string());
                }
                // 192.168.0.0/16
                if octets[0] == 192 && octets[1] == 168 {
                    return Err("Private IP range 192.168.0.0/16 is not allowed".to_string());
                }
                // 169.254.0.0/16 (link-local)
                if octets[0] == 169 && octets[1] == 254 {
                    return Err("Link-local IP range is not allowed".to_string());
                }
            }
            std::net::IpAddr::V6(ipv6) => {
                if ipv6.is_loopback() || ipv6.is_unspecified() {
                    return Err("Loopback/unspecified IPv6 addresses are not allowed".to_string());
                }
                // SECURITY: Check IPv6 private ranges
                let segments = ipv6.segments();
                // fc00::/7 (Unique Local Address)
                if (segments[0] & 0xfe00) == 0xfc00 {
                    return Err("IPv6 Unique Local Address (ULA) is not allowed".to_string());
                }
                // fe80::/10 (Link-local)
                if (segments[0] & 0xffc0) == 0xfe80 {
                    return Err("IPv6 Link-local address is not allowed".to_string());
                }
                // ::ffff:0:0/96 (IPv4-mapped IPv6)
                if segments[0] == 0 && segments[1] == 0 && segments[2] == 0
                    && segments[3] == 0 && segments[4] == 0 && segments[5] == 0xffff
                {
                    // Extract IPv4 part and validate
                    let ipv4_part = ((segments[6] as u32) << 16) | (segments[7] as u32);
                    let ipv4 = std::net::Ipv4Addr::from(ipv4_part);
                    if ipv4.is_private() || ipv4.is_loopback() || ipv4.is_link_local() {
                        return Err("IPv4-mapped IPv6 address with private IPv4 is not allowed".to_string());
                    }
                }
                // fec0::/10 (Site-local, deprecated but block anyway)
                if (segments[0] & 0xffc0) == 0xfec0 {
                    return Err("IPv6 Site-local address is not allowed".to_string());
                }
            }
        }
    }

    // Validate hostname format
    if host.is_empty() || host.len() > 253 {
        return Err("Invalid hostname length".to_string());
    }

    // Check for valid characters in hostname
    for c in host.chars() {
        if !c.is_ascii_alphanumeric() && c != '.' && c != '-' {
            return Err("Invalid characters in hostname".to_string());
        }
    }

    Ok(())
}

/// Validate port number
fn validate_port(port: u16) -> Result<(), String> {
    // Allow standard email ports only
    const ALLOWED_PORTS: [u16; 8] = [25, 143, 465, 587, 993, 995, 110, 2525];

    if ALLOWED_PORTS.contains(&port) {
        Ok(())
    } else {
        Err(format!(
            "Port {} is not allowed. Use standard email ports: {:?}",
            port, ALLOWED_PORTS
        ))
    }
}

/// SECURITY: Sanitize error messages to prevent information leakage
/// Removes server details, internal paths, and sensitive data
fn sanitize_error_message(error: &str) -> String {
    let error_lower = error.to_lowercase();

    // Map common errors to generic messages
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

    if error_lower.contains("permission") || error_lower.contains("access denied") {
        return "Access denied by server.".to_string();
    }

    if error_lower.contains("too many") || error_lower.contains("rate limit") {
        return "Too many requests. Please wait and try again.".to_string();
    }

    // Generic fallback - don't expose original error
    "Connection error. Please check your settings and try again.".to_string()
}

/// Validate email format (RFC 5321 basic compliance)
fn validate_email(email: &str) -> Result<(), String> {
    if email.is_empty() {
        return Err("Email address cannot be empty".to_string());
    }
    if email.len() > 254 {
        return Err("Email address too long".to_string());
    }
    if !email.contains('@') {
        return Err("Invalid email format".to_string());
    }
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err("Invalid email format".to_string());
    }
    // SECURITY: Check local part length (max 64)
    if parts[0].len() > 64 {
        return Err("Email local part too long".to_string());
    }
    // SECURITY: Check domain has at least one dot
    if !parts[1].contains('.') {
        return Err("Invalid email domain".to_string());
    }
    // SECURITY: Check for dangerous characters that could cause injection
    if email.contains('\r') || email.contains('\n') || email.contains('\0') {
        return Err("Invalid characters in email".to_string());
    }
    Ok(())
}

// SECURITY: Maximum recipients per email
const MAX_RECIPIENTS: usize = 100;

// SECURITY: Maximum pagination size
const MAX_PAGE_SIZE: u32 = 100;

/// SECURITY: Helper to safely get current folder from potentially poisoned mutex
/// Returns the folder for the account, or INBOX as default
fn get_current_folder_safe(
    current_folder: &Mutex<HashMap<String, String>>,
    account_id: &str,
) -> String {
    current_folder
        .lock()
        .unwrap_or_else(|poisoned| {
            log::warn!("Current folder mutex was poisoned, recovering");
            poisoned.into_inner()
        })
        .get(account_id)
        .cloned()
        .unwrap_or_else(|| "INBOX".to_string())
}

// ============================================================================
// Database Sync Helpers
// ============================================================================

/// Sync folder information to database
/// Creates or updates folder record and returns folder_id
fn sync_folder_to_db(
    db: &Database,
    account_id: i64,
    folder_name: &str,
) -> Result<i64, String> {
    // Check if folder exists
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

    // Determine folder type
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

    // Display name (clean up Gmail folder names)
    let display_name = folder_name
        .replace("[Gmail]/", "")
        .replace("[GMAIL]/", "");

    // Insert new folder
    db.execute(
        r#"
        INSERT INTO folders (account_id, name, remote_name, folder_type)
        VALUES (?1, ?2, ?3, ?4)
        "#,
        rusqlite::params![account_id, display_name, folder_name, folder_type],
    )
    .map_err(|e| format!("Failed to insert folder: {}", e))?;

    // Get the inserted folder ID
    let new_folder_id = db
        .query_row(
            "SELECT id FROM folders WHERE account_id = ?1 AND remote_name = ?2 LIMIT 1",
            rusqlite::params![account_id, folder_name],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| format!("Failed to get new folder ID: {}", e))?;

    log::info!("✓ Synced folder '{}' to DB (id={}, type={})", folder_name, new_folder_id, folder_type);
    Ok(new_folder_id)
}

/// Sync email summary to database
/// Converts mail::EmailSummary to db::NewEmail and upserts
/// Returns (email_id, is_new_email)
fn sync_email_to_db(
    db: &Database,
    account_id: i64,
    folder_id: i64,
    email_summary: &mail::EmailSummary,
) -> Result<(i64, bool), String> {
    // Check if email already exists
    let exists = db
        .query_row(
            "SELECT id FROM emails WHERE account_id = ?1 AND folder_id = ?2 AND uid = ?3",
            rusqlite::params![account_id, folder_id, email_summary.uid],
            |row| row.get::<_, i64>(0),
        )
        .ok();

    if let Some(email_id) = exists {
        // Update flags only (email already exists)
        db.execute(
            "UPDATE emails SET is_read = ?1, is_starred = ?2 WHERE id = ?3",
            rusqlite::params![email_summary.is_read, email_summary.is_starred, email_id],
        )
        .map_err(|e| format!("Failed to update email flags: {}", e))?;

        return Ok((email_id, false)); // Not a new email
    }

    // Create new email record
    let new_email = db::NewEmail {
        account_id,
        folder_id,
        message_id: email_summary.message_id.clone().unwrap_or_else(|| format!("uid-{}", email_summary.uid)),
        uid: email_summary.uid,
        from_address: email_summary.from.clone(),
        from_name: email_summary.from_name.clone(),
        to_addresses: "[]".to_string(), // Summary doesn't include full recipient list
        cc_addresses: "[]".to_string(),
        bcc_addresses: "[]".to_string(),
        reply_to: None,
        subject: email_summary.subject.clone(),
        preview: email_summary.preview.clone(),
        body_text: None, // Will be fetched when email is opened
        body_html: None,
        date: email_summary.date.clone(),
        is_read: email_summary.is_read,
        is_starred: email_summary.is_starred,
        is_deleted: false,
        is_spam: false,
        is_draft: false,
        is_answered: false,
        is_forwarded: false,
        has_attachments: email_summary.has_attachments,
        has_inline_images: false,
        thread_id: None,
        in_reply_to: None,
        references_header: None,
        raw_headers: None,
        raw_size: 0,
        priority: 3,
        labels: "[]".to_string(),
    };

    // Insert email (upsert will handle duplicates)
    let email_id = db
        .upsert_email(&new_email)
        .map_err(|e| format!("Failed to save email to DB: {}", e))?;

    Ok((email_id, true)) // New email inserted
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Greet command (demo)
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Owlivion Mail!", name)
}

/// Auto-detect email configuration for a given email address
#[tauri::command]
async fn autoconfig_detect(email: String) -> Result<AutoConfig, String> {
    fetch_autoconfig(&email).await
}

/// Debug version of autoconfig with detailed step-by-step information
#[tauri::command]
async fn autoconfig_detect_debug(email: String) -> Result<AutoConfigDebug, String> {
    fetch_autoconfig_debug(&email).await
}

/// Test IMAP connection
/// SECURITY: Input validation, rate limiting, error sanitization
#[tauri::command]
async fn account_test_imap(
    host: String,
    port: u16,
    security: String,
    email: String,
    mut password: String,
) -> Result<(), String> {
    // SECURITY: Rate limiting to prevent brute-force attacks
    let rate_key = format!("imap:{}:{}", host, email);
    CONNECTION_RATE_LIMITER.check_rate_limit(&rate_key)?;

    // SECURITY: Validate all inputs
    validate_host(&host)?;
    validate_port(port)?;
    validate_email(&email)?;
    validate_security_type(&security)?;

    log::info!("Testing IMAP connection to {}:{}", host, port);

    let sec = parse_security(&security);

    let config = ImapConfig {
        host: host.clone(),
        port,
        security: sec,
        username: email.clone(),
        password: password.clone(),
        accept_invalid_certs: true, // Accept invalid certs during testing
        oauth_provider: None, // Test uses regular password auth
    };

    // SECURITY: Zeroize password after creating config
    password.zeroize();

    // Run in blocking task since imap crate is synchronous
    let result = tokio::task::spawn_blocking(move || {
        let mut client = ImapClient::new(config);
        client.test_connection()
    })
    .await;

    match result {
        Ok(Ok(())) => {
            log::info!("IMAP connection test successful");
            Ok(())
        }
        Ok(Err(e)) => {
            // SECURITY: Sanitize error message to not leak server details
            let sanitized_err = sanitize_error_message(&e.to_string());
            log::error!("IMAP test failed: {}", sanitized_err);
            Err(sanitized_err)
        }
        Err(_) => {
            // SECURITY: Don't expose internal task errors
            Err("Connection test failed unexpectedly".to_string())
        }
    }
}

/// Test SMTP connection
/// SECURITY: Input validation, rate limiting, error sanitization
#[tauri::command]
async fn account_test_smtp(
    host: String,
    port: u16,
    security: String,
    email: String,
    mut password: String,
) -> Result<(), String> {
    // SECURITY: Rate limiting to prevent brute-force attacks
    let rate_key = format!("smtp:{}:{}", host, email);
    CONNECTION_RATE_LIMITER.check_rate_limit(&rate_key)?;

    // SECURITY: Validate all inputs
    validate_host(&host)?;
    validate_port(port)?;
    validate_email(&email)?;
    validate_security_type(&security)?;

    log::info!("Testing SMTP connection to {}:{}", host, port);

    use lettre::{
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport,
    };

    if host.is_empty() || email.is_empty() || password.is_empty() {
        return Err("Invalid SMTP configuration".to_string());
    }

    let creds = Credentials::new(email.clone(), password.clone());
    let security_type = parse_security(&security);

    // SECURITY: Zeroize password after creating credentials
    password.zeroize();

    let mailer: AsyncSmtpTransport<lettre::Tokio1Executor> = match security_type {
        SecurityType::SSL => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::relay(&host)
                .map_err(|e| sanitize_error_message(&format!("{}", e)))?
                .credentials(creds)
                .port(port)
                .build()
        }
        SecurityType::STARTTLS => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::starttls_relay(&host)
                .map_err(|e| sanitize_error_message(&format!("{}", e)))?
                .credentials(creds)
                .port(port)
                .build()
        }
        SecurityType::NONE => {
            return Err("Insecure SMTP not supported".to_string());
        }
    };

    // Test connection by checking if we can connect
    mailer.test_connection().await
        .map_err(|e| sanitize_error_message(&format!("{}", e)))?;

    log::info!("SMTP connection test successful");
    Ok(())
}

/// Send a test email to verify SMTP configuration
/// SECURITY: Validates all inputs including recipient
#[tauri::command]
async fn send_test_email(
    host: String,
    port: u16,
    security: String,
    email: String,
    password: String,
    to_email: String,
) -> Result<(), String> {
    // SECURITY: Validate inputs
    validate_host(&host)?;
    validate_port(port)?;
    validate_email(&email)?;
    validate_email(&to_email)?;

    log::info!("Sending test email from {} to {}", email, to_email);

    use lettre::{
        message::{header::ContentType, Mailbox},
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport, AsyncTransport, Message,
    };

    let from: Mailbox = email
        .parse()
        .map_err(|e: lettre::address::AddressError| format!("Invalid from address: {}", e))?;

    let to: Mailbox = to_email
        .parse()
        .map_err(|e: lettre::address::AddressError| format!("Invalid to address: {}", e))?;

    let email_msg = Message::builder()
        .from(from)
        .to(to)
        .subject("Owlivion Mail - Test Email")
        .header(ContentType::TEXT_PLAIN)
        .body(format!(
            "Bu bir test e-postasıdır.\n\n\
            Owlivion Mail uygulaması SMTP yapılandırmanızı başarıyla test etti.\n\n\
            Gönderim zamanı: {}\n\
            SMTP Sunucu: {}:{}\n\n\
            -- \n\
            Owlivion Mail",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            host,
            port
        ))
        .map_err(|e| format!("Failed to build email: {}", e))?;

    let creds = Credentials::new(email.clone(), password);
    let security_type = parse_security(&security);

    let mailer: AsyncSmtpTransport<lettre::Tokio1Executor> = match security_type {
        SecurityType::SSL => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::relay(&host)
                .map_err(|e| format!("Failed to create SMTP transport: {}", e))?
                .credentials(creds)
                .port(port)
                .build()
        }
        SecurityType::STARTTLS => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::starttls_relay(&host)
                .map_err(|e| format!("Failed to create SMTP transport: {}", e))?
                .credentials(creds)
                .port(port)
                .build()
        }
        SecurityType::NONE => {
            return Err("Insecure SMTP not supported".to_string());
        }
    };

    mailer.send(email_msg).await
        .map_err(|e| format!("Failed to send test email: {}", e))?;

    log::info!("Test email sent successfully to {}", to_email);
    Ok(())
}

/// Add a new email account
#[tauri::command]
async fn account_add(
    state: State<'_, AppState>,
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
) -> Result<String, String> {
    log::info!("Adding account to database: {} (OAuth: {})", email, oauth_provider.is_some());

    // Encrypt password before storage
    let encrypted_password = crypto::encrypt_password(&password)
        .map_err(|e| format!("Password encryption failed: {}", e))?;

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

    let account_id = state.db.add_account(&new_account)
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Account added with ID: {}", account_id);
    Ok(account_id.to_string())
}

/// Update an existing email account
#[tauri::command]
async fn account_update(
    state: State<'_, AppState>,
    account_id: String,
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
    #[allow(unused_variables)]
    accept_invalid_certs: Option<bool>,
) -> Result<(), String> {
    let id: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;
    log::info!("Updating account in database: {} (ID: {})", email, id);

    // Encrypt password before storage
    let encrypted_password = crypto::encrypt_password(&password)
        .map_err(|e| format!("Password encryption failed: {}", e))?;

    let updated_account = DbNewAccount {
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
        oauth_provider: None,
        oauth_access_token: None,
        oauth_refresh_token: None,
        oauth_expires_at: None,
        is_default,
        signature: String::new(),
        sync_days: 30,
        accept_invalid_certs: accept_invalid_certs.unwrap_or(false),
    };

    state.db.update_account(id, &updated_account)
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Account updated: {}", id);
    Ok(())
}

/// Update account signature only
#[tauri::command(rename_all = "camelCase")]
async fn account_update_signature(
    state: State<'_, AppState>,
    account_id: String,
    signature: String,
) -> Result<(), String> {
    let id: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;
    log::info!("Updating signature for account: {}", id);

    state.db.update_account_signature(id, &signature)
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Signature updated for account: {}", id);
    Ok(())
}

/// Fetch content from a URL (for signatures)
/// SECURITY: Only allows HTTPS URLs from trusted domains
#[tauri::command]
async fn fetch_url_content(url: String) -> Result<String, String> {
    log::info!("Fetching URL content: {}", url);

    // SECURITY: Validate URL
    let parsed_url = url::Url::parse(&url)
        .map_err(|_| "Invalid URL format".to_string())?;

    // Only allow HTTPS
    if parsed_url.scheme() != "https" {
        return Err("Only HTTPS URLs are allowed".to_string());
    }

    // SECURITY: Only allow trusted domains for signature fetching
    let host = parsed_url.host_str().ok_or("Invalid URL host")?;
    let allowed_domains = ["owlivion.com", "www.owlivion.com"];
    let is_allowed = allowed_domains.iter().any(|d| host == *d || host.ends_with(&format!(".{}", d)));

    if !is_allowed {
        return Err(format!("Domain '{}' is not allowed. Only owlivion.com is permitted.", host));
    }

    // Fetch with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&url)
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .map_err(|e| format!("Fetch error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let content = response
        .text()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    log::info!("URL content fetched successfully ({} bytes)", content.len());
    Ok(content)
}

/// List all configured accounts
#[tauri::command]
async fn account_list(state: State<'_, AppState>) -> Result<Vec<db::Account>, String> {
    log::info!("Listing accounts from database");
    let accounts = state.db.get_accounts()
        .map_err(|e| format!("Database error: {}", e))?;
    log::info!("Found {} accounts", accounts.len());
    Ok(accounts)
}

/// Connect to an account (used when app starts or reconnecting)
/// SECURITY: Validates stored configuration before connecting
#[tauri::command]
async fn account_connect(state: State<'_, AppState>, account_id: String) -> Result<(), String> {
    log::info!("Connecting to account: {}", account_id);
    let id: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;

    let account = state.db.get_account(id)
        .map_err(|_| "Database error".to_string())?;

    // SECURITY: Validate stored host and port before connecting
    validate_host(&account.imap_host)?;
    validate_port(account.imap_port as u16)?;
    validate_security_type(&account.imap_security)?;

    let encrypted_password = state.db.get_account_password(id)
        .map_err(|_| "Database error".to_string())?
        .ok_or_else(|| "No password stored".to_string())?;

    // Decrypt password (or access token for OAuth)
    let mut password = crypto::decrypt_password(&encrypted_password)
        .map_err(|_| "Password decryption failed".to_string())?;

    // Check if OAuth token needs refresh
    if account.oauth_provider.is_some() {
        if let Some(expires_at) = account.oauth_expires_at {
            let now = chrono::Utc::now().timestamp();
            // Refresh if token expires in less than 5 minutes
            if expires_at - now < 300 {
                log::info!("OAuth token expired or expiring soon, refreshing...");

                if let Some(refresh_token) = &account.oauth_refresh_token {
                    // Decrypt refresh token
                    let encrypted_refresh = state.db.get_account_password(id)
                        .map_err(|_| "Database error".to_string())?
                        .ok_or_else(|| "No refresh token stored".to_string())?;

                    // Get OAuth config based on provider
                    let oauth_config = match account.oauth_provider.as_deref() {
                        Some("google") => oauth::gmail_config(),
                        Some("microsoft") => oauth::microsoft_config(),
                        _ => return Err("Unknown OAuth provider".to_string()),
                    };

                    // Refresh the token
                    match oauth::refresh_access_token(&oauth_config, refresh_token).await {
                        Ok(result) => {
                            log::info!("✓ Token refreshed successfully");

                            // Update password with new access token
                            password.zeroize();
                            password = result.access_token.clone();

                            // Save new access token to database
                            let encrypted_new_token = crypto::encrypt_password(&result.access_token)
                                .map_err(|e| format!("Encryption failed: {}", e))?;

                            state.db.update_oauth_access_token(id, &encrypted_new_token)
                                .map_err(|e| format!("Database error: {}", e))?;

                            // Update expiry time (1 hour from now)
                            let new_expires_at = chrono::Utc::now().timestamp() + 3600;
                            state.db.update_oauth_expires_at(id, new_expires_at)
                                .map_err(|e| format!("Database error: {}", e))?;

                            // Update refresh token if we got a new one
                            if let Some(new_refresh) = result.refresh_token {
                                state.db.update_oauth_refresh_token(id, &new_refresh)
                                    .map_err(|e| format!("Database error: {}", e))?;
                            }

                            log::info!("✓ Tokens saved to database");
                        }
                        Err(e) => {
                            log::error!("Token refresh failed: {}. Please re-authenticate.", e);
                            return Err(format!("OAuth token expired. Please remove and re-add the account."));
                        }
                    }
                } else {
                    return Err("OAuth refresh token not found. Please remove and re-add the account.".to_string());
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

    // SECURITY: Zeroize password after creating config
    password.zeroize();

    // Create async IMAP client only (sync client has parser issues)
    let mut async_client = AsyncImapClient::new(config);
    async_client.connect().await.map_err(|e| sanitize_error_message(&e.to_string()))?;

    // Store async client
    let mut async_clients = state.async_imap_clients.lock().await;
    async_clients.insert(account_id.clone(), async_client);

    log::info!("Account connected successfully");
    Ok(())
}

/// Delete an account
#[tauri::command]
async fn account_delete(state: State<'_, AppState>, account_id: String) -> Result<(), String> {
    log::info!("Deleting account: {}", account_id);
    let id: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;

    // Remove from async clients if connected
    let mut async_clients = state.async_imap_clients.lock().await;
    async_clients.remove(&account_id);
    drop(async_clients);

    // Delete from database
    state.db.delete_account(id)
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Account {} deleted successfully", account_id);
    Ok(())
}

/// Get folders for an account
#[tauri::command]
async fn folder_list(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<mail::Folder>, String> {
    log::info!("Listing folders for account: {}", account_id);

    let mut async_clients = state.async_imap_clients.lock().await;

    let client = async_clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    let folders = client.list_folders().await.map_err(|e| e.to_string())?;

    log::info!("Found {} folders for account {}", folders.len(), account_id);
    Ok(folders)
}

/// Fetch emails with pagination
/// SECURITY: Enforces pagination limits to prevent DoS
#[tauri::command]
async fn email_list(
    state: State<'_, AppState>,
    account_id: String,
    folder: Option<String>,
    page: u32,
    page_size: u32,
) -> Result<mail::FetchResult, String> {
    // SECURITY: Enforce pagination limits
    let safe_page_size = page_size.min(MAX_PAGE_SIZE).max(1);

    log::info!("Fetching emails for account {} folder {:?} page {} size {}", account_id, folder, page, safe_page_size);
    let folder_path = folder.unwrap_or_else(|| "INBOX".to_string());

    // Update current folder
    // SECURITY: Handle lock poisoning gracefully instead of propagating panic
    {
        let mut current = state.current_folder.lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        current.insert(account_id.clone(), folder_path.clone());
    }

    // Use async IMAP client
    let mut async_clients = state.async_imap_clients.lock().await;

    // Check if account exists (borrow checker friendly)
    if !async_clients.contains_key(&account_id) {
        let available: Vec<_> = async_clients.keys().collect();
        log::error!("Account {} not connected - available accounts: {:?}", account_id, available);
        return Err("Account not connected. Please try reconnecting the account.".to_string());
    }

    let client = async_clients.get_mut(&account_id).unwrap();

    log::info!("Calling fetch_emails for folder='{}', page={}, size={}", folder_path, page, safe_page_size);
    let result = client
        .fetch_emails(&folder_path, page, safe_page_size)
        .await
        .map_err(|e| {
            log::error!("fetch_emails FAILED for account {} folder '{}': {}", account_id, folder_path, e);
            format!("Failed to fetch emails: {}", e)
        })?;

    // Release IMAP lock before DB operations
    drop(async_clients);

    // Parse account_id for DB operations
    let account_id_num: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;

    // Sync folder to database
    let folder_id = sync_folder_to_db(&state.db, account_id_num, &folder_path)
        .map_err(|e| {
            log::warn!("Failed to sync folder to DB: {}", e);
            e
        })
        .unwrap_or(1); // Fallback to ID 1 if folder sync fails

    // Sync emails to database (background operation, non-blocking)
    let mut new_emails_count = 0;
    let mut updated_count = 0;
    let mut new_email_ids = Vec::new();

    for email_summary in &result.emails {
        match sync_email_to_db(&state.db, account_id_num, folder_id, email_summary) {
            Ok((email_id, is_new)) => {
                if is_new {
                    new_emails_count += 1;
                    new_email_ids.push(email_id);
                } else {
                    updated_count += 1;
                }
            }
            Err(e) => log::warn!("Failed to sync email uid={} to DB: {}", email_summary.uid, e),
        }
    }

    if new_emails_count > 0 || updated_count > 0 {
        log::info!("✓ Synced to DB: {} new, {} updated (folder_id={})", new_emails_count, updated_count, folder_id);
    }

    // Apply filters to new emails automatically
    if !new_email_ids.is_empty() {
        use filters::FilterEngine;
        let engine = FilterEngine::new(state.db.clone());
        let mut filters_applied = 0;

        for email_id in new_email_ids {
            // Get full email from database
            if let Ok(email) = state.db.get_email(email_id) {
                // Apply filters
                match engine.apply_filters(&email).await {
                    Ok(actions) => {
                        if !actions.is_empty() {
                            filters_applied += 1;
                            if let Err(e) = engine.execute_actions(email_id, actions).await {
                                log::warn!("Failed to execute filter actions on email {}: {}", email_id, e);
                            }
                        }
                    }
                    Err(e) => log::warn!("Failed to apply filters to email {}: {}", email_id, e),
                }
            }
        }

        if filters_applied > 0 {
            log::info!("✓ Applied filters to {} new email(s)", filters_applied);
        }
    }

    // Add account metadata to all emails (for unified inbox compatibility)
    let mut result_with_account_id = result;
    for email in &mut result_with_account_id.emails {
        email.account_id = Some(account_id.clone());
    }

    log::info!("✓ email_list SUCCESS: returning {} emails (total={}) with account_id={}", result_with_account_id.emails.len(), result_with_account_id.total, account_id);
    Ok(result_with_account_id)
}

/// Sync emails with automatic filter application
/// Fetches emails, saves to database, and applies filters
#[tauri::command]
async fn email_sync_with_filters(
    state: State<'_, AppState>,
    account_id: String,
    folder: Option<String>,
    page: u32,
    page_size: u32,
) -> Result<EmailSyncResult, String> {
    // SECURITY: Enforce pagination limits
    let safe_page_size = page_size.min(MAX_PAGE_SIZE).max(1);

    log::info!("Syncing emails with filters: account {} folder {:?}", account_id, folder);
    let folder_path = folder.unwrap_or_else(|| "INBOX".to_string());

    // Parse account_id
    let account_id_num: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;

    // Sync folder to database (create if not exists)
    let folder_id = sync_folder_to_db(&state.db, account_id_num, &folder_path)?;

    // Fetch emails
    let mut async_clients = state.async_imap_clients.lock().await;
    let client = async_clients
        .get_mut(&account_id)
        .ok_or("Account not connected")?;

    let result = client
        .fetch_emails(&folder_path, page, safe_page_size)
        .await
        .map_err(|e| format!("Failed to fetch emails: {}", e))?;

    drop(async_clients); // Release lock

    let mut new_emails_count = 0;
    let mut filters_applied_count = 0;

    // Create filter engine
    use filters::FilterEngine;
    let engine = FilterEngine::new(state.db.clone());

    // Process each email
    for email_summary in &result.emails {
        // Sync email to database (creates new or updates existing)
        let (email_id, is_new) = match sync_email_to_db(&state.db, account_id_num, folder_id, email_summary) {
            Ok(result) => result,
            Err(e) => {
                log::warn!("Failed to sync email uid={}: {}", email_summary.uid, e);
                continue;
            }
        };

        // Only count as new if it was actually inserted
        if is_new {
            new_emails_count += 1;
        } else {
            // Skip filter processing for existing emails
            continue;
        }

        // Get full email from database
        let email = state
            .db
            .get_email(email_id)
            .map_err(|e| format!("Failed to get email: {}", e))?;

        // Apply filters
        let actions = engine
            .apply_filters(&email)
            .await
            .map_err(|e| format!("Failed to apply filters: {}", e))?;

        if !actions.is_empty() {
            filters_applied_count += 1;
            engine
                .execute_actions(email_id, actions)
                .await
                .map_err(|e| format!("Failed to execute actions: {}", e))?;
        }
    }

    log::info!(
        "Sync complete: {} new emails, {} filters applied",
        new_emails_count,
        filters_applied_count
    );

    // Add account metadata to all emails (for unified inbox compatibility)
    let mut result_with_account_id = result;
    for email in &mut result_with_account_id.emails {
        email.account_id = Some(account_id.clone());
    }

    Ok(EmailSyncResult {
        fetch_result: result_with_account_id,
        new_emails_count,
        filters_applied_count,
    })
}

// ============================================================================
// Helper Functions for Multi-Account Fetching
// ============================================================================

/// Generate deterministic account color based on email hash
fn generate_account_color(email: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    email.hash(&mut hasher);
    let hash = hasher.finish();

    // Generate HSL color with fixed saturation and lightness
    let hue = (hash % 360) as i32;
    format!("hsl({}, 70%, 60%)", hue)
}

/// Apply global sorting to merged emails from multiple accounts
fn apply_global_sort(emails: &mut Vec<mail::EmailSummary>, sort_by: &str) {
    match sort_by {
        "account" => {
            // Sort by account_id, then by date (newest first)
            emails.sort_by(|a, b| {
                let account_cmp = a.account_id.cmp(&b.account_id);
                if account_cmp == std::cmp::Ordering::Equal {
                    b.date.cmp(&a.date) // Newer first
                } else {
                    account_cmp
                }
            });
        }
        "unread" | "priority" => {
            // Unread first, then by date (newest first)
            emails.sort_by(|a, b| {
                let read_cmp = a.is_read.cmp(&b.is_read); // false < true (unread first)
                if read_cmp == std::cmp::Ordering::Equal {
                    b.date.cmp(&a.date) // Newer first
                } else {
                    read_cmp
                }
            });
        }
        _ => {
            // Default: sort by date (newest first)
            emails.sort_by(|a, b| b.date.cmp(&a.date));
        }
    }
}

/// Fetch emails from all active accounts (unified inbox) - TRUE PARALLEL VERSION
#[tauri::command]
async fn email_list_all_accounts(
    state: State<'_, AppState>,
    folder: Option<String>,
    page: u32,
    page_size: u32,
    sort_by: Option<String>, // "date", "account", "unread", "priority"
) -> Result<mail::MultiAccountFetchResult, String> {
    use std::time::Instant;

    let total_start = Instant::now();

    // SECURITY: Enforce pagination limits
    let safe_page_size = page_size.min(MAX_PAGE_SIZE).max(1);
    let folder_path = folder.unwrap_or_else(|| "INBOX".to_string());
    let sort_mode = sort_by.as_deref().unwrap_or("priority");

    log::info!(
        "[PARALLEL FETCH] Starting: folder={}, page={}, page_size={}, sort={}",
        folder_path, page, safe_page_size, sort_mode
    );

    // Get all active accounts
    let accounts = state.db.get_all_accounts()
        .map_err(|e| format!("Failed to get accounts: {}", e))?;

    if accounts.is_empty() {
        return Ok(mail::MultiAccountFetchResult {
            emails: vec![],
            total: 0,
            has_more: false,
            account_results: vec![],
        });
    }

    log::info!("[PARALLEL FETCH] Starting fetch for {} accounts", accounts.len());

    // Clone necessary data for parallel tasks
    let db = state.db.clone();

    // Spawn parallel fetch tasks
    let mut handles = vec![];

    for account in accounts {
        let account_id = account.id;
        let account_email = account.email.clone();
        let account_display_name = account.display_name.clone();
        let folder_path_clone = folder_path.clone();
        let db_clone = db.clone();
        let enable_priority = account.enable_priority_fetch;

        let handle = tokio::spawn(async move {
            let start_time = Instant::now();
            let account_id_str = account_id.to_string();

            log::info!("[Account {}] Starting fetch (priority={})", account_email, enable_priority);

            // Get account metadata for badge
            let (display_name, email) = match db_clone.get_account_metadata(account_id) {
                Ok(metadata) => metadata,
                Err(e) => {
                    log::warn!("[Account {}] Failed to get metadata: {}", account_email, e);
                    (account_display_name.clone(), account_email.clone())
                }
            };

            let account_color = generate_account_color(&email);

            // Get encrypted password
            let encrypted_password = match db_clone.get_account_password(account_id) {
                Ok(Some(pwd)) => pwd,
                Ok(None) => {
                    return mail::AccountFetchTaskResult {
                        emails: vec![],
                        status: mail::AccountFetchStatus {
                            account_id: account_id_str,
                            account_email: account_email.clone(),
                            account_name: Some(display_name),
                            email_count: 0,
                            success: false,
                            error: Some("No password found".to_string()),
                            fetch_time_ms: start_time.elapsed().as_millis() as u64,
                        },
                    };
                }
                Err(e) => {
                    return mail::AccountFetchTaskResult {
                        emails: vec![],
                        status: mail::AccountFetchStatus {
                            account_id: account_id_str,
                            account_email: account_email.clone(),
                            account_name: Some(display_name),
                            email_count: 0,
                            success: false,
                            error: Some(format!("Failed to get password: {}", e)),
                            fetch_time_ms: start_time.elapsed().as_millis() as u64,
                        },
                    };
                }
            };

            // Decrypt password
            let password = match crypto::decrypt_password(&encrypted_password) {
                Ok(pwd) => pwd,
                Err(e) => {
                    return mail::AccountFetchTaskResult {
                        emails: vec![],
                        status: mail::AccountFetchStatus {
                            account_id: account_id_str,
                            account_email: account_email.clone(),
                            account_name: Some(display_name),
                            email_count: 0,
                            success: false,
                            error: Some(format!("Password decryption failed: {}", e)),
                            fetch_time_ms: start_time.elapsed().as_millis() as u64,
                        },
                    };
                }
            };

            // Parse security type
            let security = match account.imap_security.to_uppercase().as_str() {
                "TLS" | "SSL" => SecurityType::SSL,
                "STARTTLS" => SecurityType::STARTTLS,
                _ => SecurityType::NONE,
            };

            // Create independent IMAP client for this account
            let imap_config = ImapConfig {
                host: account.imap_host.clone(),
                port: account.imap_port as u16,
                security,
                username: account.imap_username.unwrap_or_else(|| account_email.clone()),
                password,
                accept_invalid_certs: account.accept_invalid_certs,
                oauth_provider: account.oauth_provider.clone(),
            };

            let mut client = AsyncImapClient::new(imap_config);

            if let Err(e) = client.connect().await {
                return mail::AccountFetchTaskResult {
                    emails: vec![],
                    status: mail::AccountFetchStatus {
                        account_id: account_id_str,
                        account_email: account_email.clone(),
                        account_name: Some(display_name),
                        email_count: 0,
                        success: false,
                        error: Some(format!("Connection failed: {}", e)),
                        fetch_time_ms: start_time.elapsed().as_millis() as u64,
                    },
                };
            }

            // Fetch emails (with or without priority)
            let fetch_result = if enable_priority {
                log::info!("[Account {}] Using priority fetch (unread first)", account_email);
                client.fetch_emails_with_priority(&folder_path_clone, 0, safe_page_size).await
            } else {
                log::info!("[Account {}] Using standard fetch", account_email);
                client.fetch_emails(&folder_path_clone, 0, safe_page_size).await
            };

            let elapsed = start_time.elapsed().as_millis() as u64;

            match fetch_result {
                Ok(result) => {
                    let email_count = result.emails.len() as u32;
                    log::info!("[Account {}] ✓ Fetched {} emails in {}ms", account_email, email_count, elapsed);

                    // Add account metadata to each email
                    let mut emails_with_metadata = result.emails;
                    for email in &mut emails_with_metadata {
                        email.account_id = Some(account_id_str.clone());
                        email.account_email = Some(account_email.clone());
                        email.account_name = Some(display_name.clone());
                        email.account_color = Some(account_color.clone());
                    }

                    mail::AccountFetchTaskResult {
                        emails: emails_with_metadata,
                        status: mail::AccountFetchStatus {
                            account_id: account_id_str,
                            account_email: account_email.clone(),
                            account_name: Some(display_name),
                            email_count,
                            success: true,
                            error: None,
                            fetch_time_ms: elapsed,
                        },
                    }
                }
                Err(e) => {
                    let error_msg = format!("{}", e);
                    log::warn!("[Account {}] ✗ Failed in {}ms: {}", account_email, elapsed, error_msg);

                    mail::AccountFetchTaskResult {
                        emails: vec![],
                        status: mail::AccountFetchStatus {
                            account_id: account_id_str,
                            account_email: account_email.clone(),
                            account_name: Some(display_name),
                            email_count: 0,
                            success: false,
                            error: Some(error_msg),
                            fetch_time_ms: elapsed,
                        },
                    }
                }
            }
        });

        handles.push(handle);
    }

    // Wait for all tasks to complete
    log::info!("[PARALLEL FETCH] Waiting for {} tasks to complete", handles.len());
    let results = futures::future::join_all(handles).await;

    // Collect results
    let mut all_emails: Vec<mail::EmailSummary> = Vec::new();
    let mut account_results: Vec<mail::AccountFetchStatus> = Vec::new();

    for result in results {
        match result {
            Ok(task_result) => {
                // Collect emails from this account
                all_emails.extend(task_result.emails);
                account_results.push(task_result.status);
            }
            Err(e) => {
                log::error!("[PARALLEL FETCH] Task panicked: {}", e);
                // Create error status for panicked task
                account_results.push(mail::AccountFetchStatus {
                    account_id: "unknown".to_string(),
                    account_email: "unknown".to_string(),
                    account_name: None,
                    email_count: 0,
                    success: false,
                    error: Some(format!("Task panicked: {}", e)),
                    fetch_time_ms: 0,
                });
            }
        }
    }

    // Apply global sorting
    apply_global_sort(&mut all_emails, sort_mode);

    // Apply pagination
    let total = all_emails.len() as u32;
    let start_idx = (page * safe_page_size) as usize;
    let end_idx = std::cmp::min(start_idx + safe_page_size as usize, all_emails.len());
    let has_more = end_idx < all_emails.len();

    let paginated_emails = if start_idx < all_emails.len() {
        all_emails[start_idx..end_idx].to_vec()
    } else {
        vec![]
    };

    let total_elapsed = total_start.elapsed().as_millis();
    log::info!(
        "[PARALLEL FETCH] ✓ Completed in {}ms: {} total emails, returning {}-{}, has_more={}",
        total_elapsed, total, start_idx, end_idx, has_more
    );

    Ok(mail::MultiAccountFetchResult {
        emails: paginated_emails,
        total,
        has_more,
        account_results,
    })
}

/// Helper to connect an account (internal use)
async fn connect_account_internal(state: &State<'_, AppState>, account: &db::Account) -> Result<(), String> {
    let account_id = account.id.to_string();

    // Get password
    let encrypted_password = state.db.get_account_password(account.id)
        .map_err(|e| format!("Failed to get password: {}", e))?
        .ok_or_else(|| "No password found for account".to_string())?;

    // Decrypt password
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("Password decryption failed: {}", e))?;

    // Parse security type
    let security = match account.imap_security.to_uppercase().as_str() {
        "SSL" => mail::SecurityType::SSL,
        "STARTTLS" => mail::SecurityType::STARTTLS,
        _ => mail::SecurityType::SSL,
    };

    // Create ImapConfig
    let config = mail::ImapConfig {
        host: account.imap_host.clone(),
        port: account.imap_port as u16,
        security,
        username: account.email.clone(),
        password,
        accept_invalid_certs: account.accept_invalid_certs,
        oauth_provider: account.oauth_provider.clone(),
    };

    // Create and connect client
    let mut client = mail::AsyncImapClient::new(config);
    client.connect().await.map_err(|e| format!("{}", e))?;

    // Store client
    let mut async_clients = state.async_imap_clients.lock().await;
    async_clients.insert(account_id.clone(), client);

    log::info!("Connected to account: {} ({})", account.email, account_id);

    Ok(())
}

/// Get full email content by UID
#[tauri::command]
async fn email_get(
    state: State<'_, AppState>,
    account_id: String,
    uid: u32,
    folder: Option<String>,
) -> Result<mail::ParsedEmail, String> {
    log::info!("email_get: account={}, uid={}, folder={:?}", account_id, uid, folder);

    // SECURITY: Use safe folder lookup that handles mutex poisoning
    let folder_path = folder.unwrap_or_else(|| {
        get_current_folder_safe(&state.current_folder, &account_id)
    });

    // Get account details from database for fresh connection
    let account_id_num: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;
    let account = state.db.get_account(account_id_num)
        .map_err(|e| format!("Failed to get account: {}", e))?;
    let encrypted_password = state.db.get_account_password(account_id_num)
        .map_err(|e| format!("Failed to get password: {}", e))?
        .ok_or_else(|| "No password found for account".to_string())?;

    // Decrypt password
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("Password decryption failed: {}", e))?;

    // Parse security type
    let security = match account.imap_security.to_uppercase().as_str() {
        "SSL" => mail::SecurityType::SSL,
        "STARTTLS" => mail::SecurityType::STARTTLS,
        _ => mail::SecurityType::SSL,
    };

    // Create ImapConfig for fresh connection
    let config = mail::ImapConfig {
        host: account.imap_host.clone(),
        port: account.imap_port as u16,
        security,
        username: account.email.clone(),
        password,
        accept_invalid_certs: account.accept_invalid_certs,
        oauth_provider: account.oauth_provider.clone(),
    };

    // Create a fresh connection for this request to avoid session conflicts
    log::info!("email_get: creating fresh IMAP connection for uid={}", uid);
    let mut fresh_client = mail::AsyncImapClient::new(config);
    fresh_client.connect().await.map_err(|e| format!("Failed to connect: {}", e))?;

    // Fetch with timeout (15 seconds)
    let fetch_result = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        fresh_client.fetch_email(&folder_path, uid)
    ).await;

    let email = match fetch_result {
        Ok(Ok(email)) => email,
        Ok(Err(e)) => return Err(format!("Fetch error: {}", e)),
        Err(_) => return Err("Fetch timeout - server did not respond in time".to_string()),
    };

    // Save attachments to database if email exists in DB and has attachments
    if !email.attachments.is_empty() {
        // Try to find email in database by UID
        let folder_id_result = state.db.query_row::<i64, _, _>(
            "SELECT id FROM folders WHERE account_id = ?1 AND remote_name = ?2",
            rusqlite::params![account_id_num, folder_path],
            |row| row.get(0),
        );

        if let Ok(folder_id) = folder_id_result {
            let email_id_result = state.db.query_row::<i64, _, _>(
                "SELECT id FROM emails WHERE account_id = ?1 AND folder_id = ?2 AND uid = ?3",
                rusqlite::params![account_id_num, folder_id, uid],
                |row| row.get(0),
            );

            if let Ok(email_id) = email_id_result {
                // Check if attachments already saved
                let existing_count = state.db.query_row::<i64, _, _>(
                    "SELECT COUNT(*) FROM attachments WHERE email_id = ?1",
                    rusqlite::params![email_id],
                    |row| row.get(0),
                ).unwrap_or(0);

                // Save attachments if not already saved
                if existing_count == 0 {
                    for attachment in &email.attachments {
                        let new_att = db::NewAttachment {
                            email_id,
                            filename: attachment.filename.clone(),
                            content_type: attachment.content_type.clone(),
                            size: attachment.size as i64,
                            content_id: None,
                            is_inline: false,
                            local_path: None,
                            is_downloaded: false,
                        };

                        if let Err(e) = state.db.insert_attachment(&new_att) {
                            log::warn!("Failed to save attachment to database: {}", e);
                        }
                    }
                    log::info!("Saved {} attachments to database for email {}", email.attachments.len(), email_id);
                }
            }
        }
    }

    log::info!("email_get: returning email with subject={}", email.subject);
    Ok(email)
}

/// Download attachment from email
#[tauri::command]
async fn email_download_attachment(
    state: State<'_, AppState>,
    account_id: String,
    folder: String,
    uid: u32,
    attachment_index: usize,
) -> Result<mail::AttachmentData, String> {
    log::info!("email_download_attachment: account={}, folder={}, uid={}, index={}", account_id, folder, uid, attachment_index);

    let account_id_num: i64 = account_id.parse()
        .map_err(|_| "Invalid account ID".to_string())?;

    // Get account details
    let account = state.db.get_account(account_id_num)
        .map_err(|e| format!("Failed to get account: {}", e))?;

    // Get encrypted password
    let encrypted_password = state.db.get_account_password(account_id_num)
        .map_err(|e| format!("Failed to get password: {}", e))?
        .ok_or_else(|| "No password found for account".to_string())?;

    // Decrypt password
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("Password decryption failed: {}", e))?;

    // Parse security type
    let security = match account.imap_security.to_uppercase().as_str() {
        "SSL" => mail::SecurityType::SSL,
        "STARTTLS" => mail::SecurityType::STARTTLS,
        _ => mail::SecurityType::SSL,
    };

    // Create ImapConfig for fresh connection
    let config = mail::ImapConfig {
        host: account.imap_host.clone(),
        port: account.imap_port as u16,
        security,
        username: account.email.clone(),
        password,
        accept_invalid_certs: account.accept_invalid_certs,
        oauth_provider: account.oauth_provider.clone(),
    };

    // Create a fresh connection for this request
    log::info!("email_download_attachment: creating fresh IMAP connection");
    let mut fresh_client = mail::AsyncImapClient::new(config);
    fresh_client.connect().await.map_err(|e| format!("Failed to connect: {}", e))?;

    // Fetch attachment with timeout (30 seconds - larger files may take longer)
    let fetch_result = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        fresh_client.fetch_attachment(&folder, uid, attachment_index)
    ).await;

    let attachment = match fetch_result {
        Ok(Ok(att)) => att,
        Ok(Err(e)) => return Err(format!("Fetch error: {}", e)),
        Err(_) => return Err("Fetch timeout - attachment download took too long".to_string()),
    };

    log::info!("✓ email_download_attachment: downloaded {} ({} bytes)", attachment.filename, attachment.size);
    Ok(attachment)
}

/// Search emails using local FTS5 (fast, offline)
#[tauri::command]
async fn email_search(
    state: State<'_, AppState>,
    account_id: String,
    query: String,
    _folder: Option<String>,
) -> Result<Vec<EmailSummary>, String> {
    // Validate query
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    if query.len() > 500 {
        return Err("Search query too long (max 500 characters)".to_string());
    }

    // Parse account ID
    let account_id_num: i64 = account_id.parse()
        .map_err(|_| "Invalid account ID".to_string())?;

    // Local FTS5 Search
    log::info!("FTS5 search: account={}, query='{}'", account_id_num, query);

    let results = state.db.search_emails(account_id_num, &query, 100)
        .map_err(|e| format!("Search failed: {}", e))?;

    log::info!("FTS5 returned {} results", results.len());

    Ok(results)
}

/// Advanced email search with filters
#[tauri::command]
async fn email_search_advanced(
    state: State<'_, AppState>,
    account_id: String,
    filters: db::SearchFilters,
    limit: i32,
    offset: i32,
) -> Result<db::SearchResult, String> {
    // Parse account ID
    let account_id_num: i64 = account_id.parse()
        .map_err(|_| "Invalid account ID".to_string())?;

    log::info!(
        "Advanced search: account={}, filters={:?}, limit={}, offset={}",
        account_id_num, filters, limit, offset
    );

    // Execute advanced search
    let result = state.db.search_emails_advanced(account_id_num, &filters, limit, offset)
        .map_err(|e| format!("Advanced search failed: {}", e))?;

    log::info!(
        "Advanced search returned {} results (search_time={}ms, has_more={})",
        result.emails.len(), result.search_time, result.has_more
    );

    Ok(result)
}

/// Mark email as read/unread
#[tauri::command]
async fn email_mark_read(
    state: State<'_, AppState>,
    account_id: String,
    uid: u32,
    read: bool,
    folder: Option<String>,
) -> Result<(), String> {
    // SECURITY: Use safe folder lookup that handles mutex poisoning
    let folder_path = folder.unwrap_or_else(|| {
        get_current_folder_safe(&state.current_folder, &account_id)
    });

    let mut async_clients = state.async_imap_clients.lock().await;
    let client = async_clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .set_read(&folder_path, uid, read)
        .await
        .map_err(|e| e.to_string())
}

/// Mark email as starred/unstarred
#[tauri::command]
async fn email_mark_starred(
    state: State<'_, AppState>,
    account_id: String,
    uid: u32,
    starred: bool,
    folder: Option<String>,
) -> Result<(), String> {
    // SECURITY: Use safe folder lookup that handles mutex poisoning
    let folder_path = folder.unwrap_or_else(|| {
        get_current_folder_safe(&state.current_folder, &account_id)
    });

    let mut async_clients = state.async_imap_clients.lock().await;
    let client = async_clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .set_starred(&folder_path, uid, starred)
        .await
        .map_err(|e| e.to_string())
}

/// Move email to a folder
#[tauri::command]
async fn email_move(
    state: State<'_, AppState>,
    account_id: String,
    uid: u32,
    target_folder: String,
    folder: Option<String>,
) -> Result<(), String> {
    // SECURITY: Use safe folder lookup that handles mutex poisoning
    let folder_path = folder.unwrap_or_else(|| {
        get_current_folder_safe(&state.current_folder, &account_id)
    });

    let mut async_clients = state.async_imap_clients.lock().await;
    let client = async_clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .move_email(&folder_path, uid, &target_folder)
        .await
        .map_err(|e| e.to_string())
}

/// Delete email
#[tauri::command]
async fn email_delete(
    state: State<'_, AppState>,
    account_id: String,
    uid: u32,
    permanent: bool,
    folder: Option<String>,
) -> Result<(), String> {
    // SECURITY: Use safe folder lookup that handles mutex poisoning
    let folder_path = folder.unwrap_or_else(|| {
        get_current_folder_safe(&state.current_folder, &account_id)
    });

    let mut async_clients = state.async_imap_clients.lock().await;
    let client = async_clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .delete_email(&folder_path, uid, permanent)
        .await
        .map_err(|e| e.to_string())
}

/// Attachment file path for sending
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentPath {
    pub path: String,
    pub filename: String,
    pub content_type: String,
}

/// Send an email
/// SECURITY: Validates all recipients and enforces limits
#[tauri::command]
async fn email_send(
    state: State<'_, AppState>,
    account_id: String,
    to: Vec<String>,
    cc: Vec<String>,
    bcc: Vec<String>,
    subject: String,
    text_body: Option<String>,
    html_body: Option<String>,
    attachment_paths: Option<Vec<AttachmentPath>>,
) -> Result<(), String> {
    // SECURITY: Validate account ID
    let id: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;
    if id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    // SECURITY: Validate recipient counts
    let total_recipients = to.len() + cc.len() + bcc.len();
    if total_recipients == 0 {
        return Err("At least one recipient is required".to_string());
    }
    if total_recipients > MAX_RECIPIENTS {
        return Err(format!("Too many recipients (max {})", MAX_RECIPIENTS));
    }

    // SECURITY: Validate all email addresses
    for email in to.iter().chain(cc.iter()).chain(bcc.iter()) {
        validate_email(email)?;
    }

    // SECURITY: Validate subject length
    if subject.len() > 998 {
        return Err("Subject too long (max 998 characters)".to_string());
    }

    // SECURITY: Check for header injection in subject
    if subject.contains('\r') || subject.contains('\n') {
        return Err("Invalid characters in subject".to_string());
    }

    let account = state.db.get_account(id)
        .map_err(|e| format!("Database error: {}", e))?;

    let encrypted_password = state.db.get_account_password(id)
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "No password stored".to_string())?;

    // Decrypt password (or access token for OAuth)
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("Password decryption failed: {}", e))?;

    log::info!("Sending email from {} to {:?}", account.email, to);

    // Check if this is an OAuth account
    if account.oauth_provider.is_some() {
        log::info!("Using OAuth2 SMTP for account: {}", account.email);

        // Determine email body format
        let (body_str, is_html) = if let Some(html) = html_body {
            (html, true)
        } else {
            (text_body.unwrap_or_default(), false)
        };

        // Load attachments
        let mut attachments_data = Vec::new();
        if let Some(paths) = &attachment_paths {
            for att_path in paths {
                let data = tokio::fs::read(&att_path.path)
                    .await
                    .map_err(|e| format!("Failed to read attachment {}: {}", att_path.filename, e))?;

                attachments_data.push(mail::smtp_oauth::AttachmentData {
                    filename: att_path.filename.clone(),
                    content_type: att_path.content_type.clone(),
                    data,
                });
            }
        }

        // Use OAuth2 SMTP implementation
        return mail::smtp_oauth::send_email_oauth(
            &account.smtp_host,
            account.smtp_port as u16,
            &account.email,
            &password, // This is the access token
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
        .map_err(|e| {
            log::error!("OAuth SMTP send failed: {}", e);
            e.to_string()
        });
    }

    // Build and send email using lettre
    use lettre::{
        message::{header::ContentType, Mailbox, MultiPart, SinglePart},
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport, AsyncTransport, Message,
    };

    let from: Mailbox = account
        .email
        .parse()
        .map_err(|e: lettre::address::AddressError| e.to_string())?;

    let mut email_builder = Message::builder()
        .from(from)
        .subject(&subject);

    // Add recipients
    for recipient in &to {
        let mailbox: Mailbox = recipient
            .parse()
            .map_err(|e: lettre::address::AddressError| e.to_string())?;
        email_builder = email_builder.to(mailbox);
    }

    for recipient in &cc {
        let mailbox: Mailbox = recipient
            .parse()
            .map_err(|e: lettre::address::AddressError| e.to_string())?;
        email_builder = email_builder.cc(mailbox);
    }

    for recipient in &bcc {
        let mailbox: Mailbox = recipient
            .parse()
            .map_err(|e: lettre::address::AddressError| e.to_string())?;
        email_builder = email_builder.bcc(mailbox);
    }

    // Build body with or without attachments
    let email = if let Some(paths) = &attachment_paths {
        if !paths.is_empty() {
            // Build multipart mixed body with attachments
            let mut final_multipart = if let (Some(text), Some(html)) = (&text_body, &html_body) {
                // Alternative text/html
                MultiPart::mixed().multipart(
                    MultiPart::alternative()
                        .singlepart(
                            SinglePart::builder()
                                .header(ContentType::TEXT_PLAIN)
                                .body(text.clone()),
                        )
                        .singlepart(
                            SinglePart::builder()
                                .header(ContentType::TEXT_HTML)
                                .body(html.clone()),
                        ),
                )
            } else if let Some(html) = &html_body {
                MultiPart::mixed().singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(html.clone()),
                )
            } else {
                MultiPart::mixed().singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(text_body.clone().unwrap_or_default()),
                )
            };

            // Add all attachments
            for att_path in paths {
                let data = tokio::fs::read(&att_path.path)
                    .await
                    .map_err(|e| format!("Failed to read attachment {}: {}", att_path.filename, e))?;

                let content_type: ContentType = att_path.content_type
                    .parse()
                    .unwrap_or_else(|_| ContentType::parse("application/octet-stream").unwrap());

                final_multipart = final_multipart.singlepart(
                    lettre::message::Attachment::new(att_path.filename.clone())
                        .body(data, content_type),
                );
            }

            email_builder
                .multipart(final_multipart)
                .map_err(|e| e.to_string())?
        } else {
            // No attachments, build simple body
            if let (Some(text), Some(html)) = (&text_body, &html_body) {
                email_builder
                    .multipart(
                        MultiPart::alternative()
                            .singlepart(
                                SinglePart::builder()
                                    .header(ContentType::TEXT_PLAIN)
                                    .body(text.clone()),
                            )
                            .singlepart(
                                SinglePart::builder()
                                    .header(ContentType::TEXT_HTML)
                                    .body(html.clone()),
                            ),
                    )
                    .map_err(|e| e.to_string())?
            } else if let Some(html) = html_body {
                email_builder
                    .header(ContentType::TEXT_HTML)
                    .body(html)
                    .map_err(|e| e.to_string())?
            } else {
                email_builder
                    .header(ContentType::TEXT_PLAIN)
                    .body(text_body.unwrap_or_default())
                    .map_err(|e| e.to_string())?
            }
        }
    } else {
        // No attachments, build simple body
        if let (Some(text), Some(html)) = (&text_body, &html_body) {
            email_builder
                .multipart(
                    MultiPart::alternative()
                        .singlepart(
                            SinglePart::builder()
                                .header(ContentType::TEXT_PLAIN)
                                .body(text.clone()),
                        )
                        .singlepart(
                            SinglePart::builder()
                                .header(ContentType::TEXT_HTML)
                                .body(html.clone()),
                        ),
                )
                .map_err(|e| e.to_string())?
        } else if let Some(html) = html_body {
            email_builder
                .header(ContentType::TEXT_HTML)
                .body(html)
                .map_err(|e| e.to_string())?
        } else {
            email_builder
                .header(ContentType::TEXT_PLAIN)
                .body(text_body.unwrap_or_default())
                .map_err(|e| e.to_string())?
        }
    };

    let creds = Credentials::new(account.smtp_username.clone().unwrap_or(account.email.clone()), password);

    let security = parse_security(&account.smtp_security);

    let mailer = match security {
        SecurityType::SSL => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::relay(&account.smtp_host)
                .map_err(|e| e.to_string())?
                .credentials(creds)
                .port(account.smtp_port as u16)
                .build()
        }
        SecurityType::STARTTLS => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::starttls_relay(&account.smtp_host)
                .map_err(|e| e.to_string())?
                .credentials(creds)
                .port(account.smtp_port as u16)
                .build()
        }
        SecurityType::NONE => {
            return Err("Insecure SMTP not supported".to_string());
        }
    };

    mailer.send(email).await.map_err(|e| e.to_string())?;

    log::info!("Email sent successfully");
    Ok(())
}

// ============================================================================
// Attachment Commands
// ============================================================================

/// Write temporary file from byte array (for frontend File objects)
#[tauri::command]
async fn write_temp_attachment(
    filename: String,
    content_type: String,
    data: Vec<u8>,
) -> Result<AttachmentPath, String> {
    // SECURITY: Validate filename
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename".to_string());
    }

    // SECURITY: Limit file size (50MB)
    const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;
    if data.len() > MAX_FILE_SIZE {
        return Err("File too large (max 50MB)".to_string());
    }

    // Create temp directory for attachments
    let temp_dir = std::env::temp_dir().join("owlivion-mail-attachments");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Generate unique filename
    let unique_name = format!("{}_{}", uuid::Uuid::new_v4(), filename);
    let temp_path = temp_dir.join(&unique_name);

    // Write file to temp location
    tokio::fs::write(&temp_path, data)
        .await
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    Ok(AttachmentPath {
        path: temp_path.to_string_lossy().to_string(),
        filename,
        content_type,
    })
}

/// Upload attachment and return temporary path
#[tauri::command]
async fn attachment_upload(
    file_path: String,
    filename: String,
    content_type: String,
) -> Result<AttachmentPath, String> {
    // SECURITY: Validate filename
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename".to_string());
    }

    // Read file
    let data = tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // SECURITY: Limit file size (50MB)
    const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;
    if data.len() > MAX_FILE_SIZE {
        return Err("File too large (max 50MB)".to_string());
    }

    // Create temp directory for attachments
    let temp_dir = std::env::temp_dir().join("owlivion-mail-attachments");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Generate unique filename
    let unique_name = format!("{}_{}", uuid::Uuid::new_v4(), filename);
    let temp_path = temp_dir.join(&unique_name);

    // Copy file to temp location
    tokio::fs::write(&temp_path, data)
        .await
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    Ok(AttachmentPath {
        path: temp_path.to_string_lossy().to_string(),
        filename,
        content_type,
    })
}

/// Get attachments for an email
#[tauri::command]
async fn get_email_attachments(
    state: State<'_, AppState>,
    email_id: i64,
) -> Result<Vec<db::Attachment>, String> {
    state.db.get_attachments_for_email(email_id)
        .map_err(|e| format!("Failed to get attachments: {}", e))
}

/// Download attachment to user-selected location
#[tauri::command]
async fn attachment_download(
    state: State<'_, AppState>,
    account_id: i64,
    email_id: i64,
    attachment_id: i64,
    save_path: String,
) -> Result<(), String> {
    // Get attachment info
    let attachment = state.db.get_attachment(attachment_id)
        .map_err(|e| format!("Failed to get attachment: {}", e))?;

    // Verify attachment belongs to email
    if attachment.email_id != email_id {
        return Err("Attachment does not belong to this email".to_string());
    }

    // Check if already downloaded locally
    if attachment.is_downloaded {
        if let Some(local_path) = &attachment.local_path {
            if tokio::fs::metadata(local_path).await.is_ok() {
                // Copy to save location
                tokio::fs::copy(local_path, &save_path)
                    .await
                    .map_err(|e| format!("Failed to copy file: {}", e))?;
                return Ok(());
            }
        }
    }

    // Need to download from IMAP server
    // Get account info
    let account = state.db.get_account(account_id)
        .map_err(|e| format!("Failed to get account: {}", e))?;

    let encrypted_password = state.db.get_account_password(account_id)
        .map_err(|e| format!("Failed to get password: {}", e))?
        .ok_or_else(|| "No password stored".to_string())?;

    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("Password decryption failed: {}", e))?;

    // Get email info to find folder
    let email = state.db.get_email(email_id)
        .map_err(|e| format!("Failed to get email: {}", e))?;

    let folder = state.db.get_folder_by_id(email.folder_id)
        .map_err(|e| format!("Failed to get folder: {}", e))?;

    // Connect to IMAP and fetch email with attachments
    let config = ImapConfig {
        host: account.imap_host.clone(),
        port: account.imap_port as u16,
        username: account.imap_username.clone().unwrap_or(account.email.clone()),
        password: password.clone(),
        security: parse_security(&account.imap_security),
        accept_invalid_certs: account.accept_invalid_certs,
        oauth_provider: account.oauth_provider.clone(),
    };

    let mut imap_client = AsyncImapClient::new(config);
    imap_client.connect().await
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    let parsed_email = imap_client.fetch_email(&folder.remote_name, email.uid).await
        .map_err(|e| format!("Failed to fetch email: {}", e))?;

    // Find attachment in parsed email
    let att_info = parsed_email.attachments.iter()
        .find(|a| a.filename == attachment.filename)
        .ok_or_else(|| "Attachment not found in email".to_string())?;

    // For now, we can't download individual attachments - would need to parse BODYSTRUCTURE
    // This is a limitation - we'll note it for future improvement
    return Err("Attachment download from server not yet implemented. Please re-fetch the email.".to_string());
}

// ============================================================================
// Sync Commands
// ============================================================================

use sync::SyncConfig;
use std::sync::Mutex as StdMutex;

/// Register new Owlivion Account
#[tauri::command]
async fn sync_register(
    state: State<'_, AppState>,
    email: String,
    password: String,
    master_password: String,
) -> Result<(), String> {
    let manager = state.get_sync_manager()?;
    manager.register(email, password, master_password).await
        .map_err(|e| format!("Registration failed: {}", e))
}

/// Login to Owlivion Account
#[tauri::command]
async fn sync_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<(), String> {
    let manager = state.get_sync_manager()?;
    manager.login(email, password).await
        .map_err(|e| format!("Login failed: {}", e))
}

/// Logout from Owlivion Account
#[tauri::command]
async fn sync_logout(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.get_sync_manager()?;
    manager.logout().await
        .map_err(|e| format!("Logout failed: {}", e))
}

/// Start manual sync (bidirectional with conflict detection)
#[tauri::command]
async fn sync_start(state: State<'_, AppState>, master_password: String) -> Result<SyncResultDto, String> {
    let manager = state.get_sync_manager()?;
    let result = manager.sync_all(&master_password).await
        .map_err(|e| format!("Sync failed: {}", e))?;

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

/// Resolve a sync conflict manually
#[tauri::command]
async fn sync_resolve_conflict(
    state: State<'_, AppState>,
    data_type: String,
    strategy: String,
    master_password: String,
) -> Result<(), String> {
    let manager = state.get_sync_manager()?;

    // Parse data type
    let data_type_enum = match data_type.as_str() {
        "accounts" => crate::sync::SyncDataType::Accounts,
        "contacts" => crate::sync::SyncDataType::Contacts,
        "preferences" => crate::sync::SyncDataType::Preferences,
        "signatures" => crate::sync::SyncDataType::Signatures,
        _ => return Err("Invalid data type".to_string()),
    };

    // Parse strategy
    let strategy_enum = match strategy.as_str() {
        "use_local" => crate::sync::ConflictStrategy::UseLocal,
        "use_server" => crate::sync::ConflictStrategy::UseServer,
        "merge" => crate::sync::ConflictStrategy::Merge,
        "manual" => crate::sync::ConflictStrategy::Manual,
        _ => return Err("Invalid strategy".to_string()),
    };

    // Resolve the conflict using the manager
    manager.resolve_conflict(data_type_enum, strategy_enum, &master_password)
        .await
        .map_err(|e| format!("Conflict resolution failed: {}", e))
}

/// Get sync configuration
#[tauri::command]
async fn sync_get_config(state: State<'_, AppState>) -> Result<SyncConfigDto, String> {
    let manager = state.get_sync_manager()?;
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

/// Update sync configuration
#[tauri::command]
async fn sync_update_config(state: State<'_, AppState>, config: SyncConfigDto) -> Result<(), String> {
    let manager = state.get_sync_manager()?;

    use sync::Platform;

    let platform = match config.platform.as_str() {
        "windows" => Platform::Windows,
        "macos" => Platform::MacOS,
        "linux" => Platform::Linux,
        _ => return Err("Invalid platform".to_string()),
    };

    let sync_config = SyncConfig {
        enabled: config.enabled,
        user_id: config.user_id,
        device_id: config.device_id,
        device_name: config.device_name,
        platform,
        last_sync_at: config.last_sync_at.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|dt| dt.with_timezone(&chrono::Utc))),
        sync_interval_minutes: 30, // TODO: Add to DTO
        sync_on_startup: true, // TODO: Add to DTO
        sync_accounts: config.sync_accounts,
        sync_contacts: config.sync_contacts,
        sync_preferences: config.sync_preferences,
        sync_signatures: config.sync_signatures,
        master_key_salt: None, // Managed internally
    };

    manager.update_config(sync_config).await;
    Ok(())
}

/// Get sync status for all data types
#[tauri::command]
async fn sync_get_status(state: State<'_, AppState>) -> Result<Vec<SyncStatusDto>, String> {
    let manager = state.get_sync_manager()?;
    let statuses = manager.get_status().await
        .map_err(|e| format!("Failed to get status: {}", e))?;

    Ok(statuses.into_iter().map(|s| SyncStatusDto {
        data_type: s.data_type,
        version: s.version,
        last_sync_at: s.last_sync_at.map(|t| t.to_rfc3339()),
        status: s.status.as_str().to_string(),
    }).collect())
}

/// List all devices for this account
#[tauri::command]
async fn sync_list_devices(state: State<'_, AppState>) -> Result<Vec<DeviceInfoDto>, String> {
    let manager = state.get_sync_manager()?;
    let devices = manager.list_devices().await
        .map_err(|e| format!("Failed to list devices: {}", e))?;

    Ok(devices.into_iter().map(|d| DeviceInfoDto {
        device_id: d.device_id,
        device_name: d.device_name,
        platform: d.platform,
        last_seen_at: d.last_seen_at,
        created_at: d.created_at,
    }).collect())
}

/// Revoke device access
#[tauri::command]
async fn sync_revoke_device(state: State<'_, AppState>, device_id: String) -> Result<(), String> {
    let manager = state.get_sync_manager()?;
    manager.revoke_device(&device_id).await
        .map_err(|e| format!("Failed to revoke device: {}", e))
}

/// Get queue statistics
#[tauri::command]
fn sync_get_queue_stats(state: State<'_, AppState>) -> Result<QueueStatsDto, String> {
    let manager = state.get_sync_manager()?;
    let stats = manager.get_queue_stats()
        .map_err(|e| format!("Failed to get queue stats: {}", e))?;

    Ok(QueueStatsDto {
        pending_count: stats.pending_count,
        in_progress_count: stats.in_progress_count,
        failed_count: stats.failed_count,
        completed_count: stats.completed_count,
        total_count: stats.total_count,
    })
}

/// Process pending queue items (retry failed syncs)
#[tauri::command]
async fn sync_process_queue(
    state: State<'_, AppState>,
    master_password: String,
) -> Result<ProcessQueueResultDto, String> {
    let manager = state.get_sync_manager()?;
    let result = manager.process_queue(&master_password).await
        .map_err(|e| format!("Failed to process queue: {}", e))?;

    Ok(ProcessQueueResultDto {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
    })
}

/// Retry all failed queue items
#[tauri::command]
fn sync_retry_failed(state: State<'_, AppState>) -> Result<i32, String> {
    let manager = state.get_sync_manager()?;
    manager.retry_failed_syncs()
        .map_err(|e| format!("Failed to retry failed syncs: {}", e))
}

/// Clear completed queue items older than N days
#[tauri::command]
fn sync_clear_completed_queue(state: State<'_, AppState>, older_than_days: i32) -> Result<i32, String> {
    let manager = state.get_sync_manager()?;
    manager.clear_completed_queue(older_than_days)
        .map_err(|e| format!("Failed to clear completed queue: {}", e))
}

/// Clear permanently failed queue items
#[tauri::command]
fn sync_clear_failed_queue(state: State<'_, AppState>) -> Result<i32, String> {
    let manager = state.get_sync_manager()?;
    manager.clear_failed_queue()
        .map_err(|e| format!("Failed to clear failed queue: {}", e))
}

// ============================================================================
// Sync History & Rollback Commands
// ============================================================================

#[tauri::command]
async fn get_sync_history(
    data_type: String,
    limit: i32,
    state: State<'_, AppState>,
) -> Result<Vec<SyncSnapshotDto>, String> {
    let manager = state.get_sync_manager()?;
    let data_type_enum = parse_sync_data_type(&data_type)?;

    let snapshots = manager.get_sync_history(data_type_enum, limit)
        .map_err(|e| format!("Failed to get history: {}", e))?;

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

#[tauri::command]
async fn rollback_sync(
    data_type: String,
    version: i64,
    master_password: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.get_sync_manager()?;
    let data_type_enum = parse_sync_data_type(&data_type)?;

    manager.rollback_to_version(data_type_enum, version, &master_password).await
        .map_err(|e| format!("Rollback failed: {}", e))
}

#[tauri::command]
async fn enforce_sync_retention(
    retention_days: i64,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let manager = state.get_sync_manager()?;
    manager.enforce_history_retention(retention_days)
        .map_err(|e| format!("Failed to enforce retention: {}", e))
}

// ============================================================================
// Session Management Commands
// ============================================================================

/// Get active sessions
#[tauri::command]
async fn sync_get_sessions(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    use crate::sync::models::ActiveSession;

    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .get(format!("{}/api/v1/sessions", manager.server_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get sessions: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Revoke a specific session
#[tauri::command]
async fn sync_revoke_session(
    device_id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .delete(format!("{}/api/v1/sessions/{}", manager.server_url, device_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to revoke session: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Revoke all sessions except current
#[tauri::command]
async fn sync_revoke_all_sessions(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .delete(format!("{}/api/v1/sessions", manager.server_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to revoke sessions: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// ============================================================================
// Audit Log Commands
// ============================================================================

/// Get audit logs with filters
#[tauri::command]
async fn sync_get_audit_logs(
    filters: Option<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    // Build query string from filters
    let mut query_params = vec![];
    if let Some(filters_obj) = filters {
        if let Some(page) = filters_obj.get("page") {
            query_params.push(format!("page={}", page));
        }
        if let Some(limit) = filters_obj.get("limit") {
            query_params.push(format!("limit={}", limit));
        }
        if let Some(data_type) = filters_obj.get("data_type").and_then(|v| v.as_str()) {
            query_params.push(format!("data_type={}", data_type));
        }
        if let Some(action) = filters_obj.get("action").and_then(|v| v.as_str()) {
            query_params.push(format!("action={}", action));
        }
        if let Some(start_date) = filters_obj.get("start_date").and_then(|v| v.as_str()) {
            query_params.push(format!("start_date={}", start_date));
        }
        if let Some(end_date) = filters_obj.get("end_date").and_then(|v| v.as_str()) {
            query_params.push(format!("end_date={}", end_date));
        }
        if let Some(success) = filters_obj.get("success") {
            query_params.push(format!("success={}", success));
        }
    }

    let query_string = if query_params.is_empty() {
        String::new()
    } else {
        format!("?{}", query_params.join("&"))
    };

    let response = http_client
        .get(format!("{}/api/v1/audit/logs{}", manager.server_url, query_string))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get audit logs: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Get audit statistics
#[tauri::command]
async fn sync_get_audit_stats(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .get(format!("{}/api/v1/audit/stats", manager.server_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get audit stats: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Export audit logs to CSV
#[tauri::command]
async fn sync_export_audit_logs(
    start_date: Option<String>,
    end_date: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    // Build query string
    let mut query_params = vec![];
    if let Some(start) = start_date {
        query_params.push(format!("start_date={}", start));
    }
    if let Some(end) = end_date {
        query_params.push(format!("end_date={}", end));
    }

    let query_string = if query_params.is_empty() {
        String::new()
    } else {
        format!("?{}", query_params.join("&"))
    };

    let response = http_client
        .get(format!("{}/api/v1/audit/export{}", manager.server_url, query_string))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to export audit logs: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    // Get CSV content
    let csv_content = response
        .text()
        .await
        .map_err(|e| format!("Failed to get CSV content: {}", e))?;

    // Save to downloads directory
    use std::path::PathBuf;
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    let filename = format!("owlivion-audit-{}.csv", chrono::Utc::now().format("%Y-%m-%d"));
    let file_path = downloads_dir.join(&filename);

    std::fs::write(&file_path, csv_content)
        .map_err(|e| format!("Failed to save CSV file: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "csv_path": file_path.to_string_lossy()
    }))
}

// ============================================================================
// Two-Factor Authentication Commands
// ============================================================================

/// Get 2FA status for current user
#[tauri::command]
async fn sync_get_2fa_status(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .get(format!("{}/api/v1/auth/2fa/status", manager.server_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get 2FA status: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Setup 2FA (generate secret and QR code)
#[tauri::command]
async fn sync_setup_2fa(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .post(format!("{}/api/v1/auth/2fa/setup", manager.server_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to setup 2FA: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Server error {}: {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Enable 2FA (confirm with token and get backup codes)
#[tauri::command]
async fn sync_enable_2fa(
    token: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let access_token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .post(format!("{}/api/v1/auth/2fa/enable", manager.server_url))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({ "token": token }).to_string())
        .send()
        .await
        .map_err(|e| format!("Failed to enable 2FA: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Server error {}: {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Disable 2FA (requires password and 2FA token)
#[tauri::command]
async fn sync_disable_2fa(
    password: String,
    token: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;
    let client = manager.client.lock().await;

    if client.is_none() {
        return Err("Not logged in to sync account".to_string());
    }

    let http_client = &client.as_ref().unwrap().client;
    let access_token = &client.as_ref().unwrap().access_token;

    let response = http_client
        .post(format!("{}/api/v1/auth/2fa/disable", manager.server_url))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({
            "password": password,
            "token": token
        }).to_string())
        .send()
        .await
        .map_err(|e| format!("Failed to disable 2FA: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Server error {}: {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

/// Verify 2FA during login
#[tauri::command]
async fn sync_verify_2fa(
    email: String,
    token: String,
    remember_device: bool,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.get_sync_manager()?;

    // Note: This is called during login, so we may not have a client yet
    // We'll use a temporary HTTP client
    let http_client = reqwest::Client::new();

    let response = http_client
        .post(format!("{}/api/v1/auth/2fa/verify", manager.server_url))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({
            "email": email,
            "token": token,
            "remember_device": remember_device
        }).to_string())
        .send()
        .await
        .map_err(|e| format!("Failed to verify 2FA: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Server error {}: {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// ============================================================================
// Background Scheduler Commands
// ============================================================================

/// Start background scheduler
#[tauri::command]
async fn scheduler_start(state: State<'_, AppState>) -> Result<(), String> {
    state.background_scheduler
        .start(state.sync_manager.clone())
        .await
        .map_err(|e| format!("Failed to start scheduler: {}", e))
}

/// Stop background scheduler
#[tauri::command]
async fn scheduler_stop(state: State<'_, AppState>) -> Result<(), String> {
    state.background_scheduler
        .stop()
        .await
        .map_err(|e| format!("Failed to stop scheduler: {}", e))
}

/// Get scheduler status
#[tauri::command]
async fn scheduler_get_status(state: State<'_, AppState>) -> Result<SchedulerStatusDto, String> {
    let config = state.background_scheduler.get_config().await;
    let running = state.background_scheduler.is_running();

    // Calculate next_run timestamp
    let next_run = if let Some(ref last_run_str) = config.last_run {
        if let Ok(last_run) = chrono::DateTime::parse_from_rfc3339(last_run_str) {
            let next = last_run + chrono::Duration::minutes(config.interval_minutes as i64);
            Some(next.to_rfc3339())
        } else {
            None
        }
    } else {
        None
    };

    Ok(SchedulerStatusDto {
        enabled: config.enabled,
        running,
        interval_minutes: config.interval_minutes,
        last_run: config.last_run,
        next_run,
    })
}

/// Update scheduler configuration
#[tauri::command]
async fn scheduler_update_config(
    state: State<'_, AppState>,
    enabled: bool,
    interval_minutes: u64,
) -> Result<(), String> {
    state.background_scheduler
        .update_config(enabled, interval_minutes, state.sync_manager.clone())
        .await
        .map_err(|e| format!("Failed to update scheduler config: {}", e))
}

// ============================================================================
// Draft Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct DraftEmailData {
    id: Option<i64>,
    account_id: i64,
    to_addresses: String,
    cc_addresses: String,
    bcc_addresses: String,
    subject: String,
    body_text: String,
    body_html: String,
    reply_to_email_id: Option<i64>,
    forward_email_id: Option<i64>,
    compose_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DraftAttachmentData {
    filename: String,
    content_type: String,
    size: i64,
    local_path: String,
}

/// Draft list item (lightweight, for listing)
#[derive(Debug, Serialize, Deserialize)]
struct DraftListItem {
    id: i64,
    account_id: i64,
    subject: String,
    to_addresses: String,
    created_at: String,
    updated_at: String,
}

/// Draft detail (full data, for editing)
#[derive(Debug, Serialize, Deserialize)]
struct DraftDetail {
    id: i64,
    account_id: i64,
    to_addresses: String,
    cc_addresses: String,
    bcc_addresses: String,
    subject: String,
    body_text: String,
    body_html: String,
    reply_to_email_id: Option<i64>,
    forward_email_id: Option<i64>,
    compose_type: String,
    created_at: String,
    updated_at: String,
    attachments: Vec<DraftAttachmentData>,
}

/// Sanitize filename to prevent path traversal attacks
fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect()
}

/// Save or update a draft email
#[tauri::command]
async fn draft_save(
    state: State<'_, AppState>,
    draft: DraftEmailData,
    attachments: Vec<DraftAttachmentData>,
    app_handle: tauri::AppHandle,
) -> Result<i64, String> {
    // Validate account
    let account_id = draft.account_id;
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    // Validate JSON fields
    serde_json::from_str::<Vec<serde_json::Value>>(&draft.to_addresses)
        .map_err(|_| "Invalid to_addresses JSON")?;
    serde_json::from_str::<Vec<serde_json::Value>>(&draft.cc_addresses)
        .map_err(|_| "Invalid cc_addresses JSON")?;
    serde_json::from_str::<Vec<serde_json::Value>>(&draft.bcc_addresses)
        .map_err(|_| "Invalid bcc_addresses JSON")?;

    // Insert or update draft
    let draft_id = if let Some(existing_id) = draft.id {
        // UPDATE existing
        state.db.execute(
            "UPDATE drafts SET
                to_addresses = ?2, cc_addresses = ?3, bcc_addresses = ?4,
                subject = ?5, body_text = ?6, body_html = ?7,
                reply_to_email_id = ?8, forward_email_id = ?9,
                compose_type = ?10, updated_at = datetime('now')
             WHERE id = ?1 AND account_id = ?11",
            rusqlite::params![
                existing_id,
                draft.to_addresses,
                draft.cc_addresses,
                draft.bcc_addresses,
                draft.subject,
                draft.body_text,
                draft.body_html,
                draft.reply_to_email_id,
                draft.forward_email_id,
                draft.compose_type,
                account_id,
            ],
        )
        .map_err(|e| format!("Failed to update draft: {}", e))?;

        // Delete old attachments
        state.db.execute(
            "DELETE FROM draft_attachments WHERE draft_id = ?1",
            rusqlite::params![existing_id],
        )
        .map_err(|e| format!("Failed to delete old attachments: {}", e))?;

        existing_id
    } else {
        // INSERT new
        state.db.execute_insert(
            "INSERT INTO drafts (
                account_id, to_addresses, cc_addresses, bcc_addresses,
                subject, body_text, body_html, reply_to_email_id,
                forward_email_id, compose_type
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                account_id,
                draft.to_addresses,
                draft.cc_addresses,
                draft.bcc_addresses,
                draft.subject,
                draft.body_text,
                draft.body_html,
                draft.reply_to_email_id,
                draft.forward_email_id,
                draft.compose_type,
            ],
        )
        .map_err(|e| format!("Failed to insert draft: {}", e))?
    };

    // Copy attachments to persistent cache
    if !attachments.is_empty() {
        let cache_dir = app_handle
            .path()
            .app_cache_dir()
            .map_err(|e| format!("Failed to get cache directory: {}", e))?;

        let drafts_dir = cache_dir.join("drafts").join(draft_id.to_string());
        tokio::fs::create_dir_all(&drafts_dir)
            .await
            .map_err(|e| format!("Failed to create drafts directory: {}", e))?;

        for (idx, att) in attachments.iter().enumerate() {
            let dest_filename = format!("{}_{}", idx, sanitize_filename(&att.filename));
            let dest_path = drafts_dir.join(&dest_filename);

            tokio::fs::copy(&att.local_path, &dest_path)
                .await
                .map_err(|e| format!("Failed to copy attachment: {}", e))?;

            state.db.execute(
                "INSERT INTO draft_attachments (draft_id, filename, content_type, size, local_path)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    draft_id,
                    att.filename,
                    att.content_type,
                    att.size,
                    dest_path.to_string_lossy().to_string(),
                ],
            )
            .map_err(|e| format!("Failed to insert attachment: {}", e))?;
        }
    }

    Ok(draft_id)
}

/// Delete a draft email
#[tauri::command]
async fn draft_delete(state: State<'_, AppState>, draft_id: i64) -> Result<(), String> {
    state.db.execute("DELETE FROM drafts WHERE id = ?1", rusqlite::params![draft_id])
        .map_err(|e| format!("Failed to delete draft: {}", e))?;
    Ok(())
}

/// List drafts for an account
#[tauri::command]
async fn draft_list(state: State<'_, AppState>, account_id: i64) -> Result<Vec<DraftListItem>, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    let result = state.db.query(
        "SELECT id, account_id, subject, to_addresses, created_at, updated_at
         FROM drafts
         WHERE account_id = ?1
         ORDER BY updated_at DESC",
        rusqlite::params![account_id],
        |row| {
            Ok(DraftListItem {
                id: row.get(0)?,
                account_id: row.get(1)?,
                subject: row.get(2)?,
                to_addresses: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| format!("Failed to list drafts: {}", e))?;

    Ok(result)
}

/// Get a single draft with full details
#[tauri::command]
async fn draft_get(state: State<'_, AppState>, draft_id: i64) -> Result<DraftDetail, String> {
    if draft_id <= 0 {
        return Err("Invalid draft ID".to_string());
    }

    // Get draft data
    let drafts = state.db.query(
        "SELECT id, account_id, to_addresses, cc_addresses, bcc_addresses,
                subject, body_text, body_html, reply_to_email_id, forward_email_id,
                compose_type, created_at, updated_at
         FROM drafts
         WHERE id = ?1",
        rusqlite::params![draft_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, Option<i64>>(8)?,
                row.get::<_, Option<i64>>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, String>(12)?,
            ))
        },
    )
    .map_err(|e| format!("Failed to get draft: {}", e))?;

    if drafts.is_empty() {
        return Err("Draft not found".to_string());
    }

    let (id, account_id, to_addresses, cc_addresses, bcc_addresses,
         subject, body_text, body_html, reply_to_email_id, forward_email_id,
         compose_type, created_at, updated_at) = drafts[0].clone();

    // Get attachments
    let attachments = state.db.query(
        "SELECT filename, content_type, size, local_path
         FROM draft_attachments
         WHERE draft_id = ?1",
        rusqlite::params![draft_id],
        |row| {
            Ok(DraftAttachmentData {
                filename: row.get(0)?,
                content_type: row.get(1)?,
                size: row.get(2)?,
                local_path: row.get(3)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get attachments: {}", e))?;

    Ok(DraftDetail {
        id,
        account_id,
        to_addresses,
        cc_addresses,
        bcc_addresses,
        subject,
        body_text,
        body_html,
        reply_to_email_id,
        forward_email_id,
        compose_type,
        created_at,
        updated_at,
        attachments,
    })
}

// ============================================================================
// EMAIL FILTERS COMMANDS
// ============================================================================

use db::{EmailFilter as DbEmailFilter, NewEmailFilter as DbNewEmailFilter};
use filters::{FilterAction, FilterCondition, MatchLogic};

/// Add a new email filter
#[tauri::command]
async fn filter_add(
    state: State<'_, AppState>,
    filter: DbNewEmailFilter,
) -> Result<i64, String> {
    // Validate account_id
    if filter.account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    // Validate filter name
    if filter.name.trim().is_empty() {
        return Err("Filter name cannot be empty".to_string());
    }

    // Validate conditions
    if filter.conditions.is_empty() {
        return Err("Filter must have at least one condition".to_string());
    }

    // Validate actions
    if filter.actions.is_empty() {
        return Err("Filter must have at least one action".to_string());
    }

    let filter_id = state
        .db
        .add_filter(&filter)
        .map_err(|e| format!("Failed to add filter: {}", e))?;

    log::info!("Created filter '{}' with ID {}", filter.name, filter_id);

    Ok(filter_id)
}

/// Get all filters for an account
#[tauri::command]
async fn filter_list(
    state: State<'_, AppState>,
    account_id: i64,
) -> Result<Vec<DbEmailFilter>, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    let filters = state
        .db
        .get_filters(account_id)
        .map_err(|e| format!("Failed to list filters: {}", e))?;

    Ok(filters)
}

/// Get a single filter by ID
#[tauri::command]
async fn filter_get(state: State<'_, AppState>, filter_id: i64) -> Result<DbEmailFilter, String> {
    if filter_id <= 0 {
        return Err("Invalid filter ID".to_string());
    }

    let filter = state
        .db
        .get_filter(filter_id)
        .map_err(|e| format!("Failed to get filter: {}", e))?;

    Ok(filter)
}

/// Update an existing filter
#[tauri::command]
async fn filter_update(
    state: State<'_, AppState>,
    filter_id: i64,
    filter: DbNewEmailFilter,
) -> Result<(), String> {
    if filter_id <= 0 {
        return Err("Invalid filter ID".to_string());
    }

    // Validate same as filter_add
    if filter.name.trim().is_empty() {
        return Err("Filter name cannot be empty".to_string());
    }

    if filter.conditions.is_empty() {
        return Err("Filter must have at least one condition".to_string());
    }

    if filter.actions.is_empty() {
        return Err("Filter must have at least one action".to_string());
    }

    state
        .db
        .update_filter(filter_id, &filter)
        .map_err(|e| format!("Failed to update filter: {}", e))?;

    log::info!("Updated filter ID {}", filter_id);

    Ok(())
}

/// Delete a filter
#[tauri::command]
async fn filter_delete(state: State<'_, AppState>, filter_id: i64) -> Result<(), String> {
    if filter_id <= 0 {
        return Err("Invalid filter ID".to_string());
    }

    state
        .db
        .delete_filter(filter_id)
        .map_err(|e| format!("Failed to delete filter: {}", e))?;

    log::info!("Deleted filter ID {}", filter_id);

    Ok(())
}

/// Toggle filter enabled state
#[tauri::command]
async fn filter_toggle(state: State<'_, AppState>, filter_id: i64) -> Result<(), String> {
    if filter_id <= 0 {
        return Err("Invalid filter ID".to_string());
    }

    state
        .db
        .toggle_filter(filter_id)
        .map_err(|e| format!("Failed to toggle filter: {}", e))?;

    log::info!("Toggled filter ID {}", filter_id);

    Ok(())
}

/// Test if a filter would match a specific email
#[tauri::command]
async fn filter_test(
    state: State<'_, AppState>,
    filter_id: i64,
    email_id: i64,
) -> Result<bool, String> {
    if filter_id <= 0 || email_id <= 0 {
        return Err("Invalid filter or email ID".to_string());
    }

    // Get filter
    let filter = state
        .db
        .get_filter(filter_id)
        .map_err(|e| format!("Failed to get filter: {}", e))?;

    // Get email
    let email = state
        .db
        .get_email(email_id)
        .map_err(|e| format!("Failed to get email: {}", e))?;

    // Create filter engine and test
    use filters::FilterEngine;
    let engine = FilterEngine::new(state.db.clone());
    let matches = engine.test_filter(&filter, &email);

    Ok(matches)
}

/// Apply filters to existing emails in batch
#[tauri::command]
async fn filter_apply_batch(
    state: State<'_, AppState>,
    account_id: i64,
    filter_id: Option<i64>,
    folder_id: Option<i64>,
) -> Result<FilterBatchResult, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    log::info!(
        "Batch applying filters: account_id={}, filter_id={:?}, folder_id={:?}",
        account_id,
        filter_id,
        folder_id
    );

    // Get emails to process
    let email_select = r#"
        SELECT id, account_id, folder_id, message_id, uid,
               from_address, from_name, to_addresses, cc_addresses, bcc_addresses, reply_to,
               subject, preview, body_text, body_html, date,
               is_read, is_starred, is_deleted, is_spam, is_draft, is_answered, is_forwarded,
               has_attachments, has_inline_images, thread_id, in_reply_to, references_header,
               priority, labels
    "#;

    let emails = if let Some(fid) = folder_id {
        // Filter by folder
        state
            .db
            .query(
                &format!("{} FROM emails WHERE account_id = ?1 AND folder_id = ?2 AND is_deleted = 0", email_select),
                rusqlite::params![account_id, fid],
                |row| db::Email::from_row(row),
            )
            .map_err(|e| format!("Failed to get emails: {}", e))?
    } else {
        // All emails for account
        state
            .db
            .query(
                &format!("{} FROM emails WHERE account_id = ?1 AND is_deleted = 0", email_select),
                [account_id],
                |row| db::Email::from_row(row),
            )
            .map_err(|e| format!("Failed to get emails: {}", e))?
    };

    log::info!("Processing {} emails", emails.len());

    // Create filter engine
    use filters::FilterEngine;
    let engine = FilterEngine::new(state.db.clone());

    let mut emails_processed = 0;
    let mut filters_matched = 0;
    let mut actions_executed = 0;

    for email in emails {
        emails_processed += 1;

        // Get actions to perform
        let actions = if let Some(fid) = filter_id {
            // Apply specific filter only
            let filter = state
                .db
                .get_filter(fid)
                .map_err(|e| format!("Failed to get filter: {}", e))?;

            if engine.test_filter(&filter, &email) {
                filters_matched += 1;
                // Update filter stats
                state
                    .db
                    .execute(
                        "UPDATE email_filters SET matched_count = matched_count + 1, last_matched_at = datetime('now') WHERE id = ?1",
                        [fid],
                    )
                    .map_err(|e| format!("Failed to update filter stats: {}", e))?;

                filter.actions
            } else {
                vec![]
            }
        } else {
            // Apply all filters
            let filter_actions = engine
                .apply_filters(&email)
                .await
                .map_err(|e| format!("Failed to apply filters: {}", e))?;

            if !filter_actions.is_empty() {
                filters_matched += 1;
            }

            filter_actions
        };

        // Execute actions
        if !actions.is_empty() {
            actions_executed += actions.len();
            engine
                .execute_actions(email.id, actions)
                .await
                .map_err(|e| format!("Failed to execute actions: {}", e))?;
        }
    }

    log::info!(
        "Batch complete: processed={}, matched={}, actions={}",
        emails_processed,
        filters_matched,
        actions_executed
    );

    Ok(FilterBatchResult {
        emails_processed,
        filters_matched,
        actions_executed,
    })
}

/// Export filters as JSON
#[tauri::command]
async fn filter_export(
    state: State<'_, AppState>,
    account_id: i64,
) -> Result<String, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    let filters = state
        .db
        .get_filters(account_id)
        .map_err(|e| format!("Failed to get filters: {}", e))?;

    // Convert to JSON
    serde_json::to_string_pretty(&filters)
        .map_err(|e| format!("Failed to serialize filters: {}", e))
}

/// Import filters from JSON
#[tauri::command]
async fn filter_import(
    state: State<'_, AppState>,
    account_id: i64,
    json_data: String,
) -> Result<usize, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    // Parse JSON
    let filters: Vec<DbEmailFilter> = serde_json::from_str(&json_data)
        .map_err(|e| format!("Invalid JSON format: {}", e))?;

    log::info!("Importing {} filters for account {}", filters.len(), account_id);

    let mut imported_count = 0;

    for filter in filters {
        // Create new filter (without ID) for the target account
        let new_filter = DbNewEmailFilter {
            account_id,
            name: filter.name,
            description: filter.description,
            is_enabled: filter.is_enabled,
            priority: filter.priority,
            match_logic: filter.match_logic,
            conditions: filter.conditions,
            actions: filter.actions,
        };

        // Check if filter with same name already exists
        let existing = state
            .db
            .get_filters(account_id)
            .ok()
            .and_then(|filters| {
                filters.iter().find(|f| f.name == new_filter.name).cloned()
            });

        if existing.is_some() {
            log::warn!("Skipping filter '{}' - already exists", new_filter.name);
            continue;
        }

        // Add filter
        state
            .db
            .add_filter(&new_filter)
            .map_err(|e| format!("Failed to import filter '{}': {}", new_filter.name, e))?;

        imported_count += 1;
    }

    log::info!("Successfully imported {} filters", imported_count);
    Ok(imported_count)
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/// Add a new email template
#[tauri::command]
async fn template_add(
    state: State<'_, AppState>,
    template: NewEmailTemplate,
) -> Result<i64, String> {
    // Validation
    if template.name.trim().is_empty() {
        return Err("Template name cannot be empty".to_string());
    }
    if template.name.len() > 200 {
        return Err("Template name cannot exceed 200 characters".to_string());
    }
    if template.subject_template.len() > 1000 {
        return Err("Subject template cannot exceed 1000 characters".to_string());
    }
    if template.body_html_template.len() > 50_000 {
        return Err("Body template cannot exceed 50KB".to_string());
    }

    // Validate category
    let valid_categories = vec![
        "business", "personal", "customer_support",
        "sales", "marketing", "internal", "custom"
    ];
    if !valid_categories.contains(&template.category.as_str()) {
        return Err("Invalid category".to_string());
    }

    log::info!("Adding template: {}", template.name);

    state
        .db
        .add_template(&template)
        .map_err(|e| format!("Failed to add template: {}", e))
}

/// Get all templates for an account
#[tauri::command]
async fn template_list(
    state: State<'_, AppState>,
    account_id: i64,
) -> Result<Vec<EmailTemplate>, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    state
        .db
        .get_templates(account_id)
        .map_err(|e| format!("Failed to get templates: {}", e))
}

/// Get a single template by ID
#[tauri::command]
async fn template_get(
    state: State<'_, AppState>,
    template_id: i64,
) -> Result<EmailTemplate, String> {
    if template_id <= 0 {
        return Err("Invalid template ID".to_string());
    }

    state
        .db
        .get_template(template_id)
        .map_err(|e| format!("Failed to get template: {}", e))
}

/// Update an existing template
#[tauri::command]
async fn template_update(
    state: State<'_, AppState>,
    template_id: i64,
    template: NewEmailTemplate,
) -> Result<(), String> {
    if template_id <= 0 {
        return Err("Invalid template ID".to_string());
    }

    // Validation
    if template.name.trim().is_empty() {
        return Err("Template name cannot be empty".to_string());
    }
    if template.name.len() > 200 {
        return Err("Template name cannot exceed 200 characters".to_string());
    }
    if template.subject_template.len() > 1000 {
        return Err("Subject template cannot exceed 1000 characters".to_string());
    }
    if template.body_html_template.len() > 50_000 {
        return Err("Body template cannot exceed 50KB".to_string());
    }

    // Validate category
    let valid_categories = vec![
        "business", "personal", "customer_support",
        "sales", "marketing", "internal", "custom"
    ];
    if !valid_categories.contains(&template.category.as_str()) {
        return Err("Invalid category".to_string());
    }

    log::info!("Updating template ID: {}", template_id);

    state
        .db
        .update_template(template_id, &template)
        .map_err(|e| format!("Failed to update template: {}", e))
}

/// Delete a template
#[tauri::command]
async fn template_delete(
    state: State<'_, AppState>,
    template_id: i64,
) -> Result<(), String> {
    if template_id <= 0 {
        return Err("Invalid template ID".to_string());
    }

    log::info!("Deleting template ID: {}", template_id);

    state
        .db
        .delete_template(template_id)
        .map_err(|e| format!("Failed to delete template: {}", e))
}

/// Toggle template enabled status
#[tauri::command]
async fn template_toggle(
    state: State<'_, AppState>,
    template_id: i64,
) -> Result<(), String> {
    if template_id <= 0 {
        return Err("Invalid template ID".to_string());
    }

    state
        .db
        .toggle_template(template_id)
        .map_err(|e| format!("Failed to toggle template: {}", e))
}

/// Toggle template favorite status
#[tauri::command]
async fn template_toggle_favorite(
    state: State<'_, AppState>,
    template_id: i64,
) -> Result<(), String> {
    if template_id <= 0 {
        return Err("Invalid template ID".to_string());
    }

    state
        .db
        .toggle_template_favorite(template_id)
        .map_err(|e| format!("Failed to toggle template favorite: {}", e))
}

/// Increment template usage count
#[tauri::command]
async fn template_increment_usage(
    state: State<'_, AppState>,
    template_id: i64,
) -> Result<(), String> {
    if template_id <= 0 {
        return Err("Invalid template ID".to_string());
    }

    state
        .db
        .increment_template_usage(template_id)
        .map_err(|e| format!("Failed to increment template usage: {}", e))
}

/// Search templates using FTS5
#[tauri::command]
async fn template_search(
    state: State<'_, AppState>,
    account_id: i64,
    query: String,
    limit: i32,
) -> Result<Vec<EmailTemplate>, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }
    if query.len() > 500 {
        return Err("Search query too long".to_string());
    }

    state
        .db
        .search_templates(account_id, &query, limit)
        .map_err(|e| format!("Failed to search templates: {}", e))
}

/// Get templates by category
#[tauri::command]
async fn template_get_by_category(
    state: State<'_, AppState>,
    account_id: i64,
    category: String,
) -> Result<Vec<EmailTemplate>, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    // Validate category
    let valid_categories = vec![
        "business", "personal", "customer_support",
        "sales", "marketing", "internal", "custom"
    ];
    if !valid_categories.contains(&category.as_str()) {
        return Err("Invalid category".to_string());
    }

    state
        .db
        .get_templates_by_category(account_id, &category)
        .map_err(|e| format!("Failed to get templates by category: {}", e))
}

/// Get favorite templates
#[tauri::command]
async fn template_get_favorites(
    state: State<'_, AppState>,
    account_id: i64,
) -> Result<Vec<EmailTemplate>, String> {
    if account_id <= 0 {
        return Err("Invalid account ID".to_string());
    }

    state
        .db
        .get_favorite_templates(account_id)
        .map_err(|e| format!("Failed to get favorite templates: {}", e))
}

/// Get available template categories
#[tauri::command]
async fn template_get_categories() -> Result<Vec<String>, String> {
    Ok(vec![
        "business".to_string(),
        "personal".to_string(),
        "customer_support".to_string(),
        "sales".to_string(),
        "marketing".to_string(),
        "internal".to_string(),
        "custom".to_string(),
    ])
}

// Helper function to parse data type string
fn parse_sync_data_type(data_type: &str) -> Result<sync::SyncDataType, String> {
    match data_type {
        "accounts" => Ok(sync::SyncDataType::Accounts),
        "contacts" => Ok(sync::SyncDataType::Contacts),
        "preferences" => Ok(sync::SyncDataType::Preferences),
        "signatures" => Ok(sync::SyncDataType::Signatures),
        _ => Err(format!("Invalid data type: {}", data_type)),
    }
}

// DTO Types for Tauri Commands
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FilterBatchResult {
    emails_processed: usize,
    filters_matched: usize,
    actions_executed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EmailSyncResult {
    fetch_result: mail::FetchResult,
    new_emails_count: usize,
    filters_applied_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SyncConfigDto {
    enabled: bool,
    user_id: Option<String>,
    device_id: String,
    device_name: String,
    platform: String,
    last_sync_at: Option<String>,
    sync_accounts: bool,
    sync_contacts: bool,
    sync_preferences: bool,
    sync_signatures: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SyncStatusDto {
    data_type: String,
    version: i32,
    last_sync_at: Option<String>,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceInfoDto {
    device_id: String,
    device_name: String,
    platform: String,
    last_seen_at: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SyncResultDto {
    accounts_synced: bool,
    contacts_synced: bool,
    preferences_synced: bool,
    signatures_synced: bool,
    errors: Vec<String>,
    conflicts: Option<Vec<ConflictInfoDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConflictInfoDto {
    data_type: String,
    local_version: i32,
    server_version: i32,
    local_updated_at: Option<String>,
    server_updated_at: Option<String>,
    strategy: String,
    conflict_details: String,
    local_data: serde_json::Value,
    server_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QueueStatsDto {
    pending_count: i32,
    in_progress_count: i32,
    failed_count: i32,
    completed_count: i32,
    total_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProcessQueueResultDto {
    processed: i32,
    succeeded: i32,
    failed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SyncSnapshotDto {
    id: i64,
    data_type: String,
    version: i64,
    snapshot_hash: String,
    device_id: String,
    operation: String,
    items_count: i32,
    sync_status: String,
    error_message: Option<String>,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SchedulerStatusDto {
    enabled: bool,
    running: bool,
    interval_minutes: u64,
    last_run: Option<String>,
    next_run: Option<String>,
}

// ============================================================================
// OAuth2 Authentication Commands
// ============================================================================

// ============================================================================
// Account Priority Settings Commands
// ============================================================================

/// Get priority fetching setting for an account
#[tauri::command]
async fn account_get_priority_fetch(
    state: State<'_, AppState>,
    account_id: i64,
) -> Result<bool, String> {
    state.db.get_account_priority_setting(account_id)
        .map_err(|e| format!("Failed to get priority setting: {}", e))
}

/// Set priority fetching setting for an account
#[tauri::command]
async fn account_set_priority_fetch(
    state: State<'_, AppState>,
    account_id: i64,
    enabled: bool,
) -> Result<(), String> {
    state.db.set_account_priority_setting(account_id, enabled)
        .map_err(|e| format!("Failed to set priority setting: {}", e))
}

// ============================================================================
// OAuth Commands
// ============================================================================

use crate::oauth::{gmail_config, start_oauth_flow, handle_oauth_callback, start_callback_server, shutdown_callback_server};

/// Start Gmail OAuth2 authentication flow
/// Returns complete account information automatically when user completes auth in browser
#[tauri::command]
async fn oauth_start_gmail() -> Result<OAuthCompleteResult, String> {
    log::info!("Starting Gmail OAuth2 flow");
    complete_oauth_flow("gmail").await
}

/// Complete OAuth flow automatically - waits for callback and returns account info
async fn complete_oauth_flow(provider: &str) -> Result<OAuthCompleteResult, String> {
    let config = match provider {
        "gmail" => gmail_config(),
        _ => return Err("Unknown OAuth provider".to_string()),
    };

    // Generate auth URL
    let (auth_url, _csrf_token) = start_oauth_flow(&config)
        .map_err(|e| format!("Failed to start OAuth flow: {}", e))?;

    // Open browser automatically
    log::info!("Opening browser for OAuth: {}", auth_url);
    if let Err(e) = open::that(&auth_url) {
        log::warn!("Failed to open browser automatically: {}", e);
    }

    // Start callback server and wait for result (authorization_code, state)
    let callback_result: Arc<Mutex<Option<Result<(String, String), crate::oauth::OAuthError>>>> = Arc::new(Mutex::new(None));
    let callback_result_clone = callback_result.clone();

    // Start server in background thread with proper handle
    let server_handle = std::thread::spawn(move || {
        if let Err(e) = start_callback_server(callback_result_clone) {
            log::error!("OAuth callback server error: {}", e);
        }
    });

    // Wait for callback (with timeout)
    let timeout = std::time::Duration::from_secs(120); // 2 minute timeout
    let start = std::time::Instant::now();

    let (authorization_code, csrf_state) = loop {
        if start.elapsed() > timeout {
            // Timeout reached - signal server to shut down
            shutdown_callback_server();
            // Give server a moment to clean up
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            return Err("OAuth timeout: Please try again and complete authentication within 2 minutes".to_string());
        }

        // Check if callback result is available (scope lock tightly)
        let callback_value = {
            if let Ok(mut guard) = callback_result.lock() {
                guard.take()
            } else {
                None
            }
        }; // MutexGuard dropped here, before await

        if let Some(result) = callback_value {
            match result {
                Ok((code, state)) => break (code, state),
                Err(e) => {
                    // Error in OAuth - shut down server
                    shutdown_callback_server();
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    return Err(format!("OAuth failed: {}", e));
                }
            }
        }

        // Sleep briefly to avoid busy waiting
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    };

    // Wait for server thread to finish cleanly (with timeout)
    let join_timeout = std::time::Duration::from_secs(2);
    tokio::task::spawn_blocking(move || {
        std::thread::sleep(join_timeout);
        let _ = server_handle.join();
    });

    // Exchange code for tokens with PKCE verifier
    log::info!("Exchanging authorization code for tokens");
    let oauth_result = handle_oauth_callback(&config, authorization_code, csrf_state)
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    // Set provider-specific IMAP/SMTP settings (Gmail only for now)
    let (imap_host, imap_port, smtp_host, smtp_port) = match provider {
        "gmail" => (
            "imap.gmail.com".to_string(),
            993,
            "smtp.gmail.com".to_string(),
            465, // Gmail OAuth SMTP requires port 465 (direct TLS)
        ),
        _ => return Err("Unknown provider".to_string()),
    };

    log::info!("OAuth completed successfully for {}", oauth_result.email);

    Ok(OAuthCompleteResult {
        email: oauth_result.email,
        display_name: oauth_result.display_name,
        access_token: oauth_result.access_token,
        refresh_token: oauth_result.refresh_token,
        imap_host,
        imap_port,
        smtp_host,
        smtp_port,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OAuthCompleteResult {
    email: String,
    display_name: Option<String>,
    access_token: String,
    refresh_token: Option<String>,
    imap_host: String,
    imap_port: u16,
    smtp_host: String,
    smtp_port: u16,
}

// ============================================================================
// Application Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file for OAuth credentials
    dotenvy::dotenv().ok();

    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // SECURITY: Graceful error handling instead of panics at startup
    // Get app directories with proper error handling
    let app_dir = match directories::ProjectDirs::from("com", "owlivion", "owlivion-mail") {
        Some(dirs) => dirs,
        None => {
            log::error!("Failed to get app directories - cannot determine data location");
            eprintln!("FATAL: Failed to get app directories. Please ensure HOME environment variable is set.");
            std::process::exit(1);
        }
    };

    let data_dir = app_dir.data_dir();

    // Create data directory with proper error handling
    if let Err(e) = std::fs::create_dir_all(data_dir) {
        log::error!("Failed to create data directory: {}", e);
        eprintln!("FATAL: Failed to create data directory at {:?}: {}", data_dir, e);
        std::process::exit(1);
    }

    let db_path = data_dir.join("owlivion.db");
    log::info!("Database path: {:?}", db_path);

    // Initialize database with proper error handling
    let db = match Database::new(db_path) {
        Ok(db) => db,
        Err(e) => {
            log::error!("Failed to initialize database: {}", e);
            eprintln!("FATAL: Database initialization failed: {}", e);
            std::process::exit(1);
        }
    };
    log::info!("Database initialized successfully");

    let app_state = AppState::new(db);

    // Run Tauri application with proper error handling
    if let Err(e) = tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            autoconfig_detect,
            autoconfig_detect_debug,
            account_test_imap,
            account_test_smtp,
            send_test_email,
            account_add,
            account_update,
            account_update_signature,
            account_get_priority_fetch,
            account_set_priority_fetch,
            fetch_url_content,
            account_list,
            account_connect,
            account_delete,
            folder_list,
            email_list,
            email_list_all_accounts,
            email_sync_with_filters,
            email_get,
            email_download_attachment,
            email_search,
            email_search_advanced,
            email_mark_read,
            email_mark_starred,
            email_move,
            email_delete,
            email_send,
            write_temp_attachment,
            attachment_upload,
            get_email_attachments,
            attachment_download,
            oauth_start_gmail,
            sync_register,
            sync_login,
            sync_logout,
            sync_start,
            sync_resolve_conflict,
            sync_get_config,
            sync_update_config,
            sync_get_status,
            sync_list_devices,
            sync_revoke_device,
            sync_get_queue_stats,
            sync_process_queue,
            sync_retry_failed,
            sync_clear_completed_queue,
            sync_clear_failed_queue,
            get_sync_history,
            rollback_sync,
            enforce_sync_retention,
            scheduler_start,
            scheduler_stop,
            scheduler_get_status,
            scheduler_update_config,
            draft_save,
            draft_delete,
            draft_list,
            draft_get,
            filter_add,
            filter_list,
            filter_get,
            filter_update,
            filter_delete,
            filter_toggle,
            filter_test,
            filter_apply_batch,
            filter_export,
            filter_import,
            template_add,
            template_list,
            template_get,
            template_update,
            template_delete,
            template_toggle,
            template_toggle_favorite,
            template_increment_usage,
            template_search,
            template_get_by_category,
            template_get_favorites,
            template_get_categories,
            sync_get_sessions,
            sync_revoke_session,
            sync_revoke_all_sessions,
            sync_get_audit_logs,
            sync_get_audit_stats,
            sync_export_audit_logs,
            sync_get_2fa_status,
            sync_setup_2fa,
            sync_enable_2fa,
            sync_disable_2fa,
            sync_verify_2fa,
        ])
        .setup(|app| {
            // Setup system tray
            if let Err(e) = tray::setup_tray(&app.handle()) {
                log::error!("Failed to setup system tray: {}", e);
            } else {
                log::info!("System tray initialized successfully");
            }

            // Setup window close event handler (minimize to tray)
            let app_handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Check if close_to_tray is enabled
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            // Get setting from database (JSON boolean)
                            let should_minimize: bool = state.db.get_setting("close_to_tray")
                                .ok()
                                .flatten()
                                .unwrap_or(true); // Default: minimize to tray

                            if should_minimize {
                                // Hide window instead of closing
                                if let Some(window) = app_handle.get_webview_window("main") {
                                    let _ = window.hide();
                                }
                                api.prevent_close();
                                log::info!("Window minimized to system tray");
                            }
                            // If false, let the window close normally
                        }
                    }
                });
            } else {
                println!("❌ Could not get main window!");
                eprintln!("❌ Could not get main window!");
            }

            // Auto-start background scheduler if enabled
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    // Load scheduler config from database
                    if let Err(e) = state.background_scheduler.load_config().await {
                        log::error!("Failed to load scheduler config: {}", e);
                        return;
                    }

                    let config = state.background_scheduler.get_config().await;
                    if config.enabled {
                        log::info!("Auto-starting background scheduler (interval: {} minutes)", config.interval_minutes);
                        if let Err(e) = state.background_scheduler.start(state.sync_manager.clone()).await {
                            log::error!("Failed to auto-start scheduler: {}", e);
                        } else {
                            log::info!("Background scheduler started successfully");
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
    {
        log::error!("Tauri application error: {}", e);
        eprintln!("FATAL: Tauri application error: {}", e);
        std::process::exit(1);
    }
}
