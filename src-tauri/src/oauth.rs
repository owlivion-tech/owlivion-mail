//! OAuth2 Authentication Module
//!
//! Handles OAuth2 flows for Gmail and Microsoft accounts

use oauth2::{
    basic::BasicClient,
    reqwest::async_http_client,
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, PkceCodeVerifier,
    RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tiny_http::{Response, Server};

#[allow(unused_imports)]
use Ordering as _; // Used in lazy_static initialization

// Global OAuth server state to prevent multiple servers on same port
lazy_static::lazy_static! {
    static ref OAUTH_SERVER_RUNNING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    static ref OAUTH_SERVER_SHUTDOWN: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    // Store PKCE verifiers by CSRF token (state parameter)
    static ref PKCE_VERIFIERS: Arc<Mutex<HashMap<String, PkceCodeVerifier>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Debug, thiserror::Error)]
pub enum OAuthError {
    #[error("OAuth2 error: {0}")]
    OAuth2(String),
    #[error("HTTP server error: {0}")]
    Server(String),
    #[error("Token exchange failed: {0}")]
    TokenExchange(String),
    #[error("User cancelled authentication")]
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub auth_url: String,
    pub token_url: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub email: String,
    pub display_name: Option<String>,
}

/// Gmail OAuth2 configuration
pub fn gmail_config() -> OAuthConfig {
    // TODO: These should come from environment variables or config file
    // For now, using placeholder values - users need to create their own OAuth app
    OAuthConfig {
        client_id: std::env::var("GOOGLE_CLIENT_ID")
            .unwrap_or_else(|_| "YOUR_GOOGLE_CLIENT_ID".to_string()),
        client_secret: std::env::var("GOOGLE_CLIENT_SECRET")
            .unwrap_or_else(|_| "YOUR_GOOGLE_CLIENT_SECRET".to_string()),
        auth_url: "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
        token_url: "https://oauth2.googleapis.com/token".to_string(),
        redirect_uri: "http://localhost:8080/callback".to_string(),
        scopes: vec![
            "https://mail.google.com/".to_string(),
            "https://www.googleapis.com/auth/userinfo.email".to_string(),
            "https://www.googleapis.com/auth/userinfo.profile".to_string(),
        ],
    }
}

/// Microsoft OAuth2 configuration
pub fn microsoft_config() -> OAuthConfig {
    // TODO: These should come from environment variables or config file
    OAuthConfig {
        client_id: std::env::var("MICROSOFT_CLIENT_ID")
            .unwrap_or_else(|_| "YOUR_MICROSOFT_CLIENT_ID".to_string()),
        client_secret: std::env::var("MICROSOFT_CLIENT_SECRET")
            .unwrap_or_else(|_| "YOUR_MICROSOFT_CLIENT_SECRET".to_string()),
        auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string(),
        token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string(),
        redirect_uri: "http://localhost:8080/callback".to_string(),
        scopes: vec![
            "https://outlook.office365.com/IMAP.AccessAsUser.All".to_string(),
            "https://outlook.office365.com/SMTP.Send".to_string(),
            "offline_access".to_string(),
            "User.Read".to_string(),
        ],
    }
}

/// Start OAuth2 flow and return authorization URL
pub fn start_oauth_flow(config: &OAuthConfig) -> Result<(String, CsrfToken), OAuthError> {
    let client = BasicClient::new(
        ClientId::new(config.client_id.clone()),
        Some(ClientSecret::new(config.client_secret.clone())),
        AuthUrl::new(config.auth_url.clone()).map_err(|e| OAuthError::OAuth2(e.to_string()))?,
        Some(TokenUrl::new(config.token_url.clone()).map_err(|e| OAuthError::OAuth2(e.to_string()))?),
    )
    .set_redirect_uri(
        RedirectUrl::new(config.redirect_uri.clone())
            .map_err(|e| OAuthError::OAuth2(e.to_string()))?,
    );

    // Generate PKCE challenge and verifier
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    // Generate authorization URL with CSRF token
    let mut auth_request = client.authorize_url(CsrfToken::new_random);

    // Add scopes
    for scope in &config.scopes {
        auth_request = auth_request.add_scope(Scope::new(scope.clone()));
    }

    let (auth_url, csrf_token) = auth_request
        .set_pkce_challenge(pkce_challenge)
        .url();

    // Store PKCE verifier for later use in token exchange
    let csrf_token_str = csrf_token.secret().clone();
    if let Ok(mut verifiers) = PKCE_VERIFIERS.lock() {
        verifiers.insert(csrf_token_str, pkce_verifier);
    }

    Ok((auth_url.to_string(), csrf_token))
}

/// Handle OAuth2 callback and exchange authorization code for tokens
pub async fn handle_oauth_callback(
    config: &OAuthConfig,
    authorization_code: String,
    csrf_token: String,
) -> Result<OAuthResult, OAuthError> {
    let client = BasicClient::new(
        ClientId::new(config.client_id.clone()),
        Some(ClientSecret::new(config.client_secret.clone())),
        AuthUrl::new(config.auth_url.clone()).map_err(|e| OAuthError::OAuth2(e.to_string()))?,
        Some(TokenUrl::new(config.token_url.clone()).map_err(|e| OAuthError::OAuth2(e.to_string()))?),
    )
    .set_redirect_uri(
        RedirectUrl::new(config.redirect_uri.clone())
            .map_err(|e| OAuthError::OAuth2(e.to_string()))?,
    );

    // Retrieve PKCE verifier from storage
    let pkce_verifier = {
        let mut verifiers = PKCE_VERIFIERS.lock()
            .map_err(|e| OAuthError::OAuth2(format!("Failed to access PKCE verifiers: {}", e)))?;
        verifiers.remove(&csrf_token)
            .ok_or_else(|| OAuthError::OAuth2("PKCE verifier not found - possible CSRF attack or timeout".to_string()))?
    };

    // Exchange authorization code for access token with PKCE verifier
    let token_result = client
        .exchange_code(AuthorizationCode::new(authorization_code))
        .set_pkce_verifier(pkce_verifier)
        .request_async(async_http_client)
        .await
        .map_err(|e| OAuthError::TokenExchange(e.to_string()))?;

    let access_token = token_result.access_token().secret().clone();
    let refresh_token = token_result.refresh_token().map(|t| t.secret().clone());

    // Fetch user info to get email
    let (email, display_name) = fetch_user_info(&access_token, &config.auth_url).await?;

    Ok(OAuthResult {
        access_token,
        refresh_token,
        email,
        display_name,
    })
}

/// Fetch user information from OAuth provider
async fn fetch_user_info(
    access_token: &str,
    auth_url: &str,
) -> Result<(String, Option<String>), OAuthError> {
    let client = reqwest::Client::new();

    // Determine provider based on auth URL
    let user_info_url = if auth_url.contains("google") {
        "https://www.googleapis.com/oauth2/v2/userinfo"
    } else if auth_url.contains("microsoft") {
        "https://graph.microsoft.com/v1.0/me"
    } else {
        return Err(OAuthError::OAuth2("Unknown OAuth provider".to_string()));
    };

    let response = client
        .get(user_info_url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| OAuthError::OAuth2(format!("Failed to fetch user info: {}", e)))?;

    let user_info: serde_json::Value = response
        .json()
        .await
        .map_err(|e| OAuthError::OAuth2(format!("Failed to parse user info: {}", e)))?;

    let email = user_info["email"]
        .as_str()
        .or_else(|| user_info["userPrincipalName"].as_str())
        .ok_or_else(|| OAuthError::OAuth2("Email not found in user info".to_string()))?
        .to_string();

    let display_name = user_info["name"]
        .as_str()
        .or_else(|| user_info["displayName"].as_str())
        .map(|s| s.to_string());

    Ok((email, display_name))
}

/// Start a local HTTP server to handle OAuth redirect
/// Now with proper cleanup and shutdown mechanism
/// Returns (authorization_code, state) tuple
pub fn start_callback_server(
    callback_result: Arc<Mutex<Option<Result<(String, String), OAuthError>>>>,
) -> Result<(), OAuthError> {
    // Check if server is already running
    if OAUTH_SERVER_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        log::warn!("OAuth server already running, waiting for it to finish...");
        // Wait for the previous server to shut down
        for _ in 0..50 {
            if !OAUTH_SERVER_RUNNING.load(Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        // Try again to set running flag
        if OAUTH_SERVER_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
            return Err(OAuthError::Server("OAuth server still running after timeout".to_string()));
        }
    }

    // Reset shutdown flag
    OAUTH_SERVER_SHUTDOWN.store(false, Ordering::SeqCst);

    // Try to bind to port 8080, with retries
    let server = match Server::http("127.0.0.1:8080") {
        Ok(s) => s,
        Err(e) => {
            OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
            return Err(OAuthError::Server(format!("Failed to bind to port 8080: {}. Please close any browser tabs pointing to localhost:8080 and try again.", e)));
        }
    };

    log::info!("OAuth callback server started on http://localhost:8080");

    for request in server.incoming_requests() {
        // Check if we should shut down
        if OAUTH_SERVER_SHUTDOWN.load(Ordering::SeqCst) {
            log::info!("OAuth server received shutdown signal");
            let _ = request.respond(Response::from_string("Server shutting down"));
            break;
        }

        let url = request.url();
        log::info!("Received OAuth callback: {}", url);

        if url.starts_with("/callback") {
            // Parse query parameters
            if let Some(query) = url.split('?').nth(1) {
                let params: Vec<(&str, &str)> = query
                    .split('&')
                    .filter_map(|p| {
                        let mut parts = p.split('=');
                        Some((parts.next()?, parts.next()?))
                    })
                    .collect();

                // Check for error
                if let Some((_, error)) = params.iter().find(|(k, _)| *k == "error") {
                    if let Ok(mut guard) = callback_result.lock() {
                        *guard = Some(Err(OAuthError::OAuth2(error.to_string())));
                    }
                    let _ = request.respond(Response::from_string(
                        "<html><body style='font-family: sans-serif; text-align: center; padding: 50px;'>\
                        <h1>❌ Authentication Failed</h1>\
                        <p>You can close this window and return to Owlivion Mail.</p>\
                        </body></html>"
                    ));
                    break;
                }

                // Get authorization code and state
                if let Some((_, code)) = params.iter().find(|(k, _)| *k == "code") {
                    // URL decode the code
                    let decoded_code = urlencoding::decode(code)
                        .unwrap_or(std::borrow::Cow::Borrowed(code))
                        .to_string();

                    // Get state parameter (CSRF token)
                    let state = params.iter()
                        .find(|(k, _)| *k == "state")
                        .map(|(_, v)| urlencoding::decode(v).unwrap_or(std::borrow::Cow::Borrowed(v)).to_string())
                        .unwrap_or_default();

                    if let Ok(mut guard) = callback_result.lock() {
                        *guard = Some(Ok((decoded_code, state)));
                    }
                    let _ = request.respond(Response::from_string(
                        "<html><body style='font-family: sans-serif; text-align: center; padding: 50px;'>\
                        <h1>✅ Authentication Successful!</h1>\
                        <p>You can close this window and return to Owlivion Mail.</p>\
                        <script>setTimeout(() => window.close(), 2000);</script>\
                        </body></html>"
                    ));
                    break;
                }
            }

            let _ = request.respond(Response::from_string(
                "<html><body style='font-family: sans-serif; text-align: center; padding: 50px;'>\
                <h1>⚠️ Invalid Callback</h1>\
                <p>Please close this window and try again.</p>\
                </body></html>"
            ));
            break;
        }

        // Unknown request, ignore but don't break (keep server running)
        let _ = request.respond(Response::from_string("Not found"));
    }

    // Mark server as stopped
    OAUTH_SERVER_RUNNING.store(false, Ordering::SeqCst);
    log::info!("OAuth callback server stopped");

    Ok(())
}

/// Signal the OAuth server to shut down
pub fn shutdown_callback_server() {
    log::info!("Signaling OAuth server shutdown");
    OAUTH_SERVER_SHUTDOWN.store(true, Ordering::SeqCst);

    // Try to make a request to wake up the server if it's waiting
    std::thread::spawn(|| {
        let _ = reqwest::blocking::get("http://127.0.0.1:8080/shutdown");
    });
}

/// Refresh OAuth2 access token using refresh token
pub async fn refresh_access_token(
    config: &OAuthConfig,
    refresh_token: &str,
) -> Result<OAuthResult, OAuthError> {
    use oauth2::{RefreshToken, TokenResponse};

    let client = BasicClient::new(
        ClientId::new(config.client_id.clone()),
        Some(ClientSecret::new(config.client_secret.clone())),
        AuthUrl::new(config.auth_url.clone()).map_err(|e| OAuthError::OAuth2(e.to_string()))?,
        Some(TokenUrl::new(config.token_url.clone()).map_err(|e| OAuthError::OAuth2(e.to_string()))?),
    );

    log::info!("Refreshing OAuth2 access token...");

    // Exchange refresh token for new access token
    let token_result = client
        .exchange_refresh_token(&RefreshToken::new(refresh_token.to_string()))
        .request_async(async_http_client)
        .await
        .map_err(|e| {
            log::error!("Token refresh failed: {:?}", e);
            OAuthError::TokenExchange(format!("Failed to refresh token: {}. Please re-authenticate.", e))
        })?;

    let access_token = token_result.access_token().secret().clone();
    let new_refresh_token = token_result
        .refresh_token()
        .map(|t| t.secret().clone())
        .or_else(|| Some(refresh_token.to_string())); // Keep old refresh token if not provided

    // Fetch user info to get email (should be cached but let's be safe)
    let (email, display_name) = fetch_user_info(&access_token, &config.auth_url).await?;

    log::info!("✓ OAuth2 token refreshed successfully for {}", email);

    Ok(OAuthResult {
        access_token,
        refresh_token: new_refresh_token,
        email,
        display_name,
    })
}
