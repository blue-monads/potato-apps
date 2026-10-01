# Cimple Table - Project Documentation

## Overview
Cimple Table is a dynamic, relational datatable, database spreadsheet, and generative application builder built on **Potatoverse** (Lua backend) and **React** (TypeScript frontend). Inspired by Airtable and Notion Databases, it provides flexible column typing, cross-table relational linking (`ref`, `multiref`, `reverse_ref`), barcode scanning, industry template seeding, and AI-powered dynamic dashboard/form generation (**AutoDash** & **AutoForm**).

Potatoverse is a single-binary platform for running apps with an embedded Lua VM (`luaz`), SQLite database, key-value storage, and static file serving capabilities. For more details on the platform, refer to the [Potatoverse documentation](https://github.com/blue-monads/potatoverse/tree/main/docs) or `../potatoverse/docs`.

- **Namespace / Space Key**: `cimple-table`
- **UI Base Path**: `/zz/space/cimple-table/`
- **API Base Path**: `/zz/api/space/cimple-table`

---

## Tech Stack
- **Backend**: Potatoverse Lua (`server/server.lua`, executor type: `luaz`)
- **Database**: SQLite (`init/schema.sql`) via `potato.db`
- **AI / LLM Integration**: `server/llm.lua`, `server/autodash/`, `server/autoform/` for prompt-driven dashboard & form synthesis
- **Frontend**: React 19 + TypeScript + Vite + React Router (Static SPA, no SSR)
- **Styling & UI**: Tailwind CSS, Lucide Icons (`lucide-react`)
- **Package Manager**: Bun

---

## Project Structure

```
cimple-table/
├── potato.yaml                  # Potatoverse app manifest & packaging configuration
├── justfile                     # Development & build recipes
├── agents.md                    # Agent instructions & architecture documentation
├── package.spk.zip              # Packaged Potatoverse app archive (generated)
├── init/
│   ├── init.html                # App setup and initialization page
│   └── schema.sql               # SQLite schema definition
├── templates/                   # Industry datatable templates with schemas & seed rows
│   ├── index.json               # Template catalog manifest
│   ├── hr-directory-data.json
│   ├── crm-pipeline-data.json
│   ├── clinic-patients-data.json
│   ├── ecommerce-orders-data.json
│   ├── project-tasks-data.json
│   ├── restaurant-orders-data.json
│   ├── warehouse-inventory-data.json
│   └── ...
├── server/
│   ├── server.lua               # Lua HTTP routing, datatable queries, & cell upserts
│   ├── templates.lua            # Template loader & seeder logic
│   ├── llm.lua                  # LLM capability interface
│   ├── autodash/                # AI Dashboard generator module (Lua + HTML/prompts)
│   │   ├── autodash.lua
│   │   ├── prompt.txt
│   │   └── ddash.html
│   └── autoform/                # AI Form generator module (Lua + HTML/prompts)
│       ├── autoform.lua
│       ├── prompt.txt
│       └── aform.html
└── ui/                          # Frontend SPA
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx             # App entry, router configuration, RootLayout
        ├── App.tsx              # Shell layout with datatable navigation
        ├── pages/
        │   ├── table/           # Interactive spreadsheet table grid, column headers, cell editors
        │   ├── seeder/          # Template seeder & custom schema generator
        │   ├── autodash/        # Generative AI Dashboard viewer & prompt studio
        │   ├── autoform/        # Generative AI Form viewer & prompt studio
        │   └── shared/          # Code editor and tab controls
        └── lib/
            ├── base.ts          # Base routing and API paths
            ├── api.ts           # Datatable, column, row, and cell API operations
            ├── refCache.ts      # Relational reference caching & label resolution
            ├── barcode.ts       # Barcode scanner utilities
            ├── spaceFile.ts     # File attachment upload helpers
            ├── tableColors.ts   # Column and cell tag color palettes
            └── shared/          # Authentication wrapper and modal context
```

---

## Core Systems & Data Flow

### 1. Database Schema (`init/schema.sql`)
- **`Datatables`**: Table definitions (`name`, `info`, `icon`, `color`, `default_order`).
- **`DatatableColumns`**: Column schemas (`name`, `slug`, `column_type`, `icon`, `order_index`, `options` JSON).
  - Supported `column_type` values: `text`, `number`, `date`, `datetime`, `time`, `duration`, `image`, `file`, `link`, `dropdown`, `multiselect`, `checkbox`, `radio`, `textarea`, `barcode`, `ref`, `multiref`, `reverse_ref`.
- **`DatatableRows`**: Reserved for future row-level metadata (e.g. storing row color or custom styling).

- **`AutoDash` & `AutoDashItem`**: Conversation history and generated HTML dashboards.
- **`AutoForm` & `AutoFormItem`**: Conversation history and generated HTML forms.

### 2. Relational Cross-Table Linking (`ref`, `multiref`, `reverse_ref`)
- Columns of type `ref` or `multiref` store foreign row IDs linking to another `Datatable`.
- The backend provides `resolve_ref_ids` and `resolve_reverse_refs` to resolve target row display labels in batch, preventing $N+1$ query cascades in the frontend.
- `reverse_ref` dynamically links back from child tables to parent rows.

### 3. Generative AutoDash & AutoForm
- Users can prompt an LLM to generate custom analytical dashboards or data entry forms based on the current table's schema and live data.
- The backend compiles system prompts (`prompt.txt`) with live table introspection and feeds them to the LLM via `server/llm.lua`, returning rich interactive generative HTML components.

---

## API Endpoints Reference

All API calls require authentication header `Authorization` populated via `(window as any).spaceGetToken?.('cimple-table')`.

| Domain | Method | Path | Description |
|---|---|---|---|
| **System** | `GET` | `/init_status` | Returns system initialization status |
| **System** | `POST` | `/init_app` / `/run_schema_sql` | Initializes schema and tables |
| **Tables** | `GET` | `/tables` | Lists all active datatables |
| **Tables** | `POST` | `/tables` | Creates a new datatable |
| **Tables** | `GET` | `/tables/:id` | Gets datatable metadata |
| **Tables** | `PUT`/`PATCH` | `/tables/:id` | Updates datatable metadata |
| **Tables** | `DELETE` | `/tables/:id` | Soft-deletes a datatable |
| **Columns** | `GET` | `/tables/:table_id/columns` | Lists columns for a datatable |
| **Columns** | `POST` | `/columns` | Adds a column with type and configuration options |
| **Columns** | `PUT`/`PATCH` | `/columns/:id` | Updates column metadata/options |
| **Columns** | `DELETE` | `/columns/:id` | Deletes a column |
| **Data Grid** | `GET` | `/tables/:table_id/data` | Queries table grid (columns + rows + cell values) |
| **Data Grid** | `POST` | `/tables/:table_id/resolve_refs` | Batch resolves `ref` and `multiref` labels |
| **Data Grid** | `POST` | `/tables/:table_id/resolve_reverse_refs` | Batch resolves `reverse_ref` links |
| **Rows** | `GET` | `/tables/:table_id/rows` | Lists rows for a table |
| **Rows** | `POST` | `/rows` | Creates a new row with initial cell values |
| **Rows** | `PUT`/`PATCH` | `/rows/:id` | Updates row data |
| **Rows** | `DELETE` | `/rows/:id` | Deletes a row and its associated cells |
| **Cells** | `POST` | `/cells/upsert` | Upserts a single cell value by table, row, and column ID |
| **Cells** | `PUT`/`PATCH` | `/cells/:id` | Updates an existing cell |
| **Templates** | `POST` | `/tables/:table_id/seed` | Seeds rows from JSON template |
| **AutoDash** | `POST` | `/autodash/generate` | Generates or iterates on an AI dashboard for the table |
| **AutoForm** | `POST` | `/autoform/generate` | Generates or iterates on an AI form for the table |

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

1. **Cell-Level Upserts**: For high-performance grid editing, prefer granular cell upserts (`POST /cells/upsert`) over writing entire row records when inline-editing individual grid cells.
2. **Column Options Schema**: Store dropdown options, reference table IDs, and validation regex inside the JSON string `options` column on `DatatableColumns`.
3. **Reference Integrity**: When deleting rows or tables, be aware of existing `ref` pointers; UI should gracefully render missing foreign records as unresolved tags.
