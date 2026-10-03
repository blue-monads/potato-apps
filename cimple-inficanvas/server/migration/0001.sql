CREATE TABLE IF NOT EXISTS Cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    card_type TEXT NOT NULL DEFAULT 'text', 
    size_x INTEGER NOT NULL DEFAULT 300,
    size_y INTEGER NOT NULL DEFAULT 180,
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '',
    card_data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS CardLinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_card_id INTEGER NOT NULL,
    linked_card_id INTEGER NOT NULL,
    source_handle TEXT NOT NULL DEFAULT 'r',
    linked_handle TEXT NOT NULL DEFAULT 'l',
    label TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#94a3b8',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cards_type ON Cards(card_type);
CREATE INDEX IF NOT EXISTS idx_cardlinks_source ON CardLinks(source_card_id);
CREATE INDEX IF NOT EXISTS idx_cardlinks_linked ON CardLinks(linked_card_id);
