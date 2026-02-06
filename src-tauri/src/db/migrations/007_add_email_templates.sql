-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'custom' CHECK (
        category IN ('business', 'personal', 'customer_support',
                     'sales', 'marketing', 'internal', 'custom')
    ),
    subject_template TEXT NOT NULL DEFAULT '',
    body_html_template TEXT NOT NULL DEFAULT '',
    body_text_template TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX idx_templates_account ON email_templates(account_id);
CREATE INDEX idx_templates_category ON email_templates(account_id, category);
CREATE INDEX idx_templates_enabled ON email_templates(account_id, is_enabled);
CREATE INDEX idx_templates_favorite ON email_templates(account_id, is_favorite);

-- FTS5 Virtual Table for Full-Text Search
CREATE VIRTUAL TABLE templates_fts USING fts5(
    name,
    description,
    subject_template,
    body_text_template,
    content=email_templates,
    content_rowid=id
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER templates_fts_insert AFTER INSERT ON email_templates BEGIN
    INSERT INTO templates_fts(rowid, name, description, subject_template, body_text_template)
    VALUES (new.id, new.name, COALESCE(new.description, ''), new.subject_template, COALESCE(new.body_text_template, ''));
END;

CREATE TRIGGER templates_fts_update AFTER UPDATE ON email_templates BEGIN
    UPDATE templates_fts
    SET name = new.name,
        description = COALESCE(new.description, ''),
        subject_template = new.subject_template,
        body_text_template = COALESCE(new.body_text_template, '')
    WHERE rowid = new.id;
END;

CREATE TRIGGER templates_fts_delete AFTER DELETE ON email_templates BEGIN
    DELETE FROM templates_fts WHERE rowid = old.id;
END;

-- Trigger to auto-update updated_at
CREATE TRIGGER templates_updated_at AFTER UPDATE ON email_templates BEGIN
    UPDATE email_templates SET updated_at = datetime('now') WHERE id = new.id;
END;
