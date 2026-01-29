//! # Owlivion Mail
//!
//! A modern, AI-powered email client built with Tauri and React.

pub mod db;
pub mod mail;

use mail::{fetch_autoconfig, AutoConfig, ImapClient, ImapConfig, SecurityType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
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
    accounts: Mutex<HashMap<String, StoredAccount>>,
    imap_clients: Mutex<HashMap<String, ImapClient>>,
    current_folder: Mutex<HashMap<String, String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            accounts: Mutex::new(HashMap::new()),
            imap_clients: Mutex::new(HashMap::new()),
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
#[tauri::command]
async fn account_test_imap(
    host: String,
    port: u16,
    security: String,
    email: String,
    password: String,
) -> Result<(), String> {
    log::info!("Testing IMAP connection to {}:{}", host, port);

    let config = ImapConfig {
        host: host.clone(),
        port,
        security: parse_security(&security),
        username: email,
        password,
    };

    // Run in blocking task since imap crate is synchronous
    tokio::task::spawn_blocking(move || {
        let mut client = ImapClient::new(config);
        client.test_connection()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| e.to_string())
}

/// Test SMTP connection
#[tauri::command]
async fn account_test_smtp(
    host: String,
    port: u16,
    security: String,
    email: String,
    password: String,
) -> Result<(), String> {
    log::info!("Testing SMTP connection to {}:{}", host, port);

    use lettre::{
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport, AsyncTransport,
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
#[tauri::command]
async fn send_test_email(
    host: String,
    port: u16,
    security: String,
    email: String,
    password: String,
    to_email: String,
) -> Result<(), String> {
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
    log::info!("Adding account: {}", email);

    let account_id = uuid::Uuid::new_v4().to_string();

    let account = StoredAccount {
        id: account_id.clone(),
        email: email.clone(),
        display_name,
        password: password.clone(),
        imap_host: imap_host.clone(),
        imap_port,
        imap_security: imap_security.clone(),
        smtp_host,
        smtp_port,
        smtp_security,
        is_default,
    };

    // Store the account
    {
        let mut accounts = state.accounts.lock().map_err(|e| e.to_string())?;
        accounts.insert(account_id.clone(), account);
    }

    // Create and connect IMAP client
    let config = ImapConfig {
        host: imap_host,
        port: imap_port,
        security: parse_security(&imap_security),
        username: email,
        password,
    };

    let id_clone = account_id.clone();
    let client = tokio::task::spawn_blocking(move || {
        let mut client = ImapClient::new(config);
        client.connect()?;
        Ok::<ImapClient, mail::MailError>(client)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| e.to_string())?;

    // Store the connected client
    {
        let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;
        clients.insert(id_clone, client);
    }

    Ok(account_id)
}

/// List all configured accounts
#[tauri::command]
async fn account_list(state: State<'_, AppState>) -> Result<Vec<StoredAccount>, String> {
    let accounts = state.accounts.lock().map_err(|e| e.to_string())?;
    Ok(accounts.values().cloned().collect())
}

/// Connect to an account (used when app starts or reconnecting)
#[tauri::command]
async fn account_connect(state: State<'_, AppState>, account_id: String) -> Result<(), String> {
    let account = {
        let accounts = state.accounts.lock().map_err(|e| e.to_string())?;
        accounts
            .get(&account_id)
            .cloned()
            .ok_or_else(|| "Account not found".to_string())?
    };

    let config = ImapConfig {
        host: account.imap_host,
        port: account.imap_port,
        security: parse_security(&account.imap_security),
        username: account.email,
        password: account.password,
    };

    let client = tokio::task::spawn_blocking(move || {
        let mut client = ImapClient::new(config);
        client.connect()?;
        Ok::<ImapClient, mail::MailError>(client)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| e.to_string())?;

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;
    clients.insert(account_id, client);

    Ok(())
}

/// Get folders for an account
#[tauri::command]
async fn folder_list(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<mail::Folder>, String> {
    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    // Clone client to use in blocking task (we need mutable access)
    let folders = client.list_folders().map_err(|e| e.to_string())?;

    Ok(folders)
}

/// Fetch emails with pagination
#[tauri::command]
async fn email_list(
    state: State<'_, AppState>,
    account_id: String,
    folder: Option<String>,
    page: u32,
    page_size: u32,
) -> Result<mail::FetchResult, String> {
    let folder_path = folder.unwrap_or_else(|| "INBOX".to_string());

    // Update current folder
    {
        let mut current = state.current_folder.lock().map_err(|e| e.to_string())?;
        current.insert(account_id.clone(), folder_path.clone());
    }

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    let result = client
        .fetch_emails(&folder_path, page, page_size)
        .map_err(|e| e.to_string())?;

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
    let folder_path = folder.or_else(|| {
        state
            .current_folder
            .lock()
            .ok()
            .and_then(|f| f.get(&account_id).cloned())
    }).unwrap_or_else(|| "INBOX".to_string());

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    let email = client
        .fetch_email(&folder_path, uid)
        .map_err(|e| e.to_string())?;

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
    let folder_path = folder.or_else(|| {
        state
            .current_folder
            .lock()
            .ok()
            .and_then(|f| f.get(&account_id).cloned())
    }).unwrap_or_else(|| "INBOX".to_string());

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    let uids = client.search(&folder_path, &query).map_err(|e| e.to_string())?;

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
    let folder_path = folder.or_else(|| {
        state
            .current_folder
            .lock()
            .ok()
            .and_then(|f| f.get(&account_id).cloned())
    }).unwrap_or_else(|| "INBOX".to_string());

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .set_read(&folder_path, uid, read)
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
    let folder_path = folder.or_else(|| {
        state
            .current_folder
            .lock()
            .ok()
            .and_then(|f| f.get(&account_id).cloned())
    }).unwrap_or_else(|| "INBOX".to_string());

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .set_starred(&folder_path, uid, starred)
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
    let folder_path = folder.or_else(|| {
        state
            .current_folder
            .lock()
            .ok()
            .and_then(|f| f.get(&account_id).cloned())
    }).unwrap_or_else(|| "INBOX".to_string());

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .move_email(&folder_path, uid, &target_folder)
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
    let folder_path = folder.or_else(|| {
        state
            .current_folder
            .lock()
            .ok()
            .and_then(|f| f.get(&account_id).cloned())
    }).unwrap_or_else(|| "INBOX".to_string());

    let mut clients = state.imap_clients.lock().map_err(|e| e.to_string())?;

    let client = clients
        .get_mut(&account_id)
        .ok_or_else(|| "Account not connected".to_string())?;

    client
        .delete_email(&folder_path, uid, permanent)
        .map_err(|e| e.to_string())
}

/// Send an email
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
    let account = {
        let accounts = state.accounts.lock().map_err(|e| e.to_string())?;
        accounts
            .get(&account_id)
            .cloned()
            .ok_or_else(|| "Account not found".to_string())?
    };

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

    let creds = Credentials::new(account.email.clone(), account.password.clone());

    let security = parse_security(&account.smtp_security);

    let mailer = match security {
        SecurityType::SSL => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::relay(&account.smtp_host)
                .map_err(|e| e.to_string())?
                .credentials(creds)
                .port(account.smtp_port)
                .build()
        }
        SecurityType::STARTTLS => {
            AsyncSmtpTransport::<lettre::Tokio1Executor>::starttls_relay(&account.smtp_host)
                .map_err(|e| e.to_string())?
                .credentials(creds)
                .port(account.smtp_port)
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

    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
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
        .expect("error while running tauri application");
}
