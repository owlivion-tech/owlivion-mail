# Background Sync Scheduler - Implementation Plan

## 📋 Overview

**Feature:** Minimal Background Sync Scheduler
**Goal:** Auto-sync data at configurable intervals (15-240 minutes)
**Approach:** Tokio-based background task + settings persistence
**Estimated Changes:** ~600 lines across 8 files

---

## 🎯 Core Design Decisions

### Decision 1: Configuration Storage
**✅ CHOSEN:** Use existing `settings` table (key-value JSON)

**Rationale:**
- Consistent with existing app settings pattern
- No database migration needed
- Easy access from any module via `db.get_setting<T>()`

**Settings Keys:**
- `sync_scheduler_enabled`: `bool` (default: false)
- `sync_scheduler_interval_minutes`: `u64` (default: 30)
- `sync_scheduler_last_run`: `Option<String>` (ISO timestamp)

### Decision 2: Background Task Management
**✅ CHOSEN:** Tokio task with `tokio::time::interval`

```rust
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(60 * interval_minutes));
    loop {
        interval.tick().await;
        if !running.load(Ordering::Relaxed) { break; }
        // Sync logic here
    }
})
```

**Rationale:**
- Lightweight and Tokio-native
- Easy cancellation via AtomicBool flag
- Testable with `tokio::time::pause()`

### Decision 3: Scheduler Lifecycle
**Initialization:** Auto-start on app launch if `enabled=true` in settings
**State Management:** Store in `AppState` as `Arc<BackgroundScheduler>`
**Restart Handling:** Stop old task, spawn new task on interval change

### Decision 4: Master Password Challenge
**Problem:** `sync_all()` requires master password, but scheduler runs unattended

**⚠️ LIMITATION:** Background sync will NOT support encrypted sync
**Solution for Minimal Implementation:**
1. Background scheduler calls `sync_all()` with empty master password
2. Server-side sync only (no E2E encryption during auto-sync)
3. UI displays warning: "Otomatik senkronizasyon şifreleme kullanmaz. Manuel senkronizasyon daha güvenlidir."

**Future Enhancement:** Cache derived master key in memory with zeroization

---

## 🏗️ Architecture

### Backend Structure
```
src-tauri/src/
├── sync/
│   ├── mod.rs              [MODIFY] Add `pub mod scheduler;`
│   ├── scheduler.rs        [NEW] Core scheduler logic (~300 lines)
│   ├── manager.rs          [READ-ONLY] Use existing sync_all()
│   └── ...
├── db/
│   ├── mod.rs              [READ-ONLY] Use existing get_setting/set_setting
│   └── schema.sql          [NO CHANGE] Settings table exists
└── lib.rs                  [MODIFY] AppState + 4 Tauri commands (~80 lines)
```

### Frontend Structure
```
src/
├── types/
│   └── index.ts            [MODIFY] Add SchedulerConfig, SchedulerStatus
├── services/
│   └── syncService.ts      [MODIFY] Add 4 scheduler functions
├── hooks/
│   └── useSync.ts          [MODIFY] Add useScheduler hook
└── components/settings/
    └── SyncSettings.tsx    [MODIFY] Add scheduler UI section (~100 lines)
```

---

## 📝 Implementation Steps

### Phase 1: Backend Core (scheduler.rs)

#### File: `src-tauri/src/sync/scheduler.rs` (NEW, ~300 lines)

**Struct Definitions:**
```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use tokio::task::JoinHandle;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use crate::db::Database;
use super::manager::SyncManager;

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

#[derive(Clone)]
pub struct BackgroundScheduler {
    db: Arc<Database>,
    config: Arc<RwLock<SchedulerConfig>>,
    running: Arc<AtomicBool>,
    task_handle: Arc<StdMutex<Option<JoinHandle<()>>>>,
}

#[derive(Debug, thiserror::Error)]
pub enum SchedulerError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Already running")]
    AlreadyRunning,

    #[error("Not running")]
    NotRunning,

    #[error("Invalid interval: {0}")]
    InvalidInterval(String),
}
```

**Implementation Methods:**
```rust
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

    /// Load config from database settings table
    pub async fn load_config(&self) -> Result<(), SchedulerError> {
        let config: SchedulerConfig = self.db
            .get_setting("scheduler_config")
            .map_err(|e| SchedulerError::Database(e.to_string()))?
            .unwrap_or_default();

        *self.config.write().await = config;
        Ok(())
    }

    /// Save config to database
    pub async fn save_config(&self) -> Result<(), SchedulerError> {
        let config = self.config.read().await.clone();
        self.db
            .set_setting("scheduler_config", &config)
            .map_err(|e| SchedulerError::Database(e.to_string()))?;
        Ok(())
    }

    /// Start background scheduler
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
                format!("Must be 1-1440 minutes, got {}", interval_minutes)
            ));
        }

        // Set running flag
        self.running.store(true, Ordering::Relaxed);

        // Spawn background task
        let running_clone = self.running.clone();
        let db_clone = self.db.clone();
        let config_clone = self.config.clone();

        let handle = tokio::spawn(async move {
            Self::scheduler_loop(
                running_clone,
                db_clone,
                config_clone,
                sync_manager_ref,
            ).await;
        });

        // Store handle
        *self.task_handle.lock().unwrap() = Some(handle);

        log::info!("Background scheduler started (interval: {} minutes)", interval_minutes);
        Ok(())
    }

    /// Stop background scheduler
    pub async fn stop(&self) -> Result<(), SchedulerError> {
        if !self.running.load(Ordering::Relaxed) {
            return Err(SchedulerError::NotRunning);
        }

        // Set running flag to false
        self.running.store(false, Ordering::Relaxed);

        // Abort task
        if let Some(handle) = self.task_handle.lock().unwrap().take() {
            handle.abort();
        }

        log::info!("Background scheduler stopped");
        Ok(())
    }

    /// Check if scheduler is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Get current config
    pub async fn get_config(&self) -> SchedulerConfig {
        self.config.read().await.clone()
    }

    /// Update config (will restart scheduler if running)
    pub async fn update_config(
        &self,
        enabled: bool,
        interval_minutes: u64,
        sync_manager_ref: Arc<StdMutex<Option<SyncManager>>>,
    ) -> Result<(), SchedulerError> {
        // Validate interval
        if interval_minutes < 1 || interval_minutes > 1440 {
            return Err(SchedulerError::InvalidInterval(
                format!("Must be 1-1440 minutes, got {}", interval_minutes)
            ));
        }

        // Update config
        {
            let mut config = self.config.write().await;
            config.enabled = enabled;
            config.interval_minutes = interval_minutes;
        }

        // Save to database
        self.save_config().await?;

        // Restart scheduler if running
        let was_running = self.is_running();
        if was_running {
            self.stop().await?;
        }

        if enabled {
            self.start(sync_manager_ref).await?;
        }

        Ok(())
    }

    /// Background scheduler loop
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

        loop {
            interval.tick().await;

            // Check running flag
            if !running.load(Ordering::Relaxed) {
                log::info!("Scheduler loop: running flag is false, exiting");
                break;
            }

            log::info!("Background sync triggered");

            // Get sync manager
            let sync_manager = match sync_manager_ref.lock() {
                Ok(guard) => {
                    match guard.as_ref() {
                        Some(manager) => manager.clone(),
                        None => {
                            log::warn!("Sync manager not initialized");
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
            match sync_manager.sync_all("").await {
                Ok(result) => {
                    log::info!(
                        "Background sync completed: accounts={}, contacts={}, preferences={}, signatures={}",
                        result.accounts_synced,
                        result.contacts_synced,
                        result.preferences_synced,
                        result.signatures_synced
                    );

                    // Update last_run timestamp
                    let mut cfg = config.write().await;
                    cfg.last_run = Some(Utc::now().to_rfc3339());
                    drop(cfg);

                    // Save to database
                    if let Err(e) = db.set_setting("scheduler_config", &*config.read().await) {
                        log::error!("Failed to save last_run: {}", e);
                    }
                }
                Err(e) => {
                    log::error!("Background sync failed: {:?}", e);
                    // Errors will be handled by queue system
                }
            }
        }

        log::info!("Scheduler loop exited");
    }
}
```

**Tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn setup_test_db() -> Arc<Database> {
        let db = Database::new(":memory:").unwrap();
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
    }

    #[tokio::test]
    async fn test_save_load_config() {
        let db = setup_test_db();
        let scheduler = BackgroundScheduler::new(db);

        // Update config
        let mut config = scheduler.get_config().await;
        config.enabled = true;
        config.interval_minutes = 60;
        *scheduler.config.write().await = config;

        // Save
        scheduler.save_config().await.unwrap();

        // Load
        scheduler.load_config().await.unwrap();
        let loaded = scheduler.get_config().await;
        assert!(loaded.enabled);
        assert_eq!(loaded.interval_minutes, 60);
    }
}
```

---

### Phase 2: Backend Integration

#### File: `src-tauri/src/sync/mod.rs` (MODIFY)

**Add line 19 (after history line):**
```rust
pub mod scheduler;
```

**Add line 46 (in re-exports section):**
```rust
pub use scheduler::{BackgroundScheduler, SchedulerConfig, SchedulerError};
```

---

#### File: `src-tauri/src/lib.rs` (MODIFY)

**Update AppState struct (around line 111):**
```rust
pub struct AppState {
    db: Arc<Database>,
    async_imap_clients: tokio::sync::Mutex<HashMap<String, AsyncImapClient>>,
    current_folder: Mutex<HashMap<String, String>>,
    sync_manager: Arc<StdMutex<Option<sync::SyncManager>>>,
    background_scheduler: Arc<sync::BackgroundScheduler>, // NEW
}
```

**Update AppState::new() (around line 119):**
```rust
impl AppState {
    pub fn new(db: Database) -> Self {
        let db_arc = Arc::new(db);

        // Initialize sync manager
        let sync_manager = Arc::new(StdMutex::new(Some(sync::SyncManager::new(db_arc.clone()))));

        // Initialize scheduler
        let background_scheduler = Arc::new(sync::BackgroundScheduler::new(db_arc.clone()));

        Self {
            db: db_arc,
            async_imap_clients: tokio::sync::Mutex::new(HashMap::new()),
            current_folder: Mutex::new(HashMap::new()),
            sync_manager,
            background_scheduler,
        }
    }
    // ... rest of impl
}
```

**Add DTO types (after SyncManagerError, around line 972):**
```rust
/// DTO for scheduler status
#[derive(Debug, Clone, serde::Serialize)]
struct SchedulerStatusDto {
    enabled: bool,
    running: bool,
    interval_minutes: u64,
    last_run: Option<String>,
    next_run: Option<String>, // Calculated: last_run + interval
}
```

**Add Tauri commands (before greet command, around line 1590):**
```rust
/// Start background scheduler
#[tauri::command]
async fn scheduler_start(state: State<'_, AppState>) -> Result<(), String> {
    state.background_scheduler
        .start(state.sync_manager.clone())
        .await
        .map_err(|e| format!("Failed to start scheduler: {}", e))
}

/// Stop background scheduler
#[tauri::command]
async fn scheduler_stop(state: State<'_, AppState>) -> Result<(), String> {
    state.background_scheduler
        .stop()
        .await
        .map_err(|e| format!("Failed to stop scheduler: {}", e))
}

/// Get scheduler status
#[tauri::command]
async fn scheduler_get_status(state: State<'_, AppState>) -> Result<SchedulerStatusDto, String> {
    let config = state.background_scheduler.get_config().await;
    let running = state.background_scheduler.is_running();

    // Calculate next_run
    let next_run = if let Some(ref last_run_str) = config.last_run {
        if let Ok(last_run) = chrono::DateTime::parse_from_rfc3339(last_run_str) {
            let next = last_run + chrono::Duration::minutes(config.interval_minutes as i64);
            Some(next.to_rfc3339())
        } else {
            None
        }
    } else {
        None
    };

    Ok(SchedulerStatusDto {
        enabled: config.enabled,
        running,
        interval_minutes: config.interval_minutes,
        last_run: config.last_run,
        next_run,
    })
}

/// Update scheduler configuration
#[tauri::command]
async fn scheduler_update_config(
    state: State<'_, AppState>,
    enabled: bool,
    interval_minutes: u64,
) -> Result<(), String> {
    state.background_scheduler
        .update_config(enabled, interval_minutes, state.sync_manager.clone())
        .await
        .map_err(|e| format!("Failed to update scheduler config: {}", e))
}
```

**Register commands in invoke_handler (around line 1640):**
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    scheduler_start,
    scheduler_stop,
    scheduler_get_status,
    scheduler_update_config,
])
```

**Auto-start scheduler in setup (in run() function, around line 1628):**
```rust
.setup(|app| {
    // ... existing setup code ...

    // Auto-start scheduler if enabled
    let app_handle = app.handle();
    tauri::async_runtime::spawn(async move {
        if let Some(state) = app_handle.try_state::<AppState>() {
            if let Err(e) = state.background_scheduler.load_config().await {
                log::error!("Failed to load scheduler config: {}", e);
                return;
            }

            let config = state.background_scheduler.get_config().await;
            if config.enabled {
                log::info!("Auto-starting scheduler (interval: {} minutes)", config.interval_minutes);
                if let Err(e) = state.background_scheduler.start(state.sync_manager.clone()).await {
                    log::error!("Failed to auto-start scheduler: {}", e);
                }
            }
        }
    });

    Ok(())
})
```

---

### Phase 3: Frontend Types

#### File: `src/types/index.ts` (MODIFY)

**Add after SyncConfig interface (around line 200):**
```typescript
// Scheduler configuration
export interface SchedulerConfig {
  enabled: boolean;
  intervalMinutes: number;
  lastRun?: string;
}

// Scheduler status with runtime info
export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMinutes: number;
  lastRun?: string;
  nextRun?: string;
}
```

---

### Phase 4: Frontend Service

#### File: `src/services/syncService.ts` (MODIFY)

**Add at end of file:**
```typescript
// ============================================================================
// Background Scheduler
// ============================================================================

/**
 * Get scheduler status
 */
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const status = await invoke<{
    enabled: boolean;
    running: boolean;
    interval_minutes: number;
    last_run?: string;
    next_run?: string;
  }>('scheduler_get_status');

  return {
    enabled: status.enabled,
    running: status.running,
    intervalMinutes: status.interval_minutes,
    lastRun: status.last_run,
    nextRun: status.next_run,
  };
}

/**
 * Start scheduler
 */
export async function startScheduler(): Promise<void> {
  return invoke('scheduler_start');
}

/**
 * Stop scheduler
 */
export async function stopScheduler(): Promise<void> {
  return invoke('scheduler_stop');
}

/**
 * Update scheduler configuration
 */
export async function updateSchedulerConfig(
  enabled: boolean,
  intervalMinutes: number
): Promise<void> {
  return invoke('scheduler_update_config', { enabled, intervalMinutes });
}
```

---

### Phase 5: Frontend Hook

#### File: `src/hooks/useSync.ts` (MODIFY)

**Add at end of file:**
```typescript
/**
 * Hook for background scheduler
 */
export function useScheduler() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const newStatus = await getSchedulerStatus();
      setStatus(newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduler status');
      console.error('Failed to load scheduler:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (enabled: boolean, intervalMinutes: number) => {
    setLoading(true);
    setError(null);
    try {
      await updateSchedulerConfig(enabled, intervalMinutes);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scheduler config');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [reload]);

  // Load on mount
  useEffect(() => {
    reload();
  }, [reload]);

  // Auto-reload every 30 seconds
  useEffect(() => {
    const interval = setInterval(reload, 30000);
    return () => clearInterval(interval);
  }, [reload]);

  return { status, loading, error, reload, updateConfig };
}
```

---

### Phase 6: Frontend UI

#### File: `src/components/settings/SyncSettings.tsx` (MODIFY)

**Import useScheduler hook at top:**
```typescript
import { useScheduler } from '../../hooks/useSync';
```

**Add in component body (after existing hooks):**
```typescript
const { status: schedulerStatus, loading: schedulerLoading, updateConfig: updateScheduler } = useScheduler();
```

**Add UI section after Device Manager section (around line 250):**
```tsx
{/* Background Scheduler Section */}
{config?.enabled && (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Otomatik Senkronizasyon
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Belirli aralıklarla otomatik olarak veri senkronize et
        </p>
      </div>
      <div className="flex items-center gap-2">
        {schedulerStatus?.running ? (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
            Çalışıyor
          </span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            Durduruldu
          </span>
        )}
      </div>
    </div>

    {/* Enable/Disable Toggle */}
    <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div>
        <label htmlFor="scheduler-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Otomatik Senkronizasyonu Etkinleştir
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Kapalı olduğunda yalnızca manuel senkronizasyon yapılır
        </p>
      </div>
      <input
        id="scheduler-enabled"
        type="checkbox"
        checked={schedulerStatus?.enabled || false}
        disabled={schedulerLoading}
        onChange={(e) => {
          updateScheduler(e.target.checked, schedulerStatus?.intervalMinutes || 30);
        }}
        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
      />
    </div>

    {/* Interval Selector */}
    {schedulerStatus?.enabled && (
      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <label htmlFor="scheduler-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Senkronizasyon Aralığı
        </label>
        <select
          id="scheduler-interval"
          value={schedulerStatus?.intervalMinutes || 30}
          disabled={schedulerLoading}
          onChange={(e) => {
            updateScheduler(true, parseInt(e.target.value));
          }}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
        >
          <option value="15">15 Dakika</option>
          <option value="30">30 Dakika (Önerilen)</option>
          <option value="60">1 Saat</option>
          <option value="120">2 Saat</option>
          <option value="240">4 Saat</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Daha sık senkronizasyon daha fazla ağ kullanımına neden olur
        </p>
      </div>
    )}

    {/* Status Display */}
    {schedulerStatus?.enabled && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Son Otomatik Senkronizasyon</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {schedulerStatus.lastRun ? formatLastSync(schedulerStatus.lastRun) : 'Henüz çalışmadı'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sonraki Senkronizasyon</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {schedulerStatus.nextRun ? formatLastSync(schedulerStatus.nextRun) : 'Hesaplanıyor...'}
          </p>
        </div>
      </div>
    )}

    {/* Security Warning */}
    {schedulerStatus?.enabled && (
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>
            <strong>Güvenlik Notu:</strong> Otomatik senkronizasyon şu anda şifreleme desteği sunmamaktadır.
            Hassas verilerin güvenli senkronizasyonu için manuel senkronizasyon kullanın.
          </span>
        </p>
      </div>
    )}
  </div>
)}
```

---

## 🧪 Testing Plan

### Backend Tests

**File:** `src-tauri/src/sync/scheduler.rs` (included in module)

**Test Cases:**
1. ✅ `test_scheduler_new` - Initialization
2. ✅ `test_config_default` - Default values
3. ✅ `test_save_load_config` - Persistence
4. ⚠️ Manual test: `test_start_stop` - Lifecycle (requires runtime)
5. ⚠️ Manual test: `test_interval_execution` - Timing accuracy

**Run Tests:**
```bash
cd src-tauri
cargo test scheduler --lib
```

### Frontend Tests

**Manual Testing Checklist:**
1. ✅ Enable scheduler → Verify status changes to "Çalışıyor"
2. ✅ Change interval → Verify restart
3. ✅ Disable scheduler → Verify status changes to "Durduruldu"
4. ✅ Check last_run updates after sync
5. ✅ Verify next_run calculation
6. ✅ Refresh page → Verify persistence
7. ✅ Check console logs for sync events

---

## ⚠️ Known Limitations

### 1. No Encryption in Background Sync
**Impact:** Data synced in background is NOT encrypted with master password
**Mitigation:** Server-side encryption still applies (TLS in transit)
**User Awareness:** Warning displayed in UI

### 2. No Network State Detection
**Impact:** Scheduler may attempt sync while offline
**Mitigation:** Existing queue system will retry failed syncs
**Future Enhancement:** Add network connectivity check before sync

### 3. No Sync Conflict During Manual Sync
**Impact:** If manual sync is triggered while scheduler is running, may cause conflicts
**Mitigation:** SyncManager should handle concurrent calls (existing mutex in manager.rs)
**Future Enhancement:** Add explicit lock in scheduler before sync_all()

---

## 📦 Files Changed Summary

| File | Status | Lines Changed | Description |
|------|--------|---------------|-------------|
| `src-tauri/src/sync/scheduler.rs` | NEW | ~300 | Core scheduler logic |
| `src-tauri/src/sync/mod.rs` | MODIFY | +3 | Module registration |
| `src-tauri/src/lib.rs` | MODIFY | +120 | AppState, commands, DTOs, auto-start |
| `src/types/index.ts` | MODIFY | +15 | TypeScript types |
| `src/services/syncService.ts` | MODIFY | +40 | Service functions |
| `src/hooks/useSync.ts` | MODIFY | +50 | useScheduler hook |
| `src/components/settings/SyncSettings.tsx` | MODIFY | +120 | UI section |
| **Total** | | **~648 lines** | |

---

## ✅ Success Criteria

1. ✅ Scheduler starts automatically on app launch if enabled
2. ✅ User can enable/disable scheduler from UI
3. ✅ User can change sync interval (15-240 minutes)
4. ✅ Status shows: enabled, running, last_run, next_run
5. ✅ Scheduler persists config across app restarts
6. ✅ Background sync triggers at correct intervals
7. ✅ UI updates reflect scheduler state in real-time
8. ✅ Warning displayed about encryption limitation

---

## 🔄 Future Enhancements (Out of Scope)

1. **Master Password Caching** - Store derived key in memory for encrypted background sync
2. **Network State Detection** - Skip sync when offline
3. **Smart Scheduling** - Adjust interval based on activity
4. **Sync Lock** - Prevent concurrent manual/auto syncs
5. **Battery Awareness** - Skip sync on low battery (desktop app, less critical)
6. **Bandwidth Throttling** - Limit sync data size
7. **Custom Schedules** - Per-data-type intervals

---

## 🎬 Implementation Order

1. ✅ **Step 1:** Create `scheduler.rs` with tests
2. ✅ **Step 2:** Update `sync/mod.rs` (module registration)
3. ✅ **Step 3:** Update `lib.rs` (AppState, commands, auto-start)
4. ✅ **Step 4:** Test backend with `cargo test scheduler`
5. ✅ **Step 5:** Add TypeScript types in `types/index.ts`
6. ✅ **Step 6:** Add service functions in `syncService.ts`
7. ✅ **Step 7:** Add `useScheduler` hook in `useSync.ts`
8. ✅ **Step 8:** Update UI in `SyncSettings.tsx`
9. ✅ **Step 9:** Test frontend in dev mode (`pnpm tauri dev`)
10. ✅ **Step 10:** End-to-end testing (enable, change interval, verify syncs)

---

## 🔐 Security Notes

1. **Input Validation:** Interval must be 1-1440 minutes (enforced in Rust)
2. **Rate Limiting:** Existing sync rate limits apply
3. **Error Handling:** Failed syncs go to queue system (existing)
4. **Master Password:** Background sync does NOT use master password (security trade-off)
5. **Logging:** Scheduler events logged (avoid PII)

---

**Plan Complete** ✅
Ready for implementation approval.
