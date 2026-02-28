use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL: &str = "claude-sonnet-4-20250514";
const MAX_TOKENS: u32 = 2048;

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
}

#[derive(Debug, Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: String,
}

pub struct ClaudeClient {
    api_key: String,
    client: reqwest::Client,
}

impl Drop for ClaudeClient {
    fn drop(&mut self) {
        self.api_key.zeroize();
    }
}

impl ClaudeClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Analyze sender OSINT data and return structured profile
    pub async fn analyze_sender_osint(
        &self,
        email: &str,
        raw_data: &str,
    ) -> Result<String, String> {
        let prompt = format!(
            r#"Analyze the following OSINT data collected about the email sender: {}

Raw data:
{}

Return a JSON object with these fields (use null for unknown):
{{
  "person_name": "Full name if found",
  "job_title": "Job title/role",
  "company": "Company name",
  "location": "City/Country",
  "company_industry": "Industry sector",
  "company_size": "small/medium/large/enterprise",
  "company_website": "URL",
  "social_profiles": {{"linkedin": "url", "twitter": "url", "github": "url"}},
  "confidence_score": 0-100,
  "summary": "Brief 1-2 sentence profile summary"
}}

Only return valid JSON, no markdown or explanation."#,
            email, &raw_data[..raw_data.len().min(8000)]
        );

        self.send_message(&prompt).await
    }

    /// Identify important people from harvested company emails
    pub async fn identify_important_people(
        &self,
        domain: &str,
        emails: &[String],
    ) -> Result<String, String> {
        let email_list = emails.iter().take(50).cloned().collect::<Vec<_>>().join("\n");

        let prompt = format!(
            r#"Analyze these email addresses from the domain {} and classify their importance.

Emails:
{}

Return a JSON array where each item has:
{{
  "email": "the@email.com",
  "importance": "vip|high|normal|low",
  "reason": "Why this classification",
  "estimated_name": "Guessed name from email pattern or null",
  "estimated_title": "Guessed job title or null"
}}

Classification guide:
- vip: C-level, founders, directors (ceo@, cto@, founder@, director@)
- high: Managers, leads, key roles (manager@, lead@, head@, security@)
- normal: Regular employees
- low: Generic/functional addresses (info@, support@, sales@)

Only return valid JSON array, no markdown."#,
            domain, email_list
        );

        self.send_message(&prompt).await
    }

    /// Send a message to Claude API
    async fn send_message(&self, prompt: &str) -> Result<String, String> {
        let request = ClaudeRequest {
            model: CLAUDE_MODEL.to_string(),
            max_tokens: MAX_TOKENS,
            messages: vec![ClaudeMessage {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
        };

        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Claude API request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Claude API error {}: {}", status, body));
        }

        let claude_response: ClaudeResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

        claude_response
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| "Empty Claude response".to_string())
    }
}
