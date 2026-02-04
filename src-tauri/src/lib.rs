//! # Owlivion Mail
//!
//! A modern, AI-powered email client built with Tauri and React.

pub mod crypto;
pub mod db;
pub mod mail;
pub mod oauth;
pub mod sync;

use db::{Database, NewAccount as DbNewAccount};
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
    #[allow(unused_variables)]
    accept_invalid_certs: Option<bool>,
) -> Result<String, String> {
    log::info!("Adding account to database: {}", email);

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
        oauth_provider: None,
        oauth_access_token: None,
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

    // Decrypt password
    let mut password = crypto::decrypt_password(&encrypted_password)
        .map_err(|_| "Password decryption failed".to_string())?;

    let config = ImapConfig {
        host: account.imap_host.clone(),
        port: account.imap_port as u16,
        security: parse_security(&account.imap_security),
        username: account.imap_username.clone().unwrap_or(account.email.clone()),
        password: password.clone(),
        accept_invalid_certs: account.accept_invalid_certs,
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
    let client = async_clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    let result = client
        .fetch_emails(&folder_path, page, safe_page_size)
        .await
        .map_err(|e| e.to_string())?;

    log::info!("email_list returning {} emails, total={}", result.emails.len(), result.total);
    Ok(result)
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

    log::info!("email_get: returning email with subject={}", email.subject);
    Ok(email)
}

/// Search emails
#[tauri::command]
async fn email_search(
    state: State<'_, AppState>,
    account_id: String,
    query: String,
    folder: Option<String>,
) -> Result<Vec<u32>, String> {
    // SECURITY: Use safe folder lookup that handles mutex poisoning
    let folder_path = folder.unwrap_or_else(|| {
        get_current_folder_safe(&state.current_folder, &account_id)
    });

    let mut async_clients = state.async_imap_clients.lock().await;
    let client = async_clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    let uids = client.search(&folder_path, &query).await.map_err(|e| e.to_string())?;

    Ok(uids)
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

    // Decrypt password
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("Password decryption failed: {}", e))?;

    log::info!("Sending email from {} to {:?}", account.email, to);

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

    // Build body
    let email = if let (Some(text), Some(html)) = (&text_body, &html_body) {
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
) -> Result<i32, String> {
    let manager = state.get_sync_manager()?;
    manager.enforce_history_retention(retention_days)
        .map_err(|e| format!("Failed to enforce retention: {}", e))
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

use crate::oauth::{gmail_config, microsoft_config, start_oauth_flow, handle_oauth_callback, start_callback_server};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OAuthStartResult {
    auth_url: String,
    csrf_token: String,
}

/// Start Gmail OAuth2 authentication flow
#[tauri::command]
async fn oauth_start_gmail() -> Result<OAuthStartResult, String> {
    log::info!("Starting Gmail OAuth2 flow");

    let config = gmail_config();
    let (auth_url, csrf_token) = start_oauth_flow(&config)
        .map_err(|e| format!("Failed to start OAuth flow: {}", e))?;

    // Start callback server in background
    let callback_result = Arc::new(Mutex::new(None));
    let callback_result_clone = callback_result.clone();

    std::thread::spawn(move || {
        if let Err(e) = start_callback_server(callback_result_clone) {
            log::error!("OAuth callback server error: {}", e);
        }
    });

    Ok(OAuthStartResult {
        auth_url,
        csrf_token: csrf_token.secret().clone(),
    })
}

/// Start Microsoft OAuth2 authentication flow
#[tauri::command]
async fn oauth_start_microsoft() -> Result<OAuthStartResult, String> {
    log::info!("Starting Microsoft OAuth2 flow");

    let config = microsoft_config();
    let (auth_url, csrf_token) = start_oauth_flow(&config)
        .map_err(|e| format!("Failed to start OAuth flow: {}", e))?;

    // Start callback server in background
    let callback_result = Arc::new(Mutex::new(None));
    let callback_result_clone = callback_result.clone();

    std::thread::spawn(move || {
        if let Err(e) = start_callback_server(callback_result_clone) {
            log::error!("OAuth callback server error: {}", e);
        }
    });

    Ok(OAuthStartResult {
        auth_url,
        csrf_token: csrf_token.secret().clone(),
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

/// Complete OAuth2 authentication with authorization code
#[tauri::command]
async fn oauth_complete(
    provider: String,
    authorization_code: String,
) -> Result<OAuthCompleteResult, String> {
    log::info!("Completing OAuth2 flow for {}", provider);

    let config = match provider.as_str() {
        "gmail" => gmail_config(),
        "microsoft" => microsoft_config(),
        _ => return Err("Unknown OAuth provider".to_string()),
    };

    let result = handle_oauth_callback(&config, authorization_code)
        .await
        .map_err(|e| format!("OAuth callback failed: {}", e))?;

    // Set provider-specific IMAP/SMTP settings
    let (imap_host, imap_port, smtp_host, smtp_port) = match provider.as_str() {
        "gmail" => (
            "imap.gmail.com".to_string(),
            993,
            "smtp.gmail.com".to_string(),
            587,
        ),
        "microsoft" => (
            "outlook.office365.com".to_string(),
            993,
            "smtp.office365.com".to_string(),
            587,
        ),
        _ => return Err("Unknown provider".to_string()),
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

// ============================================================================
// Application Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
            fetch_url_content,
            account_list,
            account_connect,
            folder_list,
            email_list,
            email_get,
            email_search,
            email_mark_read,
            email_mark_starred,
            email_move,
            email_delete,
            email_send,
            oauth_start_gmail,
            oauth_start_microsoft,
            oauth_complete,
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
        ])
        .setup(|app| {
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
