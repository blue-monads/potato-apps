CREATE TABLE IF NOT EXISTS Workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    nodes_json TEXT NOT NULL DEFAULT '[]',
    wires_json TEXT NOT NULL DEFAULT '[]',
    sample_payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS Executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'success',
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    initial_payload TEXT NOT NULL DEFAULT '{}',
    final_payload TEXT NOT NULL DEFAULT '{}',
    steps_trace_json TEXT NOT NULL DEFAULT '[]',
    error_message TEXT DEFAULT '',
    FOREIGN KEY(workflow_id) REFERENCES Workflows(id) ON DELETE CASCADE
);
