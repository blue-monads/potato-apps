# Cimple Doks - Project Documentation

## Overview
Cimple Doks is a minimalist document editor, workspace notes, and wiki application built on **Potatoverse** (Lua backend) and **React** (TypeScript frontend). Inspired by Notion and Craft, it features a distraction-free block editor, hierarchical nested document trees, document starring/archiving, custom icon pickers, image attachments, and automatic setup migration/seeding.

Potatoverse is a single-binary platform for running apps with an embedded Lua VM (`luaz`), SQLite database, key-value storage, and static file serving capabilities. For more details on the platform, refer to the [Potatoverse documentation](https://github.com/blue-monads/potatoverse/tree/main/docs) or `../potatoverse/docs`.

- **Namespace / Space Key**: `cimple-doks`
- **UI Base Path**: `/zz/space/cimple-doks/`
- **API Base Path**: `/zz/api/space/cimple-doks`

---

## Tech Stack
- **Backend**: Potatoverse Lua (`server/server.lua`, executor type: `luaz`)
- **Capabilities**: `xMigrator` (SQL migrations) and `xStaticSeeder` (initial JSON data seeder)
- **Database**: SQLite (`server/migration/0001.sql`) via `potato.db`
- **Frontend**: React 19 + TypeScript + Vite + React Router (Static SPA, no SSR)
- **Editor & UI**: Rich-text / block editor (`TipTap`), Tailwind CSS, Lucide Icons (`lucide-react`)
- **Package Manager**: Bun

---

## Project Structure

```
cimple-doks/
├── potato.yaml                  # Potatoverse app manifest & packaging configuration
├── justfile                     # Development & build recipes
├── agents.md                    # Agent instructions & architecture documentation
├── readme.md                    # High-level project summary
├── package.spk.zip              # Packaged Potatoverse app archive (generated)
├── docs_editor_demo.html        # Standalone editor prototype demo
├── test.html                    # Test page for secondary namespace
├── meta/
│   └── init.html                # App setup and initialization page
├── server/
│   ├── server.lua               # Lua HTTP routing, document tree traversal, & CRUD
│   ├── migration/
│   │   └── 0001.sql             # Documents table DDL and index creation
│   └── seed/
│       └── 0001-documents.json  # Starter document seed payload
└── ui/                          # Frontend SPA
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx             # App entry, router configuration, RootLayout
        ├── App.tsx              # Workspace shell layout with tree sidebar
        ├── router.tsx           # React Router definition
        ├── types.ts             # Document and tree node interfaces
        ├── components/
        │   ├── Editor.tsx       # Main rich-text block editor with auto-save
        │   ├── Sidebar.tsx      # Nested tree navigator, starred items, & search
        │   ├── Topbar.tsx       # Document title breadcrumbs, star toggle, actions
        │   ├── IconPicker.tsx   # Emoji and document icon selector
        │   └── ImageModal.tsx   # Image upload and asset insertion modal
        └── lib/
            ├── base.ts          # Base routing and API paths
            ├── api.ts           # Typed document API client
            ├── spaceFile.ts     # Potatoverse space file attachment upload client
            └── shared/          # Authentication wrapper and modal context
```

---

## Core Systems & Data Flow

### 1. Database Schema (`server/migration/0001.sql`)
- **`Documents`**:
  - `id`: Auto-incrementing primary key.
  - `parent_id`: ID of parent document for hierarchical trees (NULL for root-level pages).
  - `title`: Document title (default: `'Untitled'`).
  - `content`: HTML / Rich-text document body.
  - `icon`: Document icon or emoji (default: `'📄'`).
  - `position`: Integer for user-defined ordering within the same tree depth.
  - `is_starred`: Boolean/integer flag for pinning documents in sidebar quick access.
  - `is_archived`: Boolean/integer flag for soft-archived documents.
  - `created_at`, `updated_at`: Timestamps.
  - Index on `parent_id` for fast tree traversal.

### 2. Document Hierarchy & Tree Summaries
- **Lightweight Listing (`GET /documents`)**: To ensure fast sidebar rendering without memory overhead, `GET /documents` omits the heavy HTML `content` field and returns only metadata (`id`, `parent_id`, `title`, `icon`, `position`, `is_starred`).
- **Full Fetch (`GET /documents/:id`)**: Retrieves the complete document including `content` and computed `children_count`.
- **Cascade Deletions (`DELETE /documents/:id`)**: Handled recursively in Lua (`delete_document_recursive`) to ensure deleting a parent document cleanly removes all nested child documents without leaving orphans.
- **Empty State Auto-Seed**: If no documents exist upon initial load, the backend automatically generates a comprehensive welcome guide document.

---

## API Endpoints Reference

All API calls require authentication header `Authorization` populated via `(window as any).spaceGetToken?.('cimple-doks')`.

| Domain | Method | Path | Description |
|---|---|---|---|
| **System** | `POST` | `/setup` | Executes migrations via `xMigrator` and seeds via `xStaticSeeder` |
| **Documents** | `GET` | `/documents` | Lists all active document summaries for sidebar tree navigation |
| **Documents** | `POST` | `/documents` | Creates a new document (root or under a specified `parent_id`) |
| **Documents** | `GET` | `/documents/:id` | Gets full document details including rich-text content |
| **Documents** | `PUT`/`PATCH` | `/documents/:id` | Updates document title, content, icon, parent, or starred status |
| **Documents** | `DELETE` | `/documents/:id` | Recursively deletes a document and all child subdocuments |

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

1. **Auto-Save Debouncing**: The editor in `ui/src/components/Editor.tsx` debounces edits before sending `PATCH /documents/:id` requests to prevent excessive database writes while typing.
2. **Tree Immutability**: When re-parenting or moving documents in the sidebar, update `parent_id` and recalculate `position` indexes.
3. **Asset Uploads**: Upload images and embedded media files via the Potatoverse space file API helper in `ui/src/lib/spaceFile.ts` rather than storing base64 strings in the SQLite database.
