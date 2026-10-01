# Cimple Books - Project Documentation

## Overview
Cimple Books is an accounting, invoicing, bookkeeping, and inventory management application built on **Potatoverse** (Lua backend) and **React** (TypeScript frontend). 

Potatoverse is a single-binary platform for running apps with an embedded Lua VM (`luaz`), SQLite database, key-value storage, and static file serving capabilities. It exposes dedicated Lua host APIs (`potato.db`, `potato.kv`, `potato.core`) and system capabilities. For more details on the platform, refer to the [Potatoverse documentation](https://github.com/blue-monads/potatoverse/tree/main/docs) or `../potatoverse/docs`.

- **Namespace / Space Key**: `cimple-books`
- **UI Base Path**: `/zz/space/cimple-books/`
- **API Base Path**: `/zz/api/space/cimple-books`

---

## Tech Stack
- **Backend**: Potatoverse Lua (`server/server.lua`, executor type: `luaz`)
- **Database**: SQLite (`server/schema.sql`) via `potato.db`
- **KV Storage**: Potatoverse KV (`potato.kv`) for system state and app configuration
- **Frontend**: React 19 + TypeScript + Vite 7 + React Router 7 (Static client-side routing, no SSR)
- **Styling**: Tailwind CSS 4 + Lucide Icons (`lucide-react`)
- **Package Manager**: Bun

---

## Project Structure

```
cimple-books/
├── potato.yaml                  # Potatoverse app manifest & package configuration
├── justfile                     # Development & deployment command recipes
├── agents.md                    # Agent instructions & technical architecture reference
├── package.spk.zip              # Packaged Potatoverse app archive (generated)
├── public/
│   └── seed/                    # Industry seed templates for system setup
│       ├── small_business.json
│       ├── consulting.json
│       ├── tech_electronics.json
│       ├── pharmacy.json
│       ├── high_volume.json
│       └── seed.json
├── server/
│   ├── server.lua               # Lua HTTP routing & business logic
│   ├── schema.sql               # SQLite schema definition
│   └── spages/
│       └── init.html            # Setup & onboarding page (special_pages.init_page)
└── ui/                          # Frontend SPA
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx             # App entry, router configuration, RootLayout
        ├── App.tsx              # Shell layout with collapsible Sidebar
        ├── index.css            # Tailwind CSS styling and theme
        ├── components/          # Shared components
        │   ├── Sidebar.tsx      # Main navigation sidebar (Ctrl+\ toggle)
        │   └── ContactPicker.tsx
        ├── pages/
        │   ├── account/         # Chart of accounts list & form
        │   ├── txn/             # Double-entry transaction journal list & form
        │   ├── contacts/        # Customers & vendors management
        │   ├── product/         # Product catalog, categories, & variant manager
        │   ├── stockin/         # Stock receiving & inventory replenishment
        │   ├── sales/           # Sales orders, invoicing, & line items
        │   ├── estimates/       # Quotation / estimates manager
        │   ├── tax/             # Tax rate configurations
        │   ├── reports/         # Financial reports list (P&L, Balance Sheet, etc.)
        │   └── settings/        # System configuration (currency, default accounts/taxes)
        └── lib/
            ├── base.ts          # Base routing and API path constants
            ├── api.ts           # Typed API client functions & interfaces
            └── shared/          # Authentication wrapper and modal context
```

---

## Core Systems & Data Flow

### 1. Database Schema (`server/schema.sql`)
- **`Accounts`**: Chart of accounts (`acc_type`: `expenses`, `revenue`, `assets`, `liabilities`, `equity`). Supports hierarchical parents (`parent_id`) and contact associations (`contact_id`).
- **`Transactions` & `TransactionLines`**: Double-entry journal entries. Every transaction enforces that total debits equal total credits.
- **`Catagories`**: Categorization for products with `product_class` (`physical_item`, `service`, `digital_item`).
- **`Products` & `ProductVariants`**: Inventory tracking. Products can have multiple variants with specific sales pricing and tracked counts.
- **`ProductStockIn` & `ProductStockInLines`**: Inventory intake linked to supplier/vendor contacts. Updates stock levels.
- **`Sales` & `SalesLines`**: Customer sales and invoicing. Tracks line item amounts, overall taxes, discounts, and payment status (`unpaid`, `paid`, `partially_paid`, `refunded`).
- **`Tax`**: Configurable tax rates for sales and purchases.
- **`Estimates` & `EstimateLines`**: Quotes/estimates acting as draft precursors to sales orders.
- **`Contacts`**: Clients, suppliers, and general contacts with addresses, phones, emails, and JSON metadata (`extra_data`).

### 2. Double-Entry Accounting Invariant
Any transaction submitted via `transaction_create` or `transaction_update` checks:
$$\sum \text{debits} == \sum \text{credits}$$
If unbalanced, the API rejects the request with HTTP 400.

### 3. Dynamic Inventory Calculation
Product inventory is calculated dynamically in Lua (`calculate_product_stocks` in `server/server.lua`):
- For tracked products (`track_inventory == true`), `stock_count` is derived by aggregating quantities from active `ProductStockInLines` (variant or product level).
- For non-tracked products (`track_inventory == false`), the manual `stock_count` value from `Products` or `ProductVariants` is returned.

### 4. Initialization & Seeding (`server/spages/init.html`)
- On initial launch, Potatoverse routes to the `init.html` special page when `INIT_VERSION` in the KV store is not present or differs from the current version.
- Users choose an industry template (`small_business`, `consulting`, `tech_electronics`, `pharmacy`, `high_volume`, or `blank`).
- `init_app` reads the selected JSON from `public/seed/` using `potato.core.read_package_file`, creates default accounts, taxes, categories, products, and sample sales/transactions, then sets `INIT_VERSION` in `potato.kv`.

### 5. KV Configuration (`potato.kv`)
System settings are persisted in the KV store under the `CONFIG` group:
- `CURRENCY_SYMBOL`: Currency symbol (default: `$`).
- `DEFAULT_TAX_RATE_ID`: Default tax rate applied to new products/sales.
- `DEFAULT_SALES_ACCOUNT_ID`: Default revenue account for sales lines.
- `DEFAULT_PURCHASE_ACCOUNT_ID`: Default purchase/expense account for stock intake.
- `SETTINGS`: JSON string containing the full configuration dictionary.

---

## API Endpoints Reference

All API calls require authentication header `Authorization` populated via `(window as any).spaceGetToken?.('cimple-books')`.

| Domain | Method | Path | Description |
|---|---|---|---|
| **System** | `GET` | `/init_status` | Returns system initialization status and version |
| **System** | `POST` | `/init_app` | Initializes schema and seeds data from template |
| **Settings** | `GET` | `/settings` | Fetches app configuration (currency, default accounts/tax) |
| **Settings** | `POST`/`PUT` | `/settings` | Updates app configuration |
| **Accounts** | `GET` | `/accounts` | Lists all non-deleted accounts |
| **Accounts** | `POST` | `/accounts` | Creates a new account |
| **Accounts** | `PUT`/`PATCH` | `/accounts/:id` | Updates an existing account |
| **Accounts** | `DELETE` | `/accounts/:id` | Soft-deletes an account |
| **Transactions** | `GET` | `/transactions` | Paginated transaction list (supports search, date filter, account filter) |
| **Transactions** | `POST` | `/transactions` | Creates balanced transaction with lines |
| **Transactions** | `PUT`/`PATCH` | `/transactions/:id` | Updates transaction and line entries |
| **Transactions** | `DELETE` | `/transactions/:id` | Soft-deletes a transaction |
| **Contacts** | `GET` | `/contacts` | Lists contacts |
| **Contacts** | `POST` | `/contacts` | Creates a contact |
| **Contacts** | `GET` | `/contacts/:id` | Gets single contact details |
| **Contacts** | `PUT`/`PATCH`/`POST` | `/contacts/:id` | Updates a contact |
| **Contacts** | `DELETE` | `/contacts/:id` | Soft-deletes a contact |
| **Categories** | `GET` | `/categories` | Lists product categories |
| **Categories** | `POST` | `/categories` | Creates a category |
| **Categories** | `PUT`/`PATCH` | `/categories/:id` | Updates a category |
| **Categories** | `DELETE` | `/categories/:id` | Soft-deletes a category |
| **Products** | `GET` | `/products` | Lists products with computed stock counts and variants |
| **Products** | `POST` | `/products` | Creates a product |
| **Products** | `GET` | `/products/:id` | Gets product details with computed stock |
| **Products** | `PUT`/`PATCH` | `/products/:id` | Updates a product |
| **Products** | `DELETE` | `/products/:id` | Soft-deletes a product |
| **Variants** | `GET` | `/products/:id/variants` | Lists variants for a specific product |
| **Variants** | `POST` | `/products/:id/variants` | Adds a variant to a product |
| **Variants** | `GET` | `/variants/:id` | Gets variant details |
| **Variants** | `PUT`/`PATCH` | `/variants/:id` | Updates variant details |
| **Variants** | `DELETE` | `/variants/:id` | Soft-deletes a variant |
| **Stock In** | `GET` | `/stockin` | Lists stock intake records |
| **Stock In** | `POST` | `/stockin` | Creates stock intake record and line items |
| **Stock In** | `GET` | `/stockin/:id` | Gets stock intake record with lines |
| **Stock In** | `PUT`/`PATCH`/`POST` | `/stockin/:id` | Updates stock intake record |
| **Stock In** | `DELETE` | `/stockin/:id` | Soft-deletes stock intake record |
| **Taxes** | `GET` | `/taxes` | Lists active tax rates |
| **Taxes** | `POST` | `/taxes` | Creates a tax rate |
| **Taxes** | `PUT`/`PATCH` | `/taxes/:id` | Updates a tax rate |
| **Taxes** | `DELETE` | `/taxes/:id` | Soft-deletes a tax rate |
| **Sales** | `GET` | `/sales` | Lists sales entries |
| **Sales** | `POST` | `/sales` | Creates sales invoice with line items |
| **Sales** | `GET` | `/sales/:id` | Gets sale record with lines |
| **Sales** | `PUT`/`PATCH` | `/sales/:id` | Updates sale record and lines |
| **Sales** | `DELETE` | `/sales/:id` | Soft-deletes sale record |

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

1. **Self-Contained Potatoverse Architecture**:
   - The frontend is built as a static Single Page Application (pre-compiled via Vite). Do not introduce SSR frameworks or Node server dependencies.
   - All server-side requests must go through `server/server.lua` using the Potatoverse HTTP routing mechanism inside `on_http(ctx)`.

2. **Soft Deletion**:
   - The application relies primarily on soft deletions (`is_deleted = 1` or `is_deleted = TRUE`). Check for `is_deleted = 0` when querying lists unless explicitly dealing with historical audit records.

3. **Double-Entry Discipline**:
   - When introducing automatic transaction generation from sales or stockin entries, ensure debits and credits balance accurately without penny discrepancies.

4. **Props Typing & State**:
   - Define React prop interfaces explicitly (e.g. `interface ComponentProps`).
   - Keep variable lineage clean and avoid shadowing imported domain types.
   - For modal forms and pickers, use the centralized `useModal()` hook located in `ui/src/lib/shared/modal/modal.tsx`.

5. **Theme & Design Consistency**:
   - Palette uses earthy olive/forest green tones (`#2E6E52` primary accent, `#1C1E1A` ink, `#F4F5F1` background, `#EEF0EA` secondary surface, `#E1E3DB` border).
   - Use Lucide icons consistently across navigation, action buttons, and status indicators.
