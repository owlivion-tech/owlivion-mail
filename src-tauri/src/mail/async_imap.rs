//! Async IMAP Client Implementation using async-imap
//!
//! Uses async-imap crate which has better parser compatibility.

use crate::mail::{
    config::{ImapConfig, SecurityType},
    EmailSummary, FetchResult, Folder, FolderType, MailError, MailResult,
};
use async_imap::Session;
use futures::StreamExt;
use tokio_util::compat::TokioAsyncReadCompatExt;

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
        let tls = async_native_tls::TlsConnector::new();
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
                return Err(MailError::Connection(
                    "Insecure connections not supported".to_string(),
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
    pub async fn fetch_emails(
        &mut self,
        folder: &str,
        page: u32,
        page_size: u32,
    ) -> MailResult<FetchResult> {
        log::info!(
            "async fetch_emails: folder={}, page={}, page_size={}",
            folder, page, page_size
        );

        let session = self.session.as_mut().ok_or(MailError::NotConnected)?;

        // Select the folder
        log::info!("Selecting folder: {}", folder);
        let mailbox = session
            .select(folder)
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
}
