//! Database module for Owlivion Mail
//!
//! Provides SQLite database operations for email storage, accounts, and settings.

use rusqlite::{Connection, params, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use thiserror::Error;

/// Database error types
#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

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
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Create a new database connection
    pub fn new(db_path: PathBuf) -> DbResult<Self> {
        let conn = Connection::open(&db_path)?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        // WAL mode for better concurrency
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;

        // Initialize schema
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Create an in-memory database (for testing)
    pub fn in_memory() -> DbResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    // =========================================================================
    // ACCOUNTS
    // =========================================================================

    /// Add a new email account
    pub fn add_account(&self, account: &NewAccount) -> DbResult<i64> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            r#"
            INSERT INTO accounts (
                email, display_name,
                imap_host, imap_port, imap_security, imap_username,
                smtp_host, smtp_port, smtp_security, smtp_username,
                password_encrypted,
                oauth_provider, oauth_access_token, oauth_refresh_token, oauth_expires_at,
                is_default, signature, sync_days
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
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
                account.is_default,
                account.signature,
                account.sync_days,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get all accounts
    pub fn get_accounts(&self) -> DbResult<Vec<Account>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            r#"
            SELECT id, email, display_name,
                   imap_host, imap_port, imap_security, imap_username,
                   smtp_host, smtp_port, smtp_security, smtp_username,
                   oauth_provider, is_active, is_default, signature, sync_days,
                   created_at, updated_at
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
                    is_active: row.get(12)?,
                    is_default: row.get(13)?,
                    signature: row.get(14)?,
                    sync_days: row.get(15)?,
                    created_at: row.get(16)?,
                    updated_at: row.get(17)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    }

    /// Get account by ID
    pub fn get_account(&self, id: i64) -> DbResult<Account> {
        let conn = self.conn.lock().unwrap();
        let account = conn.query_row(
            r#"
            SELECT id, email, display_name,
                   imap_host, imap_port, imap_security, imap_username,
                   smtp_host, smtp_port, smtp_security, smtp_username,
                   oauth_provider, is_active, is_default, signature, sync_days,
                   created_at, updated_at
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
                    is_active: row.get(12)?,
                    is_default: row.get(13)?,
                    signature: row.get(14)?,
                    sync_days: row.get(15)?,
                    created_at: row.get(16)?,
                    updated_at: row.get(17)?,
                })
            },
        )?;

        Ok(account)
    }

    /// Get account password (encrypted)
    pub fn get_account_password(&self, id: i64) -> DbResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let password: Option<String> = conn.query_row(
            "SELECT password_encrypted FROM accounts WHERE id = ?1",
            [id],
            |row| row.get(0),
        )?;
        Ok(password)
    }

    /// Delete account
    pub fn delete_account(&self, id: i64) -> DbResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM accounts WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Set default account
    pub fn set_default_account(&self, id: i64) -> DbResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE accounts SET is_default = 0", [])?;
        conn.execute("UPDATE accounts SET is_default = 1 WHERE id = ?1", [id])?;
        Ok(())
    }

    // =========================================================================
    // FOLDERS
    // =========================================================================

    /// Add or update folder
    pub fn upsert_folder(&self, folder: &NewFolder) -> DbResult<i64> {
        let conn = self.conn.lock().unwrap();

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
        let conn = self.conn.lock().unwrap();
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
        let conn = self.conn.lock().unwrap();
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
        let conn = self.conn.lock().unwrap();

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

    /// Get emails for folder with pagination
    pub fn get_emails(
        &self,
        account_id: i64,
        folder_id: i64,
        limit: i32,
        offset: i32,
    ) -> DbResult<Vec<EmailSummary>> {
        let conn = self.conn.lock().unwrap();
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
            .query_map(params![account_id, folder_id, limit, offset], |row| {
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
        let conn = self.conn.lock().unwrap();
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
        let conn = self.conn.lock().unwrap();

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
    pub fn search_emails(&self, account_id: i64, query: &str, limit: i32) -> DbResult<Vec<EmailSummary>> {
        let conn = self.conn.lock().unwrap();
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
            .query_map(params![account_id, query, limit], |row| {
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

    // =========================================================================
    // SETTINGS
    // =========================================================================

    /// Get a setting value
    pub fn get_setting<T: serde::de::DeserializeOwned>(&self, key: &str) -> DbResult<Option<T>> {
        let conn = self.conn.lock().unwrap();
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
        let conn = self.conn.lock().unwrap();
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
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO trusted_senders (email, domain) VALUES (?1, ?2)",
            params![email, domain],
        )?;
        Ok(())
    }

    /// Check if sender is trusted
    pub fn is_trusted_sender(&self, email: &str) -> DbResult<bool> {
        let conn = self.conn.lock().unwrap();

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
        let conn = self.conn.lock().unwrap();
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
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM trusted_senders WHERE id = ?1", [id])?;
        Ok(())
    }

    // =========================================================================
    // CONTACTS
    // =========================================================================

    /// Add or update contact
    pub fn upsert_contact(&self, contact: &NewContact) -> DbResult<i64> {
        let conn = self.conn.lock().unwrap();

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

    /// Search contacts
    pub fn search_contacts(&self, account_id: Option<i64>, query: &str, limit: i32) -> DbResult<Vec<Contact>> {
        let conn = self.conn.lock().unwrap();
        let search_pattern = format!("%{}%", query);

        let mut stmt = if let Some(acc_id) = account_id {
            conn.prepare(
                r#"
                SELECT id, account_id, email, name, avatar_url, company, phone, notes,
                       is_favorite, email_count, last_emailed_at
                FROM contacts
                WHERE (account_id = ?1 OR account_id IS NULL)
                  AND (email LIKE ?2 OR name LIKE ?2)
                ORDER BY email_count DESC, name ASC
                LIMIT ?3
                "#,
            )?
        } else {
            conn.prepare(
                r#"
                SELECT id, account_id, email, name, avatar_url, company, phone, notes,
                       is_favorite, email_count, last_emailed_at
                FROM contacts
                WHERE email LIKE ?2 OR name LIKE ?2
                ORDER BY email_count DESC, name ASC
                LIMIT ?3
                "#,
            )?
        };

        let contacts = if let Some(acc_id) = account_id {
            stmt.query_map(params![acc_id, search_pattern, limit], |row| {
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
            .collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(params![0, search_pattern, limit], |row| {
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
            .collect::<Result<Vec<_>, _>>()?
        };

        Ok(contacts)
    }

    // =========================================================================
    // SYNC STATE
    // =========================================================================

    /// Get sync state for folder
    pub fn get_sync_state(&self, account_id: i64, folder_id: i64) -> DbResult<Option<SyncState>> {
        let conn = self.conn.lock().unwrap();
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
        let conn = self.conn.lock().unwrap();

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub is_active: bool,
    pub is_default: bool,
    pub signature: String,
    pub sync_days: i32,
    pub created_at: String,
    pub updated_at: String,
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
}
