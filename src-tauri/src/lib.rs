//! # Owlivion Mail
//!
//! A modern, AI-powered email client built with Tauri and React.

pub mod crypto;
pub mod db;
pub mod mail;

use db::{Database, NewAccount as DbNewAccount};
use mail::{fetch_autoconfig, AsyncImapClient, AutoConfig, ImapClient, ImapConfig, SecurityType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;

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
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self {
            db: Arc::new(db),
            async_imap_clients: tokio::sync::Mutex::new(HashMap::new()),
            current_folder: Mutex::new(HashMap::new()),
        }
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

/// Test IMAP connection
/// SECURITY: Input validation to prevent SSRF
#[tauri::command]
async fn account_test_imap(
    host: String,
    port: u16,
    security: String,
    email: String,
    password: String,
) -> Result<(), String> {
    // SECURITY: Validate all inputs
    validate_host(&host)?;
    validate_port(port)?;
    validate_email(&email)?;
    validate_security_type(&security)?;

    log::info!("Testing IMAP connection to {}:{} with security: {}", host, port, security);
    log::info!("Username: {}", email);

    let sec = parse_security(&security);
    log::info!("Parsed security type: {:?}", sec);

    let config = ImapConfig {
        host: host.clone(),
        port,
        security: sec,
        username: email.clone(),
        password,
    };

    // Run in blocking task since imap crate is synchronous
    let result = tokio::task::spawn_blocking(move || {
        let mut client = ImapClient::new(config);
        client.test_connection()
    })
    .await;

    match result {
        Ok(Ok(())) => {
            log::info!("IMAP connection test successful for {}", email);
            Ok(())
        }
        Ok(Err(e)) => {
            let err_msg = format!("IMAP error: {}", e);
            log::error!("{}", err_msg);
            Err(err_msg)
        }
        Err(e) => {
            let err_msg = format!("Task panic: {}", e);
            log::error!("{}", err_msg);
            Err(err_msg)
        }
    }
}

/// Test SMTP connection
/// SECURITY: Input validation to prevent SSRF
#[tauri::command]
async fn account_test_smtp(
    host: String,
    port: u16,
    security: String,
    email: String,
    password: String,
) -> Result<(), String> {
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

    // Test connection by checking if we can connect
    mailer.test_connection().await
        .map_err(|e| format!("SMTP connection failed: {}", e))?;

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
    };

    let account_id = state.db.add_account(&new_account)
        .map_err(|e| format!("Database error: {}", e))?;

    log::info!("Account added with ID: {}", account_id);
    Ok(account_id.to_string())
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
#[tauri::command]
async fn account_connect(state: State<'_, AppState>, account_id: String) -> Result<(), String> {
    log::info!("Connecting to account: {}", account_id);
    let id: i64 = account_id.parse().map_err(|_| "Invalid account ID")?;

    let account = state.db.get_account(id)
        .map_err(|e| format!("Database error: {}", e))?;

    let encrypted_password = state.db.get_account_password(id)
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "No password stored".to_string())?;

    // Decrypt password
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("Password decryption failed: {}", e))?;

    let config = ImapConfig {
        host: account.imap_host.clone(),
        port: account.imap_port as u16,
        security: parse_security(&account.imap_security),
        username: account.imap_username.clone().unwrap_or(account.email.clone()),
        password: password.clone(),
    };

    // Create async IMAP client only (sync client has parser issues)
    let mut async_client = AsyncImapClient::new(config);
    async_client.connect().await.map_err(|e| e.to_string())?;

    // Store async client
    let mut async_clients = state.async_imap_clients.lock().await;
    async_clients.insert(account_id.clone(), async_client);

    log::info!("Account {} connected successfully", account_id);
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
            account_test_imap,
            account_test_smtp,
            send_test_email,
            account_add,
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
        ])
        .run(tauri::generate_context!())
    {
        log::error!("Tauri application error: {}", e);
        eprintln!("FATAL: Tauri application error: {}", e);
        std::process::exit(1);
    }
}
