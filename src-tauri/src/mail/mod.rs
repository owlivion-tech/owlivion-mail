//! # Owlivion Mail - Mail Module
//!
//! Email functionality including IMAP, SMTP, and auto-configuration.

pub mod autoconfig;
pub mod async_imap;
pub mod config;
pub mod imap;
pub mod smtp_oauth;

use serde::{Deserialize, Serialize};

// Re-export commonly used types
pub use autoconfig::{fetch_autoconfig, fetch_autoconfig_debug, AutoConfig, AutoConfigDebug};
pub use async_imap::AsyncImapClient;
pub use config::{AccountConfig, ImapConfig, SecurityType, SmtpConfig};
pub use imap::ImapClient;

/// Result type alias for mail operations
pub type MailResult<T> = Result<T, MailError>;

/// Unified error type for mail operations
#[derive(Debug, thiserror::Error)]
pub enum MailError {
    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("IMAP error: {0}")]
    Imap(String),

    #[error("SMTP error: {0}")]
    Smtp(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Not connected")]
    NotConnected,

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Email folder representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub name: String,
    pub path: String,
    pub folder_type: FolderType,
    pub delimiter: String,
    pub is_subscribed: bool,
    pub is_selectable: bool,
    pub unread_count: u32,
    pub total_count: u32,
}

/// Folder types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FolderType {
    Inbox,
    Sent,
    Drafts,
    Trash,
    Junk,
    Archive,
    Starred,
    Custom,
}

impl Default for FolderType {
    fn default() -> Self {
        Self::Custom
    }
}

impl FolderType {
    pub fn from_name(name: &str) -> Self {
        let lower = name.to_lowercase();
        if lower.contains("inbox") {
            FolderType::Inbox
        } else if lower.contains("sent") {
            FolderType::Sent
        } else if lower.contains("draft") {
            FolderType::Drafts
        } else if lower.contains("trash") || lower.contains("deleted") {
            FolderType::Trash
        } else if lower.contains("junk") || lower.contains("spam") {
            FolderType::Junk
        } else if lower.contains("archive") {
            FolderType::Archive
        } else if lower.contains("starred") || lower.contains("flagged") {
            FolderType::Starred
        } else {
            FolderType::Custom
        }
    }
}

/// Search criteria
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SearchCriteria {
    pub text: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub subject: Option<String>,
    pub unread: Option<bool>,
    pub flagged: Option<bool>,
}

impl SearchCriteria {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn text(mut self, text: impl Into<String>) -> Self {
        self.text = Some(text.into());
        self
    }
}

/// Email summary for list view
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSummary {
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
}

/// Fetch result with pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchResult {
    pub emails: Vec<EmailSummary>,
    pub total: u32,
    pub has_more: bool,
}

/// Parsed email
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedEmail {
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
    pub attachments: Vec<EmailAttachment>,
}

/// Email attachment metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailAttachment {
    pub filename: String,
    pub content_type: String,
    pub size: u32,
    pub index: usize,
    pub content_id: Option<String>,  // For inline images (cid:)
    pub is_inline: bool,
}

/// Email attachment with data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentData {
    pub filename: String,
    pub content_type: String,
    pub size: u32,
    pub data: String,  // Base64 encoded content
}
