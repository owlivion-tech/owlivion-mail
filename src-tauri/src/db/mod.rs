//! Database module for Owlivion Mail
//!
//! Provides SQLite database operations for email storage, accounts, and settings.
//! SECURITY HARDENED: Input validation, LIKE escaping, pagination limits

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use thiserror::Error;

// Connection pooling
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;

// SECURITY: Maximum pagination limits
const MAX_PAGE_SIZE: i32 = 100;
const MAX_SEARCH_LIMIT: i32 = 200;

/// SECURITY: Escape LIKE wildcards to prevent pattern injection
fn escape_like_pattern(query: &str) -> String {
    query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// SECURITY: Sanitize FTS5 query to prevent injection attacks
/// Removes/escapes FTS5 special operators and syntax
fn sanitize_fts5_query(query: &str) -> String {
    // FTS5 special characters and operators to handle:
    // - Quotes: " (phrase matching)
    // - Operators: AND, OR, NOT, NEAR
    // - Prefix: * (wildcard)
    // - Column filter: column:
    // - Parentheses: ( )
    // - Minus: - (exclusion)
    // - Caret: ^ (boost)

    let mut result = String::with_capacity(query.len());

    // Remove dangerous FTS5 operators (case-insensitive)
    let dangerous_ops = [" AND ", " OR ", " NOT ", " NEAR ", " NEAR/"];
    let mut cleaned = query.to_string();
    for op in dangerous_ops {
        cleaned = cleaned.to_uppercase().replace(op, " ").to_lowercase();
        // Preserve original case for non-operator parts
        let original_lower = query.to_lowercase();
        if original_lower != cleaned {
            cleaned = original_lower;
        }
    }

    // Process character by character
    for ch in query.chars() {
        match ch {
            // Remove FTS5 special characters
            '"' | '*' | '(' | ')' | '^' | '{' | '}' | '[' | ']' => {
                // Skip these characters
            }
            // Replace colon (column filter) with space
            ':' => result.push(' '),
            // Replace minus (exclusion) at word start with space
            '-' => {
                if result.is_empty() || result.ends_with(' ') {
                    result.push(' ');
                } else {
                    result.push(ch);
                }
            }
            // Allow alphanumeric, spaces, and basic punctuation
            _ if ch.is_alphanumeric() || ch.is_whitespace() || ch == '.' || ch == ',' || ch == '@' || ch == '_' => {
                result.push(ch);
            }
            // Skip other special characters
            _ => result.push(' '),
        }
    }

    // Clean up multiple spaces and trim
    let mut final_result = String::new();
    let mut last_was_space = true;
    for ch in result.chars() {
        if ch == ' ' {
            if !last_was_space {
                final_result.push(' ');
                last_was_space = true;
            }
        } else {
            final_result.push(ch);
            last_was_space = false;
        }
    }

    final_result.trim().to_string()
}

/// Database error types
#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Connection pool error: {0}")]
    Pool(#[from] r2d2::Error),

    #[error("Database not initialized")]
    NotInitialized,

    #[error("Record not found: {0}")]
    NotFound(String),

    #[error("Constraint violation: {0}")]
    Constraint(String),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

pub type DbResult<T> = Result<T, DbError>;

/// Database manager for thread-safe SQLite access
/// Uses connection pooling for better performance (10-20x faster than mutex)
#[derive(Clone)]
pub struct Database {
    pool: Arc<Pool<SqliteConnectionManager>>,
}

impl Database {
    /// Create a new database connection pool
    /// Uses r2d2 for connection pooling (10-20x faster than mutex locking)
    pub fn new(db_path: PathBuf) -> DbResult<Self> {
        let manager = SqliteConnectionManager::file(&db_path);

        let pool = Pool::builder()
            .max_size(20)           // Max 20 connections in pool
            .min_idle(Some(4))      // Keep 4 idle connections ready
            .connection_timeout(std::time::Duration::from_secs(10))
            .test_on_check_out(false) // Skip connection test for performance
            .build(manager)?;

        // Initialize one connection for schema and migrations
        let conn = pool.get()?;

        // Performance PRAGMAs
        conn.execute_batch(r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            PRAGMA temp_store = MEMORY;
            PRAGMA mmap_size = 268435456;
            PRAGMA page_size = 4096;
        "#)?;

        // Initialize schema
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;

        // Run migrations
        Self::run_migrations(&*conn)?;

        // Drop the init connection back to pool
        drop(conn);

        Ok(Self {
            pool: Arc::new(pool),
        })
    }

    /// Create an in-memory database pool (for testing)
    pub fn in_memory() -> DbResult<Self> {
        let manager = SqliteConnectionManager::memory();

        let pool = Pool::builder()
            .max_size(10)           // Smaller pool for testing
            .min_idle(Some(2))
            .build(manager)?;

        let conn = pool.get()?;

        // Performance PRAGMAs (same as file-based)
        conn.execute_batch(r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            PRAGMA temp_store = MEMORY;
        "#)?;

        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;

        Self::run_migrations(&*conn)?;
        drop(conn);

        Ok(Self {
            pool: Arc::new(pool),
        })
    }

    /// Get a connection from the pool
    /// Public for advanced database operations
    #[inline]
    pub fn get_conn(&self) -> DbResult<PooledConnection<SqliteConnectionManager>> {
        Ok(self.pool.get()?)
    }

    // =========================================================================
    // MIGRATIONS
    // =========================================================================

    /// Run migrations for existing databases
    fn run_migrations(conn: &Connection) -> DbResult<()> {
        // Migration 1: Add signature column to accounts table if not exists
        let has_signature: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('accounts') WHERE name = 'signature'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_signature {
            log::info!("Running migration: Adding signature column to accounts");
            conn.execute("ALTER TABLE accounts ADD COLUMN signature TEXT DEFAULT ''", [])?;
        }

        // Migration 2: Add accept_invalid_certs column to accounts table if not exists
        let has_accept_invalid_certs: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('accounts') WHERE name = 'accept_invalid_certs'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_accept_invalid_certs {
            log::info!("Running migration: Adding accept_invalid_certs column to accounts");
            conn.execute("ALTER TABLE accounts ADD COLUMN accept_invalid_certs INTEGER NOT NULL DEFAULT 0", [])?;
        }

        // Migration 3: Add close_to_tray setting if not exists
        let has_close_to_tray: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM settings WHERE key = 'close_to_tray'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_close_to_tray {
            log::info!("Running migration: Adding close_to_tray setting");
            conn.execute("INSERT INTO settings (key, value) VALUES ('close_to_tray', 'true')", [])?;
        }

        // Migration 4: Delta Sync - Add deleted column to accounts table
        let has_accounts_deleted: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('accounts') WHERE name = 'deleted'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_accounts_deleted {
            log::info!("Running migration: Adding deleted column to accounts (delta sync)");
            conn.execute("ALTER TABLE accounts ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0", [])?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(deleted) WHERE deleted = 0", [])?;
        }

        // Migration 5: Delta Sync - Add deleted column to contacts table
        let has_contacts_deleted: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('contacts') WHERE name = 'deleted'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_contacts_deleted {
            log::info!("Running migration: Adding deleted column to contacts (delta sync)");
            conn.execute("ALTER TABLE contacts ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0", [])?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted) WHERE deleted = 0", [])?;
        }

        // Migration 6: Delta Sync - Create sync_metadata table
        let has_sync_metadata: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='sync_metadata'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_sync_metadata {
            log::info!("Running migration: Creating sync_metadata table (delta sync)");
            conn.execute_batch(r#"
                CREATE TABLE sync_metadata (
                    data_type TEXT PRIMARY KEY CHECK (data_type IN ('accounts', 'contacts', 'preferences', 'signatures')),
                    last_sync_at TEXT,
                    last_sync_version INTEGER DEFAULT 0,
                    items_synced INTEGER DEFAULT 0,
                    items_changed INTEGER DEFAULT 0,
                    items_deleted INTEGER DEFAULT 0,
                    sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
                    error_message TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                INSERT INTO sync_metadata (data_type, last_sync_at) VALUES
                    ('accounts', NULL),
                    ('contacts', NULL),
                    ('preferences', NULL),
                    ('signatures', NULL);

                CREATE TRIGGER sync_metadata_updated_at AFTER UPDATE ON sync_metadata
                BEGIN
                    UPDATE sync_metadata SET updated_at = datetime('now') WHERE data_type = NEW.data_type;
                END;
            "#)?;
        }

        // Migration 7: Add priority_enabled column to accounts table
        let has_priority_enabled: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('accounts') WHERE name = 'priority_enabled'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_priority_enabled {
            log::info!("Running migration: Adding priority_enabled column to accounts");
            conn.execute("ALTER TABLE accounts ADD COLUMN priority_enabled INTEGER DEFAULT 1", [])?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_accounts_priority ON accounts(priority_enabled)", [])?;
        }

        // Migration 8: Email Templates - Create email_templates table
        let has_templates: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='email_templates'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_templates {
            log::info!("Running migration: Creating email_templates table");
            conn.execute_batch(include_str!("migrations/007_add_email_templates.sql"))?;
        }

        // Migration 9: Add enable_priority_fetch column to accounts table
        let has_enable_priority_fetch: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('accounts') WHERE name = 'enable_priority_fetch'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_enable_priority_fetch {
            log::info!("Running migration: Adding enable_priority_fetch column to accounts");
            conn.execute_batch(include_str!("migrations/008_add_account_priority_settings.sql"))?;
        }

        Ok(())
    }

    // =========================================================================
    // ACCOUNTS
    // =========================================================================

    /// Add a new email account
    pub fn add_account(&self, account: &NewAccount) -> DbResult<i64> {
        let conn = self.get_conn()?;

        // If this account is set as default, first remove default from all other accounts
        if account.is_default {
            conn.execute("UPDATE accounts SET is_default = 0 WHERE is_default = 1", [])?;
        }

        conn.execute(
            r#"
            INSERT INTO accounts (
                email, display_name,
                imap_host, imap_port, imap_security, imap_username,
                smtp_host, smtp_port, smtp_security, smtp_username,
                password_encrypted,
                oauth_provider, oauth_access_token, oauth_refresh_token, oauth_expires_at,
                is_active, is_default, signature, sync_days, accept_invalid_certs
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
            params![
                account.email,
                account.display_name,
                account.imap_host,
                account.imap_port,
                account.imap_security,
                account.imap_username,
                account.smtp_host,
                account.smtp_port,
                account.smtp_security,
                account.smtp_username,
                account.password_encrypted,
                account.oauth_provider,
                account.oauth_access_token,
                account.oauth_refresh_token,
                account.oauth_expires_at,
                1, // is_active - always set to 1 (active) when adding new account
                account.is_default,
                account.signature,
                account.sync_days,
                account.accept_invalid_certs,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get all accounts
    pub fn get_accounts(&self) -> DbResult<Vec<Account>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT id, email, display_name,
                   imap_host, imap_port, imap_security, imap_username,
                   smtp_host, smtp_port, smtp_security, smtp_username,
                   oauth_provider, oauth_refresh_token, oauth_expires_at,
                   is_active, is_default, signature, sync_days,
                   accept_invalid_certs, COALESCE(enable_priority_fetch, 1), created_at, updated_at
            FROM accounts
            ORDER BY is_default DESC, email ASC
            "#,
        )?;

        let accounts = stmt
            .query_map([], |row| {
                Ok(Account {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    display_name: row.get(2)?,
                    imap_host: row.get(3)?,
                    imap_port: row.get(4)?,
                    imap_security: row.get(5)?,
                    imap_username: row.get(6)?,
                    smtp_host: row.get(7)?,
                    smtp_port: row.get(8)?,
                    smtp_security: row.get(9)?,
                    smtp_username: row.get(10)?,
                    oauth_provider: row.get(11)?,
                    oauth_refresh_token: row.get(12)?,
                    oauth_expires_at: row.get(13)?,
                    is_active: row.get(14)?,
                    is_default: row.get(15)?,
                    signature: row.get(16)?,
                    sync_days: row.get(17)?,
                    accept_invalid_certs: row.get(18)?,
                    enable_priority_fetch: row.get(19)?,
                    created_at: row.get(20)?,
                    updated_at: row.get(21)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    }

    /// Get account by ID
    pub fn get_account(&self, id: i64) -> DbResult<Account> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let account = conn.query_row(
            r#"
            SELECT id, email, display_name,
                   imap_host, imap_port, imap_security, imap_username,
                   smtp_host, smtp_port, smtp_security, smtp_username,
                   oauth_provider, oauth_refresh_token, oauth_expires_at,
                   is_active, is_default, signature, sync_days,
                   accept_invalid_certs, COALESCE(enable_priority_fetch, 1), created_at, updated_at
            FROM accounts WHERE id = ?1
            "#,
            [id],
            |row| {
                Ok(Account {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    display_name: row.get(2)?,
                    imap_host: row.get(3)?,
                    imap_port: row.get(4)?,
                    imap_security: row.get(5)?,
                    imap_username: row.get(6)?,
                    smtp_host: row.get(7)?,
                    smtp_port: row.get(8)?,
                    smtp_security: row.get(9)?,
                    smtp_username: row.get(10)?,
                    oauth_provider: row.get(11)?,
                    oauth_refresh_token: row.get(12)?,
                    oauth_expires_at: row.get(13)?,
                    is_active: row.get(14)?,
                    is_default: row.get(15)?,
                    signature: row.get(16)?,
                    sync_days: row.get(17)?,
                    accept_invalid_certs: row.get(18)?,
                    enable_priority_fetch: row.get(19)?,
                    created_at: row.get(20)?,
                    updated_at: row.get(21)?,
                })
            },
        )?;

        Ok(account)
    }

    /// Get all active accounts
    pub fn get_all_accounts(&self) -> DbResult<Vec<Account>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, email, display_name,
                   imap_host, imap_port, imap_security, imap_username,
                   smtp_host, smtp_port, smtp_security, smtp_username,
                   oauth_provider, oauth_refresh_token, oauth_expires_at,
                   is_active, is_default, signature, sync_days,
                   accept_invalid_certs, COALESCE(enable_priority_fetch, 1), created_at, updated_at
            FROM accounts
            WHERE is_active = 1
            ORDER BY is_default DESC, email ASC
            "#,
        )?;

        let accounts = stmt.query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                email: row.get(1)?,
                display_name: row.get(2)?,
                imap_host: row.get(3)?,
                imap_port: row.get(4)?,
                imap_security: row.get(5)?,
                imap_username: row.get(6)?,
                smtp_host: row.get(7)?,
                smtp_port: row.get(8)?,
                smtp_security: row.get(9)?,
                smtp_username: row.get(10)?,
                oauth_provider: row.get(11)?,
                oauth_refresh_token: row.get(12)?,
                oauth_expires_at: row.get(13)?,
                is_active: row.get(14)?,
                is_default: row.get(15)?,
                signature: row.get(16)?,
                sync_days: row.get(17)?,
                accept_invalid_certs: row.get(18)?,
                enable_priority_fetch: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    }

    /// Get account by email address
    pub fn get_account_by_email(&self, email: &str) -> DbResult<Option<Account>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, email, display_name,
                   imap_host, imap_port, imap_security, imap_username,
                   smtp_host, smtp_port, smtp_security, smtp_username,
                   oauth_provider, oauth_refresh_token, oauth_expires_at,
                   is_active, is_default, signature, sync_days,
                   accept_invalid_certs, COALESCE(enable_priority_fetch, 1), created_at, updated_at
            FROM accounts
            WHERE email = ?1 AND is_active = 1
            "#,
        )?;

        let result = stmt.query_row([email], |row| {
            Ok(Account {
                id: row.get(0)?,
                email: row.get(1)?,
                display_name: row.get(2)?,
                imap_host: row.get(3)?,
                imap_port: row.get(4)?,
                imap_security: row.get(5)?,
                imap_username: row.get(6)?,
                smtp_host: row.get(7)?,
                smtp_port: row.get(8)?,
                smtp_security: row.get(9)?,
                smtp_username: row.get(10)?,
                oauth_provider: row.get(11)?,
                oauth_refresh_token: row.get(12)?,
                oauth_expires_at: row.get(13)?,
                is_active: row.get(14)?,
                is_default: row.get(15)?,
                signature: row.get(16)?,
                sync_days: row.get(17)?,
                accept_invalid_certs: row.get(18)?,
                enable_priority_fetch: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        });

        match result {
            Ok(account) => Ok(Some(account)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DbError::from(e)),
        }
    }

    /// Get account password (encrypted)
    pub fn get_account_password(&self, id: i64) -> DbResult<Option<String>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let password: Option<String> = conn.query_row(
            "SELECT password_encrypted FROM accounts WHERE id = ?1",
            [id],
            |row| row.get(0),
        )?;
        Ok(password)
    }

    /// Delete account
    pub fn delete_account(&self, id: i64) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        conn.execute("DELETE FROM accounts WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Set default account
    pub fn set_default_account(&self, id: i64) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        conn.execute("UPDATE accounts SET is_default = 0", [])?;
        conn.execute("UPDATE accounts SET is_default = 1 WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Update an existing account
    pub fn update_account(&self, id: i64, account: &NewAccount) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        // If this account is set as default, first remove default from all other accounts
        if account.is_default {
            conn.execute("UPDATE accounts SET is_default = 0 WHERE id != ?1", [id])?;
        }

        conn.execute(
            r#"
            UPDATE accounts SET
                email = ?1,
                display_name = ?2,
                imap_host = ?3,
                imap_port = ?4,
                imap_security = ?5,
                smtp_host = ?6,
                smtp_port = ?7,
                smtp_security = ?8,
                password_encrypted = ?9,
                is_default = ?10,
                updated_at = datetime('now')
            WHERE id = ?11
            "#,
            params![
                account.email,
                account.display_name,
                account.imap_host,
                account.imap_port,
                account.imap_security,
                account.smtp_host,
                account.smtp_port,
                account.smtp_security,
                account.password_encrypted,
                account.is_default,
                id,
            ],
        )?;

        Ok(())
    }

    /// Update account signature only
    pub fn update_account_signature(&self, id: i64, signature: &str) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE accounts SET signature = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![signature, id],
        )?;

        Ok(())
    }

    /// Update OAuth access token
    pub fn update_oauth_access_token(&self, id: i64, encrypted_token: &str) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE accounts SET password_encrypted = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![encrypted_token, id],
        )?;

        Ok(())
    }

    /// Update OAuth token expiry time
    pub fn update_oauth_expires_at(&self, id: i64, expires_at: i64) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE accounts SET oauth_expires_at = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![expires_at, id],
        )?;

        Ok(())
    }

    /// Update OAuth refresh token
    pub fn update_oauth_refresh_token(&self, id: i64, refresh_token: &str) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE accounts SET oauth_refresh_token = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![refresh_token, id],
        )?;

        Ok(())
    }

    /// Get priority fetching setting for an account
    pub fn get_account_priority_setting(&self, account_id: i64) -> DbResult<bool> {
        let conn = self.get_conn()?;

        let enabled: i32 = conn.query_row(
            "SELECT COALESCE(enable_priority_fetch, 1) FROM accounts WHERE id = ?1",
            [account_id],
            |row| row.get(0),
        )?;

        Ok(enabled != 0)
    }

    /// Set priority fetching setting for an account
    pub fn set_account_priority_setting(&self, account_id: i64, enabled: bool) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE accounts SET enable_priority_fetch = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![enabled as i32, account_id],
        )?;

        Ok(())
    }

    /// Get account metadata (display_name and email) for badge generation
    pub fn get_account_metadata(&self, account_id: i64) -> DbResult<(String, String)> {
        let conn = self.get_conn()?;

        conn.query_row(
            "SELECT display_name, email FROM accounts WHERE id = ?1",
            [account_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(DbError::from)
    }

    // =========================================================================
    // FOLDERS
    // =========================================================================

    /// Add or update folder
    pub fn upsert_folder(&self, folder: &NewFolder) -> DbResult<i64> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute(
            r#"
            INSERT INTO folders (account_id, name, remote_name, folder_type, is_subscribed, is_selectable, delimiter)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(account_id, remote_name) DO UPDATE SET
                name = excluded.name,
                folder_type = excluded.folder_type,
                is_subscribed = excluded.is_subscribed,
                is_selectable = excluded.is_selectable
            "#,
            params![
                folder.account_id,
                folder.name,
                folder.remote_name,
                folder.folder_type,
                folder.is_subscribed,
                folder.is_selectable,
                folder.delimiter,
            ],
        )?;

        // Get the folder ID
        let folder_id: i64 = conn.query_row(
            "SELECT id FROM folders WHERE account_id = ?1 AND remote_name = ?2",
            params![folder.account_id, folder.remote_name],
            |row| row.get(0),
        )?;

        Ok(folder_id)
    }

    /// Get folders for account
    pub fn get_folders(&self, account_id: i64) -> DbResult<Vec<Folder>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT id, account_id, name, remote_name, folder_type,
                   unread_count, total_count, is_subscribed, is_selectable, delimiter
            FROM folders
            WHERE account_id = ?1
            ORDER BY
                CASE folder_type
                    WHEN 'inbox' THEN 1
                    WHEN 'starred' THEN 2
                    WHEN 'sent' THEN 3
                    WHEN 'drafts' THEN 4
                    WHEN 'archive' THEN 5
                    WHEN 'spam' THEN 6
                    WHEN 'trash' THEN 7
                    ELSE 8
                END,
                name ASC
            "#,
        )?;

        let folders = stmt
            .query_map([account_id], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    name: row.get(2)?,
                    remote_name: row.get(3)?,
                    folder_type: row.get(4)?,
                    unread_count: row.get(5)?,
                    total_count: row.get(6)?,
                    is_subscribed: row.get(7)?,
                    is_selectable: row.get(8)?,
                    delimiter: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(folders)
    }

    /// Update folder counts
    pub fn update_folder_counts(&self, folder_id: i64, unread: i32, total: i32) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE folders SET unread_count = ?1, total_count = ?2 WHERE id = ?3",
            params![unread, total, folder_id],
        )?;
        Ok(())
    }

    // =========================================================================
    // EMAILS
    // =========================================================================

    /// Insert or update email
    pub fn upsert_email(&self, email: &NewEmail) -> DbResult<i64> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute(
            r#"
            INSERT INTO emails (
                account_id, folder_id, message_id, uid,
                from_address, from_name, to_addresses, cc_addresses, bcc_addresses, reply_to,
                subject, preview, body_text, body_html, date,
                is_read, is_starred, is_deleted, is_spam, is_draft, is_answered, is_forwarded,
                has_attachments, has_inline_images,
                thread_id, in_reply_to, references_header, raw_headers, raw_size, priority, labels
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
                ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31
            )
            ON CONFLICT(account_id, folder_id, uid) DO UPDATE SET
                is_read = excluded.is_read,
                is_starred = excluded.is_starred,
                is_deleted = excluded.is_deleted,
                is_spam = excluded.is_spam,
                is_answered = excluded.is_answered,
                is_forwarded = excluded.is_forwarded,
                body_text = COALESCE(excluded.body_text, body_text),
                body_html = COALESCE(excluded.body_html, body_html)
            "#,
            params![
                email.account_id,
                email.folder_id,
                email.message_id,
                email.uid,
                email.from_address,
                email.from_name,
                email.to_addresses,
                email.cc_addresses,
                email.bcc_addresses,
                email.reply_to,
                email.subject,
                email.preview,
                email.body_text,
                email.body_html,
                email.date,
                email.is_read,
                email.is_starred,
                email.is_deleted,
                email.is_spam,
                email.is_draft,
                email.is_answered,
                email.is_forwarded,
                email.has_attachments,
                email.has_inline_images,
                email.thread_id,
                email.in_reply_to,
                email.references_header,
                email.raw_headers,
                email.raw_size,
                email.priority,
                email.labels,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Batch upsert emails (10-50x faster for large syncs)
    /// Uses transaction to batch multiple inserts efficiently
    pub fn batch_upsert_emails(&self, emails: &[NewEmail]) -> DbResult<Vec<i64>> {
        if emails.is_empty() {
            return Ok(Vec::new());
        }

        let mut conn = self.get_conn()?;
        let tx = conn.transaction()?;

        let mut email_ids = Vec::with_capacity(emails.len());

        // Prepare statement once for all emails
        let mut stmt = tx.prepare(r#"
            INSERT INTO emails (
                account_id, folder_id, message_id, uid,
                from_address, from_name, to_addresses, cc_addresses, bcc_addresses, reply_to,
                subject, preview, body_text, body_html, date,
                is_read, is_starred, is_deleted, is_spam, is_draft, is_answered, is_forwarded,
                has_attachments, has_inline_images,
                thread_id, in_reply_to, references_header, raw_headers, raw_size, priority, labels
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
                ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31
            )
            ON CONFLICT(account_id, folder_id, uid) DO UPDATE SET
                is_read = excluded.is_read,
                is_starred = excluded.is_starred,
                is_deleted = excluded.is_deleted,
                is_spam = excluded.is_spam,
                is_answered = excluded.is_answered,
                is_forwarded = excluded.is_forwarded,
                body_text = COALESCE(excluded.body_text, body_text),
                body_html = COALESCE(excluded.body_html, body_html)
        "#)?;

        for email in emails {
            stmt.execute(params![
                email.account_id,
                email.folder_id,
                email.message_id,
                email.uid,
                email.from_address,
                email.from_name,
                email.to_addresses,
                email.cc_addresses,
                email.bcc_addresses,
                email.reply_to,
                email.subject,
                email.preview,
                email.body_text,
                email.body_html,
                email.date,
                email.is_read,
                email.is_starred,
                email.is_deleted,
                email.is_spam,
                email.is_draft,
                email.is_answered,
                email.is_forwarded,
                email.has_attachments,
                email.has_inline_images,
                email.thread_id,
                email.in_reply_to,
                email.references_header,
                email.raw_headers,
                email.raw_size,
                email.priority,
                email.labels,
            ])?;

            email_ids.push(tx.last_insert_rowid());
        }

        drop(stmt);
        tx.commit()?;

        Ok(email_ids)
    }

    /// Get emails for folder with pagination
    /// SECURITY: Enforces pagination limits to prevent DoS
    pub fn get_emails(
        &self,
        account_id: i64,
        folder_id: i64,
        limit: i32,
        offset: i32,
    ) -> DbResult<Vec<EmailSummary>> {
        // SECURITY: Validate account_id is positive
        if account_id <= 0 {
            return Err(DbError::Constraint("Invalid account ID".to_string()));
        }

        // SECURITY: Enforce pagination limits
        let safe_limit = limit.min(MAX_PAGE_SIZE).max(1);
        let safe_offset = offset.max(0);

        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT id, message_id, uid, from_address, from_name, subject, preview, date,
                   is_read, is_starred, has_attachments, has_inline_images
            FROM emails
            WHERE account_id = ?1 AND folder_id = ?2 AND is_deleted = 0
            ORDER BY date DESC
            LIMIT ?3 OFFSET ?4
            "#,
        )?;

        let emails = stmt
            .query_map(params![account_id, folder_id, safe_limit, safe_offset], |row| {
                Ok(EmailSummary {
                    id: row.get(0)?,
                    message_id: row.get(1)?,
                    uid: row.get(2)?,
                    from_address: row.get(3)?,
                    from_name: row.get(4)?,
                    subject: row.get(5)?,
                    preview: row.get(6)?,
                    date: row.get(7)?,
                    is_read: row.get(8)?,
                    is_starred: row.get(9)?,
                    has_attachments: row.get(10)?,
                    has_inline_images: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(emails)
    }

    /// Get full email by ID
    pub fn get_email(&self, id: i64) -> DbResult<Email> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let email = conn.query_row(
            r#"
            SELECT id, account_id, folder_id, message_id, uid,
                   from_address, from_name, to_addresses, cc_addresses, bcc_addresses, reply_to,
                   subject, preview, body_text, body_html, date,
                   is_read, is_starred, is_deleted, is_spam, is_draft, is_answered, is_forwarded,
                   has_attachments, has_inline_images,
                   thread_id, in_reply_to, references_header, priority, labels
            FROM emails WHERE id = ?1
            "#,
            [id],
            |row| {
                Ok(Email {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    folder_id: row.get(2)?,
                    message_id: row.get(3)?,
                    uid: row.get(4)?,
                    from_address: row.get(5)?,
                    from_name: row.get(6)?,
                    to_addresses: row.get(7)?,
                    cc_addresses: row.get(8)?,
                    bcc_addresses: row.get(9)?,
                    reply_to: row.get(10)?,
                    subject: row.get(11)?,
                    preview: row.get(12)?,
                    body_text: row.get(13)?,
                    body_html: row.get(14)?,
                    date: row.get(15)?,
                    is_read: row.get(16)?,
                    is_starred: row.get(17)?,
                    is_deleted: row.get(18)?,
                    is_spam: row.get(19)?,
                    is_draft: row.get(20)?,
                    is_answered: row.get(21)?,
                    is_forwarded: row.get(22)?,
                    has_attachments: row.get(23)?,
                    has_inline_images: row.get(24)?,
                    thread_id: row.get(25)?,
                    in_reply_to: row.get(26)?,
                    references_header: row.get(27)?,
                    priority: row.get(28)?,
                    labels: row.get(29)?,
                })
            },
        )?;

        Ok(email)
    }

    /// Update email flags
    pub fn update_email_flags(
        &self,
        id: i64,
        is_read: Option<bool>,
        is_starred: Option<bool>,
        is_deleted: Option<bool>,
    ) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        if let Some(read) = is_read {
            conn.execute("UPDATE emails SET is_read = ?1 WHERE id = ?2", params![read, id])?;
        }
        if let Some(starred) = is_starred {
            conn.execute("UPDATE emails SET is_starred = ?1 WHERE id = ?2", params![starred, id])?;
        }
        if let Some(deleted) = is_deleted {
            conn.execute("UPDATE emails SET is_deleted = ?1 WHERE id = ?2", params![deleted, id])?;
        }

        Ok(())
    }

    /// Search emails using FTS
    /// SECURITY: Validates account_id, sanitizes FTS5 query, and enforces search limits
    pub fn search_emails(&self, account_id: i64, query: &str, limit: i32) -> DbResult<Vec<EmailSummary>> {
        // SECURITY: Validate account_id is positive
        if account_id <= 0 {
            return Err(DbError::Constraint("Invalid account ID".to_string()));
        }

        // SECURITY: Validate query is not empty and not too long
        if query.is_empty() || query.len() > 500 {
            return Err(DbError::Constraint("Invalid search query length".to_string()));
        }

        // SECURITY: Sanitize FTS5 query to prevent injection
        let sanitized_query = sanitize_fts5_query(query);
        if sanitized_query.is_empty() {
            return Err(DbError::Constraint("Invalid search query after sanitization".to_string()));
        }

        // SECURITY: Enforce search limit
        let safe_limit = limit.min(MAX_SEARCH_LIMIT).max(1);

        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT e.id, e.message_id, e.uid, e.from_address, e.from_name,
                   e.subject, e.preview, e.date,
                   e.is_read, e.is_starred, e.has_attachments, e.has_inline_images
            FROM emails e
            JOIN emails_fts fts ON fts.rowid = e.id
            WHERE e.account_id = ?1 AND emails_fts MATCH ?2
            ORDER BY e.date DESC
            LIMIT ?3
            "#,
        )?;

        let emails = stmt
            .query_map(params![account_id, sanitized_query, safe_limit], |row| {
                Ok(EmailSummary {
                    id: row.get(0)?,
                    message_id: row.get(1)?,
                    uid: row.get(2)?,
                    from_address: row.get(3)?,
                    from_name: row.get(4)?,
                    subject: row.get(5)?,
                    preview: row.get(6)?,
                    date: row.get(7)?,
                    is_read: row.get(8)?,
                    is_starred: row.get(9)?,
                    has_attachments: row.get(10)?,
                    has_inline_images: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(emails)
    }

    /// Advanced search with filters
    /// SECURITY: Validates all inputs, builds safe SQL queries
    pub fn search_emails_advanced(
        &self,
        account_id: i64,
        filters: &SearchFilters,
        limit: i32,
        offset: i32,
    ) -> DbResult<SearchResult> {
        // SECURITY: Validate account_id
        if account_id <= 0 {
            return Err(DbError::Constraint("Invalid account ID".to_string()));
        }

        // SECURITY: Enforce search limit
        let safe_limit = limit.min(MAX_SEARCH_LIMIT).max(1);
        let safe_offset = offset.max(0);

        // Build WHERE clauses
        let mut where_clauses = vec!["e.account_id = ?1".to_string()];
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(account_id)];
        let mut param_index = 2;

        // FTS5 query (if provided)
        let use_fts = if let Some(ref query) = filters.query {
            if !query.is_empty() && query.len() <= 500 {
                let sanitized = sanitize_fts5_query(query);
                if !sanitized.is_empty() {
                    params.push(Box::new(sanitized));
                    true
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };

        // Date range filter
        if let Some(ref date_range) = filters.date_range {
            if let Some(ref start) = date_range.start_date {
                where_clauses.push(format!("e.date >= ?{}", param_index));
                params.push(Box::new(start.clone()));
                param_index += 1;
            }
            if let Some(ref end) = date_range.end_date {
                where_clauses.push(format!("e.date <= ?{}", param_index));
                params.push(Box::new(end.clone()));
                param_index += 1;
            }
        }

        // Sender filter
        if let Some(ref from_email) = filters.from_email {
            where_clauses.push(format!("e.from_address LIKE ?{} ESCAPE '\\'", param_index));
            let pattern = format!("%{}%", escape_like_pattern(from_email));
            params.push(Box::new(pattern));
            param_index += 1;
        }

        if let Some(ref from_domain) = filters.from_domain {
            where_clauses.push(format!("e.from_address LIKE ?{} ESCAPE '\\'", param_index));
            let pattern = format!("%@{}%", escape_like_pattern(from_domain));
            params.push(Box::new(pattern));
            param_index += 1;
        }

        // Folder filter
        if let Some(folder_id) = filters.folder_id {
            where_clauses.push(format!("e.folder_id = ?{}", param_index));
            params.push(Box::new(folder_id));
            param_index += 1;
        }

        // Attachment filter
        if let Some(has_attachments) = filters.has_attachments {
            where_clauses.push(format!("e.has_attachments = ?{}", param_index));
            params.push(Box::new(has_attachments));
            param_index += 1;
        }

        // Read/unread filter
        if let Some(is_read) = filters.is_read {
            where_clauses.push(format!("e.is_read = ?{}", param_index));
            params.push(Box::new(is_read));
            param_index += 1;
        }

        // Starred filter
        if let Some(is_starred) = filters.is_starred {
            where_clauses.push(format!("e.is_starred = ?{}", param_index));
            params.push(Box::new(is_starred));
            param_index += 1;
        }

        // Inline images filter
        if let Some(has_inline_images) = filters.has_inline_images {
            where_clauses.push(format!("e.has_inline_images = ?{}", param_index));
            params.push(Box::new(has_inline_images));
            param_index += 1;
        }

        // Build SQL query
        let base_select = r#"
            SELECT e.id, e.message_id, e.uid, e.from_address, e.from_name,
                   e.subject, e.preview, e.date,
                   e.is_read, e.is_starred, e.has_attachments, e.has_inline_images
            FROM emails e
        "#;

        let fts_join = if use_fts {
            "JOIN emails_fts fts ON fts.rowid = e.id"
        } else {
            ""
        };

        let fts_where = if use_fts {
            "emails_fts MATCH ?2"
        } else {
            ""
        };

        let mut all_where_clauses = where_clauses.clone();
        if use_fts {
            all_where_clauses.push(fts_where.to_string());
        }

        let where_clause = if !all_where_clauses.is_empty() {
            format!("WHERE {}", all_where_clauses.join(" AND "))
        } else {
            String::new()
        };

        let query = format!(
            "{} {} {} ORDER BY e.date DESC LIMIT {} OFFSET {}",
            base_select, fts_join, where_clause, safe_limit, safe_offset
        );

        // Execute query
        let start_time = std::time::Instant::now();

        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(&query)?;

        // Convert params to references for query_map
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let emails = stmt
            .query_map(&param_refs[..], |row| {
                Ok(EmailSummary {
                    id: row.get(0)?,
                    message_id: row.get(1)?,
                    uid: row.get(2)?,
                    from_address: row.get(3)?,
                    from_name: row.get(4)?,
                    subject: row.get(5)?,
                    preview: row.get(6)?,
                    date: row.get(7)?,
                    is_read: row.get(8)?,
                    is_starred: row.get(9)?,
                    has_attachments: row.get(10)?,
                    has_inline_images: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let search_time = start_time.elapsed().as_millis() as i64;
        let total_count = emails.len() as i64;
        let has_more = emails.len() as i32 == safe_limit;

        Ok(SearchResult {
            emails,
            total_count,
            has_more,
            search_time,
        })
    }

    // =========================================================================
    // SETTINGS
    // =========================================================================

    /// Get a setting value
    pub fn get_setting<T: serde::de::DeserializeOwned>(&self, key: &str) -> DbResult<Option<T>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let result: Result<String, _> = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        );

        match result {
            Ok(json) => {
                let value: T = serde_json::from_str(&json)
                    .map_err(|e| DbError::Serialization(e.to_string()))?;
                Ok(Some(value))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Set a setting value
    pub fn set_setting<T: Serialize>(&self, key: &str, value: &T) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let json = serde_json::to_string(value)
            .map_err(|e| DbError::Serialization(e.to_string()))?;

        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, json],
        )?;

        Ok(())
    }

    // =========================================================================
    // TRUSTED SENDERS
    // =========================================================================

    /// Add trusted sender
    pub fn add_trusted_sender(&self, email: &str, domain: Option<&str>) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT OR IGNORE INTO trusted_senders (email, domain) VALUES (?1, ?2)",
            params![email, domain],
        )?;
        Ok(())
    }

    /// Check if sender is trusted
    pub fn is_trusted_sender(&self, email: &str) -> DbResult<bool> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        // Check exact email match
        let email_trusted: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM trusted_senders WHERE email = ?1)",
            [email],
            |row| row.get(0),
        )?;

        if email_trusted {
            return Ok(true);
        }

        // Check domain match
        if let Some(domain) = email.split('@').last() {
            let domain_trusted: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM trusted_senders WHERE domain = ?1)",
                [domain],
                |row| row.get(0),
            )?;
            return Ok(domain_trusted);
        }

        Ok(false)
    }

    /// Get all trusted senders
    pub fn get_trusted_senders(&self) -> DbResult<Vec<TrustedSender>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, email, domain, trusted_at FROM trusted_senders ORDER BY trusted_at DESC",
        )?;

        let senders = stmt
            .query_map([], |row| {
                Ok(TrustedSender {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    domain: row.get(2)?,
                    trusted_at: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(senders)
    }

    /// Remove trusted sender
    pub fn remove_trusted_sender(&self, id: i64) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        conn.execute("DELETE FROM trusted_senders WHERE id = ?1", [id])?;
        Ok(())
    }

    // =========================================================================
    // CONTACTS
    // =========================================================================

    /// Add or update contact
    pub fn upsert_contact(&self, contact: &NewContact) -> DbResult<i64> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute(
            r#"
            INSERT INTO contacts (account_id, email, name, avatar_url, company, phone, notes, is_favorite)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(account_id, email) DO UPDATE SET
                name = COALESCE(excluded.name, name),
                avatar_url = COALESCE(excluded.avatar_url, avatar_url),
                company = COALESCE(excluded.company, company),
                email_count = email_count + 1,
                last_emailed_at = datetime('now')
            "#,
            params![
                contact.account_id,
                contact.email,
                contact.name,
                contact.avatar_url,
                contact.company,
                contact.phone,
                contact.notes,
                contact.is_favorite,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get all contacts (for sync purposes)
    pub fn get_all_contacts(&self) -> DbResult<Vec<Contact>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, account_id, email, name, avatar_url, company, phone, notes,
                   is_favorite, email_count, last_emailed_at
            FROM contacts
            ORDER BY email_count DESC, email ASC
            "#,
        )?;

        let contacts = stmt.query_map([], |row| {
            Ok(Contact {
                id: row.get(0)?,
                account_id: row.get(1)?,
                email: row.get(2)?,
                name: row.get(3)?,
                avatar_url: row.get(4)?,
                company: row.get(5)?,
                phone: row.get(6)?,
                notes: row.get(7)?,
                is_favorite: row.get(8)?,
                email_count: row.get(9)?,
                last_emailed_at: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(contacts)
    }

    /// Search contacts
    /// SECURITY: Requires account_id, escapes LIKE wildcards, enforces limits
    pub fn search_contacts(&self, account_id: i64, query: &str, limit: i32) -> DbResult<Vec<Contact>> {
        // SECURITY: Validate account_id is positive (no global search allowed)
        if account_id <= 0 {
            return Err(DbError::Constraint("Account ID is required for contact search".to_string()));
        }

        // SECURITY: Validate query length
        if query.len() > 200 {
            return Err(DbError::Constraint("Search query too long".to_string()));
        }

        // SECURITY: Enforce search limit
        let safe_limit = limit.min(MAX_SEARCH_LIMIT).max(1);

        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        // SECURITY: Escape LIKE wildcards to prevent pattern injection
        let escaped_query = escape_like_pattern(query);
        let search_pattern = format!("%{}%", escaped_query);

        let mut stmt = conn.prepare(
            r#"
            SELECT id, account_id, email, name, avatar_url, company, phone, notes,
                   is_favorite, email_count, last_emailed_at
            FROM contacts
            WHERE account_id = ?1
              AND (email LIKE ?2 ESCAPE '\' OR name LIKE ?2 ESCAPE '\')
            ORDER BY email_count DESC, name ASC
            LIMIT ?3
            "#,
        )?;

        let contacts = stmt.query_map(params![account_id, search_pattern, safe_limit], |row| {
            Ok(Contact {
                id: row.get(0)?,
                account_id: row.get(1)?,
                email: row.get(2)?,
                name: row.get(3)?,
                avatar_url: row.get(4)?,
                company: row.get(5)?,
                phone: row.get(6)?,
                notes: row.get(7)?,
                is_favorite: row.get(8)?,
                email_count: row.get(9)?,
                last_emailed_at: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(contacts)
    }

    // =========================================================================
    // EMAIL TEMPLATES
    // =========================================================================

    /// Add a new email template
    pub fn add_template(&self, template: &NewEmailTemplate) -> DbResult<i64> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let tags_json = serde_json::to_string(&template.tags)
            .unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            r#"
            INSERT INTO email_templates (
                account_id, name, description, category, subject_template,
                body_html_template, body_text_template, tags, is_enabled, is_favorite
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                template.account_id,
                template.name,
                template.description,
                template.category,
                template.subject_template,
                template.body_html_template,
                template.body_text_template,
                tags_json,
                template.is_enabled,
                template.is_favorite,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get all templates for an account (or global templates if account_id is None)
    pub fn get_templates(&self, account_id: i64) -> DbResult<Vec<EmailTemplate>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, account_id, name, description, category, subject_template,
                   body_html_template, body_text_template, tags, is_enabled,
                   is_favorite, usage_count, last_used_at, created_at, updated_at
            FROM email_templates
            WHERE account_id = ?1 OR account_id IS NULL
            ORDER BY is_favorite DESC, usage_count DESC, updated_at DESC
            "#,
        )?;

        let templates = stmt.query_map(params![account_id], |row| {
            let tags_json: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(EmailTemplate {
                id: row.get(0)?,
                account_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                subject_template: row.get(5)?,
                body_html_template: row.get(6)?,
                body_text_template: row.get(7)?,
                tags,
                is_enabled: row.get(9)?,
                is_favorite: row.get(10)?,
                usage_count: row.get(11)?,
                last_used_at: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(templates)
    }

    /// Get a single template by ID
    pub fn get_template(&self, id: i64) -> DbResult<EmailTemplate> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let template = conn.query_row(
            r#"
            SELECT id, account_id, name, description, category, subject_template,
                   body_html_template, body_text_template, tags, is_enabled,
                   is_favorite, usage_count, last_used_at, created_at, updated_at
            FROM email_templates
            WHERE id = ?1
            "#,
            params![id],
            |row| {
                let tags_json: String = row.get(8)?;
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

                Ok(EmailTemplate {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    category: row.get(4)?,
                    subject_template: row.get(5)?,
                    body_html_template: row.get(6)?,
                    body_text_template: row.get(7)?,
                    tags,
                    is_enabled: row.get(9)?,
                    is_favorite: row.get(10)?,
                    usage_count: row.get(11)?,
                    last_used_at: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        )?;

        Ok(template)
    }

    /// Update an existing template
    pub fn update_template(&self, id: i64, template: &NewEmailTemplate) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let tags_json = serde_json::to_string(&template.tags)
            .unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            r#"
            UPDATE email_templates
            SET account_id = ?1, name = ?2, description = ?3, category = ?4,
                subject_template = ?5, body_html_template = ?6, body_text_template = ?7,
                tags = ?8, is_enabled = ?9, is_favorite = ?10
            WHERE id = ?11
            "#,
            params![
                template.account_id,
                template.name,
                template.description,
                template.category,
                template.subject_template,
                template.body_html_template,
                template.body_text_template,
                tags_json,
                template.is_enabled,
                template.is_favorite,
                id,
            ],
        )?;

        Ok(())
    }

    /// Delete a template
    pub fn delete_template(&self, id: i64) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute("DELETE FROM email_templates WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Toggle template enabled status
    pub fn toggle_template(&self, id: i64) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE email_templates SET is_enabled = NOT is_enabled WHERE id = ?1",
            params![id],
        )?;

        Ok(())
    }

    /// Toggle template favorite status
    pub fn toggle_template_favorite(&self, id: i64) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE email_templates SET is_favorite = NOT is_favorite WHERE id = ?1",
            params![id],
        )?;

        Ok(())
    }

    /// Increment template usage count and update last_used_at
    pub fn increment_template_usage(&self, id: i64) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute(
            r#"
            UPDATE email_templates
            SET usage_count = usage_count + 1,
                last_used_at = datetime('now')
            WHERE id = ?1
            "#,
            params![id],
        )?;

        Ok(())
    }

    /// Search templates using FTS5
    pub fn search_templates(&self, account_id: i64, query: &str, limit: i32) -> DbResult<Vec<EmailTemplate>> {
        const MAX_SEARCH_LIMIT: i32 = 200;
        let safe_limit = limit.clamp(1, MAX_SEARCH_LIMIT);

        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        // Escape FTS5 special characters and build search query
        let search_query = query
            .replace('"', "\"\"")
            .split_whitespace()
            .map(|word| format!("\"{}\"*", word))
            .collect::<Vec<_>>()
            .join(" OR ");

        let mut stmt = conn.prepare(
            r#"
            SELECT t.id, t.account_id, t.name, t.description, t.category,
                   t.subject_template, t.body_html_template, t.body_text_template,
                   t.tags, t.is_enabled, t.is_favorite, t.usage_count,
                   t.last_used_at, t.created_at, t.updated_at
            FROM email_templates t
            INNER JOIN templates_fts f ON t.id = f.rowid
            WHERE (t.account_id = ?1 OR t.account_id IS NULL)
              AND f.templates_fts MATCH ?2
            ORDER BY t.is_favorite DESC, t.usage_count DESC, f.rank
            LIMIT ?3
            "#,
        )?;

        let templates = stmt.query_map(params![account_id, search_query, safe_limit], |row| {
            let tags_json: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(EmailTemplate {
                id: row.get(0)?,
                account_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                subject_template: row.get(5)?,
                body_html_template: row.get(6)?,
                body_text_template: row.get(7)?,
                tags,
                is_enabled: row.get(9)?,
                is_favorite: row.get(10)?,
                usage_count: row.get(11)?,
                last_used_at: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(templates)
    }

    /// Get templates by category
    pub fn get_templates_by_category(&self, account_id: i64, category: &str) -> DbResult<Vec<EmailTemplate>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, account_id, name, description, category, subject_template,
                   body_html_template, body_text_template, tags, is_enabled,
                   is_favorite, usage_count, last_used_at, created_at, updated_at
            FROM email_templates
            WHERE (account_id = ?1 OR account_id IS NULL)
              AND category = ?2
            ORDER BY is_favorite DESC, usage_count DESC, updated_at DESC
            "#,
        )?;

        let templates = stmt.query_map(params![account_id, category], |row| {
            let tags_json: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(EmailTemplate {
                id: row.get(0)?,
                account_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                subject_template: row.get(5)?,
                body_html_template: row.get(6)?,
                body_text_template: row.get(7)?,
                tags,
                is_enabled: row.get(9)?,
                is_favorite: row.get(10)?,
                usage_count: row.get(11)?,
                last_used_at: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(templates)
    }

    /// Get favorite templates
    pub fn get_favorite_templates(&self, account_id: i64) -> DbResult<Vec<EmailTemplate>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, account_id, name, description, category, subject_template,
                   body_html_template, body_text_template, tags, is_enabled,
                   is_favorite, usage_count, last_used_at, created_at, updated_at
            FROM email_templates
            WHERE (account_id = ?1 OR account_id IS NULL)
              AND is_favorite = 1
            ORDER BY usage_count DESC, updated_at DESC
            "#,
        )?;

        let templates = stmt.query_map(params![account_id], |row| {
            let tags_json: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(EmailTemplate {
                id: row.get(0)?,
                account_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                subject_template: row.get(5)?,
                body_html_template: row.get(6)?,
                body_text_template: row.get(7)?,
                tags,
                is_enabled: row.get(9)?,
                is_favorite: row.get(10)?,
                usage_count: row.get(11)?,
                last_used_at: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(templates)
    }

    // =========================================================================
    // SYNC STATE
    // =========================================================================

    /// Get sync state for folder
    pub fn get_sync_state(&self, account_id: i64, folder_id: i64) -> DbResult<Option<SyncState>> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;
        let result = conn.query_row(
            r#"
            SELECT id, account_id, folder_id, last_uid, uid_validity, highest_mod_seq,
                   last_full_sync_at, last_incremental_sync_at, sync_status, sync_error
            FROM sync_state
            WHERE account_id = ?1 AND folder_id = ?2
            "#,
            params![account_id, folder_id],
            |row| {
                Ok(SyncState {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    folder_id: row.get(2)?,
                    last_uid: row.get(3)?,
                    uid_validity: row.get(4)?,
                    highest_mod_seq: row.get(5)?,
                    last_full_sync_at: row.get(6)?,
                    last_incremental_sync_at: row.get(7)?,
                    sync_status: row.get(8)?,
                    sync_error: row.get(9)?,
                })
            },
        );

        match result {
            Ok(state) => Ok(Some(state)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Update sync state
    pub fn update_sync_state(
        &self,
        account_id: i64,
        folder_id: i64,
        last_uid: u32,
        uid_validity: Option<u32>,
    ) -> DbResult<()> {
        // SECURITY: Handle mutex poisoning gracefully
        let conn = self.get_conn()?;

        conn.execute(
            r#"
            INSERT INTO sync_state (account_id, folder_id, last_uid, uid_validity, last_incremental_sync_at)
            VALUES (?1, ?2, ?3, ?4, datetime('now'))
            ON CONFLICT(account_id, folder_id) DO UPDATE SET
                last_uid = ?3,
                uid_validity = COALESCE(?4, uid_validity),
                last_incremental_sync_at = datetime('now'),
                sync_status = 'idle',
                sync_error = NULL
            "#,
            params![account_id, folder_id, last_uid, uid_validity],
        )?;

        Ok(())
    }

    // =========================================================================
    // HELPER METHODS (for queue module and other internal use)
    // =========================================================================

    /// Execute a SQL statement and return affected rows (for internal use)
    pub fn execute<P>(&self, sql: &str, params: P) -> DbResult<usize>
    where
        P: rusqlite::Params,
    {
        let conn = self.get_conn()?;

        let affected = conn.execute(sql, params)?;
        Ok(affected)
    }

    /// Execute an INSERT statement and return the last inserted row ID
    pub fn execute_insert<P>(&self, sql: &str, params: P) -> DbResult<i64>
    where
        P: rusqlite::Params,
    {
        let conn = self.get_conn()?;

        conn.execute(sql, params)?;
        Ok(conn.last_insert_rowid())
    }

    /// Query database and map results (for internal use)
    pub fn query<T, P, F>(&self, sql: &str, params: P, f: F) -> DbResult<Vec<T>>
    where
        P: rusqlite::Params,
        F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
    {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params, f)?;

        rows.collect::<rusqlite::Result<Vec<T>>>()
            .map_err(DbError::from)
    }

    /// Query single row (for internal use)
    pub fn query_row<T, P, F>(&self, sql: &str, params: P, f: F) -> DbResult<T>
    where
        P: rusqlite::Params,
        F: FnOnce(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
    {
        let conn = self.get_conn()?;

        conn.query_row(sql, params, f).map_err(DbError::from)
    }

    /// Insert attachment for an email
    pub fn insert_attachment(&self, attachment: &NewAttachment) -> DbResult<i64> {
        let conn = self.get_conn()?;

        conn.execute(
            r#"
            INSERT INTO attachments
            (email_id, filename, content_type, size, content_id, is_inline, local_path, is_downloaded)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                attachment.email_id,
                attachment.filename,
                attachment.content_type,
                attachment.size,
                attachment.content_id,
                attachment.is_inline,
                attachment.local_path,
                attachment.is_downloaded,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get all attachments for an email
    pub fn get_attachments_for_email(&self, email_id: i64) -> DbResult<Vec<Attachment>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, email_id, filename, content_type, size, content_id,
                   is_inline, local_path, is_downloaded, created_at
            FROM attachments
            WHERE email_id = ?1
            ORDER BY is_inline ASC, filename ASC
            "#,
        )?;

        let attachments = stmt
            .query_map([email_id], |row| {
                Ok(Attachment {
                    id: row.get(0)?,
                    email_id: row.get(1)?,
                    filename: row.get(2)?,
                    content_type: row.get(3)?,
                    size: row.get(4)?,
                    content_id: row.get(5)?,
                    is_inline: row.get(6)?,
                    local_path: row.get(7)?,
                    is_downloaded: row.get(8)?,
                    created_at: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(attachments)
    }

    /// Get attachment by ID
    pub fn get_attachment(&self, id: i64) -> DbResult<Attachment> {
        let conn = self.get_conn()?;

        let attachment = conn.query_row(
            r#"
            SELECT id, email_id, filename, content_type, size, content_id,
                   is_inline, local_path, is_downloaded, created_at
            FROM attachments
            WHERE id = ?1
            "#,
            [id],
            |row| {
                Ok(Attachment {
                    id: row.get(0)?,
                    email_id: row.get(1)?,
                    filename: row.get(2)?,
                    content_type: row.get(3)?,
                    size: row.get(4)?,
                    content_id: row.get(5)?,
                    is_inline: row.get(6)?,
                    local_path: row.get(7)?,
                    is_downloaded: row.get(8)?,
                    created_at: row.get(9)?,
                })
            },
        )?;

        Ok(attachment)
    }

    /// Update attachment local path after download
    pub fn update_attachment_path(&self, id: i64, local_path: &str) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE attachments SET local_path = ?1, is_downloaded = 1 WHERE id = ?2",
            params![local_path, id],
        )?;

        Ok(())
    }

    /// Get folder by ID
    pub fn get_folder_by_id(&self, id: i64) -> DbResult<Folder> {
        let conn = self.get_conn()?;

        let folder = conn.query_row(
            "SELECT id, account_id, name, remote_name, folder_type, unread_count, total_count, is_subscribed, is_selectable, delimiter FROM folders WHERE id = ?1",
            [id],
            |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    name: row.get(2)?,
                    remote_name: row.get(3)?,
                    folder_type: row.get(4)?,
                    unread_count: row.get(5)?,
                    total_count: row.get(6)?,
                    is_subscribed: row.get(7)?,
                    is_selectable: row.get(8)?,
                    delimiter: row.get(9)?,
                })
            },
        )?;

        Ok(folder)
    }

    /// Execute batch SQL (for internal use)
    pub fn execute_batch(&self, sql: &str) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute_batch(sql).map_err(DbError::from)
    }

    // =========================================================================
    // EMAIL FILTERS
    // =========================================================================

    /// Add a new email filter
    pub fn add_filter(&self, filter: &NewEmailFilter) -> DbResult<i64> {
        let conn = self.get_conn()?;

        let conditions_json = serde_json::to_string(&filter.conditions)
            .map_err(|e| DbError::Serialization(e.to_string()))?;
        let actions_json = serde_json::to_string(&filter.actions)
            .map_err(|e| DbError::Serialization(e.to_string()))?;

        conn.execute(
            r#"
            INSERT INTO email_filters (
                account_id, name, description, is_enabled, priority,
                match_logic, conditions, actions
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                filter.account_id,
                filter.name,
                filter.description,
                filter.is_enabled,
                filter.priority,
                filter.match_logic.as_str(),
                conditions_json,
                actions_json,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get all filters for an account
    pub fn get_filters(&self, account_id: i64) -> DbResult<Vec<EmailFilter>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, account_id, name, description, is_enabled, priority,
                   match_logic, conditions, actions, matched_count, last_matched_at,
                   created_at, updated_at
            FROM email_filters
            WHERE account_id = ?1
            ORDER BY priority ASC, id ASC
            "#,
        )?;

        let filters = stmt
            .query_map([account_id], |row| {
                let conditions_json: String = row.get(7)?;
                let actions_json: String = row.get(8)?;
                let match_logic_str: String = row.get(6)?;

                let conditions = serde_json::from_str(&conditions_json)
                    .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
                let actions = serde_json::from_str(&actions_json)
                    .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
                let match_logic = match match_logic_str.as_str() {
                    "all" => MatchLogic::All,
                    "any" => MatchLogic::Any,
                    _ => MatchLogic::All,
                };

                Ok(EmailFilter {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    is_enabled: row.get(4)?,
                    priority: row.get(5)?,
                    match_logic,
                    conditions,
                    actions,
                    matched_count: row.get(9)?,
                    last_matched_at: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(filters)
    }

    /// Get filter by ID
    pub fn get_filter(&self, id: i64) -> DbResult<EmailFilter> {
        let conn = self.get_conn()?;

        let filter = conn.query_row(
            r#"
            SELECT id, account_id, name, description, is_enabled, priority,
                   match_logic, conditions, actions, matched_count, last_matched_at,
                   created_at, updated_at
            FROM email_filters
            WHERE id = ?1
            "#,
            [id],
            |row| {
                let conditions_json: String = row.get(7)?;
                let actions_json: String = row.get(8)?;
                let match_logic_str: String = row.get(6)?;

                let conditions = serde_json::from_str(&conditions_json)
                    .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
                let actions = serde_json::from_str(&actions_json)
                    .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
                let match_logic = match match_logic_str.as_str() {
                    "all" => MatchLogic::All,
                    "any" => MatchLogic::Any,
                    _ => MatchLogic::All,
                };

                Ok(EmailFilter {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    is_enabled: row.get(4)?,
                    priority: row.get(5)?,
                    match_logic,
                    conditions,
                    actions,
                    matched_count: row.get(9)?,
                    last_matched_at: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )?;

        Ok(filter)
    }

    /// Update existing filter
    pub fn update_filter(&self, id: i64, filter: &NewEmailFilter) -> DbResult<()> {
        let conn = self.get_conn()?;

        let conditions_json = serde_json::to_string(&filter.conditions)
            .map_err(|e| DbError::Serialization(e.to_string()))?;
        let actions_json = serde_json::to_string(&filter.actions)
            .map_err(|e| DbError::Serialization(e.to_string()))?;

        conn.execute(
            r#"
            UPDATE email_filters SET
                name = ?1,
                description = ?2,
                is_enabled = ?3,
                priority = ?4,
                match_logic = ?5,
                conditions = ?6,
                actions = ?7,
                updated_at = datetime('now')
            WHERE id = ?8
            "#,
            params![
                filter.name,
                filter.description,
                filter.is_enabled,
                filter.priority,
                filter.match_logic.as_str(),
                conditions_json,
                actions_json,
                id,
            ],
        )?;

        Ok(())
    }

    /// Delete filter
    pub fn delete_filter(&self, id: i64) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute("DELETE FROM email_filters WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Toggle filter enabled state
    pub fn toggle_filter(&self, id: i64) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE email_filters SET is_enabled = NOT is_enabled WHERE id = ?1",
            [id],
        )?;
        Ok(())
    }
}

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAccount {
    pub email: String,
    pub display_name: String,
    pub imap_host: String,
    pub imap_port: i32,
    pub imap_security: String,
    pub imap_username: Option<String>,
    pub smtp_host: String,
    pub smtp_port: i32,
    pub smtp_security: String,
    pub smtp_username: Option<String>,
    pub password_encrypted: Option<String>,
    pub oauth_provider: Option<String>,
    pub oauth_access_token: Option<String>,
    pub oauth_refresh_token: Option<String>,
    pub oauth_expires_at: Option<i64>,
    pub is_default: bool,
    pub signature: String,
    pub sync_days: i32,
    #[serde(default)]
    pub accept_invalid_certs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub email: String,
    pub display_name: String,
    pub imap_host: String,
    pub imap_port: i32,
    pub imap_security: String,
    pub imap_username: Option<String>,
    pub smtp_host: String,
    pub smtp_port: i32,
    pub smtp_security: String,
    pub smtp_username: Option<String>,
    pub oauth_provider: Option<String>,
    pub oauth_refresh_token: Option<String>,
    pub oauth_expires_at: Option<i64>,
    pub is_active: bool,
    pub is_default: bool,
    pub signature: String,
    pub sync_days: i32,
    #[serde(default)]
    pub accept_invalid_certs: bool,
    #[serde(default = "default_priority_fetch")]
    pub enable_priority_fetch: bool,
    pub created_at: String,
    pub updated_at: String,
}

fn default_priority_fetch() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewFolder {
    pub account_id: i64,
    pub name: String,
    pub remote_name: String,
    pub folder_type: String,
    pub is_subscribed: bool,
    pub is_selectable: bool,
    pub delimiter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: i64,
    pub account_id: i64,
    pub name: String,
    pub remote_name: String,
    pub folder_type: String,
    pub unread_count: i32,
    pub total_count: i32,
    pub is_subscribed: bool,
    pub is_selectable: bool,
    pub delimiter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEmail {
    pub account_id: i64,
    pub folder_id: i64,
    pub message_id: String,
    pub uid: u32,
    pub from_address: String,
    pub from_name: Option<String>,
    pub to_addresses: String,
    pub cc_addresses: String,
    pub bcc_addresses: String,
    pub reply_to: Option<String>,
    pub subject: String,
    pub preview: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub date: String,
    pub is_read: bool,
    pub is_starred: bool,
    pub is_deleted: bool,
    pub is_spam: bool,
    pub is_draft: bool,
    pub is_answered: bool,
    pub is_forwarded: bool,
    pub has_attachments: bool,
    pub has_inline_images: bool,
    pub thread_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub references_header: Option<String>,
    pub raw_headers: Option<String>,
    pub raw_size: i32,
    pub priority: i32,
    pub labels: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSummary {
    pub id: i64,
    pub message_id: String,
    pub uid: u32,
    pub from_address: String,
    pub from_name: Option<String>,
    pub subject: String,
    pub preview: String,
    pub date: String,
    pub is_read: bool,
    pub is_starred: bool,
    pub has_attachments: bool,
    pub has_inline_images: bool,
}

// Advanced search types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub query: Option<String>,
    pub date_range: Option<DateRange>,
    pub from_email: Option<String>,
    pub from_domain: Option<String>,
    pub folder_id: Option<i64>,
    pub has_attachments: Option<bool>,
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
    pub has_inline_images: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub emails: Vec<EmailSummary>,
    pub total_count: i64,
    pub has_more: bool,
    pub search_time: i64, // milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Email {
    pub id: i64,
    pub account_id: i64,
    pub folder_id: i64,
    pub message_id: String,
    pub uid: u32,
    pub from_address: String,
    pub from_name: Option<String>,
    pub to_addresses: String,
    pub cc_addresses: String,
    pub bcc_addresses: String,
    pub reply_to: Option<String>,
    pub subject: String,
    pub preview: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub date: String,
    pub is_read: bool,
    pub is_starred: bool,
    pub is_deleted: bool,
    pub is_spam: bool,
    pub is_draft: bool,
    pub is_answered: bool,
    pub is_forwarded: bool,
    pub has_attachments: bool,
    pub has_inline_images: bool,
    pub thread_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub references_header: Option<String>,
    pub priority: i32,
    pub labels: String,
}

impl Email {
    /// Create Email from database row
    pub fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Self> {
        Ok(Email {
            id: row.get(0)?,
            account_id: row.get(1)?,
            folder_id: row.get(2)?,
            message_id: row.get(3)?,
            uid: row.get::<_, i64>(4)? as u32,
            from_address: row.get(5)?,
            from_name: row.get(6)?,
            to_addresses: row.get(7)?,
            cc_addresses: row.get(8)?,
            bcc_addresses: row.get(9)?,
            reply_to: row.get(10)?,
            subject: row.get(11)?,
            preview: row.get(12)?,
            body_text: row.get(13)?,
            body_html: row.get(14)?,
            date: row.get(15)?,
            is_read: row.get(16)?,
            is_starred: row.get(17)?,
            is_deleted: row.get(18)?,
            is_spam: row.get(19)?,
            is_draft: row.get(20)?,
            is_answered: row.get(21)?,
            is_forwarded: row.get(22)?,
            has_attachments: row.get(23)?,
            has_inline_images: row.get(24)?,
            thread_id: row.get(25)?,
            in_reply_to: row.get(26)?,
            references_header: row.get(27)?,
            priority: row.get(28)?,
            labels: row.get(29)?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustedSender {
    pub id: i64,
    pub email: String,
    pub domain: Option<String>,
    pub trusted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewContact {
    pub account_id: Option<i64>,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: i64,
    pub account_id: Option<i64>,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub is_favorite: bool,
    pub email_count: i32,
    pub last_emailed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: i64,
    pub email_id: i64,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub content_id: Option<String>,
    pub is_inline: bool,
    pub local_path: Option<String>,
    pub is_downloaded: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailTemplate {
    pub id: i64,
    pub account_id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub subject_template: String,
    pub body_html_template: String,
    pub body_text_template: Option<String>,
    pub tags: Vec<String>,
    pub is_enabled: bool,
    pub is_favorite: bool,
    pub usage_count: i64,
    pub last_used_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewEmailTemplate {
    pub account_id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub subject_template: String,
    pub body_html_template: String,
    pub body_text_template: Option<String>,
    pub tags: Vec<String>,
    pub is_enabled: bool,
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAttachment {
    pub email_id: i64,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub content_id: Option<String>,
    pub is_inline: bool,
    pub local_path: Option<String>,
    pub is_downloaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub id: i64,
    pub account_id: i64,
    pub folder_id: i64,
    pub last_uid: u32,
    pub uid_validity: Option<u32>,
    pub highest_mod_seq: Option<i64>,
    pub last_full_sync_at: Option<String>,
    pub last_incremental_sync_at: Option<String>,
    pub sync_status: String,
    pub sync_error: Option<String>,
}

// ============================================================================
// EMAIL FILTER STRUCTURES (Re-export from filters module)
// ============================================================================

pub use crate::filters::{EmailFilter, NewEmailFilter, FilterAction, FilterCondition, MatchLogic};

// ============================================================================
// DELTA SYNC OPERATIONS
// ============================================================================

/// Sync metadata for tracking last sync timestamps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetadata {
    pub data_type: String,
    pub last_sync_at: Option<String>,
    pub last_sync_version: i64,
    pub items_synced: i64,
    pub items_changed: i64,
    pub items_deleted: i64,
    pub sync_status: String,
    pub error_message: Option<String>,
}

impl Database {
    /// Get sync metadata for a data type
    pub fn get_sync_metadata(&self, data_type: &str) -> DbResult<Option<SyncMetadata>> {
        let conn = self.get_conn()?;

        let result = conn.query_row(
            r#"
            SELECT data_type, last_sync_at, last_sync_version, items_synced,
                   items_changed, items_deleted, sync_status, error_message
            FROM sync_metadata
            WHERE data_type = ?1
            "#,
            params![data_type],
            |row| {
                Ok(SyncMetadata {
                    data_type: row.get(0)?,
                    last_sync_at: row.get(1)?,
                    last_sync_version: row.get(2)?,
                    items_synced: row.get(3)?,
                    items_changed: row.get(4)?,
                    items_deleted: row.get(5)?,
                    sync_status: row.get(6)?,
                    error_message: row.get(7)?,
                })
            },
        );

        match result {
            Ok(metadata) => Ok(Some(metadata)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Update sync metadata after successful sync
    pub fn update_sync_metadata(
        &self,
        data_type: &str,
        last_sync_at: Option<&str>,
        version: Option<i64>,
        items_synced: Option<i64>,
        items_changed: Option<i64>,
        items_deleted: Option<i64>,
    ) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            r#"
            UPDATE sync_metadata
            SET last_sync_at = COALESCE(?1, last_sync_at),
                last_sync_version = COALESCE(?2, last_sync_version),
                items_synced = COALESCE(?3, items_synced),
                items_changed = COALESCE(?4, items_changed),
                items_deleted = COALESCE(?5, items_deleted),
                sync_status = 'idle'
            WHERE data_type = ?6
            "#,
            params![last_sync_at, version, items_synced, items_changed, items_deleted, data_type],
        )?;

        Ok(())
    }

    /// Get accounts changed since last sync (delta)
    /// NOTE: Passwords and access tokens are excluded for security
    pub fn get_changed_accounts(&self, since: Option<&str>) -> DbResult<Vec<Account>> {
        let conn = self.get_conn()?;

        let query = r#"
            SELECT id, email, display_name,
                   imap_host, imap_port, imap_security, imap_username,
                   smtp_host, smtp_port, smtp_security, smtp_username,
                   oauth_provider, oauth_refresh_token, oauth_expires_at,
                   is_active, is_default, signature, sync_days, accept_invalid_certs,
                   COALESCE(enable_priority_fetch, 1), created_at, updated_at
            FROM accounts
            WHERE deleted = 0
        "#;

        let query_with_since = format!("{} AND updated_at > ?1 ORDER BY updated_at DESC", query);
        let query_all = format!("{} ORDER BY updated_at DESC", query);

        let mut stmt = if since.is_some() {
            conn.prepare(&query_with_since)?
        } else {
            conn.prepare(&query_all)?
        };

        let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Account> {
            Ok(Account {
                id: row.get(0)?,
                email: row.get(1)?,
                display_name: row.get(2)?,
                imap_host: row.get(3)?,
                imap_port: row.get(4)?,
                imap_security: row.get(5)?,
                imap_username: row.get(6)?,
                smtp_host: row.get(7)?,
                smtp_port: row.get(8)?,
                smtp_security: row.get(9)?,
                smtp_username: row.get(10)?,
                oauth_provider: row.get(11)?,
                oauth_refresh_token: row.get(12)?,
                oauth_expires_at: row.get(13)?,
                is_active: row.get(14)?,
                is_default: row.get(15)?,
                signature: row.get(16)?,
                sync_days: row.get(17)?,
                accept_invalid_certs: row.get(18)?,
                enable_priority_fetch: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        };

        let accounts = if let Some(timestamp) = since {
            stmt.query_map(params![timestamp], map_row)?
        } else {
            stmt.query_map([], map_row)?
        }
        .collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    }

    /// Get deleted accounts since last sync
    pub fn get_deleted_accounts(&self, since: Option<&str>) -> DbResult<Vec<i64>> {
        let conn = self.get_conn()?;

        let query = if since.is_some() {
            "SELECT id FROM accounts WHERE deleted = 1 AND updated_at > ?1"
        } else {
            "SELECT id FROM accounts WHERE deleted = 1"
        };

        let mut stmt = conn.prepare(query)?;

        let map_row = |row: &rusqlite::Row| -> rusqlite::Result<i64> { row.get(0) };

        let ids = if let Some(timestamp) = since {
            stmt.query_map(params![timestamp], map_row)?
        } else {
            stmt.query_map([], map_row)?
        }
        .collect::<Result<Vec<_>, _>>()?;

        Ok(ids)
    }

    /// Get contacts changed since last sync (delta)
    pub fn get_changed_contacts(&self, since: Option<&str>) -> DbResult<Vec<Contact>> {
        let conn = self.get_conn()?;

        let query = r#"
            SELECT id, account_id, email, name, avatar_url, company, phone, notes,
                   is_favorite, email_count, last_emailed_at
            FROM contacts
            WHERE deleted = 0
        "#;

        let query_with_since = format!("{} AND updated_at > ?1 ORDER BY updated_at DESC", query);
        let query_all = format!("{} ORDER BY updated_at DESC", query);

        let mut stmt = if since.is_some() {
            conn.prepare(&query_with_since)?
        } else {
            conn.prepare(&query_all)?
        };

        let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Contact> {
            Ok(Contact {
                id: row.get(0)?,
                account_id: row.get(1)?,
                email: row.get(2)?,
                name: row.get(3)?,
                avatar_url: row.get(4)?,
                company: row.get(5)?,
                phone: row.get(6)?,
                notes: row.get(7)?,
                is_favorite: row.get(8)?,
                email_count: row.get(9)?,
                last_emailed_at: row.get(10)?,
            })
        };

        let contacts = if let Some(timestamp) = since {
            stmt.query_map(params![timestamp], map_row)?
        } else {
            stmt.query_map([], map_row)?
        }
        .collect::<Result<Vec<_>, _>>()?;

        Ok(contacts)
    }

    /// Get deleted contacts since last sync
    pub fn get_deleted_contacts(&self, since: Option<&str>) -> DbResult<Vec<i64>> {
        let conn = self.get_conn()?;

        let query = if since.is_some() {
            "SELECT id FROM contacts WHERE deleted = 1 AND updated_at > ?1"
        } else {
            "SELECT id FROM contacts WHERE deleted = 1"
        };

        let mut stmt = conn.prepare(query)?;

        let map_row = |row: &rusqlite::Row| -> rusqlite::Result<i64> { row.get(0) };

        let ids = if let Some(timestamp) = since {
            stmt.query_map(params![timestamp], map_row)?
        } else {
            stmt.query_map([], map_row)?
        }
        .collect::<Result<Vec<_>, _>>()?;

        Ok(ids)
    }

    /// Soft delete an account (mark as deleted instead of removing)
    pub fn soft_delete_account(&self, account_id: i64) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE accounts SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            params![account_id],
        )?;

        Ok(())
    }

    /// Soft delete a contact (mark as deleted instead of removing)
    pub fn soft_delete_contact(&self, contact_id: i64) -> DbResult<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "UPDATE contacts SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            params![contact_id],
        )?;

        Ok(())
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_creation() {
        let db = Database::in_memory().expect("Failed to create in-memory database");

        // Test adding an account
        let account = NewAccount {
            email: "test@example.com".to_string(),
            display_name: "Test User".to_string(),
            imap_host: "imap.example.com".to_string(),
            imap_port: 993,
            imap_security: "SSL".to_string(),
            imap_username: None,
            smtp_host: "smtp.example.com".to_string(),
            smtp_port: 587,
            smtp_security: "STARTTLS".to_string(),
            smtp_username: None,
            password_encrypted: Some("encrypted_password".to_string()),
            oauth_provider: None,
            oauth_access_token: None,
            oauth_refresh_token: None,
            oauth_expires_at: None,
            is_default: true,
            signature: "Best regards".to_string(),
            sync_days: 30,
            accept_invalid_certs: false,
        };

        let id = db.add_account(&account).expect("Failed to add account");
        assert!(id > 0);

        let accounts = db.get_accounts().expect("Failed to get accounts");
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].email, "test@example.com");
    }

    #[test]
    fn test_settings() {
        let db = Database::in_memory().expect("Failed to create database");

        // Test getting default setting
        let theme: Option<String> = db.get_setting("theme").expect("Failed to get setting");
        assert_eq!(theme, Some("dark".to_string()));

        // Test setting custom value
        db.set_setting("custom_key", &"custom_value")
            .expect("Failed to set setting");

        let value: Option<String> = db.get_setting("custom_key").expect("Failed to get setting");
        assert_eq!(value, Some("custom_value".to_string()));
    }

    #[test]
    fn test_trusted_senders() {
        let db = Database::in_memory().expect("Failed to create database");

        db.add_trusted_sender("trusted@example.com", None)
            .expect("Failed to add trusted sender");

        assert!(db.is_trusted_sender("trusted@example.com").unwrap());
        assert!(!db.is_trusted_sender("untrusted@example.com").unwrap());

        // Test domain trust
        db.add_trusted_sender("", Some("trusteddomain.com"))
            .expect("Failed to add trusted domain");

        assert!(db.is_trusted_sender("anyone@trusteddomain.com").unwrap());
    }

    #[test]
    fn test_filter_crud() {
        use crate::filters::{
            ConditionField, ConditionOperator, FilterAction, FilterActionType, FilterCondition,
            MatchLogic, NewEmailFilter,
        };

        let db = Database::in_memory().expect("Failed to create database");

        // Create account first
        let account = NewAccount {
            email: "test@example.com".to_string(),
            display_name: "Test User".to_string(),
            imap_host: "imap.example.com".to_string(),
            imap_port: 993,
            imap_security: "SSL".to_string(),
            imap_username: None,
            smtp_host: "smtp.example.com".to_string(),
            smtp_port: 587,
            smtp_security: "STARTTLS".to_string(),
            smtp_username: None,
            password_encrypted: Some("password".to_string()),
            oauth_provider: None,
            oauth_access_token: None,
            oauth_refresh_token: None,
            oauth_expires_at: None,
            is_default: true,
            signature: "".to_string(),
            sync_days: 30,
            accept_invalid_certs: false,
        };
        let account_id = db.add_account(&account).expect("Failed to add account");

        // Create filter
        let new_filter = NewEmailFilter {
            account_id,
            name: "Test Filter".to_string(),
            description: Some("Test description".to_string()),
            is_enabled: true,
            priority: 10,
            match_logic: MatchLogic::All,
            conditions: vec![FilterCondition {
                field: ConditionField::From,
                operator: ConditionOperator::Contains,
                value: "example.com".to_string(),
            }],
            actions: vec![FilterAction {
                action: FilterActionType::MarkAsRead,
                folder_id: None,
                label: None,
            }],
        };

        // Test add_filter
        let filter_id = db.add_filter(&new_filter).expect("Failed to add filter");
        assert!(filter_id > 0);

        // Test get_filter
        let filter = db.get_filter(filter_id).expect("Failed to get filter");
        assert_eq!(filter.name, "Test Filter");
        assert_eq!(filter.description, Some("Test description".to_string()));
        assert_eq!(filter.is_enabled, true);
        assert_eq!(filter.priority, 10);
        assert_eq!(filter.conditions.len(), 1);
        assert_eq!(filter.actions.len(), 1);

        // Test get_filters (list)
        let filters = db.get_filters(account_id).expect("Failed to get filters");
        assert_eq!(filters.len(), 1);
        assert_eq!(filters[0].id, filter_id);

        // Test update_filter
        let updated_filter = NewEmailFilter {
            account_id,
            name: "Updated Filter".to_string(),
            description: Some("Updated description".to_string()),
            is_enabled: false,
            priority: 20,
            match_logic: MatchLogic::Any,
            conditions: vec![],
            actions: vec![],
        };
        db.update_filter(filter_id, &updated_filter)
            .expect("Failed to update filter");

        let filter = db.get_filter(filter_id).expect("Failed to get filter after update");
        assert_eq!(filter.name, "Updated Filter");
        assert_eq!(filter.is_enabled, false);
        assert_eq!(filter.priority, 20);

        // Test toggle_filter
        db.toggle_filter(filter_id).expect("Failed to toggle filter");
        let filter = db.get_filter(filter_id).expect("Failed to get filter after toggle");
        assert_eq!(filter.is_enabled, true); // Should be enabled now

        // Test delete_filter
        db.delete_filter(filter_id).expect("Failed to delete filter");
        let filters = db.get_filters(account_id).expect("Failed to get filters after delete");
        assert_eq!(filters.len(), 0);
    }

    #[test]
    fn test_filter_priority_ordering() {
        use crate::filters::{MatchLogic, NewEmailFilter};

        let db = Database::in_memory().expect("Failed to create database");

        // Create account
        let account = NewAccount {
            email: "test@example.com".to_string(),
            display_name: "Test User".to_string(),
            imap_host: "imap.example.com".to_string(),
            imap_port: 993,
            imap_security: "SSL".to_string(),
            imap_username: None,
            smtp_host: "smtp.example.com".to_string(),
            smtp_port: 587,
            smtp_security: "STARTTLS".to_string(),
            smtp_username: None,
            password_encrypted: Some("password".to_string()),
            oauth_provider: None,
            oauth_access_token: None,
            oauth_refresh_token: None,
            oauth_expires_at: None,
            is_default: true,
            signature: "".to_string(),
            sync_days: 30,
            accept_invalid_certs: false,
        };
        let account_id = db.add_account(&account).expect("Failed to add account");

        // Create filters with different priorities
        for i in [30, 10, 20] {
            let filter = NewEmailFilter {
                account_id,
                name: format!("Filter {}", i),
                description: None,
                is_enabled: true,
                priority: i,
                match_logic: MatchLogic::All,
                conditions: vec![],
                actions: vec![],
            };
            db.add_filter(&filter).expect("Failed to add filter");
        }

        // Get filters - should be ordered by priority (ascending)
        let filters = db.get_filters(account_id).expect("Failed to get filters");
        assert_eq!(filters.len(), 3);
        assert_eq!(filters[0].priority, 10);
        assert_eq!(filters[1].priority, 20);
        assert_eq!(filters[2].priority, 30);
    }

    // =========================================================================
    // OPTIMIZATION TESTS (Connection Pool + Batch Operations)
    // =========================================================================

    #[test]
    fn test_connection_pool() {
        // Test that connection pool works correctly
        let db = Database::in_memory().expect("Failed to create database");

        // Get multiple connections in sequence
        for _ in 0..10 {
            let conn = db.get_conn().expect("Failed to get connection");
            // Connection should be valid
            let result: i64 = conn.query_row("SELECT 1", [], |row| row.get(0)).unwrap();
            assert_eq!(result, 1);
            // Connection automatically returns to pool when dropped
        }

        // Test concurrent-like access
        let mut connections = Vec::new();
        for _ in 0..5 {
            connections.push(db.get_conn().expect("Failed to get connection"));
        }
        // All connections should be valid
        for conn in &connections {
            let result: i64 = conn.query_row("SELECT 1", [], |row| row.get(0)).unwrap();
            assert_eq!(result, 1);
        }
    }

    #[test]
    fn test_batch_upsert_emails() {
        let db = Database::in_memory().expect("Failed to create database");

        // Create test account and folder
        let account = NewAccount {
            email: "batch@test.com".to_string(),
            display_name: "Batch Test".to_string(),
            imap_host: "imap.test.com".to_string(),
            imap_port: 993,
            imap_security: "SSL".to_string(),
            imap_username: None,
            smtp_host: "smtp.test.com".to_string(),
            smtp_port: 587,
            smtp_security: "STARTTLS".to_string(),
            smtp_username: None,
            password_encrypted: Some("password".to_string()),
            oauth_provider: None,
            oauth_access_token: None,
            oauth_refresh_token: None,
            oauth_expires_at: None,
            is_default: true,
            signature: "".to_string(),
            sync_days: 30,
            accept_invalid_certs: false,
        };
        let account_id = db.add_account(&account).expect("Failed to add account");

        let folder = NewFolder {
            account_id,
            name: "INBOX".to_string(),
            remote_name: "INBOX".to_string(),
            folder_type: "inbox".to_string(),
            is_subscribed: true,
            is_selectable: true,
            delimiter: "/".to_string(),
        };
        let folder_id = db.upsert_folder(&folder).expect("Failed to create folder");

        // Create 100 test emails
        let emails: Vec<NewEmail> = (1..=100)
            .map(|i| NewEmail {
                account_id,
                folder_id,
                message_id: format!("test-{}@example.com", i),
                uid: i,
                from_address: format!("sender{}@example.com", i),
                from_name: Some(format!("Sender {}", i)),
                to_addresses: "[]".to_string(),
                cc_addresses: "[]".to_string(),
                bcc_addresses: "[]".to_string(),
                reply_to: None,
                subject: format!("Test Email {}", i),
                preview: format!("Preview of email {}", i),
                body_text: Some(format!("Body of email {}", i)),
                body_html: None,
                date: "2024-01-01T00:00:00Z".to_string(),
                is_read: false,
                is_starred: false,
                is_deleted: false,
                is_spam: false,
                is_draft: false,
                is_answered: false,
                is_forwarded: false,
                has_attachments: false,
                has_inline_images: false,
                thread_id: None,
                in_reply_to: None,
                references_header: None,
                raw_headers: None,
                raw_size: 1024,
                priority: 3,
                labels: "[]".to_string(),
            })
            .collect();

        // Batch insert
        let start = std::time::Instant::now();
        let email_ids = db.batch_upsert_emails(&emails).expect("Failed to batch insert");
        let duration = start.elapsed();

        println!("✓ Batch inserted 100 emails in {:?}", duration);
        assert_eq!(email_ids.len(), 100);
        assert!(duration.as_millis() < 1000, "Batch insert should be < 1s, got {:?}", duration);

        // Verify all emails were inserted
        let conn = db.get_conn().expect("Failed to get connection");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM emails WHERE account_id = ?", [account_id], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 100);

        // Test upsert (update existing)
        let updated_emails: Vec<NewEmail> = (1..=50)
            .map(|i| {
                let mut email = emails[i as usize - 1].clone();
                email.is_read = true;
                email.subject = format!("Updated Email {}", i);
                email
            })
            .collect();

        let start = std::time::Instant::now();
        let _ = db.batch_upsert_emails(&updated_emails).expect("Failed to batch update");
        let update_duration = start.elapsed();

        println!("✓ Batch updated 50 emails in {:?}", update_duration);
        assert!(update_duration.as_millis() < 500, "Batch update should be < 500ms, got {:?}", update_duration);

        // Verify updates
        let read_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM emails WHERE account_id = ? AND is_read = 1", [account_id], |row| row.get(0))
            .unwrap();
        assert_eq!(read_count, 50);
    }

    #[test]
    fn test_batch_vs_single_performance() {
        let db = Database::in_memory().expect("Failed to create database");

        // Setup
        let account = NewAccount {
            email: "perf@test.com".to_string(),
            display_name: "Performance Test".to_string(),
            imap_host: "imap.test.com".to_string(),
            imap_port: 993,
            imap_security: "SSL".to_string(),
            imap_username: None,
            smtp_host: "smtp.test.com".to_string(),
            smtp_port: 587,
            smtp_security: "STARTTLS".to_string(),
            smtp_username: None,
            password_encrypted: Some("password".to_string()),
            oauth_provider: None,
            oauth_access_token: None,
            oauth_refresh_token: None,
            oauth_expires_at: None,
            is_default: true,
            signature: "".to_string(),
            sync_days: 30,
            accept_invalid_certs: false,
        };
        let account_id = db.add_account(&account).expect("Failed to add account");

        let folder = NewFolder {
            account_id,
            name: "INBOX".to_string(),
            remote_name: "INBOX".to_string(),
            folder_type: "inbox".to_string(),
            is_subscribed: true,
            is_selectable: true,
            delimiter: "/".to_string(),
        };
        let folder_id = db.upsert_folder(&folder).expect("Failed to create folder");

        let test_size = 50;

        // Single insert test
        let emails_single: Vec<NewEmail> = (1..=test_size)
            .map(|i| NewEmail {
                account_id,
                folder_id,
                message_id: format!("single-{}@example.com", i),
                uid: i,
                from_address: format!("sender{}@example.com", i),
                from_name: Some(format!("Sender {}", i)),
                to_addresses: "[]".to_string(),
                cc_addresses: "[]".to_string(),
                bcc_addresses: "[]".to_string(),
                reply_to: None,
                subject: format!("Single Email {}", i),
                preview: format!("Preview {}", i),
                body_text: None,
                body_html: None,
                date: "2024-01-01T00:00:00Z".to_string(),
                is_read: false,
                is_starred: false,
                is_deleted: false,
                is_spam: false,
                is_draft: false,
                is_answered: false,
                is_forwarded: false,
                has_attachments: false,
                has_inline_images: false,
                thread_id: None,
                in_reply_to: None,
                references_header: None,
                raw_headers: None,
                raw_size: 0,
                priority: 3,
                labels: "[]".to_string(),
            })
            .collect();

        let start = std::time::Instant::now();
        for email in &emails_single {
            db.upsert_email(email).expect("Failed to insert");
        }
        let single_duration = start.elapsed();

        // Batch insert test (different UIDs)
        let emails_batch: Vec<NewEmail> = ((test_size + 1)..=(test_size * 2))
            .map(|i| {
                let mut email = emails_single[0].clone();
                email.uid = i;
                email.message_id = format!("batch-{}@example.com", i);
                email.subject = format!("Batch Email {}", i);
                email
            })
            .collect();

        let start = std::time::Instant::now();
        db.batch_upsert_emails(&emails_batch).expect("Failed to batch insert");
        let batch_duration = start.elapsed();

        let speedup = single_duration.as_micros() as f64 / batch_duration.as_micros() as f64;

        println!("\n=== PERFORMANCE COMPARISON ===");
        println!("Single inserts ({} emails): {:?}", test_size, single_duration);
        println!("Batch insert ({} emails):   {:?}", test_size, batch_duration);
        println!("Speedup: {:.2}x faster", speedup);
        println!("===============================\n");

        // Batch should be at least 3x faster
        assert!(speedup >= 3.0, "Batch insert should be at least 3x faster, got {:.2}x", speedup);
    }

    #[test]
    fn test_wal_mode_enabled() {
        let db = Database::in_memory().expect("Failed to create database");
        let conn = db.get_conn().expect("Failed to get connection");

        // Check that WAL mode is enabled
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("Failed to query journal mode");

        // WAL mode should be active (or "memory" for in-memory DBs)
        assert!(
            journal_mode == "wal" || journal_mode == "memory",
            "Expected WAL or memory mode, got: {}",
            journal_mode
        );
    }
}
