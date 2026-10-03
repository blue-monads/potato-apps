CREATE TABLE IF NOT EXISTS CalTags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#4f6ef7',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS CalEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    tag_id TEXT NOT NULL DEFAULT 'other',
    color_type TEXT NOT NULL DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calevents_start_date ON CalEvents(start_date);
CREATE INDEX IF NOT EXISTS idx_calevents_tag_id ON CalEvents(tag_id);
