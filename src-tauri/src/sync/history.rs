//! Sync History Module - Snapshot Management & Rollback
//!
//! Provides versioned history tracking for all sync operations:
//! - Records encrypted snapshots after each successful sync
//! - Enables rollback to previous versions
//! - Maintains integrity via SHA-256 hashing
//! - Enforces retention policies to limit storage

use crate::db::Database;
use super::crypto::SyncDataType;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::sync::Arc;

// ============================================================================
// Types & Structures
// ============================================================================

/// Sync operation type for history tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncOperation {
    Push,
    Pull,
    Merge,
}

impl SyncOperation {
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncOperation::Push => "push",
            SyncOperation::Pull => "pull",
            SyncOperation::Merge => "merge",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "push" => Ok(SyncOperation::Push),
            "pull" => Ok(SyncOperation::Pull),
            "merge" => Ok(SyncOperation::Merge),
            _ => Err(format!("Invalid operation: {}", s)),
        }
    }
}

/// Sync status for history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncStatus {
    Success,
    Failed,
    Conflict,
}

impl SyncStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncStatus::Success => "success",
            SyncStatus::Failed => "failed",
            SyncStatus::Conflict => "conflict",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "success" => Ok(SyncStatus::Success),
            "failed" => Ok(SyncStatus::Failed),
            "conflict" => Ok(SyncStatus::Conflict),
            _ => Err(format!("Invalid status: {}", s)),
        }
    }
}

/// A single sync history snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncSnapshot {
    pub id: Option<i64>,
    pub data_type: String,
    pub version: i64,
    pub encrypted_snapshot: Vec<u8>,
    pub snapshot_hash: String,
    pub device_id: String,
    pub operation: SyncOperation,
    pub items_count: i32,
    pub sync_status: SyncStatus,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// History statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryStats {
    pub total_snapshots: i32,
    pub oldest_snapshot: Option<DateTime<Utc>>,
    pub newest_snapshot: Option<DateTime<Utc>>,
    pub total_size_bytes: i64,
}

// ============================================================================
// History Manager
// ============================================================================

/// Manages sync history snapshots
pub struct HistoryManager {
    db: Arc<Database>,
}

impl HistoryManager {
    /// Create new history manager
    pub fn new(db: Arc<Database>) -> Result<Self, HistoryError> {
        Ok(Self { db })
    }

    /// Record a sync snapshot
    pub fn record_snapshot(
        &self,
        data_type: SyncDataType,
        version: i64,
        encrypted_data: &[u8],
        device_id: &str,
        operation: SyncOperation,
        items_count: i32,
    ) -> Result<i64, HistoryError> {
        let snapshot_hash = compute_snapshot_hash(encrypted_data);

        let snapshot_id = self.db.execute(
            "INSERT INTO sync_history (
                data_type, version, encrypted_snapshot, snapshot_hash,
                device_id, operation, items_count, sync_status, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(data_type, version) DO UPDATE SET
                encrypted_snapshot = excluded.encrypted_snapshot,
                snapshot_hash = excluded.snapshot_hash,
                device_id = excluded.device_id,
                operation = excluded.operation,
                items_count = excluded.items_count,
                sync_status = excluded.sync_status,
                created_at = excluded.created_at",
            rusqlite::params![
                data_type.as_str(),
                version,
                encrypted_data,
                snapshot_hash,
                device_id,
                operation.as_str(),
                items_count,
                SyncStatus::Success.as_str(),
                Utc::now().to_rfc3339(),
            ],
        ).map_err(|e| HistoryError::DatabaseError(e.to_string()))?;

        Ok(snapshot_id)
    }

    /// Get history for a specific data type
    pub fn get_history(
        &self,
        data_type: SyncDataType,
        limit: i32,
    ) -> Result<Vec<SyncSnapshot>, HistoryError> {
        self.db.query(
            "SELECT id, data_type, version, encrypted_snapshot, snapshot_hash,
                    device_id, operation, items_count, sync_status, error_message, created_at
             FROM sync_history
             WHERE data_type = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
            rusqlite::params![data_type.as_str(), limit],
            |row| {
                Ok(SyncSnapshot {
                    id: Some(row.get(0)?),
                    data_type: row.get(1)?,
                    version: row.get(2)?,
                    encrypted_snapshot: row.get(3)?,
                    snapshot_hash: row.get(4)?,
                    device_id: row.get(5)?,
                    operation: SyncOperation::from_str(&row.get::<_, String>(6)?).unwrap(),
                    items_count: row.get(7)?,
                    sync_status: SyncStatus::from_str(&row.get::<_, String>(8)?).unwrap(),
                    error_message: row.get(9)?,
                    created_at: row.get::<_, String>(10)?.parse().unwrap(),
                })
            }
        ).map_err(|e| HistoryError::DatabaseError(e.to_string()))
    }

    /// Get a specific snapshot by version
    pub fn get_snapshot(
        &self,
        data_type: SyncDataType,
        version: i64,
    ) -> Result<Option<SyncSnapshot>, HistoryError> {
        let result = self.db.query_row(
            "SELECT id, data_type, version, encrypted_snapshot, snapshot_hash,
                    device_id, operation, items_count, sync_status, error_message, created_at
             FROM sync_history
             WHERE data_type = ?1 AND version = ?2",
            rusqlite::params![data_type.as_str(), version],
            |row| {
                Ok(SyncSnapshot {
                    id: Some(row.get(0)?),
                    data_type: row.get(1)?,
                    version: row.get(2)?,
                    encrypted_snapshot: row.get(3)?,
                    snapshot_hash: row.get(4)?,
                    device_id: row.get(5)?,
                    operation: SyncOperation::from_str(&row.get::<_, String>(6)?).unwrap(),
                    items_count: row.get(7)?,
                    sync_status: SyncStatus::from_str(&row.get::<_, String>(8)?).unwrap(),
                    error_message: row.get(9)?,
                    created_at: row.get::<_, String>(10)?.parse().unwrap(),
                })
            }
        );

        match result {
            Ok(s) => Ok(Some(s)),
            Err(e) if e.to_string().contains("not found") => Ok(None),
            Err(e) => Err(HistoryError::DatabaseError(e.to_string())),
        }
    }

    /// Prepare for rollback with integrity verification
    pub fn prepare_rollback(
        &self,
        data_type: SyncDataType,
        version: i64,
    ) -> Result<SyncSnapshot, HistoryError> {
        let snapshot = self.get_snapshot(data_type, version)?
            .ok_or(HistoryError::SnapshotNotFound)?;

        // Verify hash integrity
        let computed_hash = compute_snapshot_hash(&snapshot.encrypted_snapshot);
        if computed_hash != snapshot.snapshot_hash {
            return Err(HistoryError::IntegrityCheckFailed);
        }

        Ok(snapshot)
    }

    /// Enforce retention policy - delete snapshots older than specified days
    pub fn enforce_retention_policy(
        &self,
        retention_days: i64,
    ) -> Result<i32, HistoryError> {
        let cutoff_date = Utc::now() - chrono::Duration::days(retention_days);

        let deleted = self.db.execute(
            "DELETE FROM sync_history WHERE created_at < ?1",
            rusqlite::params![cutoff_date.to_rfc3339()],
        ).map_err(|e| HistoryError::DatabaseError(e.to_string()))?;

        Ok(deleted as i32)
    }

    /// Get statistics about sync history
    pub fn get_stats(&self) -> Result<HistoryStats, HistoryError> {
        self.db.query_row(
            "SELECT
                COUNT(*) as total,
                MIN(created_at) as oldest,
                MAX(created_at) as newest,
                SUM(LENGTH(encrypted_snapshot)) as total_size
             FROM sync_history",
            [],
            |row| {
                Ok(HistoryStats {
                    total_snapshots: row.get(0)?,
                    oldest_snapshot: row.get::<_, Option<String>>(1)?
                        .and_then(|s| s.parse().ok()),
                    newest_snapshot: row.get::<_, Option<String>>(2)?
                        .and_then(|s| s.parse().ok()),
                    total_size_bytes: row.get(3).unwrap_or(0),
                })
            }
        ).map_err(|e| HistoryError::DatabaseError(e.to_string()))
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Compute SHA-256 hash of data
fn compute_snapshot_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum HistoryError {
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Snapshot not found")]
    SnapshotNotFound,

    #[error("Integrity check failed - snapshot may be corrupted")]
    IntegrityCheckFailed,

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_db() -> (Arc<Database>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db = Arc::new(Database::new(db_path).unwrap());
        (db, temp_dir)
    }

    #[test]
    fn test_record_snapshot() {
        let (db, _temp) = create_test_db();
        let manager = HistoryManager::new(db).unwrap();

        let test_data = b"encrypted test data";
        let result = manager.record_snapshot(
            SyncDataType::Accounts,
            1,
            test_data,
            "test-device",
            SyncOperation::Push,
            5,
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_get_history() {
        let (db, _temp) = create_test_db();
        let manager = HistoryManager::new(db).unwrap();

        // Record some snapshots
        manager.record_snapshot(
            SyncDataType::Accounts,
            1,
            b"data1",
            "device1",
            SyncOperation::Push,
            3,
        ).unwrap();

        manager.record_snapshot(
            SyncDataType::Accounts,
            2,
            b"data2",
            "device1",
            SyncOperation::Pull,
            5,
        ).unwrap();

        let history = manager.get_history(SyncDataType::Accounts, 10).unwrap();
        assert_eq!(history.len(), 2);
    }

    #[test]
    fn test_integrity_verification() {
        let (db, _temp) = create_test_db();
        let manager = HistoryManager::new(db).unwrap();

        let test_data = b"important data";
        manager.record_snapshot(
            SyncDataType::Contacts,
            1,
            test_data,
            "device1",
            SyncOperation::Push,
            10,
        ).unwrap();

        let result = manager.prepare_rollback(SyncDataType::Contacts, 1);
        assert!(result.is_ok());
    }

    #[test]
    fn test_retention_policy() {
        let (db, _temp) = create_test_db();
        let manager = HistoryManager::new(db).unwrap();

        // Record snapshot
        manager.record_snapshot(
            SyncDataType::Preferences,
            1,
            b"old data",
            "device1",
            SyncOperation::Push,
            2,
        ).unwrap();

        // Enforce retention (delete snapshots older than 30 days)
        let deleted = manager.enforce_retention_policy(30).unwrap();
        // Should be 0 since we just created the snapshot
        assert_eq!(deleted, 0);
    }
}
