
create table forms(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    pinned_domains TEXT NOT NULL DEFAULT '',
    embed_token TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'draft',
    extrameta JSON NOT NULL DEFAULT '{}'
);


create table formSections(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    section_order INTEGER NOT NULL DEFAULT 0,
    form_id INTEGER NOT NULL,
    layout TEXT NOT NULL DEFAULT 'horizontal',
    extrameta JSON NOT NULL DEFAULT '{}'
);

create table formFields(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    field_type TEXT NOT NULL DEFAULT '',
    default_value TEXT NOT NULL DEFAULT '',
    field_order INTEGER NOT NULL DEFAULT 0,
    field_options JSON NOT NULL DEFAULT '[]',
    form_id INTEGER NOT NULL,
    section_id INTEGER NOT NULL DEFAULT 0,
    extrameta JSON NOT NULL DEFAULT '{}'
);

create table formSubmissions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL DEFAULT 0,
    data JSON NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    response_messages TEXT NOT NULL DEFAULT '',
    extrameta JSON NOT NULL DEFAULT '{}'
);