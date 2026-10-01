# Cimple Map Fun - Project Documentation

## Overview
Cimple Map Fun is a geographic information system (GIS), event mapping, and location-based feed application built on **Potatoverse** (Lua backend) and **React** (TypeScript frontend).

Potatoverse is a single-binary platform for running apps with an embedded Lua VM (`luaz`), SQLite database, key-value storage, and static file serving capabilities. Cimple Map Fun leverages Potatoverse capabilities including **`xEasyWS`** for real-time WebSocket communication and SQLite's spatial/geopoly features. For more details on the platform, refer to the [Potatoverse documentation](https://github.com/blue-monads/potatoverse/tree/main/docs) or `../potatoverse/docs`.

- **Namespace / Space Key**: `cimple-mapfun`
- **UI Base Path**: `/zz/space/cimple-mapfun/`
- **API Base Path**: `/zz/api/space/cimple-mapfun`

---

## Tech Stack
- **Backend**: Potatoverse Lua (`server.lua`, executor type: `luaz`)
- **Capabilities**: `xEasyWS` (Real-time WebSocket event broadcasts and sync)
- **Database**: SQLite (`init/schema.sql`) via `potato.db`
- **Frontend**: React 19 + TypeScript + Vite + React Router (Static SPA, no SSR)
- **Mapping & UI**: Leaflet / MapLibre mapping components, Tailwind CSS, Lucide Icons (`lucide-react`)
- **Package Manager**: Bun

---

## Project Structure

```
cimple-mapfun/
├── potato.yaml                  # Potatoverse app manifest & packaging configuration
├── justfile                     # Development & build recipes
├── agents.md                    # Agent instructions & architecture documentation
├── readme.md                    # High-level project summary
├── server.lua                   # Lua HTTP routing, spatial logic, & WebSocket handlers
├── package.spk.zip              # Packaged Potatoverse app archive (generated)
├── mapfun_demo.html             # Standalone GIS demo page
├── init/
│   ├── init.html                # App setup and initialization page
│   └── schema.sql               # SQLite schema definition
├── meta/
│   └── spec.json                # App capability and metadata specification
└── ui/                          # Frontend SPA
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx             # App entry, router configuration, RootLayout
        ├── App.tsx              # Shell layout and navigation header
        ├── components/
        │   ├── Header.tsx       # Navigation header with map/event switcher
        │   ├── EventTypesList.tsx
        │   └── EventList/       # Event cards, feed tiles, collage, and detail modals
        ├── pages/
        │   ├── event/           # Maps view, event feed, create event & type
        │   └── feature/         # Geographic feature manager & spatial editor
        └── lib/
            ├── base.ts          # Base routing and API paths
            ├── api.ts           # Central API dispatcher
            ├── eventsApi.ts     # Typed event queries and CRUD
            ├── eventTypesApi.ts # Event categories/types API
            ├── featuresApi.ts   # Point, line, polygon feature API
            ├── eventImage.ts    # Event image attachment helpers
            └── shared/          # Authentication wrapper and modal context
```

---

## Core Systems & Data Flow

### 1. Database Schema (`init/schema.sql`)
- **`EventTypes`**: Categories for map events (`name`, `event_type`, `icon`, `color`).
- **`Events`**: Geotagged events (`title`, `info`, `event_type_id`, `event_data` JSON, `lat`, `lng`, `event_start`, `event_end`).
- **`EventImages`**: Multiple image URLs associated with an event.
- **`Features`**: Geographic vector features (`name`, `description`, `color`, `feature_type`: `point`, `area`, `line`, `geometry_data` JSON).

### 2. Real-Time Capabilities (`xEasyWS`)
- Configured in `potato.yaml` under `capabilities: [{ name: "xEasyWS", type: "xEasyWS" }]`.
- Provides `/ws_token` endpoint to issue authorized WebSocket tokens.
- Clients connect via WebSockets to receive live event updates, marker placements, and geospatial changes without manual polling.

### 3. Spatial & Geometry Processing (`server.lua`)
- `geometry_to_geopoly(geometry, feature_type)`: Converts GeoJSON coordinate arrays into SQLite `geopoly` coordinate strings.
- Spatial bounding box and proximity queries can be performed using SQLite math and geopoly extensions.

---

## API Endpoints Reference

All API calls require authentication header `Authorization` populated via `(window as any).spaceGetToken?.('cimple-mapfun')`.

| Domain | Method | Path | Description |
|---|---|---|---|
| **System** | `POST` | `/run_schema_sql` | Executes initialization DDL from `schema.sql` |
| **Realtime** | `GET` | `/ws_token` | Generates authentication token for `xEasyWS` connection |
| **Events** | `GET` | `/events` | Queries event list (supports bounds, type filtering, pagination) |
| **Events** | `POST` | `/events` | Creates geotagged event with optional image attachments |
| **Events** | `GET` | `/events/:id` | Gets single event details with images |
| **Events** | `DELETE` | `/events/:id` | Deletes an event and associated image records |
| **Event Types** | `GET` | `/event_types` | Lists all event types/categories |
| **Event Types** | `POST` | `/event_types` | Creates a new event type |
| **Event Types** | `GET` | `/event_types/:id` | Gets event type details |
| **Event Types** | `PUT`/`PATCH` | `/event_types/:id` | Updates an event type |
| **Event Types** | `DELETE` | `/event_types/:id` | Deletes an event type |
| **Features** | `GET` | `/features` | Lists all map features (points, lines, polygons) |
| **Features** | `POST` | `/features` | Creates a map feature with GeoJSON geometry |
| **Features** | `GET` | `/features/:id` | Gets feature details and geometry data |
| **Features** | `PUT`/`PATCH` | `/features/:id` | Updates feature metadata or geometry |
| **Features** | `DELETE` | `/features/:id` | Deletes a map feature |

---

## Development

### Quick Run
Runs the Potatoverse server in the current folder, keeping state in `./.pdata`:

```bash
# Build package and run local dev server (default port: 7777, working-dir: ./.pdata)
potatoverse package build && potatoverse dev run
```

To start fresh by wiping state in `.pdata`:
```bash
potatoverse dev run --reset-state
```

### Manually & Other Ways

1. **Frontend Dev Server (with HMR)**:
   ```bash
   cd ui && bun run dev
   # Or using just:
   just start_frontend
   ```

2. **Live UI Proxy Mode**:
   Run the Potatoverse dev server while proxying frontend traffic directly from Vite:
   ```bash
   potatoverse dev run --live-ui-serve
   ```

3. **Push to Running Dev Server**:
   Hot push local updates to an already running `potatoverse dev run` instance:
   ```bash
   potatoverse dev push
   ```

4. **Build & Package Bundle**:
   Compile frontend and package into `package.spk.zip`:
   ```bash
   potatoverse package build
   # Or using just:
   just build_app
   ```

5. **Deploy Package to Target Server**:
   ```bash
   potatoverse package build && potatoverse package push
   # Or using just:
   just deploy_app
   ```

---

## Coding Conventions & Guidelines

1. **SPA Delivery**: Single Page Application without SSR. Client builds to `ui/dist` and is served as static assets by Potatoverse.
2. **Coordinate Standard**: Always persist latitude and longitude in WGS84 format (`REAL` numbers: `lat`, `lng`). GeoJSON arrays follow standard `[lng, lat]` order for GeoJSON payloads, but entity tables store explicit `lat` and `lng` columns.
3. **Real-time Hygiene**: Broadcast mutations (event create, feature update) over `xEasyWS` to keep open map clients synchronized in real-time.
4. **Typing & Modals**: Maintain typed interfaces in `ui/src/lib/*Api.ts` matching backend responses.
