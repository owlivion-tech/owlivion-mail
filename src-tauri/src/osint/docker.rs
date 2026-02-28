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

    /// Deep email harvest from a domain using multiple OSINT techniques
    pub async fn email_harvest(&self, domain: &str, _depth: u32) -> DockerResult {
        // SECURITY: Validate domain to prevent command injection
        let sanitized = sanitize_domain(domain);
        if sanitized.is_empty() {
            return DockerResult {
                success: false,
                output: String::new(),
                error: Some("Invalid domain".to_string()),
            };
        }

        // Multi-source deep harvest:
        // 1. Website crawl (main page links + common pages + subdomains)
        // 2. DNS intelligence (MX, SPF, DMARC, TXT)
        // 3. SMTP recon (open ports, server banner)
        // 4. WHOIS registrant info
        // 5. crt.sh certificate transparency (subdomains)
        // 6. theHarvester (if available)
        let cmd = format!(
            r#"echo '=== WEBSITE_EMAILS ===';
for url in 'https://{d}' 'https://{d}/contact' 'https://{d}/about' 'https://{d}/iletisim' 'https://{d}/impressum' 'https://{d}/team' 'https://{d}/people' 'https://{d}/kurumsal' 'https://{d}/hakkimizda' 'https://www.{d}'; do
  curl -sL --max-time 5 "$url" 2>/dev/null;
done | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}' | sort -u;
echo '=== DEEP_CRAWL_EMAILS ===';
LINKS=$(curl -sL --max-time 8 'https://{d}' 2>/dev/null | grep -oE 'href="[^"]*"' | sed 's/href="//;s/"//' | grep -E '^/' | sort -u | head -40);
for link in $LINKS; do
  curl -sL --max-time 4 "https://{d}$link" 2>/dev/null;
done | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}' | sort -u;
echo '=== CRT_SH_JSON ===';
curl -s --max-time 15 'https://crt.sh/?q=%.{d}&output=json' 2>/dev/null | head -c 50000 || echo '[]';
echo;
echo '=== SUBDOMAIN_EMAILS ===';
SUBS=$(curl -s --max-time 15 'https://crt.sh/?q=%.{d}&output=json' 2>/dev/null | grep -oE '"name_value":"[^"]*"' | sed 's/"name_value":"//;s/"//' | tr '\\n' '\n' | grep -v '\*' | sort -u | head -15);
for sub in $SUBS; do
  curl -sL --max-time 4 "https://$sub" 2>/dev/null;
done | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}' | sort -u;
echo '=== DNS_INTEL ===';
echo 'MX:'; dig {d} MX +short 2>/dev/null;
echo 'SPF:'; dig {d} TXT +short 2>/dev/null | grep -i spf;
echo 'DMARC:'; dig _dmarc.{d} TXT +short 2>/dev/null;
echo 'NS:'; dig {d} NS +short 2>/dev/null;
echo '=== WHOIS_INFO ===';
whois {d} 2>/dev/null | grep -iE 'registrant|admin|tech|email|e-mail|organization|org-name|person|phone' | head -30;
echo '=== SMTP_RECON ===';
nmap -Pn -p 25,587,465 --script smtp-commands,smtp-enum-users {d} 2>/dev/null | head -30;
echo '=== THEHARVESTER ===';
theHarvester -d {d} -b all -l 200 2>/dev/null || echo 'not available'"#,
            d = sanitized,
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
