//! Mozilla ISPDB Auto-Configuration (Thunderbird-style)

use crate::mail::config::SecurityType;
use serde::{Deserialize, Serialize};

/// Auto-detected email configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoConfig {
    pub provider: Option<String>,
    pub display_name: Option<String>,
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_security: SecurityType,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: SecurityType,
}

/// Fetch auto-configuration for an email address
pub async fn fetch_autoconfig(email: &str) -> Result<AutoConfig, String> {
    let domain = email
        .split('@')
        .nth(1)
        .ok_or("Invalid email address")?
        .to_lowercase();

    // Try built-in presets first
    if let Some(config) = get_preset(&domain) {
        return Ok(config);
    }

    // Try Mozilla ISPDB
    if let Ok(config) = fetch_mozilla_ispdb(&domain).await {
        return Ok(config);
    }

    // Fallback: guess based on domain
    Ok(AutoConfig {
        provider: None,
        display_name: None,
        imap_host: format!("imap.{}", domain),
        imap_port: 993,
        imap_security: SecurityType::SSL,
        smtp_host: format!("smtp.{}", domain),
        smtp_port: 587,
        smtp_security: SecurityType::STARTTLS,
    })
}

/// Get preset configuration for known providers
fn get_preset(domain: &str) -> Option<AutoConfig> {
    match domain {
        // Gmail
        "gmail.com" | "googlemail.com" => Some(AutoConfig {
            provider: Some("Google".to_string()),
            display_name: None,
            imap_host: "imap.gmail.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
        }),

        // Outlook / Microsoft
        d if d.ends_with("outlook.com")
            || d.ends_with("hotmail.com")
            || d.ends_with("live.com") =>
        {
            Some(AutoConfig {
                provider: Some("Microsoft".to_string()),
                display_name: None,
                imap_host: "outlook.office365.com".to_string(),
                imap_port: 993,
                imap_security: SecurityType::SSL,
                smtp_host: "smtp.office365.com".to_string(),
                smtp_port: 587,
                smtp_security: SecurityType::STARTTLS,
            })
        }

        // Yahoo
        d if d.ends_with("yahoo.com") => Some(AutoConfig {
            provider: Some("Yahoo".to_string()),
            display_name: None,
            imap_host: "imap.mail.yahoo.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.mail.yahoo.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
        }),

        // iCloud
        "icloud.com" | "me.com" | "mac.com" => Some(AutoConfig {
            provider: Some("Apple iCloud".to_string()),
            display_name: None,
            imap_host: "imap.mail.me.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.mail.me.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
        }),

        // Yandex
        d if d.ends_with("yandex.com") || d.ends_with("yandex.ru") => Some(AutoConfig {
            provider: Some("Yandex".to_string()),
            display_name: None,
            imap_host: "imap.yandex.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.yandex.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
        }),

        _ => None,
    }
}

/// Fetch configuration from Mozilla ISPDB
async fn fetch_mozilla_ispdb(domain: &str) -> Result<AutoConfig, String> {
    let url = format!("https://autoconfig.thunderbird.net/v1.1/{}", domain);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Configuration not found".to_string());
    }

    let xml = response.text().await.map_err(|e| e.to_string())?;
    parse_autoconfig_xml(&xml)
}

/// Parse Mozilla autoconfig XML
fn parse_autoconfig_xml(xml: &str) -> Result<AutoConfig, String> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    reader.trim_text(true);

    let mut config = AutoConfig {
        provider: None,
        display_name: None,
        imap_host: String::new(),
        imap_port: 993,
        imap_security: SecurityType::SSL,
        smtp_host: String::new(),
        smtp_port: 587,
        smtp_security: SecurityType::STARTTLS,
    };

    let mut current_server_type = String::new();
    let mut current_element = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_element = name.clone();

                if name == "incomingServer" || name == "outgoingServer" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"type" {
                            current_server_type =
                                String::from_utf8_lossy(&attr.value).to_string();
                        }
                    }
                }
            }
            Ok(Event::Text(e)) => {
                let text = e.unescape().map(|s| s.to_string()).unwrap_or_default();

                match current_element.as_str() {
                    "displayName" => config.provider = Some(text),
                    "hostname" => {
                        if current_server_type == "imap" {
                            config.imap_host = text;
                        } else if current_server_type == "smtp" {
                            config.smtp_host = text;
                        }
                    }
                    "port" => {
                        if let Ok(port) = text.parse::<u16>() {
                            if current_server_type == "imap" {
                                config.imap_port = port;
                            } else if current_server_type == "smtp" {
                                config.smtp_port = port;
                            }
                        }
                    }
                    "socketType" => {
                        let security = match text.to_uppercase().as_str() {
                            "SSL" | "TLS" => SecurityType::SSL,
                            "STARTTLS" => SecurityType::STARTTLS,
                            _ => SecurityType::NONE,
                        };
                        if current_server_type == "imap" {
                            config.imap_security = security;
                        } else if current_server_type == "smtp" {
                            config.smtp_security = security;
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(_)) => current_element.clear(),
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML parse error: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    if config.imap_host.is_empty() || config.smtp_host.is_empty() {
        return Err("Incomplete configuration".to_string());
    }

    Ok(config)
}
