use crate::db::Database;

/// Check if an email should be excluded from OSINT harvesting
pub fn is_excluded(db: &Database, email: &str, raw_headers: Option<&str>) -> bool {
    let email_lower = email.to_lowercase();
    let domain = email_lower.split('@').nth(1).unwrap_or("");

    // Check List-Unsubscribe / Precedence headers
    if let Some(headers) = raw_headers {
        let headers_lower = headers.to_lowercase();
        if headers_lower.contains("list-unsubscribe")
            || headers_lower.contains("precedence: bulk")
            || headers_lower.contains("precedence: list")
            || headers_lower.contains("x-mailer: mailchimp")
            || headers_lower.contains("x-mailer: sendgrid")
        {
            return true;
        }
    }

    // Check DB exclusions
    if let Ok(exclusions) = db.osint_list_exclusions() {
        for excl in &exclusions {
            match excl.pattern_type.as_str() {
                "domain" => {
                    if domain == excl.pattern || domain.ends_with(&format!(".{}", excl.pattern)) {
                        return true;
                    }
                }
                "email" => {
                    if email_lower == excl.pattern.to_lowercase() {
                        return true;
                    }
                }
                "regex" => {
                    let pattern_lower = excl.pattern.to_lowercase();
                    if email_lower.contains(&pattern_lower) || domain.contains(&pattern_lower) {
                        return true;
                    }
                }
                _ => {}
            }
        }
    }

    false
}
