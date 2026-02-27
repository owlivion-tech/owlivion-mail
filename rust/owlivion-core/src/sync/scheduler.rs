//! Background Sync Scheduler
//!
//! Provides automatic periodic synchronization at configurable intervals.
//! Uses Tokio tasks for non-blocking background execution.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use tokio::task::JoinHandle;
use tokio::sync::RwLock;
use chrono::Utc;
use crate::db::Database;
use super::manager::SyncManager;

/// Scheduler configuration stored in settings table
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SchedulerConfig {
    pub enabled: bool,
    pub interval_minutes: u64,
    pub last_run: Option<String>, // ISO 8601 timestamp
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_minutes: 30,
            last_run: None,
        }
    }
}

/// Background scheduler for automatic sync operations
#[derive(Clone)]
pub struct BackgroundScheduler {
    db: Arc<Database>,
    config: Arc<RwLock<SchedulerConfig>>,
    running: Arc<AtomicBool>,
    task_handle: Arc<StdMutex<Option<JoinHandle<()>>>>,
}

/// Scheduler errors
#[derive(Debug, thiserror::Error)]
pub enum SchedulerError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Scheduler is already running")]
    AlreadyRunning,

    #[error("Scheduler is not running")]
    NotRunning,

    #[error("Invalid interval: {0}")]
    InvalidInterval(String),
}

impl BackgroundScheduler {
    /// Create new scheduler instance
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            config: Arc::new(RwLock::new(SchedulerConfig::default())),
            running: Arc::new(AtomicBool::new(false)),
            task_handle: Arc::new(StdMutex::new(None)),
        }
    }

    /// Load configuration from database settings table
    pub async fn load_config(&self) -> Result<(), SchedulerError> {
        let config: SchedulerConfig = self.db
            .get_setting("scheduler_config")
            .map_err(|e| SchedulerError::Database(e.to_string()))?
            .unwrap_or_default();

        *self.config.write().await = config;
        Ok(())
    }

    /// Save configuration to database settings table
    pub async fn save_config(&self) -> Result<(), SchedulerError> {
        let config = self.config.read().await.clone();
        self.db
            .set_setting("scheduler_config", &config)
            .map_err(|e| SchedulerError::Database(e.to_string()))?;
        Ok(())
    }

    /// Start background scheduler task
    pub async fn start(
        &self,
        sync_manager_ref: Arc<StdMutex<Option<SyncManager>>>,
    ) -> Result<(), SchedulerError> {
        // Check if already running
        if self.running.load(Ordering::Relaxed) {
            return Err(SchedulerError::AlreadyRunning);
        }

        // Validate interval
        let interval_minutes = self.config.read().await.interval_minutes;
        if interval_minutes < 1 || interval_minutes > 1440 {
            return Err(SchedulerError::InvalidInterval(
                format!("Interval must be 1-1440 minutes, got {}", interval_minutes)
            ));
        }

        // Set running flag
        self.running.store(true, Ordering::Relaxed);

        // Clone references for the background task
        let running_clone = self.running.clone();
        let db_clone = self.db.clone();
        let config_clone = self.config.clone();

        // Spawn background task
        let handle = tokio::spawn(async move {
            Self::scheduler_loop(
                running_clone,
                db_clone,
                config_clone,
                sync_manager_ref,
            ).await;
        });

        // Store task handle
        *self.task_handle.lock().unwrap() = Some(handle);

        log::info!("Background scheduler started (interval: {} minutes)", interval_minutes);
        Ok(())
    }

    /// Stop background scheduler task
    pub async fn stop(&self) -> Result<(), SchedulerError> {
        if !self.running.load(Ordering::Relaxed) {
            return Err(SchedulerError::NotRunning);
        }

        // Set running flag to false (signals loop to exit)
        self.running.store(false, Ordering::Relaxed);

        // Abort the task
        if let Some(handle) = self.task_handle.lock().unwrap().take() {
            handle.abort();
        }

        log::info!("Background scheduler stopped");
        Ok(())
    }

    /// Check if scheduler is currently running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Get current configuration
    pub async fn get_config(&self) -> SchedulerConfig {
        self.config.read().await.clone()
    }

    /// Update configuration and restart scheduler if needed
    pub async fn update_config(
        &self,
        enabled: bool,
        interval_minutes: u64,
        sync_manager_ref: Arc<StdMutex<Option<SyncManager>>>,
    ) -> Result<(), SchedulerError> {
        // Validate interval
        if interval_minutes < 1 || interval_minutes > 1440 {
            return Err(SchedulerError::InvalidInterval(
                format!("Interval must be 1-1440 minutes, got {}", interval_minutes)
            ));
        }

        // Update configuration
        {
            let mut config = self.config.write().await;
            config.enabled = enabled;
            config.interval_minutes = interval_minutes;
        }

        // Save to database
        self.save_config().await?;

        // Restart scheduler if it was running
        let was_running = self.is_running();
        if was_running {
            // Ignore error if not running (race condition)
            let _ = self.stop().await;
        }

        // Start if enabled
        if enabled {
            self.start(sync_manager_ref).await?;
        }

        log::info!("Scheduler config updated: enabled={}, interval={} minutes", enabled, interval_minutes);
        Ok(())
    }

    /// Background scheduler loop (runs in spawned task)
    async fn scheduler_loop(
        running: Arc<AtomicBool>,
        db: Arc<Database>,
        config: Arc<RwLock<SchedulerConfig>>,
        sync_manager_ref: Arc<StdMutex<Option<SyncManager>>>,
    ) {
        let interval_minutes = config.read().await.interval_minutes;
        let mut interval = tokio::time::interval(
            std::time::Duration::from_secs(60 * interval_minutes)
        );

        log::info!("Scheduler loop started (interval: {} minutes)", interval_minutes);

        loop {
            interval.tick().await;

            // Check if we should stop
            if !running.load(Ordering::Relaxed) {
                log::info!("Scheduler loop: stopping (running flag is false)");
                break;
            }

            log::info!("Background sync triggered by scheduler");

            // Get sync manager instance
            let sync_manager = match sync_manager_ref.lock() {
                Ok(guard) => {
                    match guard.as_ref() {
                        Some(manager) => manager.clone(),
                        None => {
                            log::warn!("Sync manager not initialized, skipping scheduled sync");
                            continue;
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to lock sync manager: {}", e);
                    continue;
                }
            };

            // Execute sync (without master password for minimal implementation)
            // Note: This means background sync won't support E2E encryption
            match sync_manager.sync_all("").await {
                Ok(result) => {
                    log::info!(
                        "Background sync completed successfully: accounts={}, contacts={}, preferences={}, signatures={}, errors={}",
                        result.accounts_synced,
                        result.contacts_synced,
                        result.preferences_synced,
                        result.signatures_synced,
                        result.errors.len()
                    );

                    if !result.errors.is_empty() {
                        log::warn!("Background sync had {} errors: {:?}", result.errors.len(), result.errors);
                    }

                    // Update last_run timestamp
                    let mut cfg = config.write().await;
                    cfg.last_run = Some(Utc::now().to_rfc3339());
                    drop(cfg);

                    // Save updated config to database
                    if let Err(e) = db.set_setting("scheduler_config", &*config.read().await) {
                        log::error!("Failed to save last_run timestamp: {}", e);
                    }
                }
                Err(e) => {
                    log::error!("Background sync failed: {:?}", e);
                    // Failed sync operations will be queued by the sync manager
                }
            }
        }

        log::info!("Scheduler loop exited");
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn setup_test_db() -> Arc<Database> {
        let db = Database::new(":memory:".into()).unwrap();
        Arc::new(db)
    }

    #[tokio::test]
    async fn test_scheduler_new() {
        let db = setup_test_db();
        let scheduler = BackgroundScheduler::new(db);

        assert!(!scheduler.is_running());
    }

    #[tokio::test]
    async fn test_config_default() {
        let db = setup_test_db();
        let scheduler = BackgroundScheduler::new(db);

        let config = scheduler.get_config().await;
        assert!(!config.enabled);
        assert_eq!(config.interval_minutes, 30);
        assert!(config.last_run.is_none());
    }

    #[tokio::test]
    async fn test_save_load_config() {
        let db = setup_test_db();
        let scheduler = BackgroundScheduler::new(db);

        // Update config
        let test_timestamp = "2026-01-01T12:00:00Z".to_string();
        {
            let mut config = scheduler.config.write().await;
            config.enabled = true;
            config.interval_minutes = 60;
            config.last_run = Some(test_timestamp.clone());
        }

        // Save
        scheduler.save_config().await.unwrap();

        // Load into new config
        scheduler.load_config().await.unwrap();

        // Verify
        let loaded = scheduler.get_config().await;
        assert!(loaded.enabled);
        assert_eq!(loaded.interval_minutes, 60);
        assert_eq!(loaded.last_run, Some(test_timestamp));
    }

    #[tokio::test]
    async fn test_invalid_interval() {
        let db = setup_test_db();
        let scheduler = BackgroundScheduler::new(db);
        let sync_manager_ref = Arc::new(StdMutex::new(None));

        // Test interval too low
        let result = scheduler.update_config(true, 0, sync_manager_ref.clone()).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SchedulerError::InvalidInterval(_)));

        // Test interval too high
        let result = scheduler.update_config(true, 2000, sync_manager_ref).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SchedulerError::InvalidInterval(_)));
    }

    #[tokio::test]
    async fn test_stop_not_running() {
        let db = setup_test_db();
        let scheduler = BackgroundScheduler::new(db);

        let result = scheduler.stop().await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SchedulerError::NotRunning));
    }
}
