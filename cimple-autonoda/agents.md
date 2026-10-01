# Cimple Autonoda - Project Documentation

## Overview
Cimple Autonoda is a visual node editor and automation workflow builder built on **Potatoverse** (Lua backend) and **React** (TypeScript frontend). Inspired by Zapier and n8n, it enables users to design trigger-based event flows, configure nested logical condition blocks (`ALL_OF`, `ANY_OF`), and orchestrate multi-step target dispatch actions (`WEBHOOK`, `EMAIL`, `SMS`, `PUSH`, `TRANSFORM`, `CODE`).

Potatoverse is a single-binary platform for running apps with an embedded Lua VM (`luaz`), SQLite database, key-value storage, and static file serving capabilities. For more details on the platform, refer to the [Potatoverse documentation](https://github.com/blue-monads/potatoverse/tree/main/docs) or `../potatoverse/docs`.

- **Namespace / Space Key**: `cimple-autonoda`
- **UI Base Path**: `/zz/space/cimple-autonoda/`
- **API Base Path**: `/zz/api/space/cimple-autonoda`

---

## Tech Stack
- **Backend**: Potatoverse Lua (`server/server.lua`, executor type: `luaz`)
- **Capabilities**: `xMigrator` (database migrations from `server/migration/`)
- **Database**: SQLite (`server/migration/0001.sql`) via `potato.db`
- **Frontend**: React 19 + TypeScript + Vite + React Router (Static SPA, no SSR)
- **Canvas & Graph UI**: Interactive SVG connection wires with bezier curves, tree auto-layout engine (`lib/layout.ts`), Tailwind CSS, Lucide Icons (`lucide-react`)
- **Package Manager**: Bun

---

## Project Structure

```
cimple-autonoda/
├── potato.yaml                  # Potatoverse app manifest & packaging configuration
├── justfile                     # Development & build recipes
├── agents.md                    # Agent instructions & architecture documentation
├── readme.md                    # Architecture and conceptual overview
├── package.spk.zip              # Packaged Potatoverse app archive (generated)
├── meta/
│   └── init.html                # App setup and initialization page
├── server/
│   ├── server.lua               # Lua HTTP routing, graph assembly, & workflow CRUD
│   └── migration/
│       └── 0001.sql             # Relational schema for triggers, blocks, rules, & targets
└── ui/                          # Frontend SPA
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx             # App entry, router configuration, RootLayout
        ├── router.tsx           # Route mapping
        ├── types/
        │   └── workflow.ts      # TypeScript definitions for triggers, blocks, rules, & targets
        ├── components/
        │   ├── Header.tsx       # Top navigation & graph action bar
        │   ├── Canvas.tsx       # Infinite zoom & pan canvas with bezier SVG wires
        │   ├── NodeCard.tsx     # Draggable visual node component
        │   └── InspectorDrawer.tsx # Side panel for editing conditions, delays, & target configs
        ├── pages/
        │   └── TriggerList.tsx  # Workflows dashboard & triggers list
        ├── Home/
        │   └── Home.tsx         # Node editor workspace & canvas host
        └── lib/
            ├── base.ts          # Base routing and API paths
            ├── api.ts           # Typed workflow CRUD & full graph API client
            └── layout.ts        # Dynamic hierarchical tree layout algorithm
```

---

## Core Systems & Data Flow

### 1. Relational Schema Without Wire Tables
Unlike conventional visual node graph systems that persist separate edge/wire connection records, Autonoda infers all graph connections on-the-fly from normalized foreign keys:
- **`EventTriggers`**: Root trigger defining event ingestion (`name`, `description`).
- **`RuleBlocks`**: Logic evaluation blocks (`blockType`: `ALL_OF` | `ANY_OF`, `delaySeconds`, `parentRuleBlockId`, `triggerId`).
  - Trigger to root block: `parentRuleBlockId IS NULL AND triggerId = EventTrigger.id`
  - Block to child block: `parentRuleBlockId = parent.id`
- **`Rules`**: Individual condition expressions inside a rule block (`variable`, `operator`, `value`, `order_index`, `ruleBlockId`).
- **`Targets`**: Action steps (`targetType`: `WEBHOOK` | `EMAIL` | `SMS` | `PUSH` | `TRANSFORM` | `CODE`, `targetMeta` JSON, `linkedBlockId`, `linkedTargetId`).
  - Block to target: `linkedBlockId = RuleBlock.id`
  - Target to downstream target: `linkedTargetId = parent.id`

### 2. Graph Payload Ingestion (`GET /triggers/:id/graph`)
The endpoint retrieves the root trigger, all child rule blocks, condition rules, and target actions in a single atomic payload. The frontend layout engine (`ui/src/lib/layout.ts`) reconstructs the hierarchical DAG and computes spatial node positions automatically.

### 3. Visual Canvas
- Bezier curves connect source output handles to downstream input handles.
- Click-to-disconnect handles and floating $(+)$ quick-add buttons allow inserting intermediate rules or target steps seamlessly.
- Smooth pan, zoom, and fit-to-screen controls.

---

## API Endpoints Reference

All API calls require authentication header `Authorization` populated via `(window as any).spaceGetToken?.('cimple-autonoda')`.

| Domain | Method | Path | Description |
|---|---|---|---|
| **System** | `POST` | `/setup` | Executes database migrations via `xMigrator` |
| **Triggers** | `GET` | `/triggers` | Lists all workflow triggers |
| **Triggers** | `POST` | `/triggers` | Creates a new trigger |
| **Triggers** | `GET` | `/triggers/:id` | Gets single trigger metadata |
| **Triggers** | `GET` | `/triggers/:id/graph` | Returns complete workflow graph (blocks, rules, targets) |
| **Triggers** | `PUT`/`PATCH` | `/triggers/:id` | Updates trigger details |
| **Triggers** | `DELETE` | `/triggers/:id` | Cascade deletes trigger, child rule blocks, and targets |
| **Rule Blocks**| `POST` | `/rule-blocks` | Creates a rule block |
| **Rule Blocks**| `PUT`/`PATCH` | `/rule-blocks/:id` | Updates block type (`ALL_OF`/`ANY_OF`) or delay |
| **Rule Blocks**| `DELETE` | `/rule-blocks/:id` | Deletes rule block and child steps |
| **Rules** | `POST` | `/rules` | Adds condition rule to a rule block |
| **Rules** | `PUT`/`PATCH` | `/rules/:id` | Updates condition rule |
| **Rules** | `DELETE` | `/rules/:id` | Deletes condition rule |
| **Targets** | `POST` | `/targets` | Adds target action step |
| **Targets** | `PUT`/`PATCH` | `/targets/:id` | Updates target action configuration |
| **Targets** | `DELETE` | `/targets/:id` | Deletes target action step |

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

1. **Normalized State Transitions**: Maintain the pure relational link model. Do not attempt to save arbitrary x/y coordinate tables in the database; node positioning is computed deterministically by `ui/src/lib/layout.ts`.
2. **Cascade Safety**: When deleting a rule block, recursively unlink or delete dependent child blocks and connected target actions.
3. **Inspector Drawer**: Keep step configuration modular in `ui/src/components/InspectorDrawer.tsx` to easily accommodate new target types (e.g. AI step, Discord webhook).
