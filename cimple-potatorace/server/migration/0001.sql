CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    host_user_id INTEGER NOT NULL,
    host_conn_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'waiting',
    max_players INTEGER NOT NULL DEFAULT 4,
    player_count INTEGER NOT NULL DEFAULT 0,
    players_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
