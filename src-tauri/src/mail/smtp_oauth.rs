//! SMTP OAuth2 Implementation
//!
//! Gmail SMTP OAuth2 support using XOAUTH2 SASL mechanism

use crate::mail::MailError;
use std::io::{Read, Write};
use std::net::TcpStream;

/// Send email using SMTP with OAuth2 XOAUTH2 authentication
pub async fn send_email_oauth(
    smtp_host: &str,
    smtp_port: u16,
    email: &str,
    access_token: &str,
    from: &str,
    to: &[String],
    cc: &[String],
    bcc: &[String],
    subject: &str,
    body: &str,
    is_html: bool,
) -> Result<(), MailError> {
    let smtp_host = smtp_host.to_string();
    let email = email.to_string();
    let access_token = access_token.to_string();
    let from = from.to_string();
    let to = to.to_vec();
    let cc = cc.to_vec();
    let bcc = bcc.to_vec();
    let subject = subject.to_string();
    let body = body.to_string();

    // Run SMTP operations in blocking thread
    tokio::task::spawn_blocking(move || {
        log::info!("SMTP OAuth: Connecting to {}:{}...", smtp_host, smtp_port);

        // Connect to SMTP server with TLS
        let tls_connector = native_tls::TlsConnector::builder()
            .build()
            .map_err(|e| {
                log::error!("TLS builder error: {}", e);
                MailError::Smtp(format!("TLS error: {}", e))
            })?;

        let stream = TcpStream::connect((smtp_host.as_str(), smtp_port))
            .map_err(|e| {
                log::error!("TCP connection failed to {}:{} - {}", smtp_host, smtp_port, e);
                MailError::Smtp(format!("Connection failed: {}", e))
            })?;

        log::info!("TCP connected, starting TLS handshake...");

        let mut tls_stream = tls_connector
            .connect(&smtp_host, stream)
            .map_err(|e| {
                log::error!("TLS handshake failed: {}", e);
                MailError::Smtp(format!("TLS handshake failed: {}", e))
            })?;

        // Read SMTP banner
        let mut response = read_response(&mut tls_stream)?;
        if !response.starts_with("220") {
            return Err(MailError::Smtp(format!("Invalid SMTP banner: {}", response)));
        }

        // Send EHLO
        send_command(&mut tls_stream, &format!("EHLO {}\r\n", smtp_host))?;
        response = read_response(&mut tls_stream)?;
        if !response.starts_with("250") {
            return Err(MailError::Smtp(format!("EHLO failed: {}", response)));
        }

        // Send AUTH XOAUTH2
        let auth_string = format!("user={}\x01auth=Bearer {}\x01\x01", email, access_token);
        let auth_base64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, auth_string.as_bytes());
        send_command(&mut tls_stream, &format!("AUTH XOAUTH2 {}\r\n", auth_base64))?;
        response = read_response(&mut tls_stream)?;

        if !response.starts_with("235") {
            // If we get 334, we need to send an empty response
            if response.starts_with("334") {
                send_command(&mut tls_stream, "\r\n")?;
                response = read_response(&mut tls_stream)?;
            }

            if !response.starts_with("235") {
                return Err(MailError::Smtp(format!("OAuth2 authentication failed: {}. Try removing and re-adding the account.", response)));
            }
        }

        log::info!("✓ SMTP OAuth2 authentication successful");

        // Send MAIL FROM
        send_command(&mut tls_stream, &format!("MAIL FROM:<{}>\r\n", from))?;
        response = read_response(&mut tls_stream)?;
        if !response.starts_with("250") {
            return Err(MailError::Smtp(format!("MAIL FROM failed: {}", response)));
        }

        // Send RCPT TO for all recipients
        for recipient in to.iter().chain(cc.iter()).chain(bcc.iter()) {
            send_command(&mut tls_stream, &format!("RCPT TO:<{}>\r\n", recipient))?;
            response = read_response(&mut tls_stream)?;
            if !response.starts_with("250") {
                return Err(MailError::Smtp(format!("RCPT TO failed for {}: {}", recipient, response)));
            }
        }

        // Send DATA
        send_command(&mut tls_stream, "DATA\r\n")?;
        response = read_response(&mut tls_stream)?;
        if !response.starts_with("354") {
            return Err(MailError::Smtp(format!("DATA failed: {}", response)));
        }

        // Build email message
        let mut email_data = String::new();
        email_data.push_str(&format!("From: {}\r\n", from));

        if !to.is_empty() {
            email_data.push_str(&format!("To: {}\r\n", to.join(", ")));
        }

        if !cc.is_empty() {
            email_data.push_str(&format!("Cc: {}\r\n", cc.join(", ")));
        }

        email_data.push_str(&format!("Subject: {}\r\n", subject));

        if is_html {
            email_data.push_str("Content-Type: text/html; charset=utf-8\r\n");
        } else {
            email_data.push_str("Content-Type: text/plain; charset=utf-8\r\n");
        }

        email_data.push_str("MIME-Version: 1.0\r\n");
        email_data.push_str("\r\n");
        email_data.push_str(&body);
        email_data.push_str("\r\n.\r\n");

        // Send email data
        send_command(&mut tls_stream, &email_data)?;
        response = read_response(&mut tls_stream)?;
        if !response.starts_with("250") {
            return Err(MailError::Smtp(format!("Send failed: {}", response)));
        }

        // Send QUIT
        send_command(&mut tls_stream, "QUIT\r\n")?;
        let _ = read_response(&mut tls_stream);

        log::info!("✓ Email sent successfully via OAuth2 SMTP");
        Ok(())
    })
    .await
    .map_err(|e| {
        log::error!("Spawn blocking join error: {}", e);
        MailError::Smtp(format!("Spawn blocking error: {}", e))
    })??; // First ? unwraps JoinError, second ? unwraps MailError

    Ok(())
}

/// Send SMTP command
fn send_command(stream: &mut native_tls::TlsStream<TcpStream>, command: &str) -> Result<(), MailError> {
    stream
        .write_all(command.as_bytes())
        .map_err(|e| MailError::Smtp(format!("Write error: {}", e)))?;
    stream
        .flush()
        .map_err(|e| MailError::Smtp(format!("Flush error: {}", e)))?;
    Ok(())
}

/// Read SMTP response
fn read_response(stream: &mut native_tls::TlsStream<TcpStream>) -> Result<String, MailError> {
    let mut buffer = [0u8; 4096];
    let n = stream
        .read(&mut buffer)
        .map_err(|e| MailError::Smtp(format!("Read error: {}", e)))?;

    let response = String::from_utf8_lossy(&buffer[..n]).to_string();
    log::debug!("SMTP Response: {}", response.trim());
    Ok(response)
}
