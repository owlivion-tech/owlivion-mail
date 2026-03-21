//! Sync API Client - HTTP communication with Owlivion VPS
//!
//! Handles all REST API calls to the sync server:
//! - User registration/login
//! - Device management
//! - Data upload/download
//! - Token refresh

use serde::{Deserialize, Serialize};
use reqwest::{Client, StatusCode};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::db::Database;

const API_BASE_URL: &str = "https://sync.owlivion.com/api/v1";

/// API client for Owlivion Sync Server
pub struct SyncApiClient {
    client: Client,
    /// JWT access token (cached in memory)
    access_token: Arc<RwLock<Option<String>>>,
    /// JWT refresh token (cached in memory, persisted to DB by SyncManager)
    refresh_token: Arc<RwLock<Option<String>>>,
}

impl SyncApiClient {
    /// Create new API client
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            access_token: Arc::new(RwLock::new(None)),
            refresh_token: Arc::new(RwLock::new(None)),
        }
    }

    /// Create new API client with tokens restored from DB
    pub fn new_with_stored_tokens(db: &Database) -> Self {
        let stored_access = db.get_sync_config_value("access_token")
            .ok()
            .flatten()
            .filter(|s| !s.is_empty());
        let stored_refresh = db.get_sync_config_value("refresh_token")
            .ok()
            .flatten()
            .filter(|s| !s.is_empty());

        if stored_access.is_some() {
            log::info!("Restored persisted access token from DB");
        }
        if stored_refresh.is_some() {
            log::info!("Restored persisted refresh token from DB");
        }

        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            access_token: Arc::new(RwLock::new(stored_access)),
            refresh_token: Arc::new(RwLock::new(stored_refresh)),
        }
    }

    /// Set access token (after login)
    pub async fn set_token(&self, token: String) {
        let mut guard = self.access_token.write().await;
        *guard = Some(token);
    }

    /// Set refresh token
    pub async fn set_refresh_token(&self, token: String) {
        let mut guard = self.refresh_token.write().await;
        *guard = Some(token);
    }

    /// Get current access token
    pub async fn get_token(&self) -> Option<String> {
        self.access_token.read().await.clone()
    }

    /// Get current refresh token
    pub async fn get_refresh_token(&self) -> Option<String> {
        self.refresh_token.read().await.clone()
    }

    /// Clear all tokens (logout)
    pub async fn clear_token(&self) {
        let mut guard = self.access_token.write().await;
        *guard = None;
        drop(guard);
        let mut guard = self.refresh_token.write().await;
        *guard = None;
    }

    /// Register new user
    pub async fn register(&self, req: RegisterRequest) -> Result<AuthResponse, SyncApiError> {
        let response = self.client
            .post(format!("{}/auth/register", API_BASE_URL))
            .json(&req)
            .send()
            .await?;

        let server_resp: ServerAuthResponse = handle_response(response).await?;
        parse_auth_response(server_resp)
    }

    /// Login user
    pub async fn login(&self, req: LoginRequest) -> Result<AuthResponse, SyncApiError> {
        let url = format!("{}/auth/login", API_BASE_URL);
        log::info!("SyncAPI: POST {} (email: {})", url, req.email);
        let response = self.client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| { log::error!("SyncAPI: Request failed: {}", e); e })?;

        log::info!("SyncAPI: Response status: {}", response.status());
        let server_resp: ServerAuthResponse = handle_response(response).await?;
        let auth = parse_auth_response(server_resp)?;

        // Cache both tokens
        self.set_token(auth.access_token.clone()).await;
        self.set_refresh_token(auth.refresh_token.clone()).await;

        Ok(auth)
    }

    /// Refresh access token using stored refresh token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<AuthResponse, SyncApiError> {
        let req = RefreshRequest {
            refresh_token: refresh_token.to_string(),
        };

        let response = self.client
            .post(format!("{}/auth/refresh", API_BASE_URL))
            .json(&req)
            .send()
            .await?;

        let server_resp: ServerRefreshResponse = handle_response(response).await?;
        let data = server_resp.data.ok_or(SyncApiError::InvalidResponse)?;
        let auth = AuthResponse {
            user_id: String::new(), // Refresh doesn't return user info
            access_token: data.tokens.access_token,
            refresh_token: data.tokens.refresh_token,
            encryption_salt: None,
        };

        // Update both cached tokens
        self.set_token(auth.access_token.clone()).await;
        self.set_refresh_token(auth.refresh_token.clone()).await;

        Ok(auth)
    }

    /// Try to auto-refresh token when a 401 is received
    /// Returns Ok(()) if refresh succeeded (caller should retry), Err if refresh failed
    pub async fn try_auto_refresh(&self) -> Result<AuthResponse, SyncApiError> {
        let refresh_tok = self.get_refresh_token().await
            .ok_or_else(|| {
                log::warn!("SyncAPI: No refresh token available for auto-refresh");
                SyncApiError::Unauthorized
            })?;

        log::info!("SyncAPI: Access token expired, attempting auto-refresh");
        self.refresh_token(&refresh_tok).await
    }

    /// List all devices for this user (with auto-refresh on 401)
    pub async fn list_devices(&self) -> Result<Vec<DeviceResponse>, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .get(format!("{}/devices", API_BASE_URL))
            .bearer_auth(&token)
            .send()
            .await?;

        if response.status() == StatusCode::UNAUTHORIZED {
            self.try_auto_refresh().await?;
            let new_token = self.get_token().await
                .ok_or(SyncApiError::Unauthorized)?;
            let retry = self.client
                .get(format!("{}/devices", API_BASE_URL))
                .bearer_auth(&new_token)
                .send()
                .await?;
            let data: DeviceListResponse = handle_response(retry).await?;
            return Ok(data.devices);
        }

        let data: DeviceListResponse = handle_response(response).await?;
        Ok(data.devices)
    }

    /// Revoke device access (with auto-refresh on 401)
    pub async fn revoke_device(&self, device_id: &str) -> Result<(), SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .delete(format!("{}/devices/{}", API_BASE_URL, device_id))
            .bearer_auth(&token)
            .send()
            .await?;

        if response.status() == StatusCode::UNAUTHORIZED {
            self.try_auto_refresh().await?;
            let new_token = self.get_token().await
                .ok_or(SyncApiError::Unauthorized)?;
            let retry = self.client
                .delete(format!("{}/devices/{}", API_BASE_URL, device_id))
                .bearer_auth(&new_token)
                .send()
                .await?;
            if retry.status().is_success() {
                return Ok(());
            }
            return Err(handle_error(retry).await);
        }

        if response.status().is_success() {
            Ok(())
        } else {
            Err(handle_error(response).await)
        }
    }

    /// Upload encrypted sync data (with auto-refresh on 401)
    pub async fn upload_data(
        &self,
        data_type: &str,
        payload: UploadRequest,
    ) -> Result<UploadResponse, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .post(format!("{}/sync/{}", API_BASE_URL, data_type))
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await?;

        // Auto-refresh on 401
        if response.status() == StatusCode::UNAUTHORIZED {
            self.try_auto_refresh().await?;
            let new_token = self.get_token().await
                .ok_or(SyncApiError::Unauthorized)?;
            let retry = self.client
                .post(format!("{}/sync/{}", API_BASE_URL, data_type))
                .bearer_auth(&new_token)
                .json(&payload)
                .send()
                .await?;
            return handle_response(retry).await;
        }

        handle_response(response).await
    }

    /// Download encrypted sync data (with auto-refresh on 401)
    pub async fn download_data(
        &self,
        data_type: &str,
    ) -> Result<DownloadResponse, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .get(format!("{}/sync/{}", API_BASE_URL, data_type))
            .bearer_auth(&token)
            .send()
            .await?;

        // Auto-refresh on 401
        if response.status() == StatusCode::UNAUTHORIZED {
            self.try_auto_refresh().await?;
            let new_token = self.get_token().await
                .ok_or(SyncApiError::Unauthorized)?;
            let retry = self.client
                .get(format!("{}/sync/{}", API_BASE_URL, data_type))
                .bearer_auth(&new_token)
                .send()
                .await?;
            if retry.status() == StatusCode::NOT_FOUND {
                return Ok(DownloadResponse {
                    encrypted_data: String::new(),
                    version: 0,
                    updated_at: chrono::Utc::now().to_rfc3339(),
                });
            }
            return handle_response(retry).await;
        }

        // Handle 404 as empty data (first sync)
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(DownloadResponse {
                encrypted_data: String::new(),
                version: 0,
                updated_at: chrono::Utc::now().to_rfc3339(),
            });
        }

        handle_response(response).await
    }

    /// Upload encryption salt to server (with auto-refresh on 401)
    pub async fn upload_salt(&self, salt_hex: &str) -> Result<(), SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let body = serde_json::json!({ "encryption_salt": salt_hex });

        let response = self.client
            .put(format!("{}/auth/salt", API_BASE_URL))
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await?;

        if response.status() == StatusCode::UNAUTHORIZED {
            self.try_auto_refresh().await?;
            let new_token = self.get_token().await
                .ok_or(SyncApiError::Unauthorized)?;
            let retry = self.client
                .put(format!("{}/auth/salt", API_BASE_URL))
                .bearer_auth(&new_token)
                .json(&body)
                .send()
                .await?;
            if retry.status().is_success() {
                return Ok(());
            }
            return Err(handle_error(retry).await);
        }

        if response.status().is_success() {
            Ok(())
        } else {
            Err(handle_error(response).await)
        }
    }

    /// Get current sync status for all data types (with auto-refresh on 401)
    pub async fn get_sync_status(&self) -> Result<SyncStatusResponse, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .get(format!("{}/sync/status", API_BASE_URL))
            .bearer_auth(&token)
            .send()
            .await?;

        if response.status() == StatusCode::UNAUTHORIZED {
            self.try_auto_refresh().await?;
            let new_token = self.get_token().await
                .ok_or(SyncApiError::Unauthorized)?;
            let retry = self.client
                .get(format!("{}/sync/status", API_BASE_URL))
                .bearer_auth(&new_token)
                .send()
                .await?;
            return handle_response(retry).await;
        }

        handle_response(response).await
    }

    /// Upload delta (with auto-refresh on 401)
    pub async fn upload_delta(
        &self,
        data_type: &str,
        payload: DeltaUploadRequest,
    ) -> Result<UploadResponse, SyncApiError> {
        let upload_req = UploadRequest {
            encrypted_data: payload.encrypted_data,
            version: payload.version,
        };

        // Delegate to upload_data which already handles auto-refresh
        self.upload_data(data_type, upload_req).await
    }

    /// Download delta (with auto-refresh on 401)
    pub async fn download_delta(
        &self,
        data_type: &str,
        _last_sync_at: Option<String>,
    ) -> Result<DeltaDownloadResponse, SyncApiError> {
        // Delegate to download_data which already handles auto-refresh
        let download_resp = self.download_data(data_type).await?;

        Ok(DeltaDownloadResponse {
            encrypted_data: download_resp.encrypted_data,
            version: download_resp.version,
            updated_at: download_resp.updated_at,
            has_more: false,
        })
    }
}

// ============================================================================
// API Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub device_name: String,
    pub device_id: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub device_name: String,
    pub device_id: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// Public auth response (simplified for internal use)
#[derive(Debug, Clone)]
pub struct AuthResponse {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub encryption_salt: Option<String>,
}

// Server response structs (matches actual API format)
#[derive(Debug, Clone, Deserialize)]
struct ServerAuthResponse {
    #[allow(dead_code)]
    success: bool,
    data: Option<ServerAuthData>,
}

#[derive(Debug, Clone, Deserialize)]
struct ServerAuthData {
    user: Option<ServerAuthUser>,
    tokens: ServerAuthTokens,
}

#[derive(Debug, Clone, Deserialize)]
struct ServerAuthUser {
    id: serde_json::Value, // Can be integer or string
    #[allow(dead_code)]
    email: Option<String>,
    encryption_salt: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ServerAuthTokens {
    access_token: String,
    refresh_token: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ServerRefreshResponse {
    #[allow(dead_code)]
    success: bool,
    data: Option<ServerRefreshData>,
}

#[derive(Debug, Clone, Deserialize)]
struct ServerRefreshData {
    tokens: ServerAuthTokens,
}

#[derive(Debug, Clone, Deserialize)]
struct DeviceListResponse {
    devices: Vec<DeviceResponse>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeviceResponse {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub last_seen_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadRequest {
    pub encrypted_data: String,
    pub version: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadResponse {
    pub version: i64,
    #[serde(alias = "synced_at")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DownloadResponse {
    #[serde(alias = "encrypted_blob")]
    pub encrypted_data: String,
    pub version: i64,
    #[serde(alias = "last_sync_at", alias = "synced_at")]
    pub updated_at: String,
}

// Delta Sync Request/Response Types
#[derive(Debug, Clone, Serialize)]
pub struct DeltaUploadRequest {
    pub encrypted_data: String,
    pub version: i64,
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeltaDownloadRequest {
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeltaDownloadResponse {
    #[serde(alias = "encrypted_blob")]
    pub encrypted_data: String,
    pub version: i64,
    #[serde(alias = "last_sync_at", alias = "synced_at")]
    pub updated_at: String,
    #[serde(default)]
    pub has_more: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SyncStatusResponse {
    pub sync_status: SyncStatusMap,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SyncStatusMap {
    pub accounts: Option<DataTypeStatus>,
    pub contacts: Option<DataTypeStatus>,
    pub preferences: Option<DataTypeStatus>,
    pub signatures: Option<DataTypeStatus>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DataTypeStatus {
    pub version: i64,
    #[serde(alias = "last_synced_at")]
    pub last_sync_at: Option<String>,
}

// ============================================================================
// Error Handling
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum SyncApiError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),

    #[error("Unauthorized - login required")]
    Unauthorized,

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("User already exists")]
    UserExists,

    #[error("Server error: {0}")]
    ServerError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Invalid response from server")]
    InvalidResponse,
}

/// Parse nested server auth response into flat AuthResponse
fn parse_auth_response(server_resp: ServerAuthResponse) -> Result<AuthResponse, SyncApiError> {
    let data = server_resp.data.ok_or(SyncApiError::InvalidResponse)?;
    let (user_id, encryption_salt) = match &data.user {
        Some(user) => {
            let id = match &user.id {
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::String(s) => s.clone(),
                _ => String::new(),
            };
            (id, user.encryption_salt.clone())
        },
        None => (String::new(), None),
    };
    Ok(AuthResponse {
        user_id,
        access_token: data.tokens.access_token,
        refresh_token: data.tokens.refresh_token,
        encryption_salt,
    })
}

/// Generic server response wrapper: { "success": bool, "data": T }
#[derive(Debug, Deserialize)]
struct ServerWrapper<T> {
    #[allow(dead_code)]
    success: bool,
    data: Option<T>,
}

/// Handle successful JSON response (auto-unwraps server wrapper)
async fn handle_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
) -> Result<T, SyncApiError> {
    let status = response.status();

    if status.is_success() {
        let body = response.text().await.map_err(|_| SyncApiError::InvalidResponse)?;
        log::debug!("SyncAPI: Response body: {}", &body[..body.len().min(500)]);

        // Try unwrapping {"success":true,"data":T} first
        if let Ok(wrapper) = serde_json::from_str::<ServerWrapper<T>>(&body) {
            if let Some(data) = wrapper.data {
                return Ok(data);
            }
        }

        // Fallback to direct T parsing
        serde_json::from_str::<T>(&body)
            .map_err(|e| {
                log::error!("SyncAPI: JSON parse error: {} | body: {}", e, &body[..body.len().min(200)]);
                SyncApiError::InvalidResponse
            })
    } else {
        Err(handle_error(response).await)
    }
}

/// Convert error response to SyncApiError
async fn handle_error(response: reqwest::Response) -> SyncApiError {
    let status = response.status();

    // Try to parse error body for all error statuses
    let body = response.text().await.unwrap_or_default();
    let error_msg = serde_json::from_str::<ErrorResponse>(&body)
        .map(|e| e.error)
        .unwrap_or_else(|_| body.clone());

    match status {
        StatusCode::UNAUTHORIZED => {
            if error_msg.is_empty() {
                SyncApiError::Unauthorized
            } else {
                SyncApiError::InvalidCredentials
            }
        }
        StatusCode::FORBIDDEN => SyncApiError::InvalidCredentials,
        StatusCode::CONFLICT => SyncApiError::UserExists,
        StatusCode::TOO_MANY_REQUESTS => SyncApiError::RateLimitExceeded,
        StatusCode::INTERNAL_SERVER_ERROR => SyncApiError::ServerError(error_msg),
        _ => SyncApiError::NetworkError(format!("{}: {}", status, error_msg)),
    }
}

#[derive(Debug, Clone, Deserialize)]
struct ErrorResponse {
    error: String,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = SyncApiClient::new();
        assert!(client.get_token().await.is_none());
    }

    #[tokio::test]
    async fn test_token_management() {
        let client = SyncApiClient::new();

        client.set_token("test_token".to_string()).await;
        assert_eq!(client.get_token().await, Some("test_token".to_string()));

        client.clear_token().await;
        assert!(client.get_token().await.is_none());
    }
}
