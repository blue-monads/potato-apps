
create table if not exists EventTypes(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'e',
    icon TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);



-- Event Feed
create table if not exists Events(
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    info TEXT NOT NULL  DEFAULT '',
    event_type_id INTEGER NULL,
    event_data JSON NOT NULL DEFAULT '{}',
    lat REAL NOT NULL DEFAULT 0,
    lng REAL NOT NULL DEFAULT 0,
    event_start TIMESTAMP,
    event_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

create table if not exists EventImages(
    id INTEGER PRIMARY KEY,
    event_id INTEGER NOT NULL,
    image_url TEXT NOT NULL
);

create VIRTUAL table if not exists EventLocations using geopoly(
    event_id
);


create table if not exists Features(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    feature_type TEXT NOT NULL DEFAULT '', -- point, area, line
    geometry_data JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

create VIRTUAL table if not exists FeatureLocations using geopoly(
    feature_id
);