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

const API_BASE_URL: &str = "https://owlivion.com/api/v1";

/// API client for Owlivion Sync Server
pub struct SyncApiClient {
    client: Client,
    /// JWT access token (cached in memory)
    access_token: Arc<RwLock<Option<String>>>,
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
        }
    }

    /// Set access token (after login)
    pub async fn set_token(&self, token: String) {
        let mut guard = self.access_token.write().await;
        *guard = Some(token);
    }

    /// Get current token
    pub async fn get_token(&self) -> Option<String> {
        self.access_token.read().await.clone()
    }

    /// Clear token (logout)
    pub async fn clear_token(&self) {
        let mut guard = self.access_token.write().await;
        *guard = None;
    }

    /// Register new user
    pub async fn register(&self, req: RegisterRequest) -> Result<AuthResponse, SyncApiError> {
        let response = self.client
            .post(format!("{}/auth/register", API_BASE_URL))
            .json(&req)
            .send()
            .await?;

        handle_response(response).await
    }

    /// Login user
    pub async fn login(&self, req: LoginRequest) -> Result<AuthResponse, SyncApiError> {
        let response = self.client
            .post(format!("{}/auth/login", API_BASE_URL))
            .json(&req)
            .send()
            .await?;

        let auth: AuthResponse = handle_response(response).await?;

        // Cache token
        self.set_token(auth.access_token.clone()).await;

        Ok(auth)
    }

    /// Refresh access token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<AuthResponse, SyncApiError> {
        let req = RefreshRequest {
            refresh_token: refresh_token.to_string(),
        };

        let response = self.client
            .post(format!("{}/auth/refresh", API_BASE_URL))
            .json(&req)
            .send()
            .await?;

        let auth: AuthResponse = handle_response(response).await?;

        // Update cached token
        self.set_token(auth.access_token.clone()).await;

        Ok(auth)
    }

    /// List all devices for this user
    pub async fn list_devices(&self) -> Result<Vec<DeviceResponse>, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .get(format!("{}/devices", API_BASE_URL))
            .bearer_auth(token)
            .send()
            .await?;

        handle_response(response).await
    }

    /// Revoke device access
    pub async fn revoke_device(&self, device_id: &str) -> Result<(), SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .delete(format!("{}/devices/{}", API_BASE_URL, device_id))
            .bearer_auth(token)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(handle_error(response).await)
        }
    }

    /// Upload encrypted sync data
    pub async fn upload_data(
        &self,
        data_type: &str,
        payload: UploadRequest,
    ) -> Result<UploadResponse, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .post(format!("{}/sync/{}", API_BASE_URL, data_type))
            .bearer_auth(token)
            .json(&payload)
            .send()
            .await?;

        handle_response(response).await
    }

    /// Download encrypted sync data
    pub async fn download_data(
        &self,
        data_type: &str,
    ) -> Result<DownloadResponse, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .get(format!("{}/sync/{}", API_BASE_URL, data_type))
            .bearer_auth(token)
            .send()
            .await?;

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

    /// Get current sync status for all data types
    pub async fn get_sync_status(&self) -> Result<SyncStatusResponse, SyncApiError> {
        let token = self.get_token().await
            .ok_or(SyncApiError::Unauthorized)?;

        let response = self.client
            .get(format!("{}/sync/status", API_BASE_URL))
            .bearer_auth(token)
            .send()
            .await?;

        handle_response(response).await
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

#[derive(Debug, Clone, Deserialize)]
pub struct AuthResponse {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
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
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DownloadResponse {
    pub encrypted_data: String,
    pub version: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SyncStatusResponse {
    pub accounts: DataTypeStatus,
    pub contacts: DataTypeStatus,
    pub preferences: DataTypeStatus,
    pub signatures: DataTypeStatus,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DataTypeStatus {
    pub version: i64,
    pub last_synced_at: Option<String>,
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

/// Handle successful JSON response
async fn handle_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
) -> Result<T, SyncApiError> {
    let status = response.status();

    if status.is_success() {
        response.json::<T>().await
            .map_err(|_| SyncApiError::InvalidResponse)
    } else {
        Err(handle_error(response).await)
    }
}

/// Convert error response to SyncApiError
async fn handle_error(response: reqwest::Response) -> SyncApiError {
    let status = response.status();

    match status {
        StatusCode::UNAUTHORIZED => SyncApiError::Unauthorized,
        StatusCode::FORBIDDEN => SyncApiError::InvalidCredentials,
        StatusCode::CONFLICT => SyncApiError::UserExists,
        StatusCode::TOO_MANY_REQUESTS => SyncApiError::RateLimitExceeded,
        StatusCode::INTERNAL_SERVER_ERROR => {
            let msg = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            SyncApiError::ServerError(msg)
        }
        _ => {
            let msg = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            SyncApiError::NetworkError(format!("{}: {}", status, msg))
        }
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
