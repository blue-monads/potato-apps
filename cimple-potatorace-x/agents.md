# Cimple Potato Race - Project Documentation

## Overview
Cimple Potato Race (`cimple-potatorace`) is a planned / in-development application within the Blue Monads **Potatoverse** ecosystem.

Potatoverse is a single-binary platform for running apps with an embedded Lua VM (`luaz`), SQLite database, key-value storage, and static file serving capabilities. For more details on the platform, refer to the [Potatoverse documentation](https://github.com/blue-monads/potatoverse/tree/main/docs) or `../potatoverse/docs`.

- **Namespace / Space Key**: `cimple-potatorace`
- **Current Status**: Placeholder / Stashed repository structure

---

## App Setup Guidelines (When Bootstrapping)

When initializing this application, follow the standard Potatoverse app pattern:

1. **Manifest (`potato.yaml`)**:
   - Define app metadata (`name`, `info`, `slug: cimple-potatorace`, `format_version: '0.0.2'`).
   - Define default space with `executor_type: luaz`, `server_file: server.lua`, `serve_folder: public`.
   - Setup special pages (`init_page: init.html`).
2. **Backend**:
   - Create `server.lua` with `on_http(ctx)` HTTP entry point.
   - Define database schema in `init/schema.sql` or `server/migration/0001.sql`.
3. **Frontend (`ui/`)**:
   - Vite + React 19 + TypeScript template.
   - Single-page application built to `ui/dist` and copied to `public`.
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
