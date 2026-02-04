//! OAuth2 Authentication Module
//!
//! Handles OAuth2 flows for Gmail and Microsoft accounts

use oauth2::{
    basic::BasicClient,
    reqwest::async_http_client,
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tiny_http::{Response, Server};

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

    // Generate PKCE challenge
    let (pkce_challenge, _pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    // Generate authorization URL
    let mut auth_request = client.authorize_url(CsrfToken::new_random);

    // Add scopes
    for scope in &config.scopes {
        auth_request = auth_request.add_scope(Scope::new(scope.clone()));
    }

    let (auth_url, csrf_token) = auth_request
        .set_pkce_challenge(pkce_challenge)
        .url();

    Ok((auth_url.to_string(), csrf_token))
}

/// Handle OAuth2 callback and exchange authorization code for tokens
pub async fn handle_oauth_callback(
    config: &OAuthConfig,
    authorization_code: String,
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

    // Exchange authorization code for access token
    let token_result = client
        .exchange_code(AuthorizationCode::new(authorization_code))
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
pub fn start_callback_server(
    callback_result: Arc<Mutex<Option<Result<String, OAuthError>>>>,
) -> Result<(), OAuthError> {
    let server = Server::http("127.0.0.1:8080")
        .map_err(|e| OAuthError::Server(e.to_string()))?;

    log::info!("OAuth callback server started on http://localhost:8080");

    for request in server.incoming_requests() {
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
                    *callback_result.lock().unwrap() = Some(Err(OAuthError::OAuth2(error.to_string())));
                    let _ = request.respond(Response::from_string("Authentication failed! You can close this window."));
                    break;
                }

                // Get authorization code
                if let Some((_, code)) = params.iter().find(|(k, _)| *k == "code") {
                    *callback_result.lock().unwrap() = Some(Ok(code.to_string()));
                    let _ = request.respond(Response::from_string(
                        "Authentication successful! You can close this window and return to Owlivion Mail."
                    ));
                    break;
                }
            }

            let _ = request.respond(Response::from_string("Invalid callback"));
            break;
        }
    }

    Ok(())
}
