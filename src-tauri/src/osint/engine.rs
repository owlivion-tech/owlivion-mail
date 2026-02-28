use crate::db::{CompanyEmail, Database, OsintProfile};
use super::claude::ClaudeClient;
use super::docker::DockerClient;
use super::exclusion;
use serde_json;
use std::sync::Arc;

pub struct OsintEngine {
    db: Arc<Database>,
    docker: DockerClient,
    claude_api_key: Option<String>,
}

impl OsintEngine {
    pub fn new(db: Arc<Database>, container: &str, claude_api_key: Option<String>) -> Self {
        Self {
            db,
            docker: DockerClient::new(container),
            claude_api_key,
        }
    }

    /// Harvest OSINT data for an email sender
    pub async fn harvest_sender(
        &self,
        email: &str,
        raw_headers: Option<&str>,
    ) -> Result<OsintProfile, String> {
        let email_lower = email.to_lowercase();
        let domain = email_lower
            .split('@')
            .nth(1)
            .ok_or("Invalid email format")?
            .to_string();

        // Check cache first
        if let Ok(Some(cached)) = self.db.osint_get_profile(&email_lower) {
            if cached.harvest_status == "completed" || cached.harvest_status == "excluded" {
                return Ok(cached);
            }
        }

        // Check exclusion
        if exclusion::is_excluded(&self.db, &email_lower, raw_headers) {
            let excluded_profile = OsintProfile {
                id: 0,
                email: email_lower.clone(),
                domain: domain.clone(),
                person_name: None,
                job_title: None,
                company: None,
                location: None,
                social_profiles: "{}".to_string(),
                company_industry: None,
                company_size: None,
                company_website: None,
                company_tech_stack: "[]".to_string(),
                raw_data: "{}".to_string(),
                ai_analysis: None,
                confidence_score: 0,
                harvest_status: "excluded".to_string(),
                error_message: None,
                created_at: String::new(),
                updated_at: String::new(),
            };
            let _ = self.db.osint_upsert_profile(&excluded_profile);
            return Ok(excluded_profile);
        }

        // Set status to harvesting
        let mut profile = OsintProfile {
            id: 0,
            email: email_lower.clone(),
            domain: domain.clone(),
            person_name: None,
            job_title: None,
            company: None,
            location: None,
            social_profiles: "{}".to_string(),
            company_industry: None,
            company_size: None,
            company_website: None,
            company_tech_stack: "[]".to_string(),
            raw_data: "{}".to_string(),
            ai_analysis: None,
            confidence_score: 0,
            harvest_status: "harvesting".to_string(),
            error_message: None,
            created_at: String::new(),
            updated_at: String::new(),
        };
        let _ = self.db.osint_upsert_profile(&profile);

        // Collect raw data from Docker tools
        let mut raw_data = serde_json::Map::new();

        if self.docker.is_available().await {
            // Run recon tools in parallel
            let (recon_result, social_result, whatweb_result) = tokio::join!(
                self.docker.osint_recon(&domain),
                self.docker.social_check(&email_lower),
                self.docker.whatweb(&domain)
            );

            if recon_result.success {
                raw_data.insert(
                    "recon".to_string(),
                    serde_json::Value::String(recon_result.output),
                );
            }
            if social_result.success {
                raw_data.insert(
                    "social".to_string(),
                    serde_json::Value::String(social_result.output),
                );
            }
            if whatweb_result.success {
                raw_data.insert(
                    "whatweb".to_string(),
                    serde_json::Value::String(whatweb_result.output),
                );
            }
        }

        let raw_data_str = serde_json::to_string(&raw_data).unwrap_or_else(|_| "{}".to_string());
        profile.raw_data = raw_data_str.clone();

        // AI analysis if Claude API key is available
        if let Some(ref api_key) = self.claude_api_key {
            if !api_key.is_empty() {
                let claude = ClaudeClient::new(api_key);
                match claude.analyze_sender_osint(&email_lower, &raw_data_str).await {
                    Ok(analysis) => {
                        // Parse AI response to fill profile fields
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&analysis) {
                            profile.person_name = parsed["person_name"].as_str().map(|s| s.to_string());
                            profile.job_title = parsed["job_title"].as_str().map(|s| s.to_string());
                            profile.company = parsed["company"].as_str().map(|s| s.to_string());
                            profile.location = parsed["location"].as_str().map(|s| s.to_string());
                            profile.company_industry = parsed["company_industry"].as_str().map(|s| s.to_string());
                            profile.company_size = parsed["company_size"].as_str().map(|s| s.to_string());
                            profile.company_website = parsed["company_website"].as_str().map(|s| s.to_string());

                            if let Some(social) = parsed.get("social_profiles") {
                                profile.social_profiles = serde_json::to_string(social)
                                    .unwrap_or_else(|_| "{}".to_string());
                            }

                            if let Some(score) = parsed["confidence_score"].as_i64() {
                                profile.confidence_score = score.clamp(0, 100) as i32;
                            }
                        }
                        profile.ai_analysis = Some(analysis);
                    }
                    Err(e) => {
                        log::warn!("Claude OSINT analysis failed: {}", e);
                        profile.error_message = Some(format!("AI analysis failed: {}", e));
                    }
                }
            }
        }

        profile.harvest_status = "completed".to_string();
        let _ = self.db.osint_upsert_profile(&profile);

        Ok(profile)
    }

    /// Harvest company emails from a domain using deep OSINT
    pub async fn harvest_company_emails(
        &self,
        domain: &str,
    ) -> Result<Vec<CompanyEmail>, String> {
        // Check cache
        if let Ok(cached) = self.db.osint_get_company_emails(domain) {
            if !cached.is_empty() {
                return Ok(cached);
            }
        }

        let mut discovered_emails: Vec<String> = Vec::new();
        let mut subdomains: Vec<String> = Vec::new();
        let mut intel_context = String::new();

        // Use Docker for deep email harvesting
        if self.docker.is_available().await {
            let harvest_result = self.docker.email_harvest(domain, 200).await;
            if harvest_result.success {
                let output = &harvest_result.output;

                // Helper: extract emails from a section between two markers
                let extract_emails_from_section = |start_marker: &str, end_markers: &[&str]| -> Vec<String> {
                    let mut emails = Vec::new();
                    if let Some(start) = output.find(start_marker) {
                        let section = &output[start..];
                        let end = end_markers.iter()
                            .filter_map(|m| section.find(m))
                            .min()
                            .unwrap_or(section.len());
                        for line in section[..end].lines().skip(1) {
                            let trimmed = line.trim();
                            if trimmed.contains('@') && trimmed.contains('.') && trimmed.len() <= 254 {
                                let cleaned = trimmed.trim_matches(|c: char| !c.is_alphanumeric() && c != '@' && c != '.' && c != '-' && c != '_' && c != '+');
                                if cleaned.contains('@') {
                                    emails.push(cleaned.to_lowercase());
                                }
                            }
                        }
                    }
                    emails
                };

                // Parse all email sections
                let end_markers_web = &["=== DEEP_CRAWL_EMAILS ===", "=== CRT_SH_JSON ==="];
                discovered_emails.extend(extract_emails_from_section("=== WEBSITE_EMAILS ===", end_markers_web));

                let end_markers_crawl = &["=== CRT_SH_JSON ==="];
                discovered_emails.extend(extract_emails_from_section("=== DEEP_CRAWL_EMAILS ===", end_markers_crawl));

                let end_markers_sub = &["=== DNS_INTEL ==="];
                discovered_emails.extend(extract_emails_from_section("=== SUBDOMAIN_EMAILS ===", end_markers_sub));

                let end_markers_th: &[&str] = &[];
                discovered_emails.extend(extract_emails_from_section("=== THEHARVESTER ===", end_markers_th));

                // Parse CRT_SH_JSON for subdomains
                if let Some(crt_start) = output.find("=== CRT_SH_JSON ===") {
                    let crt_section = &output[crt_start..];
                    let crt_end = crt_section.find("=== SUBDOMAIN_EMAILS ===").unwrap_or(crt_section.len());
                    let json_str = crt_section["=== CRT_SH_JSON ===".len()..crt_end].trim();
                    if let Ok(certs) = serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
                        for cert in &certs {
                            if let Some(name_value) = cert["name_value"].as_str() {
                                for name in name_value.lines() {
                                    let name = name.trim().trim_start_matches("*.");
                                    if !name.is_empty() && name.contains('.') && !subdomains.contains(&name.to_string()) {
                                        subdomains.push(name.to_string());
                                    }
                                }
                            }
                        }
                    }
                }

                // Collect DNS/WHOIS/SMTP intelligence for AI context
                for section_name in &["DNS_INTEL", "WHOIS_INFO", "SMTP_RECON"] {
                    let marker = format!("=== {} ===", section_name);
                    if let Some(start) = output.find(&marker) {
                        let section = &output[start..];
                        let next_marker = section[marker.len()..].find("=== ").map(|p| p + marker.len()).unwrap_or(section.len());
                        let content = section[..next_marker].trim();
                        if !content.is_empty() {
                            intel_context.push_str(content);
                            intel_context.push('\n');
                        }
                    }
                }

                // Extract emails from WHOIS section too
                if let Some(whois_start) = output.find("=== WHOIS_INFO ===") {
                    let whois_section = &output[whois_start..];
                    let whois_end = whois_section.find("=== SMTP_RECON ===").unwrap_or(whois_section.len());
                    for line in whois_section[..whois_end].lines() {
                        if line.contains('@') {
                            // Extract email from line like "Registrant Email: foo@bar.com"
                            let after_colon = line.split(':').last().unwrap_or("").trim();
                            if after_colon.contains('@') && after_colon.contains('.') && after_colon.len() <= 254 {
                                let cleaned = after_colon.trim_matches(|c: char| !c.is_alphanumeric() && c != '@' && c != '.' && c != '-' && c != '_');
                                if cleaned.contains('@') && !cleaned.is_empty() {
                                    discovered_emails.push(cleaned.to_lowercase());
                                }
                            }
                        }
                    }
                }
            }
        }

        // Deduplicate
        discovered_emails.sort();
        discovered_emails.dedup();

        // Always use Claude to discover additional emails when we have context
        if let Some(ref api_key) = self.claude_api_key {
            if !api_key.is_empty() {
                let claude = ClaudeClient::new(api_key);
                let context = format!(
                    "Domain: {}\nSubdomains (crt.sh): {}\nEmails found so far: {}\n\n{}",
                    domain,
                    if subdomains.is_empty() { "none".to_string() } else { subdomains.join(", ") },
                    if discovered_emails.is_empty() { "none".to_string() } else { discovered_emails.join(", ") },
                    intel_context
                );
                match claude.discover_emails(domain, &context).await {
                    Ok(emails_json) => {
                        if let Ok(emails) = serde_json::from_str::<Vec<serde_json::Value>>(&emails_json) {
                            for item in &emails {
                                if let Some(email) = item["email"].as_str() {
                                    let email_lower = email.to_lowercase();
                                    if email_lower.contains('@') && email_lower.contains('.') && !discovered_emails.contains(&email_lower) {
                                        discovered_emails.push(email_lower);
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("Claude email discovery failed: {}", e);
                    }
                }
            }
        }

        // Final deduplicate
        discovered_emails.sort();
        discovered_emails.dedup();

        if discovered_emails.is_empty() {
            return Ok(Vec::new());
        }

        // AI classification
        let mut company_emails: Vec<CompanyEmail> = Vec::new();

        if let Some(ref api_key) = self.claude_api_key {
            if !api_key.is_empty() {
                let claude = ClaudeClient::new(api_key);
                match claude
                    .identify_important_people(domain, &discovered_emails)
                    .await
                {
                    Ok(analysis) => {
                        if let Ok(parsed) = serde_json::from_str::<Vec<serde_json::Value>>(&analysis) {
                            for item in &parsed {
                                let email = item["email"].as_str().unwrap_or("").to_string();
                                if email.is_empty() {
                                    continue;
                                }

                                let importance = match item["importance"].as_str().unwrap_or("normal") {
                                    "vip" => "vip",
                                    "high" => "high",
                                    "low" => "low",
                                    _ => "normal",
                                };

                                let ce = CompanyEmail {
                                    id: 0,
                                    domain: domain.to_string(),
                                    email,
                                    name: item["estimated_name"].as_str().map(|s| s.to_string()),
                                    job_title: item["estimated_title"].as_str().map(|s| s.to_string()),
                                    source: Some("deep-harvest+AI".to_string()),
                                    importance: importance.to_string(),
                                    importance_reason: item["reason"].as_str().map(|s| s.to_string()),
                                    is_auto_starred: importance == "vip" || importance == "high",
                                    created_at: String::new(),
                                };
                                let _ = self.db.osint_upsert_company_email(&ce);
                                company_emails.push(ce);
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("Claude classification failed: {}", e);
                    }
                }
            }
        }

        // Fallback: store raw emails with heuristic importance
        if company_emails.is_empty() {
            for email in &discovered_emails {
                let importance = guess_importance_from_email(email);
                let ce = CompanyEmail {
                    id: 0,
                    domain: domain.to_string(),
                    email: email.clone(),
                    name: None,
                    job_title: None,
                    source: Some("deep-harvest".to_string()),
                    importance: importance.to_string(),
                    importance_reason: None,
                    is_auto_starred: importance == "vip" || importance == "high",
                    created_at: String::new(),
                };
                let _ = self.db.osint_upsert_company_email(&ce);
                company_emails.push(ce);
            }
        }

        Ok(company_emails)
    }
}

/// Simple heuristic importance guess based on email prefix
fn guess_importance_from_email(email: &str) -> &str {
    let prefix = email.split('@').next().unwrap_or("").to_lowercase();

    // VIP patterns
    let vip = ["ceo", "cto", "cfo", "coo", "ciso", "founder", "president", "director"];
    if vip.iter().any(|p| prefix == *p || prefix.starts_with(&format!("{}.", p))) {
        return "vip";
    }

    // High patterns
    let high = ["manager", "lead", "head", "vp", "chief", "security", "admin", "hr"];
    if high.iter().any(|p| prefix.contains(p)) {
        return "high";
    }

    // Low patterns
    let low = ["info", "support", "sales", "contact", "hello", "help", "billing", "noreply", "no-reply"];
    if low.iter().any(|p| prefix == *p || prefix.starts_with(&format!("{}.", p))) {
        return "low";
    }

    "normal"
}
