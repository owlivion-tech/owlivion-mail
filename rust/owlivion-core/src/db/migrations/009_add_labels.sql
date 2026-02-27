-- Migration 009: Labels system
-- Adds labels table for organizing emails with colored categories

CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'blue',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(account_id, name)
);

CREATE TABLE IF NOT EXISTS email_labels (
    email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (email_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_labels_account ON labels(account_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_email_labels_email ON email_labels(email_id);
CREATE INDEX IF NOT EXISTS idx_email_labels_label ON email_labels(label_id);

DROP TRIGGER IF EXISTS labels_updated_at;
CREATE TRIGGER labels_updated_at AFTER UPDATE ON labels
BEGIN
    UPDATE labels SET updated_at = datetime('now') WHERE id = NEW.id;
END;
