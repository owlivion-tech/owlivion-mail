use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

pub struct DockerClient {
    container: String,
}

impl DockerClient {
    pub fn new(container: &str) -> Self {
        Self {
            container: container.to_string(),
        }
    }

    /// Check if Docker container is running
    pub async fn is_available(&self) -> bool {
        let result = Command::new("docker")
            .args(["inspect", "-f", "{{.State.Running}}", &self.container])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;

        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                stdout.trim() == "true"
            }
            Err(_) => false,
        }
    }

    /// Execute a command inside the Docker container
    async fn exec(&self, cmd: &str) -> DockerResult {
        let result = Command::new("docker")
            .args(["exec", &self.container, "bash", "-c", cmd])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;

        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                DockerResult {
                    success: output.status.success(),
                    output: stdout,
                    error: if stderr.is_empty() { None } else { Some(stderr) },
                }
            }
            Err(e) => DockerResult {
                success: false,
                output: String::new(),
                error: Some(format!("Docker exec failed: {}", e)),
            },
        }
    }

    /// Harvest emails from a domain using theHarvester + crt.sh
    pub async fn email_harvest(&self, domain: &str, depth: u32) -> DockerResult {
        // SECURITY: Validate domain to prevent command injection
        let sanitized = sanitize_domain(domain);
        if sanitized.is_empty() {
            return DockerResult {
                success: false,
                output: String::new(),
                error: Some("Invalid domain".to_string()),
            };
        }

        let cmd = format!(
            "theHarvester -d {} -b all -l {} 2>/dev/null || echo 'theHarvester not available'; \
             echo '---SEPARATOR---'; \
             curl -s 'https://crt.sh/?q=%.{}&output=json' 2>/dev/null | head -c 50000 || echo '[]'",
            sanitized,
            depth.min(500),
            sanitized
        );
        self.exec(&cmd).await
    }

    /// OSINT reconnaissance on a domain (whois + DNS)
    pub async fn osint_recon(&self, domain: &str) -> DockerResult {
        let sanitized = sanitize_domain(domain);
        if sanitized.is_empty() {
            return DockerResult {
                success: false,
                output: String::new(),
                error: Some("Invalid domain".to_string()),
            };
        }

        let cmd = format!(
            "echo '=== WHOIS ===' && whois {} 2>/dev/null | head -100; \
             echo '=== DNS ===' && dig {} ANY +short 2>/dev/null; \
             echo '=== MX ===' && dig {} MX +short 2>/dev/null; \
             echo '=== TXT ===' && dig {} TXT +short 2>/dev/null",
            sanitized, sanitized, sanitized, sanitized
        );
        self.exec(&cmd).await
    }

    /// Check social media presence using holehe
    pub async fn social_check(&self, email: &str) -> DockerResult {
        let sanitized = sanitize_email(email);
        if sanitized.is_empty() {
            return DockerResult {
                success: false,
                output: String::new(),
                error: Some("Invalid email".to_string()),
            };
        }

        let cmd = format!(
            "holehe {} --only-used 2>/dev/null || echo 'holehe not available'",
            sanitized
        );
        self.exec(&cmd).await
    }

    /// Website technology detection
    pub async fn whatweb(&self, domain: &str) -> DockerResult {
        let sanitized = sanitize_domain(domain);
        if sanitized.is_empty() {
            return DockerResult {
                success: false,
                output: String::new(),
                error: Some("Invalid domain".to_string()),
            };
        }

        let cmd = format!(
            "whatweb -q {} 2>/dev/null || echo 'whatweb not available'",
            sanitized
        );
        self.exec(&cmd).await
    }
}

/// SECURITY: Sanitize domain input to prevent shell injection
fn sanitize_domain(domain: &str) -> String {
    let cleaned: String = domain
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-')
        .collect();

    // Basic domain validation
    if cleaned.is_empty() || !cleaned.contains('.') || cleaned.len() > 253 {
        return String::new();
    }
    cleaned
}

/// SECURITY: Sanitize email input to prevent shell injection
fn sanitize_email(email: &str) -> String {
    let cleaned: String = email
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '@' || *c == '.' || *c == '-' || *c == '_' || *c == '+')
        .collect();

    if cleaned.is_empty() || !cleaned.contains('@') || !cleaned.contains('.') || cleaned.len() > 254 {
        return String::new();
    }
    cleaned
}
