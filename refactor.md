# Server Refactoring Philosophy

A guide for refactoring Lua server files in potato-apps.
Distilled from the cimple-books `server.lua` refactor.

---

## Core Principle: Make the Flow Obvious

Code should read like a story. A reader should be able to scan a handler
and immediately understand: *what is required, what can fail, and what
happens on success.* No hunting for the happy path buried inside nested
ifs.

---

## 1. Error-First Flow (Go Style)

Every operation that can fail follows a strict pattern:

```lua
local result, err = do_something()
if err ~= nil then
    req.json(400, { error = tostring(err) })
    return
end
-- continue with result...
```

**Rules:**
- Check for error **immediately** after the call — never defer it.
- On error: respond and `return`. Do not `else`-branch the happy path.
- The happy path is always the code that keeps going *down the page*, not
  the code inside an `else` block.
- Errors that indicate a missing resource use `404`. Errors from bad input
  or constraint violations use `400`. Unexpected server failures use `500`.

---

## 2. Guard Clauses at the Top

All preconditions (auth, required params, state checks) belong at the top
of the function, before any real work happens. Each guard is a single
check → respond → return block.

```lua
function update_thing(ctx, thing_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end          -- auth guard
    if not require_param(req, "thing_id", thing_id) then return end  -- param guard

    local thing, err = potato.db.find_by_id("Things", thing_id)
    if err ~= nil or thing == nil then        -- existence guard
        req.json(404, { error = "Thing not found" })
        return
    end
    if thing.is_locked == 1 then             -- state guard
        req.json(400, { error = "Thing is locked" })
        return
    end

    -- real work starts here, no nesting
end
```

---

## 3. Extract Common Logic into Named Functions

If you see the same 3+ lines in more than one place, it belongs in a
function. Name it after *what it does*, not *how*.

### Standard helpers to always have:

```lua
-- Auth: writes 401, returns nil on failure. Callers guard on nil.
function get_user_id(req) end

-- Param guard: writes 400, returns false on failure.
local function require_param(req, name, value) end

-- Soft delete: sets is_deleted = 1 and updated_by.
local function soft_delete(table_name, id, userId) end

-- Fetch a parent record and attach its child rows as entity.lines.
local function attach_lines(entity, lines_table, fk_field, fk_value) end

-- Validate an account ID against allowed types. Returns (id, err).
-- Nil/empty/zero/false raw_id → treat as clear → returns (nil, nil).
local function validate_account_id(raw_id, allowed_types) end
```

### KV store helpers:

The KV API has two shapes (`.value` vs `.Value`). Normalize once:

```lua
local function kv_value(kv_row)
    if kv_row == nil then return nil end
    local v = kv_row.value or kv_row.Value
    if v == nil or v == "" then return nil end
    return v
end

local function kv_number(group, key)
    return tonumber(kv_value(space_kv_get(group, key))) or nil
end

local function kv_string(group, key)
    return kv_value(space_kv_get(group, key))
end
```

Never write `kv_row.value or kv_row.Value` inline — always go through
`kv_value()`.

### Field-alias resolution helpers:

When the API accepts two names for the same field, resolve once:

```lua
local function resolve_payment_account_id(data)
    if type(data) ~= "table" then return nil end
    if data.payment_account_id ~= nil and data.payment_account_id ~= "" then
        return tonumber(data.payment_account_id)
    elseif data.account_id ~= nil and data.account_id ~= "" then
        return tonumber(data.account_id)
    end
    return nil
end
```

Apply the same pattern for `client_contact_id / client_id`,
`vendor_contact_id / vendor_id`, `images / image`, `sales_price / price`, etc.

---

## 4. Insert / Replace Lines as Named Operations

Any time you insert a batch of child rows, extract the loop into a named
function. This makes create vs update vs replace read clearly:

```lua
-- Insert lines for a new parent record.
local function insert_X_lines(lines, parent_id, userId)
    for _, line in ipairs(lines) do
        local _, err = potato.db.insert("XLines", { ... })
        if err ~= nil then
            return "Failed to create line: " .. tostring(err)
        end
    end
    return nil  -- nil = success (Go convention)
end

-- Replace lines for an existing parent (delete-then-insert).
local function replace_X_lines(lines, parent_id, userId)
    local existing, _ = potato.db.find_all_by_cond("XLines", { parent_id = parent_id })
    for _, line in ipairs(existing or {}) do
        local err = potato.db.delete_by_id("XLines", line.id)
        if err ~= nil then return "Failed to delete existing line: " .. tostring(err) end
    end
    return insert_X_lines(lines, parent_id, userId)
end
```

Callers are then clean:

```lua
local lines_err = insert_X_lines(data.lines, parent_id, userId)
if lines_err ~= nil then
    req.json(400, { error = lines_err })
    return
end
```

---

## 5. Patch Updates (Don't Overwrite What Wasn't Sent)

Build an `update_data` table from only the fields present in the request.
Never send the whole request body directly to the DB — callers may omit
fields they don't want to change.

```lua
local update_data = { updated_by = userId }

-- Simple scalar patches
local patchable = { "title", "notes", "status", "date" }
for _, f in ipairs(patchable) do
    if data[f] ~= nil then update_data[f] = data[f] end
end

-- Fields with aliases or type coercion
if data.images ~= nil then update_data.images = data.images
elseif data.image ~= nil then update_data.images = data.image end
```

---

## 6. Boolean / Flag Normalization

SQLite stores booleans as integers. Normalize once on the way in:

```lua
-- From DB → Lua bool
local track_inv = not (p.track_inventory == false or p.track_inventory == 0)

-- From request → DB integer
track_inventory = (product.track_inventory == true or product.track_inventory == 1) and 1 or 0
```

Never scatter `== true or == 1` checks across the file — do the
normalization in one place and store a clean bool/int.

---

## 7. DB Lookup Patterns

### Find or 404
```lua
local record, err = potato.db.find_by_id("Table", id)
if err ~= nil or record == nil then
    req.json(404, { error = "Record not found" })
    return
end
```

### Find or ignore (for enrichment / optional joins)
```lua
local rows, _ = potato.db.find_all_by_cond("Table", { ... })
for _, row in ipairs(rows or {}) do ... end
```

Always use `rows or {}` — never assume find returns a non-nil table.

### Account lookup with fallback
When resolving an account by type with common name hints (e.g., for
auto-selecting the right account):

```lua
local function find_account_by_type(acc_type, name_hints)
    for _, hint in ipairs(name_hints or {}) do
        local rows = run_q(
            "SELECT id FROM Accounts WHERE is_deleted = 0 AND acc_type = ? AND name LIKE ? LIMIT 1",
            { acc_type, "%" .. hint .. "%" }
        )
        if rows and #rows > 0 then return tonumber(rows[1].id) end
    end
    local rows = run_q(
        "SELECT id FROM Accounts WHERE is_deleted = 0 AND acc_type = ? LIMIT 1", { acc_type }
    )
    if rows and #rows > 0 then return tonumber(rows[1].id) end
    return nil
end
```

---

## 8. Router Style

Keep the router flat and scannable. One route = one line (or two at most).
Order: simple paths first, parameterized paths after, action paths before
plain CRUD paths for the same resource.

```lua
-- Simple paths
if path == "/things" and method == "GET"  then return list_things(ctx) end
if path == "/things" and method == "POST" then return create_thing(ctx) end

-- Action sub-paths (before the plain /:id match)
local id_action = string.match(path, "^/things/(%d+)/confirm$")
if id_action and method == "POST" then return confirm_thing(ctx, tonumber(id_action)) end

-- Plain CRUD by id
local id_match = string.match(path, "^/things/(%d+)$")
if id_match then
    local thing_id = tonumber(id_match)
    if method == "GET"                      then return get_thing(ctx, thing_id) end
    if method == "PUT" or method == "PATCH" then return update_thing(ctx, thing_id) end
    if method == "DELETE"                   then return delete_thing(ctx, thing_id) end
end
```

---

## 9. Section Headers

Divide the file into clearly labelled sections with a consistent banner:

```lua
-- ============================================================
-- SECTION NAME
-- ============================================================
```

Order:
1. Utilities (pure helpers, no DB/HTTP)
2. KV helpers
3. Auth helpers
4. Validation helpers
5. DB convenience wrappers
6. Domain sections (Accounts, Transactions, …) — each with its own banner
7. HTTP Router (always last)

---

## 10. Naming Conventions

| Thing | Convention |
|-------|-----------|
| Handler functions | `verb_noun` — `list_sales`, `create_account`, `delete_product` |
| Local helpers | `verb_noun` — `resolve_vendor`, `attach_lines`, `insert_sale_lines` |
| Boolean check helpers | `is_X` or `get_X` — `is_already_initialized`, `get_parent_track_inv` |
| Error return convention | return `nil, "message"` on failure; return `value` or `value, nil` on success |
| Soft-delete convention | always `{ is_deleted = 1, updated_by = userId }` via `soft_delete()` |

---

## Quick Checklist Before Committing

- [ ] Every `err ~= nil` check is at the **top** of the next statement after the call
- [ ] No `else` branch contains the happy path — happy path is always the fallthrough
- [ ] No duplicated 3+ line blocks — extract to a named function
- [ ] No inline `kv_row.value or kv_row.Value` — use `kv_value()`
- [ ] No inline `data.foo_id ~= nil and data.foo_id ~= "" and tonumber(...)` — use a resolver
- [ ] `or {}` on every `find_all_by_cond` result before iterating
- [ ] Router is flat — each route is one `if` line
- [ ] File sections are in the defined order, each with a banner
