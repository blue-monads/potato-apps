# cimple-autonoda (Autonoda)

Visual node editor for Potatoverse. Focuses on core node editing, condition logic building, and target dispatch orchestration with normalized relational storage.

## Key Architecture Concepts

- **Relational Schema (No Wire Table)**:
  - Links and graph wires are **not stored as database records**.
  - Connections are inferred on-the-fly directly from entity relations:
    - `EventTrigger` $\rightarrow$ `RuleBlock`: `parentRuleBlockId IS NULL` and `triggerId = EventTrigger.id`
    - `RuleBlock` $\rightarrow$ child `RuleBlock`: `parentRuleBlockId = parent.id`
    - `RuleBlock` $\rightarrow$ `Target`: `linkedBlockId = RuleBlock.id`
    - `Target` $\rightarrow$ `Target`: `linkedTargetId = parent.id`
- **Core Entities (`poc.sql` / `0001.sql`)**:
  1. **EventTriggers**: Root trigger defining event ingestion (`name`, `description`).
  2. **RuleBlocks**: Logic blocks (`blockType: ALL_OF | ANY_OF`, `delaySeconds`, `parentRuleBlockId`).
  3. **Rules**: Condition rules inside a block (`variable`, `operator`, `value`, `order`).
  4. **Targets**: Target steps (`targetType: WEBHOOK | EMAIL | SMS | PUSH | TRANSFORM | CODE`, `targetMeta`).
- **Core Visual Node Editor**:
  - Interactive SVG connection wires with bezier curves and click-to-disconnect.
  - In-graph quick step creation via floating menu (+).
  - Tree auto-layout algorithm for automatic node alignment.
  - Pan & zoom canvas navigation.

## Backend Endpoints (`server/server.lua`)

- `POST /setup`: Runs migration (`xMigrator`)
- `GET /triggers`: List all event triggers
- `POST /triggers`: Create new event trigger
- `GET /triggers/:id`: Get trigger details
- `GET /triggers/:id/graph`: Get full trigger graph (`trigger`, `rule_blocks`, `rules`, `targets`) in a single payload
- `PUT /triggers/:id`: Update trigger
- `DELETE /triggers/:id`: Cascade delete trigger and all related blocks/rules/targets
- `POST /rule-blocks`: Create rule block
- `PUT /rule-blocks/:id`: Update rule block
- `DELETE /rule-blocks/:id`: Delete rule block
- `POST /rules`: Add rule to a rule block
- `PUT /rules/:id`: Update rule
- `DELETE /rules/:id`: Delete rule
- `POST /targets`: Create target action
- `PUT /targets/:id`: Update target action
- `DELETE /targets/:id`: Delete target action

## Frontend Build

Built with React 19, TypeScript, Tailwind CSS, Lucide React, and Vite:

```bash
cd ui
bun install
bun run build
```