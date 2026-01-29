//! Mozilla ISPDB Auto-Configuration (Thunderbird-style)
//!
//! Implements the full Thunderbird autoconfiguration mechanism:
//! 1. Built-in presets for major providers
//! 2. ISP's own autoconfig server (autoconfig.domain.com)
//! 3. Well-known URL (domain.com/.well-known/autoconfig/)
//! 4. Mozilla ISPDB central database
//! 5. MX record lookup → find provider from MX host
//! 6. Smart guessing with connection testing

use crate::mail::config::SecurityType;
use hickory_resolver::config::{ResolverConfig, ResolverOpts};
use hickory_resolver::TokioAsyncResolver;
use serde::{Deserialize, Serialize};
use std::net::TcpStream;
use std::time::Duration;

/// Auto-detected email configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoConfig {
    pub provider: Option<String>,
    pub display_name: Option<String>,
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_security: SecurityType,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: SecurityType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detection_method: Option<String>,
}

/// Fetch auto-configuration for an email address
/// Tries multiple methods in order (like Thunderbird)
pub async fn fetch_autoconfig(email: &str) -> Result<AutoConfig, String> {
    let domain = email
        .split('@')
        .nth(1)
        .ok_or("Invalid email address")?
        .to_lowercase();

    log::info!("Starting autoconfig for domain: {}", domain);

    // 1. Try built-in presets first (fastest)
    if let Some(mut config) = get_preset(&domain) {
        config.detection_method = Some("preset".to_string());
        log::info!("Found preset config for {}", domain);
        return Ok(config);
    }

    // 2. Try ISP's own autoconfig server
    if let Ok(mut config) = fetch_isp_autoconfig(&domain).await {
        config.detection_method = Some("isp-autoconfig".to_string());
        log::info!("Found ISP autoconfig for {}", domain);
        return Ok(config);
    }

    // 3. Try well-known autoconfig URL
    if let Ok(mut config) = fetch_wellknown_autoconfig(&domain).await {
        config.detection_method = Some("well-known".to_string());
        log::info!("Found well-known autoconfig for {}", domain);
        return Ok(config);
    }

    // 4. Try Mozilla ISPDB
    if let Ok(mut config) = fetch_mozilla_ispdb(&domain).await {
        config.detection_method = Some("ispdb".to_string());
        log::info!("Found ISPDB config for {}", domain);
        return Ok(config);
    }

    // 5. Try MX record lookup
    if let Ok(mut config) = fetch_via_mx_lookup(&domain).await {
        config.detection_method = Some("mx-lookup".to_string());
        log::info!("Found config via MX lookup for {}", domain);
        return Ok(config);
    }

    // 6. Smart guessing with connection testing
    if let Ok(mut config) = guess_and_test_config(&domain).await {
        config.detection_method = Some("guessed".to_string());
        log::info!("Guessed and verified config for {}", domain);
        return Ok(config);
    }

    // Last resort: return best guess without verification
    log::warn!("No verified config found for {}, returning unverified guess", domain);
    Ok(AutoConfig {
        provider: None,
        display_name: None,
        imap_host: format!("mail.{}", domain),
        imap_port: 993,
        imap_security: SecurityType::SSL,
        smtp_host: format!("mail.{}", domain),
        smtp_port: 587,
        smtp_security: SecurityType::STARTTLS,
        detection_method: Some("unverified-guess".to_string()),
    })
}

/// Get preset configuration for known providers
fn get_preset(domain: &str) -> Option<AutoConfig> {
    match domain {
        // Gmail
        "gmail.com" | "googlemail.com" => Some(AutoConfig {
            provider: Some("Google".to_string()),
            display_name: Some("Gmail".to_string()),
            imap_host: "imap.gmail.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        }),

        // Outlook / Microsoft
        d if d == "outlook.com"
            || d == "hotmail.com"
            || d == "live.com"
            || d == "msn.com"
            || d.ends_with(".outlook.com")
            || d.ends_with(".hotmail.com")
            || d.ends_with(".live.com") =>
        {
            Some(AutoConfig {
                provider: Some("Microsoft".to_string()),
                display_name: Some("Outlook".to_string()),
                imap_host: "outlook.office365.com".to_string(),
                imap_port: 993,
                imap_security: SecurityType::SSL,
                smtp_host: "smtp.office365.com".to_string(),
                smtp_port: 587,
                smtp_security: SecurityType::STARTTLS,
                detection_method: None,
            })
        }

        // Yahoo
        d if d == "yahoo.com"
            || d.ends_with(".yahoo.com")
            || d == "ymail.com"
            || d == "rocketmail.com" =>
        {
            Some(AutoConfig {
                provider: Some("Yahoo".to_string()),
                display_name: Some("Yahoo Mail".to_string()),
                imap_host: "imap.mail.yahoo.com".to_string(),
                imap_port: 993,
                imap_security: SecurityType::SSL,
                smtp_host: "smtp.mail.yahoo.com".to_string(),
                smtp_port: 465,
                smtp_security: SecurityType::SSL,
                detection_method: None,
            })
        }

        // iCloud / Apple
        "icloud.com" | "me.com" | "mac.com" => Some(AutoConfig {
            provider: Some("Apple iCloud".to_string()),
            display_name: Some("iCloud".to_string()),
            imap_host: "imap.mail.me.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.mail.me.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        }),

        // Yandex
        d if d == "yandex.com"
            || d == "yandex.ru"
            || d == "yandex.ua"
            || d == "yandex.by"
            || d == "yandex.kz"
            || d == "ya.ru" =>
        {
            Some(AutoConfig {
                provider: Some("Yandex".to_string()),
                display_name: Some("Yandex Mail".to_string()),
                imap_host: "imap.yandex.com".to_string(),
                imap_port: 993,
                imap_security: SecurityType::SSL,
                smtp_host: "smtp.yandex.com".to_string(),
                smtp_port: 465,
                smtp_security: SecurityType::SSL,
                detection_method: None,
            })
        }

        // ProtonMail (via Bridge)
        "protonmail.com" | "proton.me" | "pm.me" => Some(AutoConfig {
            provider: Some("ProtonMail".to_string()),
            display_name: Some("ProtonMail (Bridge)".to_string()),
            imap_host: "127.0.0.1".to_string(),
            imap_port: 1143,
            imap_security: SecurityType::STARTTLS,
            smtp_host: "127.0.0.1".to_string(),
            smtp_port: 1025,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        }),

        // Zoho Mail
        d if d == "zoho.com" || d == "zohomail.com" => Some(AutoConfig {
            provider: Some("Zoho".to_string()),
            display_name: Some("Zoho Mail".to_string()),
            imap_host: "imap.zoho.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.zoho.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        }),

        // GMX
        d if d == "gmx.com" || d == "gmx.net" || d == "gmx.de" => Some(AutoConfig {
            provider: Some("GMX".to_string()),
            display_name: Some("GMX".to_string()),
            imap_host: "imap.gmx.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "mail.gmx.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        }),

        // AOL
        "aol.com" => Some(AutoConfig {
            provider: Some("AOL".to_string()),
            display_name: Some("AOL Mail".to_string()),
            imap_host: "imap.aol.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.aol.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        }),

        // Mail.com
        "mail.com" => Some(AutoConfig {
            provider: Some("Mail.com".to_string()),
            display_name: Some("Mail.com".to_string()),
            imap_host: "imap.mail.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.mail.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        }),

        // Fastmail
        "fastmail.com" | "fastmail.fm" => Some(AutoConfig {
            provider: Some("Fastmail".to_string()),
            display_name: Some("Fastmail".to_string()),
            imap_host: "imap.fastmail.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.fastmail.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        }),

        _ => None,
    }
}

/// Fetch from ISP's own autoconfig server
/// Tries: https://autoconfig.{domain}/mail/config-v1.1.xml
async fn fetch_isp_autoconfig(domain: &str) -> Result<AutoConfig, String> {
    let urls = [
        format!(
            "https://autoconfig.{}/mail/config-v1.1.xml",
            domain
        ),
        format!(
            "http://autoconfig.{}/mail/config-v1.1.xml",
            domain
        ),
    ];

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| e.to_string())?;

    for url in &urls {
        log::debug!("Trying ISP autoconfig: {}", url);
        if let Ok(response) = client.get(url).send().await {
            if response.status().is_success() {
                if let Ok(xml) = response.text().await {
                    if let Ok(config) = parse_autoconfig_xml(&xml) {
                        return Ok(config);
                    }
                }
            }
        }
    }

    Err("ISP autoconfig not found".to_string())
}

/// Fetch from well-known autoconfig URL
/// Tries: https://{domain}/.well-known/autoconfig/mail/config-v1.1.xml
async fn fetch_wellknown_autoconfig(domain: &str) -> Result<AutoConfig, String> {
    let urls = [
        format!(
            "https://{}/.well-known/autoconfig/mail/config-v1.1.xml",
            domain
        ),
        format!(
            "http://{}/.well-known/autoconfig/mail/config-v1.1.xml",
            domain
        ),
    ];

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    for url in &urls {
        log::debug!("Trying well-known autoconfig: {}", url);
        if let Ok(response) = client.get(url).send().await {
            if response.status().is_success() {
                if let Ok(xml) = response.text().await {
                    if let Ok(config) = parse_autoconfig_xml(&xml) {
                        return Ok(config);
                    }
                }
            }
        }
    }

    Err("Well-known autoconfig not found".to_string())
}

/// Fetch configuration from Mozilla ISPDB
async fn fetch_mozilla_ispdb(domain: &str) -> Result<AutoConfig, String> {
    let url = format!("https://autoconfig.thunderbird.net/v1.1/{}", domain);
    log::debug!("Trying Mozilla ISPDB: {}", url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Configuration not found in ISPDB".to_string());
    }

    let xml = response.text().await.map_err(|e| e.to_string())?;
    parse_autoconfig_xml(&xml)
}

/// Lookup MX records and try to find provider
async fn fetch_via_mx_lookup(domain: &str) -> Result<AutoConfig, String> {
    log::debug!("Performing MX lookup for {}", domain);

    let resolver = TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());

    let mx_lookup = resolver
        .mx_lookup(domain)
        .await
        .map_err(|e| format!("MX lookup failed: {}", e))?;

    for mx in mx_lookup.iter() {
        let mx_host = mx.exchange().to_string().trim_end_matches('.').to_lowercase();
        log::debug!("Found MX record: {}", mx_host);

        // Extract the main domain from MX host
        // e.g., mx1.mail.google.com -> google.com
        //       mail.protection.outlook.com -> outlook.com
        let mx_parts: Vec<&str> = mx_host.split('.').collect();
        if mx_parts.len() >= 2 {
            let mx_domain = format!(
                "{}.{}",
                mx_parts[mx_parts.len() - 2],
                mx_parts[mx_parts.len() - 1]
            );

            // Check known hosting providers by MX pattern
            // Pass the original user domain for mail server construction
            if let Some(config) = get_config_from_mx_host(&mx_host, domain) {
                return Ok(config);
            }

            // Try ISPDB with the MX domain
            if let Ok(config) = fetch_mozilla_ispdb(&mx_domain).await {
                return Ok(config);
            }
        }
    }

    Err("Could not determine provider from MX records".to_string())
}

/// Get configuration based on MX host pattern
fn get_config_from_mx_host(mx_host: &str, user_domain: &str) -> Option<AutoConfig> {
    // Google / G Suite / Google Workspace
    if mx_host.contains("google.com") || mx_host.contains("googlemail.com") {
        return Some(AutoConfig {
            provider: Some("Google Workspace".to_string()),
            display_name: None,
            imap_host: "imap.gmail.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.gmail.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    // Microsoft 365 / Office 365
    if mx_host.contains("outlook.com")
        || mx_host.contains("protection.outlook.com")
        || mx_host.contains("mail.protection.outlook.com")
    {
        return Some(AutoConfig {
            provider: Some("Microsoft 365".to_string()),
            display_name: None,
            imap_host: "outlook.office365.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.office365.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    // Zoho
    if mx_host.contains("zoho.com") || mx_host.contains("zoho.eu") {
        return Some(AutoConfig {
            provider: Some("Zoho Mail".to_string()),
            display_name: None,
            imap_host: "imap.zoho.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.zoho.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // ProtonMail
    if mx_host.contains("protonmail.ch") || mx_host.contains("proton.ch") {
        return Some(AutoConfig {
            provider: Some("ProtonMail".to_string()),
            display_name: Some("ProtonMail (Bridge required)".to_string()),
            imap_host: "127.0.0.1".to_string(),
            imap_port: 1143,
            imap_security: SecurityType::STARTTLS,
            smtp_host: "127.0.0.1".to_string(),
            smtp_port: 1025,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    // Fastmail
    if mx_host.contains("fastmail.com") || mx_host.contains("messagingengine.com") {
        return Some(AutoConfig {
            provider: Some("Fastmail".to_string()),
            display_name: None,
            imap_host: "imap.fastmail.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.fastmail.com".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    // Yandex
    if mx_host.contains("yandex.ru") || mx_host.contains("yandex.net") {
        return Some(AutoConfig {
            provider: Some("Yandex".to_string()),
            display_name: None,
            imap_host: "imap.yandex.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.yandex.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // Mail.ru
    if mx_host.contains("mail.ru") {
        return Some(AutoConfig {
            provider: Some("Mail.ru".to_string()),
            display_name: None,
            imap_host: "imap.mail.ru".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.mail.ru".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // OVH
    if mx_host.contains("ovh.net") || mx_host.contains("ovh.com") {
        return Some(AutoConfig {
            provider: Some("OVH".to_string()),
            display_name: None,
            imap_host: "ssl0.ovh.net".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "ssl0.ovh.net".to_string(),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    // Hostinger
    if mx_host.contains("hostinger") {
        return Some(AutoConfig {
            provider: Some("Hostinger".to_string()),
            display_name: None,
            imap_host: "imap.hostinger.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.hostinger.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // GoDaddy
    if mx_host.contains("secureserver.net") {
        return Some(AutoConfig {
            provider: Some("GoDaddy".to_string()),
            display_name: None,
            imap_host: "imap.secureserver.net".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtpout.secureserver.net".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // Namecheap / Privateemail
    if mx_host.contains("privateemail.com") {
        return Some(AutoConfig {
            provider: Some("Namecheap".to_string()),
            display_name: None,
            imap_host: "mail.privateemail.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "mail.privateemail.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // Titan (commonly used by domain registrars)
    if mx_host.contains("titan.email") {
        return Some(AutoConfig {
            provider: Some("Titan".to_string()),
            display_name: None,
            imap_host: "imap.titan.email".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "smtp.titan.email".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // Natro (Turkish hosting provider) - uses shared mail server
    if mx_host.contains("natrohost.com") || mx_host.contains("natro.com") {
        return Some(AutoConfig {
            provider: Some("Natro".to_string()),
            display_name: None,
            imap_host: "mail.kurumsaleposta.com".to_string(),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: "mail.kurumsaleposta.com".to_string(),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // Turhost (Turkish hosting)
    if mx_host.contains("turhost.com") {
        return Some(AutoConfig {
            provider: Some("Turhost".to_string()),
            display_name: None,
            imap_host: format!("mail.{}", user_domain),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: format!("mail.{}", user_domain),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // Radore (Turkish hosting)
    if mx_host.contains("radore.com") {
        return Some(AutoConfig {
            provider: Some("Radore".to_string()),
            display_name: None,
            imap_host: format!("mail.{}", user_domain),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: format!("mail.{}", user_domain),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    // Guzel.net.tr (Turkish hosting)
    if mx_host.contains("guzel.net.tr") {
        return Some(AutoConfig {
            provider: Some("Guzel Hosting".to_string()),
            display_name: None,
            imap_host: format!("mail.{}", user_domain),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: format!("mail.{}", user_domain),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    // Isimtescil (Turkish domain registrar with hosting)
    if mx_host.contains("isimtescil.net") {
        return Some(AutoConfig {
            provider: Some("İsimtescil".to_string()),
            display_name: None,
            imap_host: format!("mail.{}", user_domain),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: format!("mail.{}", user_domain),
            smtp_port: 465,
            smtp_security: SecurityType::SSL,
            detection_method: None,
        });
    }

    // Generic cPanel/Plesk hosting (common patterns)
    if mx_host.starts_with("mail.") || mx_host.starts_with("mx.") {
        return Some(AutoConfig {
            provider: Some("Generic Hosting".to_string()),
            display_name: None,
            imap_host: format!("mail.{}", user_domain),
            imap_port: 993,
            imap_security: SecurityType::SSL,
            smtp_host: format!("mail.{}", user_domain),
            smtp_port: 587,
            smtp_security: SecurityType::STARTTLS,
            detection_method: None,
        });
    }

    None
}

/// Smart guessing with connection testing
async fn guess_and_test_config(domain: &str) -> Result<AutoConfig, String> {
    log::debug!("Starting smart guess for {}", domain);

    // Common server name patterns to try
    let imap_candidates = [
        (format!("imap.{}", domain), 993, SecurityType::SSL),
        (format!("mail.{}", domain), 993, SecurityType::SSL),
        (format!("imap.{}", domain), 143, SecurityType::STARTTLS),
        (format!("mail.{}", domain), 143, SecurityType::STARTTLS),
        (domain.to_string(), 993, SecurityType::SSL),
        (format!("mx.{}", domain), 993, SecurityType::SSL),
        (format!("email.{}", domain), 993, SecurityType::SSL),
        (format!("pop.{}", domain), 993, SecurityType::SSL), // some hosts use pop for imap too
    ];

    let smtp_candidates = [
        (format!("smtp.{}", domain), 587, SecurityType::STARTTLS),
        (format!("mail.{}", domain), 587, SecurityType::STARTTLS),
        (format!("smtp.{}", domain), 465, SecurityType::SSL),
        (format!("mail.{}", domain), 465, SecurityType::SSL),
        (domain.to_string(), 587, SecurityType::STARTTLS),
        (format!("smtp.{}", domain), 25, SecurityType::STARTTLS),
        (format!("mx.{}", domain), 587, SecurityType::STARTTLS),
        (format!("email.{}", domain), 587, SecurityType::STARTTLS),
        (format!("outgoing.{}", domain), 587, SecurityType::STARTTLS),
    ];

    // Find working IMAP server
    let mut imap_config = None;
    for (host, port, security) in &imap_candidates {
        if test_tcp_connection(host, *port).await {
            log::info!("Found working IMAP: {}:{}", host, port);
            imap_config = Some((host.clone(), *port, security.clone()));
            break;
        }
    }

    // Find working SMTP server
    let mut smtp_config = None;
    for (host, port, security) in &smtp_candidates {
        if test_tcp_connection(host, *port).await {
            log::info!("Found working SMTP: {}:{}", host, port);
            smtp_config = Some((host.clone(), *port, security.clone()));
            break;
        }
    }

    match (imap_config, smtp_config) {
        (Some((imap_host, imap_port, imap_security)), Some((smtp_host, smtp_port, smtp_security))) => {
            Ok(AutoConfig {
                provider: None,
                display_name: None,
                imap_host,
                imap_port,
                imap_security,
                smtp_host,
                smtp_port,
                smtp_security,
                detection_method: None,
            })
        }
        (Some((imap_host, imap_port, imap_security)), None) => {
            // Found IMAP but not SMTP, use same host for SMTP
            Ok(AutoConfig {
                provider: None,
                display_name: None,
                imap_host: imap_host.clone(),
                imap_port,
                imap_security,
                smtp_host: imap_host.replace("imap.", "smtp."),
                smtp_port: 587,
                smtp_security: SecurityType::STARTTLS,
                detection_method: None,
            })
        }
        _ => Err("Could not find working mail servers".to_string()),
    }
}

/// Test if a TCP connection can be established
async fn test_tcp_connection(host: &str, port: u16) -> bool {
    let addr = format!("{}:{}", host, port);
    log::debug!("Testing connection to {}", addr);

    // Use tokio's timeout with blocking DNS resolution
    let result = tokio::time::timeout(Duration::from_secs(3), async {
        tokio::task::spawn_blocking(move || {
            TcpStream::connect_timeout(
                &addr.parse().unwrap_or_else(|_| {
                    // If direct parse fails, try DNS resolution
                    use std::net::ToSocketAddrs;
                    addr.to_socket_addrs()
                        .ok()
                        .and_then(|mut addrs| addrs.next())
                        .unwrap_or_else(|| "0.0.0.0:0".parse().unwrap())
                }),
                Duration::from_secs(2),
            )
            .is_ok()
        })
        .await
        .unwrap_or(false)
    })
    .await;

    result.unwrap_or(false)
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
        detection_method: None,
    };

    let mut current_server_type = String::new();
    let mut current_element = String::new();
    let mut buf = Vec::new();
    let mut found_imap = false;
    let mut found_smtp = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_element = name.clone();

                if name == "incomingServer" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"type" {
                            let server_type = String::from_utf8_lossy(&attr.value).to_string();
                            // Prefer IMAP over POP3
                            if server_type == "imap" || (!found_imap && server_type == "pop3") {
                                current_server_type = "imap".to_string();
                                if server_type == "imap" {
                                    found_imap = true;
                                }
                            }
                        }
                    }
                } else if name == "outgoingServer" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"type" {
                            let server_type = String::from_utf8_lossy(&attr.value).to_string();
                            if server_type == "smtp" && !found_smtp {
                                current_server_type = "smtp".to_string();
                                found_smtp = true;
                            }
                        }
                    }
                }
            }
            Ok(Event::Text(e)) => {
                let text = e.unescape().map(|s| s.to_string()).unwrap_or_default();

                match current_element.as_str() {
                    "displayName" | "displayShortName" => {
                        if config.provider.is_none() {
                            config.provider = Some(text);
                        }
                    }
                    "hostname" => {
                        if current_server_type == "imap" && config.imap_host.is_empty() {
                            config.imap_host = text;
                        } else if current_server_type == "smtp" && config.smtp_host.is_empty() {
                            config.smtp_host = text;
                        }
                    }
                    "port" => {
                        if let Ok(port) = text.parse::<u16>() {
                            if current_server_type == "imap" && config.imap_host.len() > 0 {
                                config.imap_port = port;
                            } else if current_server_type == "smtp" && config.smtp_host.len() > 0 {
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
            Ok(Event::End(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if name == "incomingServer" || name == "outgoingServer" {
                    current_server_type.clear();
                }
                current_element.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML parse error: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    if config.imap_host.is_empty() || config.smtp_host.is_empty() {
        return Err("Incomplete configuration in XML".to_string());
    }

    Ok(config)
}
