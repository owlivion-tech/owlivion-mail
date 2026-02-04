//! Offline Queue Module - Handles failed sync operations with retry logic
//!
//! When sync operations fail (network issues, server down, etc.), they are
//! queued locally and retried with exponential backoff.
//!
//! Features:
//! - SQLite-backed persistent queue
//! - Exponential backoff retry policy
//! - Max retry limit (default: 5 attempts)
//! - Automatic cleanup of completed items
//! - Queue status reporting (pending, failed counts)

use super::crypto::SyncDataType;
use crate::db::Database;
use chrono::{DateTime, Utc, Duration};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// ============================================================================
// Constants
// ============================================================================

const BASE_DELAY_SECS: i64 = 30;      // Initial retry delay: 30 seconds
const MAX_DELAY_SECS: i64 = 3600;     // Max retry delay: 1 hour
const DEFAULT_MAX_RETRIES: i32 = 5;   // Max retry attempts

// ============================================================================
// Data Types
// ============================================================================

/// Queue item status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueStatus {
    Pending,
    InProgress,
    Failed,
    Completed,
}

impl QueueStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::InProgress => "in_progress",
            Self::Failed => "failed",
            Self::Completed => "completed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => Self::Pending,
            "in_progress" => Self::InProgress,
            "failed" => Self::Failed,
            "completed" => Self::Completed,
            _ => Self::Pending, // Default
        }
    }
}

/// Queue item stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub id: Option<i64>,
    pub data_type: String,
    pub encrypted_data: String,  // base64 encoded
    pub version: i64,
    pub retry_count: i32,
    pub max_retries: i32,
    pub status: QueueStatus,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

impl QueueItem {
    /// Create new queue item
    pub fn new(data_type: SyncDataType, encrypted_data: String, version: i64) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            data_type: data_type.as_str().to_string(),
            encrypted_data,
            version,
            retry_count: 0,
            max_retries: DEFAULT_MAX_RETRIES,
            status: QueueStatus::Pending,
            error_message: None,
            created_at: now,
            next_retry_at: Some(now), // Ready immediately
            updated_at: now,
        }
    }

    /// Check if item should be retried now
    pub fn should_retry(&self) -> bool {
        if self.status != QueueStatus::Pending && self.status != QueueStatus::Failed {
            return false;
        }

        if self.retry_count >= self.max_retries {
            return false;
        }

        if let Some(next_retry) = self.next_retry_at {
            Utc::now() >= next_retry
        } else {
            true
        }
    }

    /// Calculate next retry timestamp with exponential backoff
    pub fn calculate_next_retry(&self) -> DateTime<Utc> {
        let delay_secs = (BASE_DELAY_SECS * 2_i64.pow(self.retry_count as u32))
            .min(MAX_DELAY_SECS);

        Utc::now() + Duration::seconds(delay_secs)
    }
}

/// Queue statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStats {
    pub pending_count: i32,
    pub in_progress_count: i32,
    pub failed_count: i32,
    pub completed_count: i32,
    pub total_count: i32,
}

// ============================================================================
// Queue Manager
// ============================================================================

/// Manages offline sync queue operations
pub struct QueueManager {
    db: Arc<Database>,
}

impl QueueManager {
    /// Create new queue manager
    pub fn new(db: Arc<Database>) -> Result<Self, QueueError> {
        let manager = Self { db };
        manager.initialize_schema()?;
        Ok(manager)
    }

    /// Initialize database schema for queue
    fn initialize_schema(&self) -> Result<(), QueueError> {
        self.db.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data_type TEXT NOT NULL,
                encrypted_data TEXT NOT NULL,
                version INTEGER NOT NULL,
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 5,
                status TEXT DEFAULT 'pending',
                error_message TEXT,
                created_at TEXT NOT NULL,
                next_retry_at TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_queue_status
                ON sync_queue(status);

            CREATE INDEX IF NOT EXISTS idx_queue_next_retry
                ON sync_queue(next_retry_at);

            CREATE INDEX IF NOT EXISTS idx_queue_data_type
                ON sync_queue(data_type);
            "#
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Add item to queue
    pub fn add_to_queue(&self, item: QueueItem) -> Result<i64, QueueError> {
        log::info!("Adding {} to sync queue (retry: {})", item.data_type, item.retry_count);

        let id = self.db.execute(
            r#"
            INSERT INTO sync_queue (
                data_type, encrypted_data, version, retry_count, max_retries,
                status, error_message, created_at, next_retry_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                item.data_type,
                item.encrypted_data,
                item.version,
                item.retry_count,
                item.max_retries,
                item.status.as_str(),
                item.error_message,
                item.created_at.to_rfc3339(),
                item.next_retry_at.map(|dt| dt.to_rfc3339()),
                item.updated_at.to_rfc3339(),
            ],
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        log::info!("Queue item added with ID: {}", id);
        Ok(id)
    }

    /// Get all pending items ready for retry
    pub fn get_pending_items(&self) -> Result<Vec<QueueItem>, QueueError> {
        let now = Utc::now().to_rfc3339();

        let items = self.db.query(
            r#"
            SELECT id, data_type, encrypted_data, version, retry_count,
                   max_retries, status, error_message, created_at,
                   next_retry_at, updated_at
            FROM sync_queue
            WHERE (status = 'pending' OR status = 'failed')
              AND retry_count < max_retries
              AND (next_retry_at IS NULL OR next_retry_at <= ?1)
            ORDER BY created_at ASC
            "#,
            params![now],
            |row| {
                Ok(QueueItem {
                    id: row.get(0)?,
                    data_type: row.get(1)?,
                    encrypted_data: row.get(2)?,
                    version: row.get(3)?,
                    retry_count: row.get(4)?,
                    max_retries: row.get(5)?,
                    status: QueueStatus::from_str(&row.get::<_, String>(6)?),
                    error_message: row.get(7)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                    next_retry_at: row.get::<_, Option<String>>(9)?
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                })
            },
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        log::info!("Found {} pending queue items", items.len());
        Ok(items)
    }

    /// Update queue item status
    pub fn update_item_status(
        &self,
        id: i64,
        status: QueueStatus,
        error_message: Option<String>,
    ) -> Result<(), QueueError> {
        log::info!("Updating queue item {} status to {:?}", id, status);

        self.db.execute(
            r#"
            UPDATE sync_queue
            SET status = ?1, error_message = ?2, updated_at = ?3
            WHERE id = ?4
            "#,
            params![
                status.as_str(),
                error_message,
                Utc::now().to_rfc3339(),
                id
            ],
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Mark item as failed and schedule retry
    pub fn mark_failed_and_retry(
        &self,
        id: i64,
        error_message: String,
    ) -> Result<(), QueueError> {
        log::warn!("Queue item {} failed: {}", id, error_message);

        // Get current item
        let item = self.get_item_by_id(id)?;

        let new_retry_count = item.retry_count + 1;
        let next_retry = if new_retry_count < item.max_retries {
            // Calculate next retry with exponential backoff
            let delay_secs = (BASE_DELAY_SECS * 2_i64.pow(new_retry_count as u32))
                .min(MAX_DELAY_SECS);
            Some(Utc::now() + Duration::seconds(delay_secs))
        } else {
            None // Max retries exceeded, don't retry
        };

        self.db.execute(
            r#"
            UPDATE sync_queue
            SET status = ?1, error_message = ?2, retry_count = ?3,
                next_retry_at = ?4, updated_at = ?5
            WHERE id = ?6
            "#,
            params![
                QueueStatus::Failed.as_str(),
                Some(error_message),
                new_retry_count,
                next_retry.map(|dt| dt.to_rfc3339()),
                Utc::now().to_rfc3339(),
                id
            ],
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        if let Some(retry_time) = next_retry {
            log::info!(
                "Queue item {} will retry at {} (attempt {}/{})",
                id, retry_time, new_retry_count + 1, item.max_retries
            );
        } else {
            log::warn!("Queue item {} exceeded max retries", id);
        }

        Ok(())
    }

    /// Get queue item by ID
    pub fn get_item_by_id(&self, id: i64) -> Result<QueueItem, QueueError> {
        let items = self.db.query(
            r#"
            SELECT id, data_type, encrypted_data, version, retry_count,
                   max_retries, status, error_message, created_at,
                   next_retry_at, updated_at
            FROM sync_queue
            WHERE id = ?1
            "#,
            params![id],
            |row| {
                Ok(QueueItem {
                    id: row.get(0)?,
                    data_type: row.get(1)?,
                    encrypted_data: row.get(2)?,
                    version: row.get(3)?,
                    retry_count: row.get(4)?,
                    max_retries: row.get(5)?,
                    status: QueueStatus::from_str(&row.get::<_, String>(6)?),
                    error_message: row.get(7)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                    next_retry_at: row.get::<_, Option<String>>(9)?
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                })
            },
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        items.into_iter().next()
            .ok_or(QueueError::ItemNotFound(id))
    }

    /// Get queue statistics
    pub fn get_stats(&self) -> Result<QueueStats, QueueError> {
        let stats = self.db.query_row(
            r#"
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                COUNT(*) as total
            FROM sync_queue
            "#,
            params![],
            |row| {
                Ok(QueueStats {
                    pending_count: row.get::<_, i32>(0).unwrap_or(0),
                    in_progress_count: row.get::<_, i32>(1).unwrap_or(0),
                    failed_count: row.get::<_, i32>(2).unwrap_or(0),
                    completed_count: row.get::<_, i32>(3).unwrap_or(0),
                    total_count: row.get::<_, i32>(4).unwrap_or(0),
                })
            },
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        Ok(stats)
    }

    /// Clear completed items older than N days
    pub fn clear_completed(&self, older_than_days: i32) -> Result<i32, QueueError> {
        let cutoff = Utc::now() - Duration::days(older_than_days as i64);

        let deleted = self.db.execute(
            r#"
            DELETE FROM sync_queue
            WHERE status = 'completed' AND updated_at < ?1
            "#,
            params![cutoff.to_rfc3339()],
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        log::info!("Cleared {} completed queue items", deleted);
        Ok(deleted as i32)
    }

    /// Clear all failed items (manual action)
    pub fn clear_failed(&self) -> Result<i32, QueueError> {
        let deleted = self.db.execute(
            r#"
            DELETE FROM sync_queue
            WHERE status = 'failed' AND retry_count >= max_retries
            "#,
            params![],
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        log::info!("Cleared {} permanently failed queue items", deleted);
        Ok(deleted as i32)
    }

    /// Reset failed items for manual retry
    pub fn retry_failed_items(&self) -> Result<i32, QueueError> {
        let now = Utc::now().to_rfc3339();

        let updated = self.db.execute(
            r#"
            UPDATE sync_queue
            SET status = 'pending',
                retry_count = 0,
                next_retry_at = ?1,
                updated_at = ?1,
                error_message = NULL
            WHERE status = 'failed'
            "#,
            params![now],
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        log::info!("Reset {} failed items for retry", updated);
        Ok(updated as i32)
    }

    /// Delete specific queue item
    pub fn delete_item(&self, id: i64) -> Result<(), QueueError> {
        self.db.execute(
            "DELETE FROM sync_queue WHERE id = ?1",
            params![id],
        ).map_err(|e| QueueError::DatabaseError(e.to_string()))?;

        log::info!("Deleted queue item {}", id);
        Ok(())
    }
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum QueueError {
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Queue item not found: {0}")]
    ItemNotFound(i64),

    #[error("Invalid queue state")]
    InvalidState,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_manager() -> QueueManager {
        let db = Arc::new(Database::in_memory().expect("Failed to create test DB"));
        QueueManager::new(db).expect("Failed to create QueueManager")
    }

    #[test]
    fn test_queue_creation() {
        let manager = create_test_manager();
        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.total_count, 0);
    }

    #[test]
    fn test_add_to_queue() {
        let manager = create_test_manager();

        let item = QueueItem::new(
            SyncDataType::Contacts,
            "encrypted_data_base64".to_string(),
            1,
        );

        let id = manager.add_to_queue(item).unwrap();
        assert!(id > 0);

        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.pending_count, 1);
    }

    #[test]
    fn test_get_pending_items() {
        let manager = create_test_manager();

        // Add two items
        let item1 = QueueItem::new(SyncDataType::Contacts, "data1".to_string(), 1);
        let item2 = QueueItem::new(SyncDataType::Accounts, "data2".to_string(), 1);

        manager.add_to_queue(item1).unwrap();
        manager.add_to_queue(item2).unwrap();

        let pending = manager.get_pending_items().unwrap();
        assert_eq!(pending.len(), 2);
    }

    #[test]
    fn test_mark_failed_and_retry() {
        let manager = create_test_manager();

        let item = QueueItem::new(SyncDataType::Contacts, "data".to_string(), 1);
        let id = manager.add_to_queue(item).unwrap();

        manager.mark_failed_and_retry(id, "Network error".to_string()).unwrap();

        let updated = manager.get_item_by_id(id).unwrap();
        assert_eq!(updated.status, QueueStatus::Failed);
        assert_eq!(updated.retry_count, 1);
        assert!(updated.next_retry_at.is_some());
    }

    #[test]
    fn test_max_retries() {
        let manager = create_test_manager();

        let item = QueueItem::new(SyncDataType::Contacts, "data".to_string(), 1);
        let id = manager.add_to_queue(item).unwrap();

        // Fail 5 times (max retries)
        for _ in 0..5 {
            manager.mark_failed_and_retry(id, "Error".to_string()).unwrap();
        }

        let updated = manager.get_item_by_id(id).unwrap();
        assert_eq!(updated.retry_count, 5);
        assert!(updated.next_retry_at.is_none()); // No more retries

        // Should not appear in pending
        let pending = manager.get_pending_items().unwrap();
        assert_eq!(pending.len(), 0);
    }

    #[test]
    fn test_retry_failed_items() {
        let manager = create_test_manager();

        let item = QueueItem::new(SyncDataType::Contacts, "data".to_string(), 1);
        let id = manager.add_to_queue(item).unwrap();

        // Mark as failed
        manager.mark_failed_and_retry(id, "Error".to_string()).unwrap();

        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.failed_count, 1);

        // Retry failed items
        manager.retry_failed_items().unwrap();

        let updated = manager.get_item_by_id(id).unwrap();
        assert_eq!(updated.status, QueueStatus::Pending);
        assert_eq!(updated.retry_count, 0);
    }

    #[test]
    fn test_clear_completed() {
        let manager = create_test_manager();

        let item = QueueItem::new(SyncDataType::Contacts, "data".to_string(), 1);
        let id = manager.add_to_queue(item).unwrap();

        manager.update_item_status(id, QueueStatus::Completed, None).unwrap();

        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.completed_count, 1);

        // Clear completed items older than 0 days (all)
        manager.clear_completed(0).unwrap();

        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.total_count, 0);
    }

    #[test]
    fn test_exponential_backoff() {
        let item = QueueItem::new(SyncDataType::Contacts, "data".to_string(), 1);

        // Check backoff progression
        let mut test_item = item.clone();

        test_item.retry_count = 0;
        let retry1 = test_item.calculate_next_retry();

        test_item.retry_count = 1;
        let retry2 = test_item.calculate_next_retry();

        test_item.retry_count = 2;
        let retry3 = test_item.calculate_next_retry();

        // Each retry should be further in the future
        assert!(retry2 > retry1);
        assert!(retry3 > retry2);
    }
}
