# cimple-autonoda (Autonoda)

Visual event automator and workflow orchestrator for Potatoverse. Ingests JSON event payloads, processes data through conditional logic blocks, and branches down actions (webhooks, email alerts, data enrichment, and audit logs).

## Key Features

- **Airtable-like Visual Canvas**:
  - Drag-and-drop or click-to-add blocks.
  - Interactive SVG bezier connection wires with live rubber-banding, snapping, and click-to-disconnect.
  - Canvas pan & zoom controls (fit, zoom in/out, reset).
- **Core Block Types**:
  1. **Trigger (Event Start)**:
     - Ingests incoming JSON payload.
     - Custom event types, sources, and built-in **Test Payload Editor**.
  2. **Logic Block (Conditions & Branching)**:
     - Multi-rule conditional builder with format `<var> <op> <value>` (e.g. `order.total greater_than 100`, `customer.tier equals gold`).
     - Supports deep dot notation (`order.customer.tier`, `lead.contact.email`).
     - Evaluation Mode Toggle: **AND** (all rules pass) vs. **OR** (any rule passes).
     - **Two distinct output ports**: **`TRUE`** (emerald green handle) and **`FALSE`** (rose red handle).
  3. **Action Blocks**:
     - **Webhook**: HTTP POST/GET/PUT to external endpoints.
     - **Send Email**: Dynamic `{{var}}` variable interpolation in recipient, subject, and body.
     - **Enrich / Transform**: Mutates and appends new fields to the payload for downstream blocks.
     - **Log / Audit**: Records checkpoints and debug notes to the execution trace.
- **Interactive Test Simulator & Live Execution**:
  - Sequential animated step playback with wire pulses and glowing active nodes.
  - Node outcome badges (`✓ TRUE`, `⨉ FALSE`, `✓ Executed`).
  - Bottom collapsible **Execution Trace & Step-by-Step Payload Inspector** with side-by-side Input vs. Transformed Output JSON comparison.
- **Execution History & Audit Log**:
  - Modal viewing previous workflow runs with status, duration, and ability to reload past traces into the inspector.
- **Local-First & Potatoverse Ready**:
  - Seamlessly persists to Potatoverse Lua/SQLite backend when running in the platform, with zero-friction browser fallback for standalone execution.

## Backend Architecture

- **Runtime**: `potato-executor:luaz`
- **Database**: SQLite (`Workflows`, `Executions`)
- **Endpoints (`server/server.lua`)**:
  - `POST /setup`: Runs migrations and seeders (`xMigrator`, `xStaticSeeder`)
  - `GET /workflows`: List all workflows
  - `POST /workflows`: Create workflow
  - `GET /workflows/:id`: Get workflow by ID
  - `PUT /workflows/:id`: Update workflow (name, description, nodes, wires, test payload)
  - `DELETE /workflows/:id`: Delete workflow
  - `POST /workflows/:id/run`: Execute workflow with incoming event payload and record execution history
  - `GET /workflows/:id/executions`: List past execution history for workflow
  - `GET /executions/:id`: Fetch single execution details
  - `POST /webhook/:id`: External webhook ingestion trigger

## Frontend Build

Built with React 19, TypeScript, Tailwind CSS, Lucide React, and Vite:

```bash
cd ui
bun install
bun run build
```