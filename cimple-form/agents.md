# Cimple Form - Project Documentation

## Overview
Cimple Form is an interactive form builder, survey creator, and submission management platform built on **Potatoverse** (Lua backend) and **React** (TypeScript frontend). Inspired by Google Forms and Typeform, it provides a drag-and-drop form canvas, multi-section layouts, rich input field types (text, numbers, dropdowns, location pickers, file attachments), public embeddable form links with embed tokens, and real-time response review.

Potatoverse is a single-binary platform for running apps with an embedded Lua VM (`luaz`), SQLite database, key-value storage, and static file serving capabilities. For more details on the platform, refer to the [Potatoverse documentation](https://github.com/blue-monads/potatoverse/tree/main/docs) or `../potatoverse/docs`.

- **Namespace / Space Key**: `cimple-form`
- **UI Base Path**: `/zz/space/cimple-form/`
- **API Base Path**: `/zz/api/space/cimple-form`

---

## Tech Stack
- **Backend**: Potatoverse Lua (`server.lua`, executor type: `luaz`)
- **Database**: SQLite (`init/schema.sql`) via `potato.db`
- **Frontend**: React 19 + TypeScript + Vite + React Router (Static SPA, no SSR)
- **UI & Inputs**: Tailwind CSS, Lucide Icons (`lucide-react`), Leaflet/MapLibre (Location picker), File inputs
- **Package Manager**: Bun

---

## Project Structure

```
cimple-form/
├── potato.yaml                  # Potatoverse app manifest & packaging configuration
├── justfile                     # Development & build recipes
├── agents.md                    # Agent instructions & architecture documentation
├── server.lua                   # Lua HTTP routing, form schema operations, & submissions
├── package.spk.zip              # Packaged Potatoverse app archive (generated)
├── demo.html                    # Standalone form builder & submitter demo
├── init/
│   ├── init.html                # App setup and initialization page
│   └── schema.sql               # SQLite schema definition
├── submissions/                 # Submission export storage
├── renderer/                    # Form renderer templates & assets
└── ui/                          # Frontend SPA
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx             # App entry, router configuration, RootLayout
        ├── App.tsx              # Shell layout and navigation
        ├── components/          # Shared input controls
        │   ├── FileInput.tsx    # File attachment picker
        │   └── LocationPicker.tsx # Geographic coordinate & map picker
        ├── pages/
        │   ├── Listings/        # My Forms list & dashboard
        │   ├── Builder/         # Form Builder workspace (sections, fields, palette)
        │   ├── Submitter/       # Public respondent form filling view
        │   └── Submissions/     # Response tables & submission details
        └── lib/
            ├── base.ts          # Base routing and API paths
            ├── api.ts           # Typed form builder & submissions client
            ├── spaceFile.ts     # File attachment upload helper
            └── shared/          # Authentication wrapper and modal context
```

---

## Core Systems & Data Flow

### 1. Database Schema (`init/schema.sql`)
- **`forms`**: Form definitions (`name`, `description`, `pinned_domains`, `embed_token`, `status`: `draft` | `published`, `extrameta` JSON).
- **`formSections`**: Form layout groupings (`name`, `section_order`, `form_id`, `layout`: `horizontal` | `vertical`, `extrameta` JSON).
- **`formFields`**: Field definitions (`name`, `field_type`, `default_value`, `field_order`, `field_options` JSON, `form_id`, `section_id`, `extrameta` JSON).
- **`formSubmissions`**: Respondent submissions (`form_id`, `data` JSON containing form answers, `status`: `pending` | `reviewed`, `response_messages`, `extrameta` JSON).

### 2. Form Schema Synchronization
- The builder updates form structure efficiently through batch operations:
  - `bulk_upsert_sections`: Synchronizes section orders and layouts in a single transaction.
  - `bulk_upsert_fields`: Synchronizes field configurations, validation rules, and ordering.
- Full form query (`GET /forms/:id`) returns the form entity along with its populated sections and fields.

### 3. Public Form Submission
- Public forms are accessible via `GET /forms/public/:id` without administrative authentication.
- Submissions (`POST /forms/:id/submit`) validate inputs and record answer payloads in `formSubmissions` with status `pending`.

---

## API Endpoints Reference

Administrative API calls require the authentication header `Authorization` populated via `(window as any).spaceGetToken?.('cimple-form')`. Public respondent submission endpoints do not require space authentication.

| Domain | Method | Path | Description |
|---|---|---|---|
| **System** | `POST` | `/run_schema_sql` | Initializes SQLite schema from `init/schema.sql` |
| **Forms** | `GET` | `/forms` | Lists forms created by the user |
| **Forms** | `POST` | `/forms` | Creates a new form in draft status |
| **Forms** | `GET` | `/forms/:id` | Gets full form details with sections and fields |
| **Forms** | `PUT`/`PATCH` | `/forms/:id` | Updates form metadata, status, or embed token |
| **Forms** | `DELETE` | `/forms/:id` | Deletes a form and cascades to sections, fields, and submissions |
| **Public** | `GET` | `/forms/public/:id` | Publicly viewable form definition for respondents |
| **Public** | `POST` | `/forms/:id/submit` | Submits respondent form answers |
| **Sections**| `POST` | `/forms/:id/sections` | Bulk upserts form sections |
| **Sections**| `DELETE` | `/sections/:id` | Deletes a specific section |
| **Fields** | `POST` | `/forms/:id/fields` | Bulk upserts fields in a form or section |
| **Fields** | `DELETE` | `/fields/:id` | Deletes a specific field |
| **Submissions**| `GET` | `/forms/:id/submissions` | Lists all submissions received for a form |
| **Submissions**| `DELETE` | `/submissions/:id` | Deletes a single submission |
| **Submissions**| `POST` | `/forms/:id/clear_submissions` | Clears all responses for a form |

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

1. **JSON Extensibility**: `extrameta` columns on forms, sections, and fields allow storing arbitrary UI presentation metadata (e.g. theme colors, validation rules, conditional logic) without schema alterations.
2. **Public Submission Isolation**: Do not expose internal administrative tokens or user IDs through the public `/forms/public/:id` response.
3. **Files & Attachments**: File inputs in forms leverage the space file upload API helper in `ui/src/lib/spaceFile.ts` to attach file references into submission answer payloads.
