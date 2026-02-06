//! IMAP Client Implementation
//!
//! Real IMAP connection for fetching emails, managing folders, and syncing.

use crate::mail::{
    config::{ImapConfig, SecurityType},
    EmailAttachment, EmailSummary, FetchResult, Folder, FolderType, MailError, MailResult,
    ParsedEmail,
};
use imap::Session;
use mail_parser::MimeHeaders;
use native_tls::{TlsConnector, TlsStream};
use std::net::TcpStream;

/// IMAP Client wrapper - supports both TLS and plain connections
pub struct ImapClient {
    session_tls: Option<Session<TlsStream<TcpStream>>>,
    config: ImapConfig,
}

impl ImapClient {
    /// Create a new IMAP client with the given configuration
    pub fn new(config: ImapConfig) -> Self {
        Self {
            session_tls: None,
            config,
        }
    }

    /// Connect to the IMAP server
    pub fn connect(&mut self) -> MailResult<()> {
        let tls = TlsConnector::builder()
            .danger_accept_invalid_certs(false)
            .build()
            .map_err(|e| MailError::Connection(e.to_string()))?;

        let address = format!("{}:{}", self.config.host, self.config.port);

        match self.config.security {
            SecurityType::SSL => {
                // Direct TLS connection (port 993)
                let stream = TcpStream::connect(&address)
                    .map_err(|e| MailError::Connection(e.to_string()))?;
                stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();
                stream.set_write_timeout(Some(std::time::Duration::from_secs(30))).ok();

                let tls_stream = tls
                    .connect(&self.config.host, stream)
                    .map_err(|e| MailError::Connection(e.to_string()))?;

                let client = imap::Client::new(tls_stream);
                let session = client
                    .login(&self.config.username, &self.config.password)
                    .map_err(|e| MailError::Authentication(e.0.to_string()))?;

                self.session_tls = Some(session);
            }
            SecurityType::STARTTLS => {
                // For STARTTLS, we need to connect plain first, then upgrade
                // The imap crate 2.4 doesn't have built-in STARTTLS support
                // So we'll use SSL on port 993 as fallback
                let ssl_address = format!("{}:993", self.config.host);
                let stream = TcpStream::connect(&ssl_address)
                    .map_err(|e| MailError::Connection(e.to_string()))?;
                stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();
                stream.set_write_timeout(Some(std::time::Duration::from_secs(30))).ok();

                let tls_stream = tls
                    .connect(&self.config.host, stream)
                    .map_err(|e| MailError::Connection(e.to_string()))?;

                let client = imap::Client::new(tls_stream);
                let session = client
                    .login(&self.config.username, &self.config.password)
                    .map_err(|e| MailError::Authentication(e.0.to_string()))?;

                self.session_tls = Some(session);
            }
            SecurityType::NONE => {
                return Err(MailError::Connection(
                    "Insecure connections not supported".to_string(),
                ));
            }
        }

        log::info!("Connected to IMAP server: {}", self.config.host);
        Ok(())
    }

    /// Get mutable reference to session
    fn session(&mut self) -> MailResult<&mut Session<TlsStream<TcpStream>>> {
        self.session_tls.as_mut().ok_or(MailError::NotConnected)
    }

    /// Disconnect from the server
    pub fn disconnect(&mut self) -> MailResult<()> {
        if let Some(mut session) = self.session_tls.take() {
            session
                .logout()
                .map_err(|e| MailError::Imap(e.to_string()))?;
        }
        Ok(())
    }

    /// Test the connection (connect and immediately logout)
    pub fn test_connection(&mut self) -> MailResult<()> {
        self.connect()?;
        self.disconnect()?;
        Ok(())
    }

    /// List all folders/mailboxes
    pub fn list_folders(&mut self) -> MailResult<Vec<Folder>> {
        let session = self.session()?;

        let mailboxes = session
            .list(Some(""), Some("*"))
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let mut folders: Vec<Folder> = mailboxes
            .iter()
            .map(|mb| {
                let name = mb.name().to_string();
                let delimiter = mb.delimiter().map(|d| d.to_string()).unwrap_or("/".to_string());

                Folder {
                    name: name.split(&delimiter).last().unwrap_or(&name).to_string(),
                    path: name.clone(),
                    folder_type: FolderType::from_name(&name),
                    delimiter,
                    is_subscribed: true,
                    is_selectable: !mb.attributes().iter().any(|a| {
                        matches!(a, imap::types::NameAttribute::NoSelect)
                    }),
                    unread_count: 0,
                    total_count: 0,
                }
            })
            .collect();

        // Get message counts for each selectable folder
        for folder in &mut folders {
            if folder.is_selectable {
                if let Ok(mailbox) = session.examine(&folder.path) {
                    folder.total_count = mailbox.exists;
                    // Get unread count via SEARCH
                    if let Ok(unseen) = session.uid_search("UNSEEN") {
                        folder.unread_count = unseen.len() as u32;
                    }
                }
            }
        }

        Ok(folders)
    }

    /// Select a folder/mailbox
    pub fn select_folder(&mut self, folder: &str) -> MailResult<u32> {
        let session = self.session()?;

        let mailbox = session
            .select(folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        Ok(mailbox.exists)
    }

    /// Fetch email summaries with pagination
    pub fn fetch_emails(
        &mut self,
        folder: &str,
        page: u32,
        page_size: u32,
    ) -> MailResult<FetchResult> {
        log::info!("fetch_emails called: folder={}, page={}, page_size={}", folder, page, page_size);

        log::info!("Checking session validity...");
        let session = self.session()?;

        // Test connection with NOOP first
        match session.noop() {
            Ok(_) => log::info!("NOOP succeeded, connection is valid"),
            Err(e) => {
                log::error!("NOOP failed, connection may be broken: {}", e);
                return Err(MailError::Connection("Session expired".to_string()));
            }
        }

        // Try to list folders first to verify connection
        log::info!("Testing folder listing...");
        match session.list(Some(""), Some("*")) {
            Ok(folders) => {
                log::info!("Found {} folders", folders.len());
                for f in folders.iter().take(5) {
                    log::info!("  Folder: {}", f.name());
                }
            }
            Err(e) => {
                log::warn!("List folders failed: {}", e);
            }
        }

        // Try to select
        log::info!("Attempting to select folder: {}", folder);
        let mailbox = match session.select(folder) {
            Ok(m) => {
                log::info!("Successfully selected folder: {}", folder);
                m
            }
            Err(e) => {
                log::error!("select({}) failed: {}", folder, e);
                // Try examine as fallback
                log::info!("Trying examine() instead...");
                match session.examine(folder) {
                    Ok(m) => {
                        log::info!("examine() succeeded");
                        m
                    }
                    Err(e2) => {
                        log::error!("Both select and examine failed: {}, {}", e, e2);
                        return Ok(FetchResult {
                            emails: vec![],
                            total: 0,
                            has_more: false,
                        });
                    }
                }
            }
        };

        let total = mailbox.exists;
        log::info!("Mailbox selected: {} - total messages: {}", folder, total);

        if total == 0 {
            log::info!("No emails in folder");
            return Ok(FetchResult {
                emails: vec![],
                total: 0,
                has_more: false,
            });
        }

        // Calculate sequence range (IMAP uses 1-based, newest first)
        let start = total.saturating_sub((page + 1) * page_size) + 1;
        let end = total.saturating_sub(page * page_size);

        if start > end || end == 0 {
            return Ok(FetchResult {
                emails: vec![],
                total,
                has_more: false,
            });
        }

        let range = format!("{}:{}", start, end);
        log::info!("Fetching range: {}", range);

        // Fetch headers and flags
        let messages = session
            .fetch(&range, "(UID FLAGS ENVELOPE RFC822.SIZE)")
            .map_err(|e| MailError::Imap(e.to_string()))?;

        log::info!("Fetched {} messages from server", messages.len());

        let mut emails: Vec<EmailSummary> = Vec::new();

        for message in messages.iter() {
            let uid = message.uid.unwrap_or(0);
            let flags = message.flags();

            let is_read = flags.iter().any(|f| matches!(f, imap::types::Flag::Seen));
            let is_starred = flags.iter().any(|f| matches!(f, imap::types::Flag::Flagged));

            if let Some(envelope) = message.envelope() {
                let from = envelope
                    .from
                    .as_ref()
                    .and_then(|addrs| addrs.first())
                    .map(|addr| {
                        let mailbox = addr.mailbox.as_ref().map(|m| {
                            String::from_utf8_lossy(m).to_string()
                        }).unwrap_or_default();
                        let host = addr.host.as_ref().map(|h| {
                            String::from_utf8_lossy(h).to_string()
                        }).unwrap_or_default();
                        format!("{}@{}", mailbox, host)
                    })
                    .unwrap_or_else(|| "unknown".to_string());

                let from_name = envelope
                    .from
                    .as_ref()
                    .and_then(|addrs| addrs.first())
                    .and_then(|addr| addr.name.as_ref())
                    .map(|n| decode_mime_header(&String::from_utf8_lossy(n)));

                let subject = envelope
                    .subject
                    .as_ref()
                    .map(|s| decode_mime_header(&String::from_utf8_lossy(s)))
                    .unwrap_or_else(|| "(No subject)".to_string());

                let message_id = envelope
                    .message_id
                    .as_ref()
                    .map(|id| String::from_utf8_lossy(id).to_string());

                let date = envelope
                    .date
                    .as_ref()
                    .map(|d| String::from_utf8_lossy(d).to_string())
                    .unwrap_or_else(|| "Unknown".to_string());

                emails.push(EmailSummary {
                    uid,
                    message_id,
                    from,
                    from_name,
                    subject,
                    preview: String::new(), // Preview requires fetching body
                    date,
                    is_read,
                    is_starred,
                    has_attachments: false, // Would need BODYSTRUCTURE to detect
                    account_id: None, // Not used in sync imap client
                    account_email: None,
                    account_name: None,
                    account_color: None,
                });
            }
        }

        // Reverse to show newest first
        emails.reverse();

        let has_more = start > 1;

        // SECURITY: Don't log email content/metadata in production
        log::debug!("Returning {} emails, total={}, has_more={}", emails.len(), total, has_more);

        Ok(FetchResult {
            emails,
            total,
            has_more,
        })
    }

    /// Fetch a single email by UID
    pub fn fetch_email(&mut self, folder: &str, uid: u32) -> MailResult<ParsedEmail> {
        let session = self.session()?;

        // Select folder
        session
            .select(folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        // Fetch the full message
        let messages = session
            .uid_fetch(uid.to_string(), "(FLAGS ENVELOPE BODY[])")
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let message = messages
            .iter()
            .next()
            .ok_or_else(|| MailError::NotFound(format!("Email with UID {} not found", uid)))?;

        let flags = message.flags();
        let is_read = flags.iter().any(|f| matches!(f, imap::types::Flag::Seen));
        let is_starred = flags.iter().any(|f| matches!(f, imap::types::Flag::Flagged));

        // Parse envelope
        let envelope = message.envelope().ok_or_else(|| {
            MailError::Imap("Failed to get envelope".to_string())
        })?;

        let from = envelope
            .from
            .as_ref()
            .and_then(|addrs| addrs.first())
            .map(|addr| {
                let mailbox = addr.mailbox.as_ref().map(|m| {
                    String::from_utf8_lossy(m).to_string()
                }).unwrap_or_default();
                let host = addr.host.as_ref().map(|h| {
                    String::from_utf8_lossy(h).to_string()
                }).unwrap_or_default();
                format!("{}@{}", mailbox, host)
            })
            .unwrap_or_else(|| "unknown".to_string());

        let from_name = envelope
            .from
            .as_ref()
            .and_then(|addrs| addrs.first())
            .and_then(|addr| addr.name.as_ref())
            .map(|n| decode_mime_header(&String::from_utf8_lossy(n)));

        let to: Vec<String> = envelope
            .to
            .as_ref()
            .map(|addrs| {
                addrs.iter().map(|addr| {
                    let mailbox = addr.mailbox.as_ref().map(|m| {
                        String::from_utf8_lossy(m).to_string()
                    }).unwrap_or_default();
                    let host = addr.host.as_ref().map(|h| {
                        String::from_utf8_lossy(h).to_string()
                    }).unwrap_or_default();
                    format!("{}@{}", mailbox, host)
                }).collect()
            })
            .unwrap_or_default();

        let cc: Vec<String> = envelope
            .cc
            .as_ref()
            .map(|addrs| {
                addrs.iter().map(|addr| {
                    let mailbox = addr.mailbox.as_ref().map(|m| {
                        String::from_utf8_lossy(m).to_string()
                    }).unwrap_or_default();
                    let host = addr.host.as_ref().map(|h| {
                        String::from_utf8_lossy(h).to_string()
                    }).unwrap_or_default();
                    format!("{}@{}", mailbox, host)
                }).collect()
            })
            .unwrap_or_default();

        let subject = envelope
            .subject
            .as_ref()
            .map(|s| decode_mime_header(&String::from_utf8_lossy(s)))
            .unwrap_or_else(|| "(No subject)".to_string());

        let message_id = envelope
            .message_id
            .as_ref()
            .map(|id| String::from_utf8_lossy(id).to_string());

        let date = envelope
            .date
            .as_ref()
            .map(|d| String::from_utf8_lossy(d).to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        // Parse body using mail-parser
        let body = message.body().unwrap_or(&[]);
        let (body_text, body_html, attachments) = parse_email_body(body);

        Ok(ParsedEmail {
            uid,
            message_id,
            from,
            from_name,
            to,
            cc,
            subject,
            date,
            body_text,
            body_html,
            is_read,
            is_starred,
            attachments,
        })
    }

    /// Search emails
    /// SECURITY: Query is sanitized to prevent IMAP command injection
    pub fn search(&mut self, folder: &str, query: &str) -> MailResult<Vec<u32>> {
        let session = self.session()?;

        // Validate folder name
        let safe_folder = sanitize_imap_string(folder);

        session
            .select(&safe_folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        // Sanitize search query to prevent IMAP injection
        let safe_query = sanitize_imap_string(query);

        // Limit query length to prevent DoS
        if safe_query.len() > 200 {
            return Err(MailError::Imap("Search query too long".to_string()));
        }

        // Search in subject, from, and body
        let search_query = format!("OR OR SUBJECT \"{}\" FROM \"{}\" BODY \"{}\"", safe_query, safe_query, safe_query);

        let uids = session
            .uid_search(&search_query)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        Ok(uids.iter().cloned().collect())
    }

    /// Mark email as read/unread
    pub fn set_read(&mut self, folder: &str, uid: u32, read: bool) -> MailResult<()> {
        let session = self.session()?;

        session
            .select(folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();

        if read {
            session
                .uid_store(&uid_str, "+FLAGS (\\Seen)")
                .map_err(|e| MailError::Imap(e.to_string()))?;
        } else {
            session
                .uid_store(&uid_str, "-FLAGS (\\Seen)")
                .map_err(|e| MailError::Imap(e.to_string()))?;
        }

        Ok(())
    }

    /// Mark email as starred/unstarred
    pub fn set_starred(&mut self, folder: &str, uid: u32, starred: bool) -> MailResult<()> {
        let session = self.session()?;

        session
            .select(folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();

        if starred {
            session
                .uid_store(&uid_str, "+FLAGS (\\Flagged)")
                .map_err(|e| MailError::Imap(e.to_string()))?;
        } else {
            session
                .uid_store(&uid_str, "-FLAGS (\\Flagged)")
                .map_err(|e| MailError::Imap(e.to_string()))?;
        }

        Ok(())
    }

    /// Move email to another folder
    pub fn move_email(&mut self, folder: &str, uid: u32, target_folder: &str) -> MailResult<()> {
        let session = self.session()?;

        session
            .select(folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();

        // Copy to target folder
        session
            .uid_copy(&uid_str, target_folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        // Mark original as deleted
        session
            .uid_store(&uid_str, "+FLAGS (\\Deleted)")
            .map_err(|e| MailError::Imap(e.to_string()))?;

        // Expunge deleted messages
        session
            .expunge()
            .map_err(|e| MailError::Imap(e.to_string()))?;

        Ok(())
    }

    /// Delete email (move to trash or permanently delete)
    pub fn delete_email(&mut self, folder: &str, uid: u32, permanent: bool) -> MailResult<()> {
        let session = self.session()?;

        session
            .select(folder)
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();

        if permanent {
            // Mark as deleted and expunge
            session
                .uid_store(&uid_str, "+FLAGS (\\Deleted)")
                .map_err(|e| MailError::Imap(e.to_string()))?;
            session
                .expunge()
                .map_err(|e| MailError::Imap(e.to_string()))?;
        } else {
            // Move to Trash folder
            // Try common trash folder names
            let trash_folders = ["Trash", "[Gmail]/Trash", "Deleted Items", "Deleted"];

            for trash in &trash_folders {
                if session.uid_copy(&uid_str, trash).is_ok() {
                    session
                        .uid_store(&uid_str, "+FLAGS (\\Deleted)")
                        .map_err(|e| MailError::Imap(e.to_string()))?;
                    session
                        .expunge()
                        .map_err(|e| MailError::Imap(e.to_string()))?;
                    return Ok(());
                }
            }

            // If no trash folder found, just mark as deleted
            session
                .uid_store(&uid_str, "+FLAGS (\\Deleted)")
                .map_err(|e| MailError::Imap(e.to_string()))?;
        }

        Ok(())
    }
}

/// Decode MIME encoded header (RFC 2047)
fn decode_mime_header(input: &str) -> String {
    // Simple decoder for =?charset?encoding?text?= format
    if !input.contains("=?") {
        return input.to_string();
    }

    let mut result = input.to_string();

    // Handle UTF-8 Base64 encoded strings
    if let Ok(re_b64) = regex_lite::Regex::new(r"=\?([^?]+)\?[Bb]\?([^?]+)\?=") {
        result = re_b64.replace_all(&result, |caps: &regex_lite::Captures| {
            let encoded = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded)
                .ok()
                .and_then(|bytes| String::from_utf8(bytes).ok())
                .unwrap_or_else(|| encoded.to_string())
        }).to_string();
    }

    // Handle quoted-printable
    if let Ok(re_qp) = regex_lite::Regex::new(r"=\?([^?]+)\?[Qq]\?([^?]+)\?=") {
        result = re_qp.replace_all(&result, |caps: &regex_lite::Captures| {
            let encoded = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            decode_quoted_printable(encoded)
        }).to_string();
    }

    result.replace("_", " ")
}

/// Decode quoted-printable string
fn decode_quoted_printable(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '=' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            }
        } else if c == '_' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }

    result
}

/// Sanitize string for IMAP commands to prevent injection attacks
/// Removes/escapes characters that could be used for IMAP command injection
fn sanitize_imap_string(input: &str) -> String {
    input
        .chars()
        .filter(|c| {
            // Allow alphanumeric, common punctuation, and Unicode letters
            c.is_alphanumeric()
                || *c == ' '
                || *c == '.'
                || *c == '-'
                || *c == '_'
                || *c == '@'
                || *c == '+'
                || *c == ','
                || *c == ':'
                || *c == '/'
                || *c == '['
                || *c == ']'
                || c.is_alphabetic() // Unicode letters (Turkish, etc.)
        })
        .collect::<String>()
        // Double any remaining quotes (shouldn't be any, but safe)
        .replace('"', "")
        .replace('\\', "")
        .replace('\r', "")
        .replace('\n', "")
        .replace('\0', "")
}

/// Parse email body using mail-parser
fn parse_email_body(body: &[u8]) -> (Option<String>, Option<String>, Vec<EmailAttachment>) {
    let mut body_text = None;
    let mut body_html = None;
    let mut attachments = Vec::new();

    if let Some(message) = mail_parser::MessageParser::default().parse(body) {
        // Get text body
        body_text = message.body_text(0).map(|s| s.to_string());

        // Get HTML body
        body_html = message.body_html(0).map(|s| s.to_string());

        // Get attachments
        for (index, attachment) in message.attachments().enumerate() {
            let filename = attachment
                .attachment_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("attachment_{}", index));

            let content_type = attachment
                .content_type()
                .map(|ct| ct.ctype().to_string())
                .unwrap_or_else(|| "application/octet-stream".to_string());
            let size = attachment.contents().len() as u32;

            let content_id = attachment.content_id()
                .map(|id| id.to_string());

            let is_inline = content_id.is_some() || attachment.is_message();

            attachments.push(EmailAttachment {
                filename,
                content_type,
                size,
                index,
                content_id,
                is_inline,
            });
        }
    }

    (body_text, body_html, attachments)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_mime_header_plain() {
        let input = "Hello World";
        let decoded = decode_mime_header(input);
        assert_eq!(decoded, "Hello World");
    }

    #[test]
    fn test_folder_type_detection() {
        assert_eq!(FolderType::from_name("INBOX"), FolderType::Inbox);
        assert_eq!(FolderType::from_name("Sent Items"), FolderType::Sent);
        assert_eq!(FolderType::from_name("[Gmail]/Spam"), FolderType::Junk);
    }
}
