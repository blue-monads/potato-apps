

CREATE TABLE chat_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visibility text not null default 'private', -- private, public, direct
    name text not null,
    description text not null default '',
    created_by_user_id int not null,
    emit_event boolean not null default false,


    extrameta text default null,
    created_at timestamp not null default CURRENT_TIMESTAMP
);

CREATE TABLE chat_channel_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id int not null,
    key_hash text not null,
    key text not null,
    created_at timestamp not null default CURRENT_TIMESTAMP
);


CREATE TABLE chat_channel_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id int not null,
    user_id int not null,
    read_until_message_id int default null,
    is_admin boolean default false,
    joined_at timestamp not null default CURRENT_TIMESTAMP,
    extrameta text default null,
    usermeta text default null
);

CREATE TABLE chat_channel_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id int not null,
    message text not null,
    key_id int,
    from_user_id int not null,
    is_edited boolean not null default false,
    is_deleted boolean not null default false,
    thread_id int,
    reply_to_message_id int,
    created_at timestamp not null default CURRENT_TIMESTAMP,
    updated_at timestamp not null default CURRENT_TIMESTAMP
);


CREATE TABLE chat_channel_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id int not null,
    user_id int not null,
    reaction text not null,
    created_at timestamp not null default CURRENT_TIMESTAMP
);


CREATE TABLE chat_channel_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id int not null,
    ftype text not null default 'file', -- image, video, pdf, doc, audio, file
    file_url_or_id text not null,
    file_name text default null,
    file_size int default 0
);

CREATE TABLE chat_channel_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id int not null,
    link text not null,
    preview_text text,
    preview_image text,
    created_at timestamp not null default CURRENT_TIMESTAMP
);

CREATE TABLE chat_channel_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id int not null,
    user_id int not null,
    mentioned_user_id int not null,
    created_at timestamp not null default CURRENT_TIMESTAMP
);
