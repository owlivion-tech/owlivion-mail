-- Migration 011: Email Aliases

CREATE TABLE IF NOT EXISTS email_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    alias_email TEXT NOT NULL,
    alias_name TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(account_id, alias_email)
);

CREATE INDEX IF NOT EXISTS idx_aliases_account ON email_aliases(account_id, is_enabled);
