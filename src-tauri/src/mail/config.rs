//! Email Configuration Module

use serde::{Deserialize, Serialize};

/// Security type for email connections
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum SecurityType {
    #[default]
    SSL,
    STARTTLS,
    NONE,
}

impl SecurityType {
    pub fn default_imap_port(&self) -> u16 {
        match self {
            SecurityType::SSL => 993,
            SecurityType::STARTTLS => 143,
            SecurityType::NONE => 143,
        }
    }

    pub fn default_smtp_port(&self) -> u16 {
        match self {
            SecurityType::SSL => 465,
            SecurityType::STARTTLS => 587,
            SecurityType::NONE => 25,
        }
    }
}

/// IMAP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapConfig {
    pub host: String,
    pub port: u16,
    pub security: SecurityType,
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub accept_invalid_certs: bool,
}

impl Default for ImapConfig {
    fn default() -> Self {
        Self {
            host: String::new(),
            port: 993,
            security: SecurityType::SSL,
            username: String::new(),
            password: String::new(),
            accept_invalid_certs: false, // Secure by default
        }
    }
}

/// SMTP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub security: SecurityType,
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub accept_invalid_certs: bool,
}

impl Default for SmtpConfig {
    fn default() -> Self {
        Self {
            host: String::new(),
            port: 587,
            security: SecurityType::STARTTLS,
            username: String::new(),
            password: String::new(),
            accept_invalid_certs: false, // Secure by default
        }
    }
}

/// Full account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountConfig {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub imap: ImapConfig,
    pub smtp: SmtpConfig,
    pub signature: Option<String>,
}

impl AccountConfig {
    pub fn new(email: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            email: email.clone(),
            display_name: None,
            imap: ImapConfig {
                username: email.clone(),
                ..Default::default()
            },
            smtp: SmtpConfig {
                username: email,
                ..Default::default()
            },
            signature: None,
        }
    }

    pub fn set_password(&mut self, password: String) {
        self.imap.password = password.clone();
        self.smtp.password = password;
    }

    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.email.is_empty() {
            errors.push("Email is required".to_string());
        }
        if self.imap.host.is_empty() {
            errors.push("IMAP host is required".to_string());
        }
        if self.smtp.host.is_empty() {
            errors.push("SMTP host is required".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}
