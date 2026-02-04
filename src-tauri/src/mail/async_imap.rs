//! Async IMAP Client Implementation using async-imap
//!
//! Uses async-imap crate which has better parser compatibility.

use crate::mail::{
    config::{ImapConfig, SecurityType},
    EmailSummary, FetchResult, Folder, FolderType, MailError, MailResult, ParsedEmail,
};
use async_imap::Session;
use futures::{pin_mut, StreamExt};
use tokio_util::compat::TokioAsyncReadCompatExt;

// SECURITY: Maximum search query length to prevent injection attacks
const MAX_SEARCH_QUERY_LENGTH: usize = 200;

/// SECURITY: Sanitize IMAP string to prevent injection attacks
/// Removes characters that could be used for IMAP command injection
fn sanitize_imap_string(input: &str) -> String {
    input
        .chars()
        .filter(|c| {
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
                || c.is_alphabetic()
        })
        .collect::<String>()
        .replace('"', "")
        .replace('\\', "")
        .replace('\r', "")
        .replace('\n', "")
        .replace('\0', "")
}

/// SECURITY: Sanitize folder name for IMAP operations
fn sanitize_folder_name(folder: &str) -> String {
    // Allow standard folder characters but remove injection vectors
    folder
        .chars()
        .filter(|c| {
            c.is_alphanumeric()
                || *c == '/'
                || *c == '.'
                || *c == '-'
                || *c == '_'
                || *c == '['
                || *c == ']'
                || *c == ' '
        })
        .collect::<String>()
        .replace('\r', "")
        .replace('\n', "")
        .replace('\0', "")
}

/// Decode MIME encoded header (RFC 2047)
fn decode_mime_header(input: &str) -> String {
    if !input.contains("=?") {
        return input.to_string();
    }

    let mut result = input.to_string();

    // Handle UTF-8 Base64 encoded strings =?charset?B?text?=
    if let Ok(re_b64) = regex_lite::Regex::new(r"=\?([^?]+)\?[Bb]\?([^?]+)\?=") {
        result = re_b64.replace_all(&result, |caps: &regex_lite::Captures| {
            let encoded = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded)
                .ok()
                .and_then(|bytes| String::from_utf8(bytes).ok())
                .unwrap_or_else(|| encoded.to_string())
        }).to_string();
    }

    // Handle quoted-printable =?charset?Q?text?=
    if let Ok(re_qp) = regex_lite::Regex::new(r"=\?([^?]+)\?[Qq]\?([^?]+)\?=") {
        result = re_qp.replace_all(&result, |caps: &regex_lite::Captures| {
            let encoded = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            decode_quoted_printable(encoded)
        }).to_string();
    }

    // Replace underscores with spaces (common in MIME headers)
    result.replace("_", " ")
}

/// Decode quoted-printable string
fn decode_quoted_printable(input: &str) -> String {
    let mut result = Vec::new();
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '=' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte);
            }
        } else if c == '_' {
            result.push(b' ');
        } else {
            result.push(c as u8);
        }
    }

    String::from_utf8(result).unwrap_or_else(|_| input.to_string())
}

type TlsStream = async_native_tls::TlsStream<tokio_util::compat::Compat<tokio::net::TcpStream>>;

/// Async IMAP Client wrapper
pub struct AsyncImapClient {
    session: Option<Session<TlsStream>>,
    config: ImapConfig,
}

impl AsyncImapClient {
    /// Create a new async IMAP client
    pub fn new(config: ImapConfig) -> Self {
        Self {
            session: None,
            config,
        }
    }

    /// Connect to the IMAP server
    pub async fn connect(&mut self) -> MailResult<()> {
        // Configure TLS based on account settings
        let tls = if self.config.accept_invalid_certs {
            log::warn!("⚠️  Accepting invalid SSL certificates for {}", self.config.host);
            async_native_tls::TlsConnector::new()
                .danger_accept_invalid_certs(true)
        } else {
            async_native_tls::TlsConnector::new()
        };

        let address = format!("{}:{}", self.config.host, self.config.port);

        match self.config.security {
            SecurityType::SSL => {
                // Direct TLS connection (port 993)
                let stream = tokio::net::TcpStream::connect(&address)
                    .await
                    .map_err(|e| MailError::Connection(e.to_string()))?;

                // Convert to futures-io compatible stream
                let compat_stream = stream.compat();

                let tls_stream = tls
                    .connect(&self.config.host, compat_stream)
                    .await
                    .map_err(|e| MailError::Connection(e.to_string()))?;

                let client = async_imap::Client::new(tls_stream);
                let session = client
                    .login(&self.config.username, &self.config.password)
                    .await
                    .map_err(|e| MailError::Authentication(e.0.to_string()))?;

                self.session = Some(session);
            }
            SecurityType::STARTTLS => {
                // For STARTTLS, fallback to SSL on port 993
                let ssl_address = format!("{}:993", self.config.host);
                let stream = tokio::net::TcpStream::connect(&ssl_address)
                    .await
                    .map_err(|e| MailError::Connection(e.to_string()))?;

                let compat_stream = stream.compat();

                let tls_stream = tls
                    .connect(&self.config.host, compat_stream)
                    .await
                    .map_err(|e| MailError::Connection(e.to_string()))?;

                let client = async_imap::Client::new(tls_stream);
                let session = client
                    .login(&self.config.username, &self.config.password)
                    .await
                    .map_err(|e| MailError::Authentication(e.0.to_string()))?;

                self.session = Some(session);
            }
            SecurityType::NONE => {
                // SECURITY WARNING: Unencrypted connection
                log::warn!("⚠️  CRITICAL SECURITY WARNING: Connecting without encryption!");
                log::warn!("⚠️  Credentials will be sent in PLAIN TEXT over the network!");

                // Try to connect without TLS (plain TCP)
                // Note: Most modern email servers don't support this
                let stream = tokio::net::TcpStream::connect(&address)
                    .await
                    .map_err(|e| MailError::Connection(format!("Plain connection failed: {}. Most email servers require SSL/TLS encryption. Try using SSL (port 993) or STARTTLS (port 143) instead.", e)))?;

                let compat_stream = stream.compat();
                let client = async_imap::Client::new(compat_stream);

                // Try to login without encryption
                let session = client
                    .login(&self.config.username, &self.config.password)
                    .await
                    .map_err(|e| MailError::Authentication(format!("Authentication failed on unencrypted connection: {}. Server may not support plain text login.", e.0)))?;

                // Store session (this won't compile as-is, need to handle different types)
                // For now, return error with suggestion
                return Err(MailError::Connection(
                    "Unencrypted connections are not fully supported yet. Please use SSL/TLS or STARTTLS. If your server has a self-signed certificate, the app now accepts those automatically.".to_string(),
                ));
            }
        }

        log::info!("Async IMAP connected to: {}", self.config.host);
        Ok(())
    }

    /// Disconnect from server
    pub async fn disconnect(&mut self) -> MailResult<()> {
        if let Some(mut session) = self.session.take() {
            session
                .logout()
                .await
                .map_err(|e| MailError::Imap(e.to_string()))?;
        }
        Ok(())
    }

    /// List folders
    pub async fn list_folders(&mut self) -> MailResult<Vec<Folder>> {
        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        let mut mailboxes_stream = session
            .list(Some(""), Some("*"))
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let mut folders = Vec::new();
        while let Some(result) = mailboxes_stream.next().await {
            let mb = result.map_err(|e| MailError::Imap(e.to_string()))?;
            let name = mb.name().to_string();
            let delimiter = mb.delimiter()
                .map(|d: &str| d.to_string())
                .unwrap_or("/".to_string());

            folders.push(Folder {
                name: name.split(&delimiter).last().unwrap_or(&name).to_string(),
                path: name.clone(),
                folder_type: FolderType::from_name(&name),
                delimiter,
                is_subscribed: true,
                is_selectable: true,
                unread_count: 0,
                total_count: 0,
            });
        }

        Ok(folders)
    }

    /// Fetch emails with pagination
    /// SECURITY: Folder name sanitized to prevent IMAP injection
    pub async fn fetch_emails(
        &mut self,
        folder: &str,
        page: u32,
        page_size: u32,
    ) -> MailResult<FetchResult> {
        // SECURITY: Sanitize folder name
        let safe_folder = sanitize_folder_name(folder);

        log::info!(
            "async fetch_emails: folder={}, page={}, page_size={}",
            safe_folder, page, page_size
        );

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        // Select the folder
        log::info!("Selecting folder: {}", safe_folder);
        let mailbox = session
            .select(&safe_folder)
            .await
            .map_err(|e| {
                log::error!("Failed to select folder: {}", e);
                MailError::Imap(e.to_string())
            })?;

        let total = mailbox.exists;
        log::info!("Folder selected, {} messages exist", total);

        if total == 0 {
            return Ok(FetchResult {
                emails: vec![],
                total: 0,
                has_more: false,
            });
        }

        // Calculate sequence range
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

        // Fetch emails - returns a Stream
        let mut messages_stream = session
            .fetch(&range, "(UID FLAGS ENVELOPE)")
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        // Collect messages from stream
        let mut emails: Vec<EmailSummary> = Vec::new();
        let mut msg_count = 0;

        while let Some(result) = messages_stream.next().await {
            msg_count += 1;
            let message = result.map_err(|e| MailError::Imap(e.to_string()))?;

            let uid = message.uid.unwrap_or(0);
            let flags = message.flags();

            let flags_vec: Vec<_> = flags.collect();
            let is_read = flags_vec.iter().any(|f| matches!(f, async_imap::types::Flag::Seen));
            let is_starred = flags_vec.iter().any(|f| matches!(f, async_imap::types::Flag::Flagged));

            if let Some(envelope) = message.envelope() {
                let from = envelope
                    .from
                    .as_ref()
                    .and_then(|addrs| addrs.first())
                    .map(|addr| {
                        let mailbox = addr.mailbox.as_ref()
                            .map(|m: &std::borrow::Cow<'_, [u8]>| String::from_utf8_lossy(m).to_string())
                            .unwrap_or_default();
                        let host = addr.host.as_ref()
                            .map(|h: &std::borrow::Cow<'_, [u8]>| String::from_utf8_lossy(h).to_string())
                            .unwrap_or_default();
                        format!("{}@{}", mailbox, host)
                    })
                    .unwrap_or_else(|| "unknown".to_string());

                let from_name = envelope
                    .from
                    .as_ref()
                    .and_then(|addrs| addrs.first())
                    .and_then(|addr| addr.name.as_ref())
                    .map(|n: &std::borrow::Cow<'_, [u8]>| {
                        let raw = String::from_utf8_lossy(n).to_string();
                        decode_mime_header(&raw)
                    });

                let subject = envelope
                    .subject
                    .as_ref()
                    .map(|s| {
                        let raw = String::from_utf8_lossy(s).to_string();
                        decode_mime_header(&raw)
                    })
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
                    preview: String::new(),
                    date,
                    is_read,
                    is_starred,
                    has_attachments: false,
                });
            }
        }

        log::info!("Processed {} messages from stream", msg_count);

        emails.reverse();
        let has_more = start > 1;

        log::info!("Returning {} emails, total={}, has_more={}", emails.len(), total, has_more);

        Ok(FetchResult {
            emails,
            total,
            has_more,
        })
    }

    /// Fetch a single email with full content
    /// SECURITY: Folder name sanitized to prevent IMAP injection
    pub async fn fetch_email(&mut self, folder: &str, uid: u32) -> MailResult<ParsedEmail> {
        // SECURITY: Sanitize folder name
        let safe_folder = sanitize_folder_name(folder);

        log::info!("fetch_email: folder={}, uid={}", safe_folder, uid);

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        // Select folder
        log::info!("fetch_email: selecting folder...");
        session
            .select(&safe_folder)
            .await
            .map_err(|e| {
                log::error!("fetch_email: failed to select folder: {}", e);
                MailError::Imap(e.to_string())
            })?;
        log::info!("fetch_email: folder selected");

        // Fetch the email with body - use simpler fetch command
        let uid_str = uid.to_string();
        log::info!("fetch_email: fetching UID {}...", uid);
        let mut messages_stream = session
            .uid_fetch(&uid_str, "(UID FLAGS ENVELOPE RFC822)")
            .await
            .map_err(|e| {
                log::error!("fetch_email: uid_fetch failed: {}", e);
                MailError::Imap(e.to_string())
            })?;
        log::info!("fetch_email: got message stream");

        log::info!("fetch_email: waiting for message from stream...");
        if let Some(result) = messages_stream.next().await {
            log::info!("fetch_email: got message from stream");
            let message = result.map_err(|e| {
                log::error!("fetch_email: message parse error: {}", e);
                MailError::Imap(e.to_string())
            })?;

            let flags = message.flags();
            let flags_vec: Vec<_> = flags.collect();
            let is_read = flags_vec.iter().any(|f| matches!(f, async_imap::types::Flag::Seen));
            let is_starred = flags_vec.iter().any(|f| matches!(f, async_imap::types::Flag::Flagged));

            // Get envelope for headers
            let envelope = message.envelope();

            let (from, from_name) = envelope
                .and_then(|e| e.from.as_ref())
                .and_then(|addrs| addrs.first())
                .map(|addr| {
                    let mailbox = addr.mailbox.as_ref()
                        .map(|m| String::from_utf8_lossy(m).to_string())
                        .unwrap_or_default();
                    let host = addr.host.as_ref()
                        .map(|h| String::from_utf8_lossy(h).to_string())
                        .unwrap_or_default();
                    let email = format!("{}@{}", mailbox, host);
                    let name = addr.name.as_ref()
                        .map(|n| decode_mime_header(&String::from_utf8_lossy(n)));
                    (email, name)
                })
                .unwrap_or_else(|| ("unknown".to_string(), None));

            let to: Vec<String> = envelope
                .and_then(|e| e.to.as_ref())
                .map(|addrs| {
                    addrs.iter().map(|addr| {
                        let mailbox = addr.mailbox.as_ref()
                            .map(|m| String::from_utf8_lossy(m).to_string())
                            .unwrap_or_default();
                        let host = addr.host.as_ref()
                            .map(|h| String::from_utf8_lossy(h).to_string())
                            .unwrap_or_default();
                        format!("{}@{}", mailbox, host)
                    }).collect()
                })
                .unwrap_or_default();

            let cc: Vec<String> = envelope
                .and_then(|e| e.cc.as_ref())
                .map(|addrs| {
                    addrs.iter().map(|addr| {
                        let mailbox = addr.mailbox.as_ref()
                            .map(|m| String::from_utf8_lossy(m).to_string())
                            .unwrap_or_default();
                        let host = addr.host.as_ref()
                            .map(|h| String::from_utf8_lossy(h).to_string())
                            .unwrap_or_default();
                        format!("{}@{}", mailbox, host)
                    }).collect()
                })
                .unwrap_or_default();

            let subject = envelope
                .and_then(|e| e.subject.as_ref())
                .map(|s| decode_mime_header(&String::from_utf8_lossy(s)))
                .unwrap_or_else(|| "(No subject)".to_string());

            let date = envelope
                .and_then(|e| e.date.as_ref())
                .map(|d| String::from_utf8_lossy(d).to_string())
                .unwrap_or_else(|| "Unknown".to_string());

            let message_id = envelope
                .and_then(|e| e.message_id.as_ref())
                .map(|id| String::from_utf8_lossy(id).to_string());

            // Parse body
            log::info!("fetch_email: parsing body...");
            let body = message.body();
            log::info!("fetch_email: body present={}", body.is_some());
            let (body_text, body_html) = if let Some(body_bytes) = body {
                log::info!("fetch_email: body size={} bytes", body_bytes.len());
                parse_email_body(body_bytes)
            } else {
                log::warn!("fetch_email: no body found");
                (None, None)
            };

            // SECURITY: Don't log email subject/content in production
            log::debug!("Email fetched: uid={}, body_text_len={:?}, body_html_len={:?}",
                uid, body_text.as_ref().map(|s| s.len()), body_html.as_ref().map(|s| s.len()));

            return Ok(ParsedEmail {
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
                attachments: vec![],
            });
        }

        Err(MailError::Imap("Email not found".to_string()))
    }

    /// Search emails
    /// SECURITY: Input sanitized and length-limited to prevent IMAP injection
    pub async fn search(&mut self, folder: &str, query: &str) -> MailResult<Vec<u32>> {
        // SECURITY: Validate query length
        if query.len() > MAX_SEARCH_QUERY_LENGTH {
            return Err(MailError::Imap(format!(
                "Search query too long (max {} characters)",
                MAX_SEARCH_QUERY_LENGTH
            )));
        }

        // SECURITY: Sanitize folder name
        let safe_folder = sanitize_folder_name(folder);

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        session
            .select(&safe_folder)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        // SECURITY: Sanitize search query to prevent IMAP injection
        let sanitized_query = sanitize_imap_string(query);
        let search_query = format!(
            "OR OR SUBJECT \"{}\" FROM \"{}\" BODY \"{}\"",
            sanitized_query, sanitized_query, sanitized_query
        );

        let uids_set = session
            .uid_search(&search_query)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        Ok(uids_set.into_iter().collect())
    }

    /// Mark email as read/unread
    /// SECURITY: Folder name sanitized to prevent IMAP injection
    pub async fn set_read(&mut self, folder: &str, uid: u32, read: bool) -> MailResult<()> {
        // SECURITY: Sanitize folder name
        let safe_folder = sanitize_folder_name(folder);

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        session
            .select(&safe_folder)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();
        let flag_cmd = if read { "+FLAGS (\\Seen)" } else { "-FLAGS (\\Seen)" };

        // Execute the store command and consume the stream
        let mut stream = session
            .uid_store(&uid_str, flag_cmd)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;
        while let Some(_) = stream.next().await {}

        Ok(())
    }

    /// Mark email as starred/unstarred
    /// SECURITY: Folder name sanitized to prevent IMAP injection
    pub async fn set_starred(&mut self, folder: &str, uid: u32, starred: bool) -> MailResult<()> {
        // SECURITY: Sanitize folder name
        let safe_folder = sanitize_folder_name(folder);

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        session
            .select(&safe_folder)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();
        let flag_cmd = if starred { "+FLAGS (\\Flagged)" } else { "-FLAGS (\\Flagged)" };

        // Execute the store command and consume the stream
        let mut stream = session
            .uid_store(&uid_str, flag_cmd)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;
        while let Some(_) = stream.next().await {}

        Ok(())
    }

    /// Move email to another folder
    /// SECURITY: Folder names sanitized to prevent IMAP injection
    pub async fn move_email(&mut self, folder: &str, uid: u32, target_folder: &str) -> MailResult<()> {
        // SECURITY: Sanitize folder names
        let safe_folder = sanitize_folder_name(folder);
        let safe_target = sanitize_folder_name(target_folder);

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        session
            .select(&safe_folder)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();

        // Copy to target folder
        session
            .uid_copy(&uid_str, &safe_target)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        // Mark original as deleted and consume the stream
        {
            let mut stream = session
                .uid_store(&uid_str, "+FLAGS (\\Deleted)")
                .await
                .map_err(|e| MailError::Imap(e.to_string()))?;
            while let Some(_) = stream.next().await {}
        } // stream is dropped here

        // Expunge deleted messages and consume the stream
        {
            let expunge_stream = session
                .expunge()
                .await
                .map_err(|e| MailError::Imap(e.to_string()))?;
            pin_mut!(expunge_stream);
            while let Some(_) = expunge_stream.next().await {}
        }

        Ok(())
    }

    /// Delete email
    /// SECURITY: Folder name sanitized to prevent IMAP injection
    pub async fn delete_email(&mut self, folder: &str, uid: u32, permanent: bool) -> MailResult<()> {
        // SECURITY: Sanitize folder name
        let safe_folder = sanitize_folder_name(folder);

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        session
            .select(&safe_folder)
            .await
            .map_err(|e| MailError::Imap(e.to_string()))?;

        let uid_str = uid.to_string();

        if permanent {
            // Mark as deleted and consume the stream
            {
                let mut stream = session
                    .uid_store(&uid_str, "+FLAGS (\\Deleted)")
                    .await
                    .map_err(|e| MailError::Imap(e.to_string()))?;
                while let Some(_) = stream.next().await {}
            } // stream is dropped here

            // Expunge and consume the stream
            {
                let expunge_stream = session
                    .expunge()
                    .await
                    .map_err(|e| MailError::Imap(e.to_string()))?;
                pin_mut!(expunge_stream);
                while let Some(_) = expunge_stream.next().await {}
            }
        } else {
            // Move to Trash folder - try common trash folder names
            let trash_folders = ["Trash", "[Gmail]/Trash", "Deleted Items", "Deleted"];
            let mut moved = false;

            for trash in &trash_folders {
                if session.uid_copy(&uid_str, trash).await.is_ok() {
                    // Mark as deleted and consume the stream
                    {
                        let mut stream = session
                            .uid_store(&uid_str, "+FLAGS (\\Deleted)")
                            .await
                            .map_err(|e| MailError::Imap(e.to_string()))?;
                        while let Some(_) = stream.next().await {}
                    } // stream is dropped here

                    // Expunge and consume the stream
                    {
                        let expunge_stream = session
                            .expunge()
                            .await
                            .map_err(|e| MailError::Imap(e.to_string()))?;
                        pin_mut!(expunge_stream);
                        while let Some(_) = expunge_stream.next().await {}
                    }

                    moved = true;
                    break;
                }
            }

            if !moved {
                // If no trash folder found, just mark as deleted
                let mut stream = session
                    .uid_store(&uid_str, "+FLAGS (\\Deleted)")
                    .await
                    .map_err(|e| MailError::Imap(e.to_string()))?;
                while let Some(_) = stream.next().await {}
            }
        }

        Ok(())
    }
}

/// Parse email body from raw bytes
fn parse_email_body(body: &[u8]) -> (Option<String>, Option<String>) {
    // Try to parse with mail_parser
    if let Some(parsed) = mail_parser::MessageParser::default().parse(body) {
        let body_text = parsed.body_text(0).map(|s| s.to_string());
        let body_html = parsed.body_html(0).map(|s| s.to_string());
        return (body_text, body_html);
    }

    // Fallback: treat as plain text
    let text = String::from_utf8_lossy(body).to_string();
    (Some(text), None)
}
