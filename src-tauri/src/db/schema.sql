-- ============================================================================
-- Owlivion Mail - SQLite Database Schema
-- Modern AI-powered email client
-- Version: 1.0.0
-- ============================================================================

-- Enable foreign key support (must be done at runtime in SQLite)
PRAGMA foreign_keys = ON;

-- ============================================================================
-- ACCOUNTS TABLE
-- Stores email account configurations and credentials
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Basic info
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,

    -- IMAP Configuration
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_security TEXT NOT NULL DEFAULT 'SSL' CHECK (imap_security IN ('SSL', 'TLS', 'STARTTLS', 'NONE')),
    imap_username TEXT,  -- NULL means use email address

    -- SMTP Configuration
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_security TEXT NOT NULL DEFAULT 'STARTTLS' CHECK (smtp_security IN ('SSL', 'TLS', 'STARTTLS', 'NONE')),
    smtp_username TEXT,  -- NULL means use email address

    -- Authentication (encrypted at application level)
    password_encrypted TEXT,

    -- OAuth2 (for Gmail, Outlook)
    oauth_provider TEXT CHECK (oauth_provider IN ('gmail', 'outlook', NULL)),
    oauth_access_token TEXT,
    oauth_refresh_token TEXT,
    oauth_expires_at INTEGER,  -- Unix timestamp

    -- Account settings
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    signature TEXT DEFAULT '',

    -- Sync settings
    sync_days INTEGER NOT NULL DEFAULT 30,  -- How many days to sync

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ensure only one default account
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_default
    ON accounts(is_default) WHERE is_default = 1;

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

-- ============================================================================
-- FOLDERS TABLE
-- IMAP folder/mailbox mapping
-- ============================================================================
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    -- Folder identification
    name TEXT NOT NULL,           -- Display name
    remote_name TEXT NOT NULL,    -- IMAP folder name (may differ)

    -- Folder type for special handling
    folder_type TEXT NOT NULL DEFAULT 'custom' CHECK (
        folder_type IN ('inbox', 'sent', 'drafts', 'trash', 'spam', 'archive', 'starred', 'custom')
    ),

    -- Statistics
    unread_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,

    -- Folder attributes
    is_subscribed INTEGER NOT NULL DEFAULT 1,
    is_selectable INTEGER NOT NULL DEFAULT 1,

    -- Hierarchy
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    delimiter TEXT DEFAULT '/',

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(account_id, remote_name)
);

CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id);
CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(account_id, folder_type);

-- ============================================================================
-- EMAILS TABLE
-- Cached email messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

    -- Message identification
    message_id TEXT NOT NULL,     -- Email Message-ID header
    uid INTEGER NOT NULL,         -- IMAP UID

    -- Sender
    from_address TEXT NOT NULL,
    from_name TEXT,

    -- Recipients (JSON arrays)
    to_addresses TEXT NOT NULL DEFAULT '[]',      -- JSON: [{"email": "", "name": ""}]
    cc_addresses TEXT NOT NULL DEFAULT '[]',      -- JSON
    bcc_addresses TEXT NOT NULL DEFAULT '[]',     -- JSON
    reply_to TEXT,                                -- Reply-To address

    -- Content
    subject TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',             -- First ~200 chars
    body_text TEXT,                               -- Plain text body
    body_html TEXT,                               -- HTML body

    -- Date
    date TEXT NOT NULL,                           -- Email Date header
    received_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Flags
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    is_spam INTEGER NOT NULL DEFAULT 0,
    is_draft INTEGER NOT NULL DEFAULT 0,
    is_answered INTEGER NOT NULL DEFAULT 0,
    is_forwarded INTEGER NOT NULL DEFAULT 0,

    -- Attachments
    has_attachments INTEGER NOT NULL DEFAULT 0,
    has_inline_images INTEGER NOT NULL DEFAULT 0,

    -- Threading
    thread_id TEXT,                               -- For grouping conversations
    in_reply_to TEXT,                             -- In-Reply-To header
    references_header TEXT,                       -- References header (JSON array)

    -- Raw data
    raw_headers TEXT,                             -- Full headers as JSON
    raw_size INTEGER NOT NULL DEFAULT 0,          -- Size in bytes

    -- Priority/Labels
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),  -- 1=highest, 5=lowest
    labels TEXT NOT NULL DEFAULT '[]',            -- JSON array of label strings

    -- AI Analysis (populated by Gemini)
    ai_summary TEXT,
    ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'negative', 'neutral', NULL)),
    ai_category TEXT,
    ai_action_items TEXT,                         -- JSON array

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(account_id, folder_id, uid)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_emails_account_folder ON emails(account_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_address);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_unread ON emails(account_id, folder_id, is_read) WHERE is_read = 0;
CREATE INDEX IF NOT EXISTS idx_emails_starred ON emails(account_id, is_starred) WHERE is_starred = 1;
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
    subject,
    body_text,
    from_name,
    from_address,
    content=emails,
    content_rowid=id
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
    INSERT INTO emails_fts(rowid, subject, body_text, from_name, from_address)
    VALUES (NEW.id, NEW.subject, NEW.body_text, NEW.from_name, NEW.from_address);
END;

CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
    INSERT INTO emails_fts(emails_fts, rowid, subject, body_text, from_name, from_address)
    VALUES ('delete', OLD.id, OLD.subject, OLD.body_text, OLD.from_name, OLD.from_address);
END;

CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
    INSERT INTO emails_fts(emails_fts, rowid, subject, body_text, from_name, from_address)
    VALUES ('delete', OLD.id, OLD.subject, OLD.body_text, OLD.from_name, OLD.from_address);
    INSERT INTO emails_fts(rowid, subject, body_text, from_name, from_address)
    VALUES (NEW.id, NEW.subject, NEW.body_text, NEW.from_name, NEW.from_address);
END;

-- ============================================================================
-- ATTACHMENTS TABLE
-- Email attachment metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

    -- File info
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    size INTEGER NOT NULL DEFAULT 0,

    -- For inline images
    content_id TEXT,              -- CID for inline references
    is_inline INTEGER NOT NULL DEFAULT 0,

    -- Storage
    local_path TEXT,              -- Path to cached file
    is_downloaded INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_attachments_cid ON attachments(content_id) WHERE content_id IS NOT NULL;

-- ============================================================================
-- CONTACTS TABLE
-- Address book / contact management
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,  -- NULL for global contacts

    -- Contact info
    email TEXT NOT NULL,
    name TEXT,

    -- Additional details
    avatar_url TEXT,
    company TEXT,
    phone TEXT,
    notes TEXT,

    -- Flags
    is_favorite INTEGER NOT NULL DEFAULT 0,

    -- Auto-populated from email frequency
    email_count INTEGER NOT NULL DEFAULT 0,
    last_emailed_at TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(account_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(is_favorite) WHERE is_favorite = 1;

-- ============================================================================
-- TRUSTED_SENDERS TABLE
-- Senders trusted for image loading
-- ============================================================================
CREATE TABLE IF NOT EXISTS trusted_senders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    domain TEXT,                  -- Domain-level trust option
    trusted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trusted_email ON trusted_senders(email);
CREATE INDEX IF NOT EXISTS idx_trusted_domain ON trusted_senders(domain) WHERE domain IS NOT NULL;

-- ============================================================================
-- SETTINGS TABLE
-- Key-value store for user preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,          -- JSON value
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', '"dark"'),
    ('language', '"tr"'),
    ('notifications_enabled', 'true'),
    ('notification_sound', 'true'),
    ('notification_badge', 'true'),
    ('auto_mark_read', 'true'),
    ('auto_mark_read_delay', '3'),
    ('confirm_delete', 'true'),
    ('confirm_send', 'false'),
    ('signature_position', '"bottom"'),
    ('reply_position', '"top"'),
    ('gemini_api_key', 'null'),
    ('ai_auto_summarize', 'false'),
    ('ai_reply_tone', '"professional"'),
    ('keyboard_shortcuts_enabled', 'true'),
    ('compact_list_view', 'false'),
    ('show_avatars', 'true'),
    ('conversation_view', 'true'),
    ('close_to_tray', 'true');

-- ============================================================================
-- SYNC_STATE TABLE
-- Track synchronization progress per folder
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

    -- IMAP sync tracking
    last_uid INTEGER NOT NULL DEFAULT 0,        -- Last synced UID
    uid_validity INTEGER,                        -- UIDVALIDITY for cache invalidation
    highest_mod_seq INTEGER,                     -- For CONDSTORE extension

    -- Sync status
    last_full_sync_at TEXT,
    last_incremental_sync_at TEXT,
    sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
    sync_error TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(account_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_state_account ON sync_state(account_id);

-- ============================================================================
-- DRAFTS TABLE
-- Local draft storage (not yet sent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    -- Recipients
    to_addresses TEXT NOT NULL DEFAULT '[]',
    cc_addresses TEXT NOT NULL DEFAULT '[]',
    bcc_addresses TEXT NOT NULL DEFAULT '[]',

    -- Content
    subject TEXT NOT NULL DEFAULT '',
    body_text TEXT,
    body_html TEXT,

    -- Reply/Forward context
    reply_to_email_id INTEGER REFERENCES emails(id) ON DELETE SET NULL,
    forward_email_id INTEGER REFERENCES emails(id) ON DELETE SET NULL,
    compose_type TEXT NOT NULL DEFAULT 'new' CHECK (compose_type IN ('new', 'reply', 'reply_all', 'forward')),

    -- Attachments stored separately

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drafts_account ON drafts(account_id);

-- ============================================================================
-- DRAFT_ATTACHMENTS TABLE
-- Attachments for drafts (not yet sent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS draft_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,

    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    local_path TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_draft_attachments_draft ON draft_attachments(draft_id);

-- ============================================================================
-- OUTBOX TABLE
-- Emails queued for sending
-- ============================================================================
CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    draft_id INTEGER REFERENCES drafts(id) ON DELETE SET NULL,

    -- Full email data
    to_addresses TEXT NOT NULL,
    cc_addresses TEXT NOT NULL DEFAULT '[]',
    bcc_addresses TEXT NOT NULL DEFAULT '[]',
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,

    -- Send status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS accounts_updated_at AFTER UPDATE ON accounts
BEGIN
    UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS folders_updated_at AFTER UPDATE ON folders
BEGIN
    UPDATE folders SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS emails_updated_at AFTER UPDATE ON emails
BEGIN
    UPDATE emails SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS contacts_updated_at AFTER UPDATE ON contacts
BEGIN
    UPDATE contacts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS settings_updated_at AFTER UPDATE ON settings
BEGIN
    UPDATE settings SET updated_at = datetime('now') WHERE key = NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS sync_state_updated_at AFTER UPDATE ON sync_state
BEGIN
    UPDATE sync_state SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS drafts_updated_at AFTER UPDATE ON drafts
BEGIN
    UPDATE drafts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS outbox_updated_at AFTER UPDATE ON outbox
BEGIN
    UPDATE outbox SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Unread count per folder
CREATE VIEW IF NOT EXISTS v_folder_unread AS
SELECT
    f.id AS folder_id,
    f.account_id,
    f.name,
    f.folder_type,
    COUNT(CASE WHEN e.is_read = 0 THEN 1 END) AS unread_count,
    COUNT(e.id) AS total_count
FROM folders f
LEFT JOIN emails e ON e.folder_id = f.id AND e.is_deleted = 0
GROUP BY f.id;

-- Recent contacts (most emailed)
CREATE VIEW IF NOT EXISTS v_recent_contacts AS
SELECT
    email,
    name,
    email_count,
    last_emailed_at
FROM contacts
WHERE email_count > 0
ORDER BY last_emailed_at DESC
LIMIT 50;

-- Conversation threads
CREATE VIEW IF NOT EXISTS v_threads AS
SELECT
    thread_id,
    MIN(date) AS started_at,
    MAX(date) AS last_reply_at,
    COUNT(*) AS message_count,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
    GROUP_CONCAT(DISTINCT from_address) AS participants
FROM emails
WHERE thread_id IS NOT NULL
GROUP BY thread_id
ORDER BY last_reply_at DESC;

-- ============================================================================
-- SYNC_HISTORY TABLE
-- Track synchronization snapshots for rollback capability
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Sync metadata
    data_type TEXT NOT NULL CHECK (data_type IN ('accounts', 'contacts', 'preferences', 'signatures')),
    version INTEGER NOT NULL,              -- Server version number

    -- Snapshot data (encrypted)
    encrypted_snapshot BLOB NOT NULL,      -- Full encrypted data snapshot
    snapshot_hash TEXT NOT NULL,           -- SHA-256 integrity check (hex)

    -- Device and operation info
    device_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('push', 'pull', 'merge')),

    -- Statistics
    items_count INTEGER DEFAULT 0,

    -- Status tracking
    sync_status TEXT DEFAULT 'success' CHECK (sync_status IN ('success', 'failed', 'conflict')),
    error_message TEXT,

    -- Timestamp
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(data_type, version)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_history_data_type ON sync_history(data_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_version ON sync_history(data_type, version);

-- ============================================================================
-- ERD (ASCII Reference)
-- ============================================================================
/*
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   ACCOUNTS   │       │   FOLDERS    │       │    EMAILS    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ PK id        │──┐    │ PK id        │──┐    │ PK id        │
│    email     │  │    │ FK account_id│  │    │ FK account_id│
│    imap_*    │  │    │    name      │  │    │ FK folder_id │
│    smtp_*    │  │    │    type      │  │    │    subject   │
│    oauth_*   │  └────│    unread    │  └────│    body      │
└──────────────┘       └──────────────┘       │    flags     │
       │                      │               └──────────────┘
       │                      │                      │
       │               ┌──────┴──────┐               │
       │               │ SYNC_STATE  │               │
       │               ├─────────────┤        ┌──────┴──────┐
       │               │ FK account  │        │ ATTACHMENTS │
       │               │ FK folder   │        ├─────────────┤
       │               │    last_uid │        │ FK email_id │
       │               └─────────────┘        │    filename │
       │                                      └─────────────┘
       │
┌──────┴──────┐       ┌──────────────┐       ┌──────────────┐
│  CONTACTS   │       │   SETTINGS   │       │   TRUSTED    │
├─────────────┤       ├──────────────┤       │   SENDERS    │
│ FK account  │       │ PK key       │       ├──────────────┤
│    email    │       │    value     │       │    email     │
│    name     │       └──────────────┘       │    domain    │
└─────────────┘                              └──────────────┘
*/
