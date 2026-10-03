local potato = require("potato")
local json = require("json")

-- ============================================================
-- UTILITIES
-- ============================================================

local unpack_fn = table.unpack or unpack
local sync_all_product_stock_counts

-- Run a parameterized SQL query.
local function run_q(sql, params)
    if params ~= nil and #params > 0 then
        return potato.db.run_query(sql, unpack_fn(params))
    end
    return potato.db.run_query(sql)
end

-- Helper to safely read and trim query parameters from HttpContext
local function get_query_param(req, name, default_val)
    local val = req.default_query(name, default_val or "")
    if val == nil or val == "" then return default_val end
    return tostring(val)
end

-- Normalize a Unix timestamp or ISO string to "YYYY-MM-DD HH:MM:SS".
-- The upper/db ORM can pass raw float64 Unix timestamps as NULL for
-- TIMESTAMP NOT NULL columns, so we always produce a proper string here.
local function to_sqlite_datetime(value)
    local t = tonumber(value)
    if t then
        return os.date("%Y-%m-%d %H:%M:%S", math.floor(t))
    end
    if type(value) == "string" and value ~= "" then
        return value
    end
    return os.date("%Y-%m-%d %H:%M:%S")
end

-- ============================================================
-- SPACE KV  (thin wrapper — handles both API shapes)
-- ============================================================

local function space_kv_get(group, key)
    if potato.kv == nil then return nil end
    if type(potato.kv.kv_get) == "function" then
        local ok, res = pcall(potato.kv.kv_get, group, key)
        if ok and res ~= nil then return res end
    elseif type(potato.kv.get) == "function" then
        local ok, res = pcall(potato.kv.get, group, key)
        if ok and res ~= nil then return res end
    end
    return nil
end

local function space_kv_upsert(group, key, data)
    if potato.kv == nil then return end
    if type(potato.kv.kv_upsert) == "function" then
        pcall(potato.kv.kv_upsert, group, key, data)
    elseif type(potato.kv.upsert) == "function" then
        pcall(potato.kv.upsert, group, key, data)
    end
end

-- Read the scalar value from a KV row (handles both .value and .Value shapes).
local function kv_value(kv_row)
    if kv_row == nil then return nil end
    local v = kv_row.value or kv_row.Value
    if v == nil or v == "" then return nil end
    return v
end

-- ============================================================
-- AUTH HELPER
-- ============================================================

-- Extracts the authenticated user id from a request.
-- Writes a 401 and returns nil on failure — callers must guard on nil.
function get_user_id(req)
    local userId, err = req.get_user_id()
    if err then
        req.json(401, { error = "Unauthorized" })
        return nil
    end
    return userId
end

-- ============================================================
-- VALIDATION HELPERS
-- ============================================================

-- Require a non-nil path parameter.  Writes 400 and returns false on failure.
local function require_param(req, name, value)
    if value == nil then
        req.json(400, { error = name .. " is required" })
        return false
    end
    return true
end

-- Helper to check if is_deleted flag is set (handles both boolean true and integer 1)
local function is_deleted_val(v)
    return v == true or v == 1 or v == "1"
end

-- Resolve and validate an account ID against allowed types.
-- Returns (resolved_id, nil) on success, or (nil, err_msg) on failure.
-- Passing an empty / zero / false value clears the field (returns nil, nil).
local function validate_account_id(raw_id, allowed_types)
    -- Explicit clear
    if raw_id == nil or raw_id == "" or raw_id == 0 or raw_id == false then
        return nil, nil
    end

    local id = tonumber(raw_id)
    if not id or id <= 0 then
        return nil, nil  -- treat as clear
    end

    local acc, _ = potato.db.find_by_id("Accounts", id)
    if not acc or is_deleted_val(acc.is_deleted) then
        return nil, "Account not found or deleted"
    end

    for _, t in ipairs(allowed_types) do
        if acc.acc_type == t then
            return id, nil
        end
    end

    return nil, "Account must have account type: " .. table.concat(allowed_types, " or ")
end

-- ============================================================
-- DB CONVENIENCE WRAPPERS
-- ============================================================

-- Soft-delete a record by setting is_deleted = 1.
local function soft_delete(table_name, id, userId)
    local data = { is_deleted = 1 }
    if table_name ~= "Accounts" and userId ~= nil then
        data.updated_by = userId
    end
    return potato.db.update_by_id(table_name, id, data)
end

-- Fetch an entity and attach its child lines into entity.lines.
local function attach_lines(entity, lines_table, fk_field, fk_value)
    local lines, _ = potato.db.find_all_by_cond(lines_table, { [fk_field] = fk_value })
    entity.lines = lines or {}
end

-- ============================================================
-- INITIALIZATION
-- ============================================================

local INIT_VERSION = "26-7-alpha"

local function is_already_initialized()
    local kv = space_kv_get("SYSTEM", "INIT_VERSION")
    local v = kv_value(kv)
    return v == INIT_VERSION
end

function get_init_status(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if is_already_initialized() then
        req.json(200, {
            initialized = true,
            version = INIT_VERSION,
            message = "Cimple Books has already been initialized (version: " .. INIT_VERSION .. ")."
        })
    else
        req.json(200, {
            initialized = false,
            message = "System not initialized."
        })
    end
end

-- Backward-compat aliases that both delegate to init_app.
function run_schema_sql(ctx) return init_app(ctx) end
function seed_database(ctx)   return init_app(ctx) end

-- ============================================================
-- SEEDING
-- ============================================================

local function read_seed_file(file_name)
    local content, err = potato.core.read_package_file("public/seed/" .. file_name)
    if err ~= nil or content == nil or content == "" then
        error("Failed to read seed file 'public/seed/" .. tostring(file_name) .. "': " .. tostring(err))
    end
    return content
end

local function load_template_data(template)
    if template == nil or template == "" then
        template = "small_business"
    end
    local raw = read_seed_file(template .. ".json")
    local ok, data = pcall(json.decode, raw)
    if not ok or type(data) ~= "table" then
        error("Failed to parse JSON for seed template '" .. tostring(template) .. "': " .. tostring(data))
    end
    return data
end

function seed_template_data(userId, template)
    if template == "blank" then return end

    local seed_data = load_template_data(template)
    if not seed_data then
        print("Warning: No seed data found for template: " .. tostring(template))
        return
    end

    -- 1. Accounts
    local created_accounts = {}
    for _, acc in ipairs(seed_data.accounts or {}) do
        local id, _ = potato.db.insert("Accounts", {
            name      = acc.name,
            acc_type  = acc.acc_type,
            info      = acc.info or "",
            parent_id = acc.parent_id or 0,
            contact_id = acc.contact_id or 0,
            is_deleted = acc.is_deleted or 0
        })
        if id ~= nil then
            created_accounts[acc.name] = id
        end
    end

    -- 2. Tax Rates
    for _, t in ipairs(seed_data.taxes or {}) do
        potato.db.insert("Tax", {
            name       = t.name,
            ttype      = t.ttype or "sales",
            info       = t.info or "",
            rate       = t.rate or 0,
            ["strict"] = t["strict"] or 0,
            created_by = userId,
            updated_by = userId,
            is_deleted = t.is_deleted or 0
        })
    end

    -- 3. Categories
    local created_categories = {}
    for _, cat in ipairs(seed_data.categories or {}) do
        local id, _ = potato.db.insert("Catagories", {
            name          = cat.name,
            info          = cat.info or "",
            product_class = cat.product_class or "physical_item",
            parent_id     = cat.parent_id or 0,
            image         = cat.image or "",
            created_by    = userId,
            updated_by    = userId,
            is_deleted    = cat.is_deleted or 0
        })
        if id ~= nil then
            table.insert(created_categories, id)
        end
    end

    -- 4. Products & ProductVariants
    local created_product_ids = {}
    for _, item in ipairs(seed_data.products or {}) do
        local prod = item.prod or item
        local cat_idx = prod.category_index or 1
        local cat_id  = created_categories[cat_idx] or cat_idx

        local has_vars = (item.variants ~= nil and #item.variants > 0)
            or prod.has_variants == true or prod.has_variants == 1

        local track_inv = true
        if prod.track_inventory == false or prod.track_inventory == 0 then
            track_inv = false
        end

        local init_stock = prod.stock_count or 0

        local pid, _ = potato.db.insert("Products", {
            name                = prod.name,
            info                = prod.info or "",
            catagory_id         = cat_id,
            sales_price         = prod.sales_price or 0,
            images              = prod.images or prod.image or "",
            total_sold_qty      = 0,
            total_stockin_qty   = track_inv and init_stock or 0,
            stock_count         = track_inv and 0 or init_stock,
            track_inventory     = track_inv and 1 or 0,
            has_variants        = has_vars and 1 or 0,
            sales_account_id    = prod.sales_account_id,
            purchase_account_id = prod.purchase_account_id,
            tax_id              = prod.tax_id,
            created_by          = userId,
            updated_by          = userId,
            is_deleted          = prod.is_deleted or 0
        })

        if pid ~= nil then
            table.insert(created_product_ids, pid)
            for _, var in ipairs(item.variants or {}) do
                local var_stock = var.stock_count or 0
                potato.db.insert("ProductVariants", {
                    product_id        = pid,
                    name              = var.name,
                    description       = var.description or "",
                    sales_price       = var.sales_price or 0,
                    total_sold_qty    = 0,
                    total_stockin_qty = track_inv and var_stock or 0,
                    stock_count       = track_inv and 0 or var_stock,
                    images            = var.images or "",
                    created_by        = userId,
                    updated_by        = userId,
                    is_deleted        = var.is_deleted or 0
                })
            end
        end
    end

    -- 5. Sample Sale
    local s = seed_data.sale
    if s and #created_product_ids >= 1 then
        local sale_id, _ = potato.db.insert("Sales", {
            title                        = s.title or "INV-001 - First Customer Order",
            client_contact_id            = s.client_contact_id or s.client_id or nil,
            client_alt_name              = s.client_alt_name or s.client_name or "Global Ventures Inc.",
            notes                        = s.notes or "Initial demo order created upon system setup",
            attachments                  = s.attachments or "",
            total_item_price             = s.total_item_price or 0,
            total_item_tax_amount        = s.total_item_tax_amount or 0,
            total_item_discount_amount   = s.total_item_discount_amount or 0,
            sub_total                    = s.sub_total or 0,
            overall_discount_amount      = s.overall_discount_amount or 0,
            overall_tax_amount           = s.overall_tax_amount or 0,
            total                        = s.total or 0,
            created_by                   = userId,
            updated_by                   = userId,
            payment_status               = s.payment_status or "paid",
            invalidated_reason           = s.invalidated_reason or "",
            sales_status                 = s.sales_status or "draft"
        })

        if sale_id ~= nil then
            for idx, line in ipairs(s.lines or {}) do
                local p_idx = line.product_index or idx
                local p_id  = created_product_ids[p_idx] or created_product_ids[1]
                potato.db.insert("SalesLines", {
                    sale_id         = sale_id,
                    product_id      = p_id,
                    info            = line.info or ("Item Line " .. tostring(idx)),
                    qty             = line.qty or 1,
                    price           = line.price or 0,
                    tax_amount      = line.tax_amount or 0,
                    discount_amount = line.discount_amount or 0,
                    total_amount    = line.total_amount or 0,
                    created_by      = userId,
                    updated_by      = userId
                })
            end
        end
    end

    -- 5b. Sample Contacts
    for _, c in ipairs(seed_data.contacts or {}) do
        potato.db.insert("Contacts", {
            name            = c.name,
            contact_type    = c.contact_type or "company",
            relation_type   = c.relation_type or "customer",
            primary_email   = c.primary_email or "",
            primary_phone   = c.primary_phone or "",
            primary_address = c.primary_address or "",
            notes           = c.notes or "",
            extra_data      = "{}",
            created_by      = userId,
            updated_by      = userId,
            is_deleted      = 0
        })
    end

    -- 6. Sample Transactions
    local tx_list = seed_data.transactions or {}
    if #tx_list == 0 and seed_data.transaction then
        tx_list = { seed_data.transaction }
    end

    -- Merge seeded accounts with anything already in the DB.
    local db_accounts = potato.db.find_all_by_cond("Accounts", { is_deleted = 0 })
    for _, acc in ipairs(db_accounts or {}) do
        if acc.name and acc.name ~= "" and not created_accounts[acc.name] then
            created_accounts[acc.name] = acc.id
        end
    end

    local fallback_acc_id = 1
    for _, id in pairs(created_accounts) do fallback_acc_id = id; break end

    for _, tx in ipairs(tx_list) do
        local txn_record = {
            title          = tx.title or "Journal Entry",
            notes          = tx.notes or "",
            txn_type       = tx.txn_type or "manual",
            reference_id   = tx.reference_id or "",
            reference_type = tx.reference_type or "external",
            attachments    = tx.attachments or "",
            created_by     = userId,
            updated_by     = userId,
            is_editable    = tx.is_editable ~= nil and tx.is_editable or 1,
            is_deleted     = tx.is_deleted or 0
        }
        if tx.txn_date and tx.txn_date ~= "" then
            txn_record.txn_date = tx.txn_date
        end

        local txn_id, _ = potato.db.insert("Transactions", txn_record)
        if txn_id ~= nil then
            for _, tline in ipairs(tx.lines or {}) do
                local acc_id = created_accounts[tline.account_name] or tline.account_id or fallback_acc_id
                potato.db.insert("TransactionLines", {
                    account_id              = acc_id,
                    txn_id                  = txn_id,
                    debit_amount            = tline.debit_amount or 0,
                    credit_amount           = tline.credit_amount or 0,
                    created_by              = userId,
                    updated_by              = userId,
                    linked_sales_line_id    = tline.linked_sales_line_id or nil,
                    linked_stockin_line_id  = tline.linked_stockin_line_id or nil
                })
            end
        end
    end
end

function init_app(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if is_already_initialized() then
        req.json(200, {
            success     = true,
            initialized = true,
            version     = INIT_VERSION,
            message     = "Cimple Books has already been initialized (version: " .. INIT_VERSION .. ")."
        })
        return
    end

    local body     = req.bind_json() or {}
    local template = body.template or "small_business"

    local schema, err = potato.core.read_package_file("schema.sql")
    if err ~= nil or schema == nil or schema == "" then
        req.json(500, { error = "Failed to read schema.sql: " .. tostring(err) })
        return
    end

    local ddl_err = potato.db.run_ddl(schema)
    if ddl_err ~= nil then
        print("DDL notice: " .. tostring(ddl_err))
    end

    local seed_ok, seed_err = pcall(seed_template_data, userId, template)
    if not seed_ok then
        req.json(500, { error = "Failed to seed template data: " .. tostring(seed_err) })
        return
    end

    if type(sync_all_product_stock_counts) == "function" then
        sync_all_product_stock_counts()
    end

    space_kv_upsert("SYSTEM", "INIT_VERSION", { value = INIT_VERSION })

    req.json(200, {
        success     = true,
        initialized = true,
        version     = INIT_VERSION,
        template    = template,
        message     = "Cimple Books initialized successfully with template: " .. template
    })
end

-- ============================================================
-- ACCOUNTS
-- ============================================================

--- @param ctx HttpContext
function list_accounts(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local page_str   = get_query_param(req, "page", "")
    local raw_array  = get_query_param(req, "raw_array", "") == "1"
    local search     = (get_query_param(req, "search", "") or get_query_param(req, "q", "")):match("^%s*(.-)%s*$") or ""
    local acc_type   = get_query_param(req, "type", "") or get_query_param(req, "acc_type", "")
    if acc_type == "all" then acc_type = "" end

    -- If no pagination or filtering requested, return flat array for compatibility
    if page_str == "" and not raw_array and search == "" and acc_type == "" then
        local accounts, err = potato.db.find_all_by_cond("Accounts", { is_deleted = 0 })
        if err ~= nil then
            req.json(400, { error = tostring(err) })
            return
        end
        req.json_array(200, accounts or {})
        return
    end

    local page      = math.max(1, tonumber(page_str) or 1)
    local page_size = tonumber(get_query_param(req, "pageSize", "15")) or 15
    page_size = math.max(1, math.min(page_size, 200))

    local where_clauses = { "is_deleted = 0" }
    local args = {}

    if acc_type ~= "" then
        table.insert(where_clauses, "acc_type = ?")
        table.insert(args, acc_type)
    end

    if search ~= "" then
        local like = "%" .. search .. "%"
        table.insert(where_clauses, "(name LIKE ? OR info LIKE ?)")
        table.insert(args, like)
        table.insert(args, like)
    end

    local where_sql = table.concat(where_clauses, " AND ")

    -- Count total matching rows
    local count_rows = run_q("SELECT COUNT(*) as cnt FROM Accounts WHERE " .. where_sql, args)
    local total_count = (count_rows and #count_rows > 0) and (tonumber(count_rows[1].cnt) or 0) or 0

    if raw_array then
        local all_accounts, a_err = run_q("SELECT * FROM Accounts WHERE " .. where_sql .. " ORDER BY id ASC", args)
        if a_err ~= nil or all_accounts == nil then
            req.json(400, { error = tostring(a_err or "Failed to query accounts") })
            return
        end
        req.json_array(200, all_accounts or {})
        return
    end

    -- Paginated results
    local offset = (page - 1) * page_size
    local page_args = {}
    for _, a in ipairs(args) do table.insert(page_args, a) end
    table.insert(page_args, page_size)
    table.insert(page_args, offset)

    local accounts, a_err = run_q("SELECT * FROM Accounts WHERE " .. where_sql .. " ORDER BY id ASC LIMIT ? OFFSET ?", page_args)
    if a_err ~= nil or accounts == nil then
        req.json(400, { error = tostring(a_err or "Failed to query accounts") })
        return
    end

    req.json(200, {
        items       = accounts or {},
        total       = total_count,
        page        = page,
        page_size   = page_size,
        total_pages = math.max(1, math.ceil(total_count / page_size))
    })
end

--- @param ctx HttpContext
function create_account(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local account = req.bind_json()
    local id, err = potato.db.insert("Accounts", account)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local created, err = potato.db.find_by_id("Accounts", id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, created)
end

--- @param ctx HttpContext
--- @param account_id number
function update_account(ctx, account_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "account_id", account_id) then return end

    local account = req.bind_json()
    local err = potato.db.update_by_id("Accounts", account_id, account)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local updated, err = potato.db.find_by_id("Accounts", account_id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param account_id number
function delete_account(ctx, account_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "account_id", account_id) then return end

    local err = soft_delete("Accounts", account_id, userId)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, { message = "Account deleted" })
end

-- ============================================================
-- TRANSACTIONS
-- ============================================================

--- @param ctx HttpContext
function transaction_list(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    -- Query-parameter helpers
    local function get_qp(name, default_val)
        local val = req.default_query(name, default_val or "")
        if val == nil or val == "" then return default_val end
        return tostring(val)
    end

    local raw_array  = get_qp("raw_array", "") == "1"
    local page       = math.max(1, tonumber(get_qp("page", "1")) or 1)
    local page_size  = tonumber(get_qp("pageSize", "15")) or 15
    page_size = math.max(1, math.min(page_size, 500))

    local search = (get_qp("search", "") or get_qp("q", "")):match("^%s*(.-)%s*$") or ""

    local account_id_str = get_qp("accountId", "")
    local account_id = (account_id_str ~= "" and account_id_str ~= "all")
        and tonumber(account_id_str) or nil

    local txn_type = get_qp("txnType", "") or get_qp("type", "")
    if txn_type == "all" then txn_type = "" end

    local date_preset = get_qp("datePreset", "")
    local start_date  = get_qp("startDate", "")
    local end_date    = get_qp("endDate", "")
    local sort_by     = get_qp("sortBy", "date_desc")

    -- Build WHERE clause
    local where_clauses = { "t.is_deleted = 0" }
    local args = {}

    if account_id ~= nil then
        table.insert(where_clauses, "t.id IN (SELECT tl.txn_id FROM TransactionLines tl WHERE tl.account_id = ?)")
        table.insert(args, account_id)
    end

    if txn_type ~= "" then
        if txn_type == "manual" then
            table.insert(where_clauses, "(t.txn_type = 'manual' OR t.txn_type = 'normal' OR t.txn_type = '' OR t.txn_type IS NULL)")
        else
            table.insert(where_clauses, "LOWER(t.txn_type) = LOWER(?)")
            table.insert(args, txn_type)
        end
    end

    if date_preset == "today" then
        table.insert(where_clauses, "date(t.txn_date) = date('now')")
    elseif date_preset == "this_month" then
        table.insert(where_clauses, "strftime('%Y-%m', t.txn_date) = strftime('%Y-%m', 'now')")
    elseif date_preset == "last_30_days" then
        table.insert(where_clauses, "t.txn_date >= datetime('now', '-30 days')")
    elseif date_preset == "custom" or (start_date ~= "" or end_date ~= "") then
        if start_date ~= "" then
            table.insert(where_clauses, "t.txn_date >= ?")
            table.insert(args, #start_date == 10 and start_date .. " 00:00:00" or start_date)
        end
        if end_date ~= "" then
            table.insert(where_clauses, "t.txn_date <= ?")
            table.insert(args, #end_date == 10 and end_date .. " 23:59:59" or end_date)
        end
    end

    if search ~= "" then
        local like = "%" .. search .. "%"
        table.insert(where_clauses, [[
            (
                t.title LIKE ?
                OR t.notes LIKE ?
                OR t.reference_id LIKE ?
                OR t.id IN (
                    SELECT tl.txn_id FROM TransactionLines tl
                    JOIN Accounts a ON tl.account_id = a.id
                    WHERE a.name LIKE ?
                )
                OR t.id IN (
                    SELECT tl.txn_id FROM TransactionLines tl
                    WHERE CAST(tl.debit_amount AS TEXT) LIKE ? OR CAST(tl.credit_amount AS TEXT) LIKE ?
                )
            )
        ]])
        for _ = 1, 6 do table.insert(args, like) end
    end

    local where_sql = table.concat(where_clauses, " AND ")

    local order_sql = "ORDER BY t.txn_date DESC, t.id DESC"
    if sort_by == "date_asc" then
        order_sql = "ORDER BY t.txn_date ASC, t.id ASC"
    elseif sort_by == "amount_desc" then
        order_sql = "ORDER BY (SELECT COALESCE(SUM(tl.debit_amount), 0) FROM TransactionLines tl WHERE tl.txn_id = t.id) DESC, t.id DESC"
    elseif sort_by == "amount_asc" then
        order_sql = "ORDER BY (SELECT COALESCE(SUM(tl.debit_amount), 0) FROM TransactionLines tl WHERE tl.txn_id = t.id) ASC, t.id ASC"
    end

    -- 1. Total matching count
    local count_rows = run_q("SELECT COUNT(*) as cnt FROM Transactions t WHERE " .. where_sql, args)
    local total_count = (count_rows and #count_rows > 0) and (tonumber(count_rows[1].cnt) or 0) or 0

    -- 2. Aggregated metrics for the filtered subset
    local metrics_rows = run_q([[
        SELECT
            COALESCE(SUM(tl.debit_amount), 0)  as total_debit,
            COALESCE(SUM(tl.credit_amount), 0) as total_credit,
            COUNT(DISTINCT tl.account_id)       as accounts_count
        FROM TransactionLines tl
        WHERE tl.txn_id IN (SELECT t.id FROM Transactions t WHERE ]] .. where_sql .. ")", args)

    local total_debit, total_credit, accounts_count = 0, 0, 0
    if metrics_rows and #metrics_rows > 0 then
        total_debit     = tonumber(metrics_rows[1].total_debit)     or 0
        total_credit    = tonumber(metrics_rows[1].total_credit)    or 0
        accounts_count  = tonumber(metrics_rows[1].accounts_count)  or 0
    end

    -- 3. Per-account transaction counts for the filter dropdown
    local acc_count_rows = run_q([[
        SELECT tl.account_id, COUNT(DISTINCT tl.txn_id) as txn_count
        FROM TransactionLines tl
        JOIN Transactions t ON tl.txn_id = t.id
        WHERE t.is_deleted = 0
        GROUP BY tl.account_id
    ]])
    local account_counts = {}
    for _, row in ipairs(acc_count_rows or {}) do
        if row.account_id ~= nil then
            account_counts[tostring(row.account_id)] = tonumber(row.txn_count) or 0
        end
    end

    -- 4. Paginated transactions
    local offset    = (page - 1) * page_size
    local page_args = {}
    for _, a in ipairs(args) do table.insert(page_args, a) end
    table.insert(page_args, page_size)
    table.insert(page_args, offset)

    local transactions, t_err = run_q(
        "SELECT t.* FROM Transactions t WHERE " .. where_sql .. " " .. order_sql .. " LIMIT ? OFFSET ?",
        page_args
    )
    if t_err ~= nil or transactions == nil then
        req.json(400, { error = tostring(t_err or "Failed to query transactions") })
        return
    end

    -- Attach lines to each transaction on this page only
    for _, txn in ipairs(transactions) do
        attach_lines(txn, "TransactionLines", "txn_id", txn.id)
    end

    if raw_array then
        req.json_array(200, transactions)
        return
    end

    req.json(200, {
        items       = transactions,
        total       = total_count,
        page        = page,
        page_size   = page_size,
        total_pages = math.max(1, math.ceil(total_count / page_size)),
        metrics = {
            total_entries  = total_count,
            total_debit    = total_debit,
            total_credit   = total_credit,
            accounts_count = accounts_count,
            is_balanced    = (total_debit == total_credit)
        },
        account_counts = account_counts
    })
end

-- Validate that the lines table is non-empty and debits == credits.
-- Returns (total_debit, total_credit, nil) or (0, 0, err_msg).
local function validate_txn_lines(lines)
    if lines == nil or type(lines) ~= "table" or #lines == 0 then
        return 0, 0, "Transaction must have at least one line"
    end
    local debit, credit = 0, 0
    for _, line in ipairs(lines) do
        debit  = debit  + (line.debit_amount  or 0)
        credit = credit + (line.credit_amount or 0)
    end
    if debit ~= credit then
        return debit, credit, "Transaction must balance: debits (" .. debit .. ") must equal credits (" .. credit .. ")"
    end
    return debit, credit, nil
end

-- Insert transaction lines for a given txn_id.
-- Returns nil on success, or an error string on the first failure.
local function insert_txn_lines(lines, txn_id, userId)
    for _, line in ipairs(lines) do
        local _, err = potato.db.insert("TransactionLines", {
            account_id              = line.account_id,
            txn_id                  = txn_id,
            debit_amount            = line.debit_amount  or 0,
            credit_amount           = line.credit_amount or 0,
            created_by              = userId,
            updated_by              = userId,
            linked_sales_line_id    = line.linked_sales_line_id   and tonumber(line.linked_sales_line_id)   or nil,
            linked_stockin_line_id  = line.linked_stockin_line_id and tonumber(line.linked_stockin_line_id) or nil
        })
        if err ~= nil then
            return "Failed to create transaction line: " .. tostring(err)
        end
    end
    return nil
end

--- @param ctx HttpContext
function transaction_create(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    local _, _, lines_err = validate_txn_lines(data.lines)
    if lines_err ~= nil then
        req.json(400, { error = lines_err })
        return
    end

    local txn_id, err = potato.db.insert("Transactions", {
        title        = data.title        or "",
        notes        = data.notes        or "",
        txn_type     = data.txn_type     or "normal",
        reference_id = data.reference_id or "",
        attachments  = data.attachments  or "",
        created_by   = userId,
        updated_by   = userId,
        txn_date     = to_sqlite_datetime(data.txn_date),
        is_editable  = data.is_editable  or false
    })
    if err ~= nil then
        req.json(400, { error = "Failed to create transaction: " .. tostring(err) })
        return
    end

    local line_err = insert_txn_lines(data.lines, txn_id, userId)
    if line_err ~= nil then
        req.json(400, { error = line_err })
        return
    end

    local txn, fetch_err = potato.db.find_by_id("Transactions", txn_id)
    if fetch_err ~= nil then
        req.json(400, { error = "Failed to fetch transaction: " .. tostring(fetch_err) })
        return
    end
    attach_lines(txn, "TransactionLines", "txn_id", txn_id)

    req.json(200, txn)
end

--- @param ctx HttpContext
--- @param txn_id number
function transaction_update(ctx, txn_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "txn_id", txn_id) then return end

    local txn, err = potato.db.find_by_id("Transactions", txn_id)
    if err ~= nil or txn == nil then
        req.json(404, { error = "Transaction not found" })
        return
    end
    if is_deleted_val(txn.is_deleted) then
        req.json(400, { error = "Cannot update deleted transaction" })
        return
    end
    if txn.is_editable == 0 then
        req.json(400, { error = "Transaction is not editable" })
        return
    end

    local data = req.bind_json()

    if data.lines ~= nil and type(data.lines) == "table" and #data.lines > 0 then
        local _, _, lines_err = validate_txn_lines(data.lines)
        if lines_err ~= nil then
            req.json(400, { error = lines_err })
            return
        end

        -- Replace existing lines
        local existing_lines, _ = potato.db.find_all_by_cond("TransactionLines", { txn_id = txn_id })
        for _, line in ipairs(existing_lines or {}) do
            local del_err = potato.db.delete_by_id("TransactionLines", line.id)
            if del_err ~= nil then
                req.json(400, { error = "Failed to delete existing line: " .. tostring(del_err) })
                return
            end
        end

        local line_err = insert_txn_lines(data.lines, txn_id, userId)
        if line_err ~= nil then
            req.json(400, { error = line_err })
            return
        end
    end

    -- Patch only provided top-level fields
    local update_data = { updated_by = userId }
    local patch_fields = { "title", "notes", "txn_type", "reference_id", "attachments", "txn_date", "is_editable" }
    for _, f in ipairs(patch_fields) do
        if data[f] ~= nil then update_data[f] = data[f] end
    end

    local update_err = potato.db.update_by_id("Transactions", txn_id, update_data)
    if update_err ~= nil then
        req.json(400, { error = "Failed to update transaction: " .. tostring(update_err) })
        return
    end

    local updated_txn, fetch_err = potato.db.find_by_id("Transactions", txn_id)
    if fetch_err ~= nil then
        req.json(400, { error = "Failed to fetch transaction: " .. tostring(fetch_err) })
        return
    end
    attach_lines(updated_txn, "TransactionLines", "txn_id", txn_id)

    req.json(200, updated_txn)
end

--- @param ctx HttpContext
--- @param txn_id number
function transaction_delete(ctx, txn_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "txn_id", txn_id) then return end

    local txn, err = potato.db.find_by_id("Transactions", txn_id)
    if err ~= nil or txn == nil then
        req.json(404, { error = "Transaction not found" })
        return
    end
    if is_deleted_val(txn.is_deleted) then
        req.json(400, { error = "Transaction already deleted" })
        return
    end
    if txn.is_editable == 0 then
        req.json(400, { error = "Transaction is not editable and cannot be deleted" })
        return
    end

    local del_err = potato.db.update_by_id("Transactions", txn_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if del_err ~= nil then
        req.json(400, { error = tostring(del_err) })
        return
    end
    req.json(200, { message = "Transaction deleted" })
end

-- ============================================================
-- CATEGORIES
-- ============================================================

--- @param ctx HttpContext
function list_categories(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local page_str      = get_query_param(req, "page", "")
    local raw_array     = get_query_param(req, "raw_array", "") == "1"
    local search        = (get_query_param(req, "search", "") or get_query_param(req, "q", "")):match("^%s*(.-)%s*$") or ""
    local product_class = get_query_param(req, "productClass", "") or get_query_param(req, "product_class", "")
    if product_class == "all" then product_class = "" end

    -- If no pagination or filtering requested, return flat array for compatibility
    if page_str == "" and not raw_array and search == "" and product_class == "" then
        local categories, err = potato.db.find_all_by_cond("Catagories", { is_deleted = 0 })
        if err ~= nil then
            req.json(400, { error = tostring(err) })
            return
        end
        req.json_array(200, categories or {})
        return
    end

    local page      = math.max(1, tonumber(page_str) or 1)
    local page_size = tonumber(get_query_param(req, "pageSize", "15")) or 15
    page_size = math.max(1, math.min(page_size, 200))

    local where_clauses = { "is_deleted = 0" }
    local args = {}

    if product_class ~= "" then
        table.insert(where_clauses, "product_class = ?")
        table.insert(args, product_class)
    end

    if search ~= "" then
        local like = "%" .. search .. "%"
        table.insert(where_clauses, "(name LIKE ? OR info LIKE ?)")
        table.insert(args, like)
        table.insert(args, like)
    end

    local where_sql = table.concat(where_clauses, " AND ")

    -- Count total
    local count_rows = run_q("SELECT COUNT(*) as cnt FROM Catagories WHERE " .. where_sql, args)
    local total_count = (count_rows and #count_rows > 0) and (tonumber(count_rows[1].cnt) or 0) or 0

    if raw_array then
        local all_categories, c_err = run_q("SELECT * FROM Catagories WHERE " .. where_sql .. " ORDER BY id ASC", args)
        if c_err ~= nil or all_categories == nil then
            req.json(400, { error = tostring(c_err or "Failed to query categories") })
            return
        end
        req.json_array(200, all_categories or {})
        return
    end

    -- Paginated
    local offset = (page - 1) * page_size
    local page_args = {}
    for _, a in ipairs(args) do table.insert(page_args, a) end
    table.insert(page_args, page_size)
    table.insert(page_args, offset)

    local categories, c_err = run_q("SELECT * FROM Catagories WHERE " .. where_sql .. " ORDER BY id ASC LIMIT ? OFFSET ?", page_args)
    if c_err ~= nil or categories == nil then
        req.json(400, { error = tostring(c_err or "Failed to query categories") })
        return
    end

    req.json(200, {
        items       = categories or {},
        total       = total_count,
        page        = page,
        page_size   = page_size,
        total_pages = math.max(1, math.ceil(total_count / page_size))
    })
end

--- @param ctx HttpContext
function create_category(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local category = req.bind_json()
    category.created_by = userId
    category.updated_by = userId

    local id, err = potato.db.insert("Catagories", category)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local created, err = potato.db.find_by_id("Catagories", id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, created)
end

--- @param ctx HttpContext
--- @param category_id number
function update_category(ctx, category_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "category_id", category_id) then return end

    local category = req.bind_json()
    category.updated_by = userId

    local err = potato.db.update_by_id("Catagories", category_id, category)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local updated, err = potato.db.find_by_id("Catagories", category_id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param category_id number
function delete_category(ctx, category_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "category_id", category_id) then return end

    local err = soft_delete("Catagories", category_id, userId)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, { message = "Category deleted" })
end

-- ============================================================
-- CONTACTS
-- ============================================================

--- @param ctx HttpContext
function list_contacts(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local page_str      = get_query_param(req, "page", "")
    local raw_array     = get_query_param(req, "raw_array", "") == "1"
    local search        = (get_query_param(req, "search", "") or get_query_param(req, "q", "")):match("^%s*(.-)%s*$") or ""
    local relation_type = get_query_param(req, "relationType", "") or get_query_param(req, "relation_type", "")
    if relation_type == "all" then relation_type = "" end

    -- If no pagination or filtering requested, return flat array for compatibility
    if page_str == "" and not raw_array and search == "" and relation_type == "" then
        local contacts, err = potato.db.find_all_by_cond("Contacts", { is_deleted = 0 })
        if err ~= nil then
            req.json(400, { error = tostring(err) })
            return
        end
        table.sort(contacts or {}, function(a, b) return (a.id or 0) > (b.id or 0) end)
        req.json_array(200, contacts or {})
        return
    end

    local page      = math.max(1, tonumber(page_str) or 1)
    local page_size = tonumber(get_query_param(req, "pageSize", "15")) or 15
    page_size = math.max(1, math.min(page_size, 200))

    local where_clauses = { "is_deleted = 0" }
    local args = {}

    if relation_type == "customer" then
        table.insert(where_clauses, "relation_type IN ('customer', 'general')")
    elseif relation_type == "supplier" then
        table.insert(where_clauses, "relation_type IN ('supplier', 'general')")
    elseif relation_type == "general" then
        table.insert(where_clauses, "relation_type = 'general'")
    elseif relation_type ~= "" then
        table.insert(where_clauses, "relation_type = ?")
        table.insert(args, relation_type)
    end

    if search ~= "" then
        local like = "%" .. search .. "%"
        table.insert(where_clauses, "(name LIKE ? OR primary_email LIKE ? OR primary_phone LIKE ? OR primary_address LIKE ? OR info LIKE ?)")
        for _ = 1, 5 do table.insert(args, like) end
    end

    local where_sql = table.concat(where_clauses, " AND ")

    -- Count total
    local count_rows = run_q("SELECT COUNT(*) as cnt FROM Contacts WHERE " .. where_sql, args)
    local total_count = (count_rows and #count_rows > 0) and (tonumber(count_rows[1].cnt) or 0) or 0

    -- Summary counts across tabs
    local summary_rows = run_q([[
        SELECT
            COUNT(*) as total_all,
            SUM(CASE WHEN relation_type IN ('customer', 'general') THEN 1 ELSE 0 END) as total_customer,
            SUM(CASE WHEN relation_type IN ('supplier', 'general') THEN 1 ELSE 0 END) as total_supplier,
            SUM(CASE WHEN relation_type = 'general' THEN 1 ELSE 0 END) as total_general
        FROM Contacts
        WHERE is_deleted = 0
    ]])
    local counts = {
        all      = (summary_rows and #summary_rows > 0) and (tonumber(summary_rows[1].total_all) or 0) or 0,
        customer = (summary_rows and #summary_rows > 0) and (tonumber(summary_rows[1].total_customer) or 0) or 0,
        supplier = (summary_rows and #summary_rows > 0) and (tonumber(summary_rows[1].total_supplier) or 0) or 0,
        general  = (summary_rows and #summary_rows > 0) and (tonumber(summary_rows[1].total_general) or 0) or 0,
    }

    if raw_array then
        local all_contacts, c_err = run_q("SELECT * FROM Contacts WHERE " .. where_sql .. " ORDER BY id DESC", args)
        if c_err ~= nil or all_contacts == nil then
            req.json(400, { error = tostring(c_err or "Failed to query contacts") })
            return
        end
        req.json_array(200, all_contacts or {})
        return
    end

    -- Paginated
    local offset = (page - 1) * page_size
    local page_args = {}
    for _, a in ipairs(args) do table.insert(page_args, a) end
    table.insert(page_args, page_size)
    table.insert(page_args, offset)

    local contacts, c_err = run_q("SELECT * FROM Contacts WHERE " .. where_sql .. " ORDER BY id DESC LIMIT ? OFFSET ?", page_args)
    if c_err ~= nil or contacts == nil then
        req.json(400, { error = tostring(c_err or "Failed to query contacts") })
        return
    end

    req.json(200, {
        items       = contacts or {},
        total       = total_count,
        page        = page,
        page_size   = page_size,
        total_pages = math.max(1, math.ceil(total_count / page_size)),
        counts      = counts
    })
end

--- @param ctx HttpContext
--- @param contact_id number
function get_contact(ctx, contact_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "contact_id", contact_id) then return end

    local contact, err = potato.db.find_by_id("Contacts", contact_id)
    if err ~= nil or contact == nil or is_deleted_val(contact.is_deleted) then
        req.json(404, { error = "Contact not found" })
        return
    end
    req.json(200, contact)
end

--- @param ctx HttpContext
function create_contact(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if data.name == nil or data.name == "" then
        req.json(400, { error = "name is required" })
        return
    end

    local id, err = potato.db.insert("Contacts", {
        name              = data.name or "",
        parent_contact_id = data.parent_contact_id and tonumber(data.parent_contact_id) or nil,
        info              = data.info or "",
        images            = data.images or data.image or "",
        contact_type      = data.contact_type or "individual",
        relation_type     = data.relation_type or "customer",
        primary_email     = data.primary_email or "",
        primary_phone     = data.primary_phone or "",
        primary_address   = data.primary_address or "",
        notes             = data.notes or "",
        extra_data        = data.extra_data or "{}",
        created_by        = userId,
        updated_by        = userId,
        is_deleted        = 0
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local created, err = potato.db.find_by_id("Contacts", id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, created)
end

--- @param ctx HttpContext
--- @param contact_id number
function update_contact(ctx, contact_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "contact_id", contact_id) then return end

    local existing, err = potato.db.find_by_id("Contacts", contact_id)
    if err ~= nil or existing == nil or is_deleted_val(existing.is_deleted) then
        req.json(404, { error = "Contact not found" })
        return
    end

    local data        = req.bind_json()
    local update_data = { updated_by = userId }

    if data.name              ~= nil then update_data.name            = data.name end
    if data.parent_contact_id ~= nil then update_data.parent_contact_id = tonumber(data.parent_contact_id) or nil end
    if data.info              ~= nil then update_data.info            = data.info end
    if data.images            ~= nil then update_data.images          = data.images
    elseif data.image         ~= nil then update_data.images          = data.image end
    if data.contact_type      ~= nil then update_data.contact_type    = data.contact_type end
    if data.relation_type     ~= nil then update_data.relation_type   = data.relation_type end
    if data.primary_email     ~= nil then update_data.primary_email   = data.primary_email end
    if data.primary_phone     ~= nil then update_data.primary_phone   = data.primary_phone end
    if data.primary_address   ~= nil then update_data.primary_address = data.primary_address end
    if data.notes             ~= nil then update_data.notes           = data.notes end
    if data.extra_data        ~= nil then update_data.extra_data      = data.extra_data end

    local update_err = potato.db.update_by_id("Contacts", contact_id, update_data)
    if update_err ~= nil then
        req.json(400, { error = tostring(update_err) })
        return
    end

    local updated, _ = potato.db.find_by_id("Contacts", contact_id)
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param contact_id number
function delete_contact(ctx, contact_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "contact_id", contact_id) then return end

    local err = soft_delete("Contacts", contact_id, userId)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, { message = "Contact deleted" })
end

-- ============================================================
-- PRODUCTS
-- ============================================================

-- Adjust stock counters on a product or variant.
-- delta_stockin: change in cumulative received stock (positive for new stockin, negative for cancelled/deleted)
-- delta_sold:    change in cumulative sold stock (positive for new sale, negative for cancelled/deleted)
local function adjust_single_inventory_item(product_id, variant_id, delta_stockin, delta_sold, userId)
    if not product_id or product_id <= 0 then return end
    delta_stockin = tonumber(delta_stockin) or 0
    delta_sold    = tonumber(delta_sold) or 0
    if delta_stockin == 0 and delta_sold == 0 then return end

    -- 1. Variant adjustment (if variant_id is provided)
    if variant_id ~= nil and variant_id > 0 then
        local variant, _ = potato.db.find_by_id("ProductVariants", variant_id)
        if variant ~= nil then
            local v_stockin = math.max(0, (variant.total_stockin_qty or 0) + delta_stockin)
            local v_sold    = math.max(0, (variant.total_sold_qty or 0) + delta_sold)
            local v_stock   = v_stockin - v_sold
            potato.db.update_by_id("ProductVariants", variant_id, {
                total_stockin_qty = v_stockin,
                total_sold_qty    = v_sold,
                stock_count       = v_stock,
                updated_by        = userId or variant.updated_by
            })
        end
    end

    -- 2. Product adjustment (if track_inventory is true)
    local product, _ = potato.db.find_by_id("Products", product_id)
    if product ~= nil then
        local is_tracked = not (product.track_inventory == false or product.track_inventory == 0)
        if is_tracked then
            local p_stockin = math.max(0, (product.total_stockin_qty or 0) + delta_stockin)
            local p_sold    = math.max(0, (product.total_sold_qty or 0) + delta_sold)
            local p_stock   = p_stockin - p_sold
            potato.db.update_by_id("Products", product_id, {
                total_stockin_qty = p_stockin,
                total_sold_qty    = p_sold,
                stock_count       = p_stock,
                updated_by        = userId or product.updated_by
            })
        end
    end
end

-- Adjust inventory for a list of lines (from SalesLines or ProductStockInLines)
-- delta_type: "stockin" (inflow) or "sale" (outflow)
-- sign: +1 (confirming/posting) or -1 (cancelling/reverting/deleting)
local function adjust_lines_inventory(lines, delta_type, sign, userId)
    if not lines or type(lines) ~= "table" then return end
    sign = sign or 1
    for _, line in ipairs(lines) do
        local pid = line.product_id
        local vid = line.variant_id
        local qty = (line.qty or 0) * sign
        if qty ~= 0 and pid ~= nil and pid > 0 then
            if delta_type == "stockin" then
                adjust_single_inventory_item(pid, vid, qty, 0, userId)
            elseif delta_type == "sale" then
                adjust_single_inventory_item(pid, vid, 0, qty, userId)
            end
        end
    end
end

-- Synchronize all product and variant counters from existing confirmed stockin and sales records.
sync_all_product_stock_counts = function()
    local stockins, _ = potato.db.find_all_by_cond("ProductStockIn", { stockin_status = "confirmed" })
    local sid_map = {}
    for _, s in ipairs(stockins or {}) do sid_map[s.id] = true end

    local stockin_by_prod = {}
    local stockin_by_var  = {}
    local stockin_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {})
    for _, l in ipairs(stockin_lines or {}) do
        if sid_map[l.product_stockin_id] then
            local pid = l.product_id
            local vid = l.variant_id or 0
            local q   = l.qty or 0
            if pid ~= nil and pid > 0 then
                stockin_by_prod[pid] = (stockin_by_prod[pid] or 0) + q
            end
            if vid > 0 then
                stockin_by_var[vid] = (stockin_by_var[vid] or 0) + q
            end
        end
    end

    local confirmed_sales, _ = potato.db.find_all_by_cond("Sales", { sales_status = "confirmed" })
    local scrapped_sales, _  = potato.db.find_all_by_cond("Sales", { sales_status = "scrapped" })
    local sale_id_map = {}
    for _, s in ipairs(confirmed_sales or {}) do sale_id_map[s.id] = true end
    for _, s in ipairs(scrapped_sales or {})  do sale_id_map[s.id] = true end

    local sold_by_prod = {}
    local sold_by_var  = {}
    local sales_lines, _ = potato.db.find_all_by_cond("SalesLines", {})
    for _, l in ipairs(sales_lines or {}) do
        if sale_id_map[l.sale_id] then
            local pid = l.product_id
            local vid = l.variant_id or 0
            local q   = l.qty or 0
            if pid ~= nil and pid > 0 then
                sold_by_prod[pid] = (sold_by_prod[pid] or 0) + q
            end
            if vid > 0 then
                sold_by_var[vid] = (sold_by_var[vid] or 0) + q
            end
        end
    end

    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {})
    for _, v in ipairs(variants or {}) do
        local si = stockin_by_var[v.id]
        local so = sold_by_var[v.id]
        if si ~= nil or so ~= nil then
            si = si or 0
            so = so or 0
            potato.db.update_by_id("ProductVariants", v.id, {
                total_stockin_qty = si,
                total_sold_qty    = so,
                stock_count       = 0
            })
        end
    end

    local products, _ = potato.db.find_all_by_cond("Products", {})
    for _, p in ipairs(products or {}) do
        local is_tracked = not (p.track_inventory == false or p.track_inventory == 0)
        if is_tracked then
            local si = stockin_by_prod[p.id]
            local so = sold_by_prod[p.id]
            if si ~= nil or so ~= nil then
                si = si or 0
                so = so or 0
                potato.db.update_by_id("Products", p.id, {
                    total_stockin_qty = si,
                    total_sold_qty    = so,
                    stock_count       = 0
                })
            end
        end
    end
end

local function calculate_product_stocks(products, variants)
    -- Index variants by product
    local variants_by_product = {}
    for _, v in ipairs(variants or {}) do
        local pid = v.product_id
        if variants_by_product[pid] == nil then
            variants_by_product[pid] = {}
        end
        v.total_sold_qty    = v.total_sold_qty or 0
        v.total_stockin_qty = v.total_stockin_qty or 0
        table.insert(variants_by_product[pid], v)
    end

    for _, p in ipairs(products) do
        local p_vars  = variants_by_product[p.id] or {}
        p.variants    = p_vars

        -- Normalize alias
        if p.sales_price == nil and p.price ~= nil then
            p.sales_price = p.price
        end

        local track_inv = not (p.track_inventory == false or p.track_inventory == 0)
        p.track_inventory = track_inv

        local has_vars = p.has_variants == true or p.has_variants == 1 or #p_vars > 0
        p.has_variants = has_vars

        p.total_sold_qty    = p.total_sold_qty or 0
        p.total_stockin_qty = p.total_stockin_qty or 0

        if track_inv then
            if has_vars and #p_vars > 0 then
                local total_stock = 0
                local total_in    = 0
                local total_out   = 0
                for _, v in ipairs(p_vars) do
                    local v_cur   = (v.total_stockin_qty or 0) - (v.total_sold_qty or 0)
                    v.stock_count = v_cur
                    total_stock   = total_stock + v_cur
                    total_in      = total_in + (v.total_stockin_qty or 0)
                    total_out     = total_out + (v.total_sold_qty or 0)
                end
                p.stock_count       = total_stock
                p.total_stockin_qty = total_in
                p.total_sold_qty    = total_out
            else
                p.stock_count = (p.total_stockin_qty or 0) - (p.total_sold_qty or 0)
            end
        else
            if has_vars and #p_vars > 0 then
                local total = 0
                for _, v in ipairs(p_vars) do
                    v.stock_count = v.stock_count or 0
                    total = total + v.stock_count
                end
                p.stock_count = total
            else
                p.stock_count = p.stock_count or 0
            end
        end
    end
end

--- @param ctx HttpContext
function list_products(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local page_str    = get_query_param(req, "page", "")
    local raw_array   = get_query_param(req, "raw_array", "") == "1"
    local search      = (get_query_param(req, "search", "") or get_query_param(req, "q", "")):match("^%s*(.-)%s*$") or ""
    local category_id = get_query_param(req, "categoryId", "") or get_query_param(req, "category_id", "")
    if category_id == "all" then category_id = "" end

    -- If no pagination or filtering requested, return flat array for compatibility
    if page_str == "" and not raw_array and search == "" and category_id == "" then
        local products, err = potato.db.find_all_by_cond("Products", { is_deleted = 0 })
        if err ~= nil then
            req.json(400, { error = tostring(err) })
            return
        end
        local variants, _ = potato.db.find_all_by_cond("ProductVariants", { is_deleted = 0 })
        calculate_product_stocks(products or {}, variants or {})
        req.json_array(200, products or {})
        return
    end

    local page      = math.max(1, tonumber(page_str) or 1)
    local page_size = tonumber(get_query_param(req, "pageSize", "15")) or 15
    page_size = math.max(1, math.min(page_size, 200))

    local where_clauses = { "is_deleted = 0" }
    local args = {}

    if category_id ~= "" and tonumber(category_id) ~= nil then
        table.insert(where_clauses, "catagory_id = ?")
        table.insert(args, tonumber(category_id))
    end

    if search ~= "" then
        local like = "%" .. search .. "%"
        table.insert(where_clauses, "(name LIKE ? OR info LIKE ?)")
        table.insert(args, like)
        table.insert(args, like)
    end

    local where_sql = table.concat(where_clauses, " AND ")

    -- Count total
    local count_rows = run_q("SELECT COUNT(*) as cnt FROM Products WHERE " .. where_sql, args)
    local total_count = (count_rows and #count_rows > 0) and (tonumber(count_rows[1].cnt) or 0) or 0

    if raw_array then
        local all_products, p_err = run_q("SELECT * FROM Products WHERE " .. where_sql .. " ORDER BY id DESC", args)
        if p_err ~= nil or all_products == nil then
            req.json(400, { error = tostring(p_err or "Failed to query products") })
            return
        end
        local variants, _ = potato.db.find_all_by_cond("ProductVariants", { is_deleted = 0 })
        calculate_product_stocks(all_products or {}, variants or {})
        req.json_array(200, all_products or {})
        return
    end

    -- Paginated
    local offset = (page - 1) * page_size
    local page_args = {}
    for _, a in ipairs(args) do table.insert(page_args, a) end
    table.insert(page_args, page_size)
    table.insert(page_args, offset)

    local products, p_err = run_q("SELECT * FROM Products WHERE " .. where_sql .. " ORDER BY id DESC LIMIT ? OFFSET ?", page_args)
    if p_err ~= nil or products == nil then
        req.json(400, { error = tostring(p_err or "Failed to query products") })
        return
    end

    local variants, _ = potato.db.find_all_by_cond("ProductVariants", { is_deleted = 0 })
    calculate_product_stocks(products or {}, variants or {})

    req.json(200, {
        items       = products or {},
        total       = total_count,
        page        = page,
        page_size   = page_size,
        total_pages = math.max(1, math.ceil(total_count / page_size))
    })
end

--- @param ctx HttpContext
--- @param product_id number
function get_product(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end

    local product, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil or product == nil or is_deleted_val(product.is_deleted) then
        req.json(404, { error = "Product not found" })
        return
    end

    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {
        product_id = product_id,
        is_deleted = 0
    })
    calculate_product_stocks({ product }, variants or {})
    req.json(200, product)
end

-- Resolve and validate a product account field (sales or purchase).
-- Returns (resolved_id, nil) or (nil, err_msg).
-- A zero/empty/false value is treated as an explicit clear → returns (nil, nil).
local function resolve_product_account(raw_id, field_name, allowed_types)
    local id, err = validate_account_id(raw_id, allowed_types)
    if err ~= nil then
        return nil, field_name .. ": " .. err
    end
    return id, nil
end

--- @param ctx HttpContext
function create_product(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local product = req.bind_json()

    local sales_account_id, sa_err = resolve_product_account(
        product.sales_account_id, "Sales account", { "revenue" }
    )
    if sa_err ~= nil then
        req.json(400, { error = sa_err })
        return
    end

    local purchase_account_id, pa_err = resolve_product_account(
        product.purchase_account_id, "Purchase account", { "expenses", "assets" }
    )
    if pa_err ~= nil then
        req.json(400, { error = pa_err })
        return
    end

    local is_tracked = (product.track_inventory == false or product.track_inventory == 0) and 0 or 1
    local init_stock = tonumber(product.stock_count) or 0
    local init_stockin = (is_tracked == 1) and init_stock or 0

    local id, err = potato.db.insert("Products", {
        name                = product.name or "",
        info                = product.info or "",
        catagory_id         = tonumber(product.catagory_id) or 0,
        images              = product.images or product.image or "",
        sales_price         = tonumber(product.sales_price or product.price) or 0,
        total_sold_qty      = 0,
        total_stockin_qty   = init_stockin,
        stock_count         = init_stock,
        track_inventory     = is_tracked,
        has_variants        = (product.has_variants == true or product.has_variants == 1) and 1 or 0,
        sales_account_id    = sales_account_id,
        purchase_account_id = purchase_account_id,
        tax_id              = product.tax_id ~= nil and tonumber(product.tax_id) or nil,
        created_by          = userId,
        updated_by          = userId,
        is_deleted          = 0
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local created, err = potato.db.find_by_id("Products", id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    calculate_product_stocks({ created }, {})
    req.json(200, created)
end

--- @param ctx HttpContext
--- @param product_id number
function update_product(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end

    local product     = req.bind_json()
    local update_data = { updated_by = userId }

    if product.name        ~= nil then update_data.name        = product.name end
    if product.info        ~= nil then update_data.info        = product.info end
    if product.catagory_id ~= nil then update_data.catagory_id = tonumber(product.catagory_id) or 0 end

    if product.images ~= nil then
        update_data.images = product.images
    elseif product.image ~= nil then
        update_data.images = product.image
    end

    if product.sales_price ~= nil then
        update_data.sales_price = tonumber(product.sales_price) or 0
    elseif product.price ~= nil then
        update_data.sales_price = tonumber(product.price) or 0
    end

    local curr_prod, _ = potato.db.find_by_id("Products", product_id)
    local will_be_tracked = curr_prod and not (curr_prod.track_inventory == false or curr_prod.track_inventory == 0)
    if product.track_inventory ~= nil then
        will_be_tracked = (product.track_inventory == true or product.track_inventory == 1)
        update_data.track_inventory = will_be_tracked and 1 or 0
    end

    if not will_be_tracked and product.stock_count ~= nil then
        update_data.stock_count = tonumber(product.stock_count) or 0
    end
    if product.has_variants ~= nil then update_data.has_variants = (product.has_variants == true or product.has_variants == 1) and 1 or 0 end

    if product.sales_account_id ~= nil then
        local id, err = resolve_product_account(product.sales_account_id, "Sales account", { "revenue" })
        if err ~= nil then
            req.json(400, { error = err })
            return
        end
        update_data.sales_account_id = id or ""
    end

    if product.purchase_account_id ~= nil then
        local id, err = resolve_product_account(product.purchase_account_id, "Purchase account", { "expenses", "assets" })
        if err ~= nil then
            req.json(400, { error = err })
            return
        end
        update_data.purchase_account_id = id or ""
    end

    if product.tax_id ~= nil then
        update_data.tax_id = (product.tax_id == "" or product.tax_id == 0 or product.tax_id == false)
            and "" or tonumber(product.tax_id)
    end

    local err = potato.db.update_by_id("Products", product_id, update_data)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local updated, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {
        product_id = product_id,
        is_deleted = 0
    })
    calculate_product_stocks({ updated }, variants or {})
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param product_id number
function delete_product(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end

    local err = soft_delete("Products", product_id, userId)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, { message = "Product deleted" })
end

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================

-- Compute stock_count for each variant from counters (if tracked).
local function enrich_variant_stocks(variants, product_id, track_inv)
    for _, v in ipairs(variants or {}) do
        v.total_sold_qty    = v.total_sold_qty or 0
        v.total_stockin_qty = v.total_stockin_qty or 0
        if track_inv then
            v.stock_count = v.total_stockin_qty - v.total_sold_qty
        else
            v.stock_count = v.stock_count or 0
        end
    end
end

local function get_parent_track_inv(product_id)
    local parent, _ = potato.db.find_by_id("Products", product_id)
    if parent == nil then return true end
    return not (parent.track_inventory == false or parent.track_inventory == 0)
end

--- @param ctx HttpContext
--- @param product_id number
function list_product_variants(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end

    local variants, err = potato.db.find_all_by_cond("ProductVariants", {
        product_id = product_id,
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    enrich_variant_stocks(variants, product_id, get_parent_track_inv(product_id))
    req.json_array(200, variants or {})
end

--- @param ctx HttpContext
--- @param product_id number
function create_product_variant(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end

    local variant        = req.bind_json()
    local parent_tracked = get_parent_track_inv(product_id)
    local init_v_stock   = tonumber(variant.stock_count) or 0
    local init_v_stockin = parent_tracked and init_v_stock or 0

    local id, err = potato.db.insert("ProductVariants", {
        product_id        = product_id,
        name              = variant.name or "",
        description       = variant.description or "",
        images            = variant.images or variant.image or "",
        sales_price       = tonumber(variant.sales_price or variant.price) or 0,
        total_sold_qty    = 0,
        total_stockin_qty = init_v_stockin,
        stock_count       = init_v_stock,
        created_by        = userId,
        updated_by        = userId,
        is_deleted        = 0
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    if parent_tracked and init_v_stock > 0 then
        adjust_single_inventory_item(product_id, nil, init_v_stock, 0, userId)
    end

    local created, err = potato.db.find_by_id("ProductVariants", id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, created)
end

--- @param ctx HttpContext
--- @param variant_id number
function get_product_variant(ctx, variant_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "variant_id", variant_id) then return end

    local variant, err = potato.db.find_by_id("ProductVariants", variant_id)
    if err ~= nil or variant == nil then
        req.json(404, { error = "Variant not found" })
        return
    end

    local track_inv = get_parent_track_inv(variant.product_id)
    variant.total_sold_qty    = variant.total_sold_qty or 0
    variant.total_stockin_qty = variant.total_stockin_qty or 0
    if track_inv then
        variant.stock_count = variant.total_stockin_qty - variant.total_sold_qty
    else
        variant.stock_count = variant.stock_count or 0
    end

    req.json(200, variant)
end

--- @param ctx HttpContext
--- @param variant_id number
function update_product_variant(ctx, variant_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "variant_id", variant_id) then return end

    local variant     = req.bind_json()
    local update_data = { updated_by = userId }

    if variant.name        ~= nil then update_data.name        = variant.name end
    if variant.description ~= nil then update_data.description = variant.description end
    if variant.images      ~= nil then update_data.images      = variant.images
    elseif variant.image   ~= nil then update_data.images      = variant.image end
    if variant.sales_price ~= nil then
        update_data.sales_price = tonumber(variant.sales_price) or 0
    elseif variant.price ~= nil then
        update_data.sales_price = tonumber(variant.price) or 0
    end

    local current_var, _ = potato.db.find_by_id("ProductVariants", variant_id)
    local parent_tracked = current_var and get_parent_track_inv(current_var.product_id)
    if not parent_tracked and variant.stock_count ~= nil then
        update_data.stock_count = tonumber(variant.stock_count) or 0
    end

    local err = potato.db.update_by_id("ProductVariants", variant_id, update_data)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local updated, err = potato.db.find_by_id("ProductVariants", variant_id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param variant_id number
function delete_product_variant(ctx, variant_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "variant_id", variant_id) then return end

    local err = soft_delete("ProductVariants", variant_id, userId)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, { message = "Variant deleted" })
end

--- @param ctx HttpContext
--- @param product_id number
function adjust_product_stock_endpoint(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end

    local product, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil or product == nil or is_deleted_val(product.is_deleted) then
        req.json(404, { error = "Product not found" })
        return
    end

    local data = req.bind_json()
    local is_tracked = not (product.track_inventory == false or product.track_inventory == 0)

    if is_tracked then
        local delta = 0
        if data.delta ~= nil then
            delta = tonumber(data.delta) or 0
        elseif data.new_stock_count ~= nil or data.stock_count ~= nil then
            local target = tonumber(data.new_stock_count or data.stock_count) or 0
            local curr   = (product.total_stockin_qty or 0) - (product.total_sold_qty or 0)
            delta = target - curr
        end

        if delta > 0 then
            adjust_single_inventory_item(product_id, nil, delta, 0, userId)
        elseif delta < 0 then
            adjust_single_inventory_item(product_id, nil, 0, -delta, userId)
        end
    else
        local target = tonumber(data.new_stock_count or data.stock_count) or 0
        potato.db.update_by_id("Products", product_id, {
            stock_count = target,
            updated_by  = userId
        })
    end

    local updated, _ = potato.db.find_by_id("Products", product_id)
    local variants, _ = potato.db.find_all_by_cond("ProductVariants", { product_id = product_id, is_deleted = 0 })
    calculate_product_stocks({ updated }, variants or {})
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param variant_id number
function adjust_variant_stock_endpoint(ctx, variant_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "variant_id", variant_id) then return end

    local variant, err = potato.db.find_by_id("ProductVariants", variant_id)
    if err ~= nil or variant == nil or is_deleted_val(variant.is_deleted) then
        req.json(404, { error = "Variant not found" })
        return
    end

    local data = req.bind_json()
    local parent_tracked = get_parent_track_inv(variant.product_id)

    if parent_tracked then
        local delta = 0
        if data.delta ~= nil then
            delta = tonumber(data.delta) or 0
        elseif data.new_stock_count ~= nil or data.stock_count ~= nil then
            local target = tonumber(data.new_stock_count or data.stock_count) or 0
            local curr   = (variant.total_stockin_qty or 0) - (variant.total_sold_qty or 0)
            delta = target - curr
        end

        if delta > 0 then
            adjust_single_inventory_item(variant.product_id, variant_id, delta, 0, userId)
        elseif delta < 0 then
            adjust_single_inventory_item(variant.product_id, variant_id, 0, -delta, userId)
        end
    else
        local target = tonumber(data.new_stock_count or data.stock_count) or 0
        potato.db.update_by_id("ProductVariants", variant_id, {
            stock_count = target,
            updated_by  = userId
        })
    end

    local updated, _ = potato.db.find_by_id("ProductVariants", variant_id)
    enrich_variant_stocks({ updated }, updated.product_id, parent_tracked)
    req.json(200, updated)
end

-- ============================================================
-- SHARED ACCOUNTING & CONFIG HELPERS
-- ============================================================

-- Read a numeric config value from KV, with fallback to nil.
local function kv_number(group, key)
    local v = kv_value(space_kv_get(group, key))
    return v and tonumber(v) or nil
end

-- Read a string config value from KV, with fallback to nil.
local function kv_string(group, key)
    return kv_value(space_kv_get(group, key))
end

local function get_app_settings_table()
    local currency_symbol            = kv_string("CONFIG", "CURRENCY_SYMBOL") or "$"
    local default_tax_rate_id        = kv_number("CONFIG", "DEFAULT_TAX_RATE_ID")
    local default_sales_account_id   = kv_number("CONFIG", "DEFAULT_SALES_ACCOUNT_ID")
    local default_purchase_account_id= kv_number("CONFIG", "DEFAULT_PURCHASE_ACCOUNT_ID")
    local default_receivable_account_id = kv_number("CONFIG", "DEFAULT_RECEIVABLE_ACCOUNT_ID")
    local default_payable_account_id = kv_number("CONFIG", "DEFAULT_PAYABLE_ACCOUNT_ID")
    local default_payment_account_id = kv_number("CONFIG", "DEFAULT_PAYMENT_ACCOUNT_ID")
    local default_tax_account_id     = kv_number("CONFIG", "DEFAULT_TAX_ACCOUNT_ID")

    -- Also try a combined SETTINGS blob (legacy support)
    local settings_raw = kv_string("CONFIG", "SETTINGS") or kv_string("CONFIG", "DEFAULTS")
    if settings_raw ~= nil then
        local ok, parsed = pcall(json.decode, settings_raw)
        if ok and type(parsed) == "table" then
            if currency_symbol == "$"             and parsed.currency_symbol             ~= nil and parsed.currency_symbol             ~= "" then currency_symbol             = tostring(parsed.currency_symbol) end
            if default_tax_rate_id        == nil  and parsed.default_tax_rate_id        ~= nil then default_tax_rate_id        = tonumber(parsed.default_tax_rate_id) end
            if default_sales_account_id   == nil  and parsed.default_sales_account_id   ~= nil then default_sales_account_id   = tonumber(parsed.default_sales_account_id) end
            if default_purchase_account_id == nil and parsed.default_purchase_account_id ~= nil then default_purchase_account_id = tonumber(parsed.default_purchase_account_id) end
            if default_receivable_account_id == nil and parsed.default_receivable_account_id ~= nil then default_receivable_account_id = tonumber(parsed.default_receivable_account_id) end
            if default_payable_account_id == nil  and parsed.default_payable_account_id  ~= nil then default_payable_account_id  = tonumber(parsed.default_payable_account_id) end
            if default_payment_account_id == nil  and parsed.default_payment_account_id  ~= nil then default_payment_account_id  = tonumber(parsed.default_payment_account_id) end
            if default_tax_account_id     == nil  and parsed.default_tax_account_id      ~= nil then default_tax_account_id      = tonumber(parsed.default_tax_account_id) end
        end
    end

    return {
        currency_symbol              = currency_symbol,
        default_tax_rate_id          = default_tax_rate_id,
        default_sales_account_id     = default_sales_account_id,
        default_purchase_account_id  = default_purchase_account_id,
        default_receivable_account_id = default_receivable_account_id,
        default_payable_account_id   = default_payable_account_id,
        default_payment_account_id   = default_payment_account_id,
        default_tax_account_id       = default_tax_account_id
    }
end

-- Find the best-matching account ID for a given type, using common name patterns as hints.
local function find_account_by_type(acc_type, name_hints)
    -- Try name hints first
    for _, hint in ipairs(name_hints or {}) do
        local rows = run_q("SELECT id FROM Accounts WHERE is_deleted = 0 AND acc_type = ? AND name LIKE ? LIMIT 1",
            { acc_type, "%" .. hint .. "%" })
        if rows and #rows > 0 then return tonumber(rows[1].id) end
    end
    -- Fall back to any account of the right type
    local rows = run_q("SELECT id FROM Accounts WHERE is_deleted = 0 AND acc_type = ? LIMIT 1", { acc_type })
    if rows and #rows > 0 then return tonumber(rows[1].id) end
    return nil
end

-- Extract payment_account_id from request body (handles two field aliases).
local function resolve_payment_account_id(data)
    if type(data) ~= "table" then return nil end
    if data.payment_account_id ~= nil and data.payment_account_id ~= "" then
        return tonumber(data.payment_account_id)
    elseif data.account_id ~= nil and data.account_id ~= "" then
        return tonumber(data.account_id)
    end
    return nil
end

-- ============================================================
-- STOCK IN
-- ============================================================

-- Resolve vendor fields: prefer contact id, fall back to alt name.
local function resolve_vendor(data)
    local cid = nil
    if data.vendor_contact_id ~= nil and data.vendor_contact_id ~= "" then
        cid = tonumber(data.vendor_contact_id)
    elseif data.vendor_id ~= nil and data.vendor_id ~= "" then
        cid = tonumber(data.vendor_id)
    end
    local alt = data.vendor_alt_name or data.vendor_name or ""
    return cid, alt
end

-- Annotate a stockin with its vendor name (resolved from Contacts or alt name).
local function resolve_stockin_vendor_name(stockin)
    if stockin.vendor_contact_id ~= nil then
        local c, _ = potato.db.find_by_id("Contacts", stockin.vendor_contact_id)
        stockin.vendor_name = (c ~= nil) and c.name or (stockin.vendor_alt_name or "")
    else
        stockin.vendor_name = stockin.vendor_alt_name or ""
    end
end

-- Calculate total amount from line items (qty * price, or explicit amount).
local function calc_stockin_lines_total(lines)
    local total = 0
    for _, line in ipairs(lines) do
        local q   = tonumber(line.qty) or 0
        local p   = tonumber(line.price) or 0
        local amt = tonumber(line.amount)
        if amt == nil or amt == 0 then amt = q * p end
        total = total + amt
    end
    return total
end

-- Insert all lines for a stockin. Returns annotated line records with computed amounts.
local function insert_stockin_lines(lines, stockin_id, userId)
    for _, line in ipairs(lines) do
        local q   = tonumber(line.qty) or 0
        local p   = tonumber(line.price) or 0
        local amt = tonumber(line.amount)
        if amt == nil or amt == 0 then amt = q * p end
        potato.db.insert("ProductStockInLines", {
            product_stockin_id = stockin_id,
            product_id         = tonumber(line.product_id) or 0,
            variant_id         = tonumber(line.variant_id) or 0,
            qty                = q,
            price              = p,
            amount             = amt,
            info               = line.info or "",
            created_by         = userId,
            updated_by         = userId
        })
    end
end

local function resolve_stockin_accounts()
    local s = get_app_settings_table()

    local purchase_acc_id = (s.default_purchase_account_id and s.default_purchase_account_id ~= 0) and s.default_purchase_account_id
        or find_account_by_type("expenses", { "Purchase", "Cost", "COGS", "Inventory" })
        or find_account_by_type("assets", { "Inventory" })

    local payable_acc_id = (s.default_payable_account_id and s.default_payable_account_id ~= 0) and s.default_payable_account_id
        or find_account_by_type("liabilities", { "Payable", "Creditor", "Supplier" })
        or find_account_by_type("liabilities")

    local payment_acc_id = (s.default_payment_account_id and s.default_payment_account_id ~= 0) and s.default_payment_account_id
        or find_account_by_type("assets", { "Cash", "Bank" })

    return {
        purchase_acc_id = purchase_acc_id,
        payable_acc_id  = payable_acc_id,
        payment_acc_id  = payment_acc_id
    }
end

local function post_stockin_transaction(stockin, lines, payment_account_id, userId)
    local accounts = resolve_stockin_accounts()

    -- Credit account: Cash/Bank if paid, otherwise Accounts Payable
    local credit_acc_id = (stockin.payment_status == "paid")
        and (payment_account_id or accounts.payment_acc_id)
        or accounts.payable_acc_id

    if not credit_acc_id then
        return nil, "No valid account found for credit (Accounts Payable or Payment asset account)"
    end

    local txn_title = "Stock In #" .. tostring(stockin.id)
    if stockin.reference_id and stockin.reference_id ~= "" then
        txn_title = txn_title .. " - " .. stockin.reference_id
    elseif stockin.vendor_name and stockin.vendor_name ~= "" then
        txn_title = txn_title .. " - " .. stockin.vendor_name
    end

    local txn_id, err = potato.db.insert("Transactions", {
        title          = txn_title,
        notes          = "Auto-generated transaction for Stock In #" .. tostring(stockin.id),
        txn_type       = "stockin",
        reference_id   = tostring(stockin.id),
        reference_type = "stockin",
        attachments    = stockin.attachments or "",
        created_by     = userId,
        updated_by     = userId,
        txn_date       = to_sqlite_datetime(stockin.stockin_date),
        is_editable    = 0,
        is_deleted     = 0
    })
    if err ~= nil or txn_id == nil then
        return nil, "Failed to create transaction: " .. tostring(err)
    end

    -- Build debit lines (one per stockin line)
    local debit_lines = {}
    local total_debits = 0

    for _, line in ipairs(lines or {}) do
        local line_acc = nil
        if line.product_id and tonumber(line.product_id) and tonumber(line.product_id) > 0 then
            local prod, _ = potato.db.find_by_id("Products", tonumber(line.product_id))
            if prod and prod.purchase_account_id and tonumber(prod.purchase_account_id) and tonumber(prod.purchase_account_id) > 0 then
                line_acc = tonumber(prod.purchase_account_id)
            end
        end
        if not line_acc then line_acc = accounts.purchase_acc_id end
        if not line_acc then
            return nil, "No valid purchase account found for debit line"
        end

        local line_amount = tonumber(line.amount)
        if line_amount == nil or line_amount == 0 then
            line_amount = (tonumber(line.qty) or 0) * (tonumber(line.price) or 0)
        end

        table.insert(debit_lines, {
            account_id             = line_acc,
            txn_id                 = txn_id,
            debit_amount           = line_amount,
            credit_amount          = 0,
            created_by             = userId,
            updated_by             = userId,
            linked_sales_line_id   = nil,
            linked_stockin_line_id = line.id
        })
        total_debits = total_debits + line_amount
    end

    local stockin_total = tonumber(stockin.amount) or 0
    if #debit_lines == 0 and accounts.purchase_acc_id then
        table.insert(debit_lines, {
            account_id             = accounts.purchase_acc_id,
            txn_id                 = txn_id,
            debit_amount           = stockin_total,
            credit_amount          = 0,
            created_by             = userId,
            updated_by             = userId,
            linked_sales_line_id   = nil,
            linked_stockin_line_id = nil
        })
        total_debits = stockin_total
    end

    -- Balance check
    local diff = stockin_total - total_debits
    if diff ~= 0 and #debit_lines > 0 then
        debit_lines[1].debit_amount = debit_lines[1].debit_amount + diff
        total_debits = total_debits + diff
    end

    -- Credit line (Accounts Payable or Payment Asset)
    potato.db.insert("TransactionLines", {
        account_id             = credit_acc_id,
        txn_id                 = txn_id,
        debit_amount           = 0,
        credit_amount          = total_debits,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = nil,
        linked_stockin_line_id = nil
    })

    for _, dl in ipairs(debit_lines) do
        potato.db.insert("TransactionLines", dl)
    end

    return txn_id
end

local function post_stockin_payment_transaction(stockin, payment_account_id, payment_date, userId)
    local accounts       = resolve_stockin_accounts()
    local pay_acc_id     = payment_account_id or accounts.payment_acc_id
    local payable_acc_id = accounts.payable_acc_id

    if not pay_acc_id or not payable_acc_id then
        return nil, "Missing payment or accounts payable account"
    end

    local txn_id, err = potato.db.insert("Transactions", {
        title          = "Payment for Stock In #" .. tostring(stockin.id),
        notes          = "Payment made for Stock In #" .. tostring(stockin.id),
        txn_type       = "stockin",
        reference_id   = tostring(stockin.id),
        reference_type = "stockin",
        attachments    = "",
        created_by     = userId,
        updated_by     = userId,
        txn_date       = to_sqlite_datetime(payment_date),
        is_editable    = 0,
        is_deleted     = 0
    })
    if err ~= nil or txn_id == nil then
        return nil, "Failed to create payment transaction: " .. tostring(err)
    end

    local total = tonumber(stockin.amount) or 0

    -- Debit Accounts Payable
    potato.db.insert("TransactionLines", {
        account_id             = payable_acc_id,
        txn_id                 = txn_id,
        debit_amount           = total,
        credit_amount          = 0,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = nil,
        linked_stockin_line_id = nil
    })

    -- Credit Cash/Bank
    potato.db.insert("TransactionLines", {
        account_id             = pay_acc_id,
        txn_id                 = txn_id,
        debit_amount           = 0,
        credit_amount          = total,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = nil,
        linked_stockin_line_id = nil
    })

    return txn_id
end

local function revert_stockin_transactions(stockin_id, userId)
    local txns = run_q(
        "SELECT id FROM Transactions WHERE reference_type = 'stockin' AND reference_id = ? AND is_deleted = 0",
        { tostring(stockin_id) }
    )
    for _, t in ipairs(txns or {}) do
        potato.db.update_by_id("Transactions", t.id, { is_deleted = 1, updated_by = userId })
    end
end

--- @param ctx HttpContext
function list_stockin(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local stockins, err = potato.db.find_all_by_cond("ProductStockIn", {})
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    -- Build lookup maps for product / variant / contact names
    local prod_map, var_map, contact_map = {}, {}, {}

    local all_prods, _ = potato.db.find_all_by_cond("Products", {})
    for _, p in ipairs(all_prods or {}) do prod_map[p.id] = p.name end

    local all_vars, _ = potato.db.find_all_by_cond("ProductVariants", {})
    for _, v in ipairs(all_vars or {}) do var_map[v.id] = v.name end

    local all_contacts, _ = potato.db.find_all_by_cond("Contacts", {})
    for _, c in ipairs(all_contacts or {}) do contact_map[c.id] = c.name end

    -- Group lines by stockin, annotating with product/variant names
    local lines_by_stockin = {}
    local all_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {})
    for _, l in ipairs(all_lines or {}) do
        local sid = l.product_stockin_id
        if lines_by_stockin[sid] == nil then lines_by_stockin[sid] = {} end
        l.product_name = prod_map[l.product_id] or ("Product #" .. tostring(l.product_id))
        if l.variant_id ~= nil and l.variant_id > 0 then
            l.variant_name = var_map[l.variant_id] or ("Variant #" .. tostring(l.variant_id))
        end
        table.insert(lines_by_stockin[sid], l)
    end

    for _, s in ipairs(stockins or {}) do
        s.lines       = lines_by_stockin[s.id] or {}
        s.vendor_name = (s.vendor_contact_id ~= nil and contact_map[s.vendor_contact_id])
            and contact_map[s.vendor_contact_id]
            or (s.vendor_alt_name or "")
    end

    table.sort(stockins or {}, function(a, b) return (a.id or 0) > (b.id or 0) end)
    req.json_array(200, stockins or {})
end

--- @param ctx HttpContext
function create_stockin(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data   = req.bind_json()
    local lines  = data.lines or {}

    if lines == nil or type(lines) ~= "table" or #lines == 0 then
        req.json(400, { error = "Stock in must have at least one line" })
        return
    end

    local total_amount = calc_stockin_lines_total(lines)
    if total_amount == 0 and data.amount ~= nil then
        total_amount = tonumber(data.amount) or 0
    end

    local vendor_cid, vendor_alt = resolve_vendor(data)

    local id, err = potato.db.insert("ProductStockIn", {
        info              = data.info or "",
        amount            = total_amount,
        stockin_status    = data.stockin_status or "draft",
        payment_status    = data.payment_status or "unpaid",
        reference_id      = data.reference_id or "",
        vendor_contact_id = vendor_cid,
        vendor_alt_name   = vendor_alt,
        attachments       = data.attachments or "",
        stockin_date      = to_sqlite_datetime(data.stockin_date),
        created_by        = userId,
        updated_by        = userId
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    insert_stockin_lines(lines, id, userId)

    local stockin, _ = potato.db.find_by_id("ProductStockIn", id)
    if stockin ~= nil then
        attach_lines(stockin, "ProductStockInLines", "product_stockin_id", id)
        resolve_stockin_vendor_name(stockin)
    end

    -- Auto-post transaction when stockin is created directly as confirmed
    if data.stockin_status == "confirmed" then
        local pay_acc_id = resolve_payment_account_id(data)
        if pay_acc_id ~= nil and data.payment_status == "paid" then
            local p_acc, _ = potato.db.find_by_id("Accounts", pay_acc_id)
            if not p_acc or p_acc.acc_type ~= "assets" then
                req.json(400, { error = "Payment account must have account type 'assets'" })
                return
            end
        end
        local _, post_err = post_stockin_transaction(stockin, stockin.lines, pay_acc_id, userId)
        if post_err ~= nil then
            print("Warning: failed to post stockin transaction on creation: " .. tostring(post_err))
        end
        adjust_lines_inventory(stockin.lines, "stockin", 1, userId)
    end

    req.json(200, stockin)
end

--- @param ctx HttpContext
--- @param stockin_id number
function get_stockin(ctx, stockin_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "stockin_id", stockin_id) then return end

    local stockin, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or stockin == nil then
        req.json(404, { error = "StockIn not found" })
        return
    end

    resolve_stockin_vendor_name(stockin)

    -- Build product / variant name maps for line annotation
    local prod_map, var_map = {}, {}
    local all_prods, _ = potato.db.find_all_by_cond("Products", {})
    for _, p in ipairs(all_prods or {}) do prod_map[p.id] = p.name end

    local all_vars, _ = potato.db.find_all_by_cond("ProductVariants", {})
    for _, v in ipairs(all_vars or {}) do var_map[v.id] = v.name end

    local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })
    for _, l in ipairs(lines or {}) do
        l.product_name = prod_map[l.product_id] or ("Product #" .. tostring(l.product_id))
        if l.variant_id ~= nil and l.variant_id > 0 then
            l.variant_name = var_map[l.variant_id] or ("Variant #" .. tostring(l.variant_id))
        end
    end
    stockin.lines = lines or {}

    req.json(200, stockin)
end

--- @param ctx HttpContext
--- @param stockin_id number
function update_stockin(ctx, stockin_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "stockin_id", stockin_id) then return end

    local existing, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or existing == nil then
        req.json(404, { error = "StockIn not found" })
        return
    end
    if (existing.stockin_status or "draft") ~= "draft" then
        req.json(400, { error = "Cannot edit stock in record unless it is in draft state" })
        return
    end

    local data        = req.bind_json()
    local update_data = { updated_by = userId }

    if data.info           ~= nil then update_data.info           = data.info end
    if data.stockin_status ~= nil then update_data.stockin_status = data.stockin_status end
    if data.payment_status ~= nil then update_data.payment_status = data.payment_status end
    if data.reference_id   ~= nil then update_data.reference_id   = data.reference_id end
    if data.attachments    ~= nil then update_data.attachments    = data.attachments end
    if data.stockin_date   ~= nil then update_data.stockin_date   = to_sqlite_datetime(data.stockin_date) end

    -- Resolve vendor
    if data.vendor_contact_id ~= nil then
        update_data.vendor_contact_id = (data.vendor_contact_id == "" or data.vendor_contact_id == 0)
            and nil or tonumber(data.vendor_contact_id)
    elseif data.vendor_id ~= nil then
        update_data.vendor_contact_id = tonumber(data.vendor_id) or nil
    end
    if data.vendor_alt_name ~= nil then
        update_data.vendor_alt_name = data.vendor_alt_name
    elseif data.vendor_name ~= nil then
        update_data.vendor_alt_name = data.vendor_name
    end

    -- Replace lines if provided
    if data.lines ~= nil and type(data.lines) == "table" and #data.lines > 0 then
        potato.db.delete_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })
        insert_stockin_lines(data.lines, stockin_id, userId)
        update_data.amount = calc_stockin_lines_total(data.lines)
    elseif data.amount ~= nil then
        update_data.amount = tonumber(data.amount) or 0
    end

    local update_err = potato.db.update_by_id("ProductStockIn", stockin_id, update_data)
    if update_err ~= nil then
        req.json(400, { error = tostring(update_err) })
        return
    end

    local updated, _ = potato.db.find_by_id("ProductStockIn", stockin_id)
    if updated ~= nil then
        attach_lines(updated, "ProductStockInLines", "product_stockin_id", stockin_id)
        resolve_stockin_vendor_name(updated)
    end

    -- Auto-post transaction when transitioning to confirmed for the first time
    if update_data.stockin_status == "confirmed" then
        local existing_txns = run_q(
            "SELECT id FROM Transactions WHERE reference_type = 'stockin' AND reference_id = ? AND is_deleted = 0",
            { tostring(stockin_id) }
        )
        if not existing_txns or #existing_txns == 0 then
            local pay_acc_id = resolve_payment_account_id(data)
            local _, post_err = post_stockin_transaction(updated, updated.lines, pay_acc_id, userId)
            if post_err ~= nil then
                print("Warning: failed to post stockin transaction on update: " .. tostring(post_err))
            end
            adjust_lines_inventory(updated.lines, "stockin", 1, userId)
        end
    end

    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param stockin_id number
function confirm_stockin(ctx, stockin_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "stockin_id", stockin_id) then return end

    local stockin, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or stockin == nil then
        req.json(404, { error = "StockIn not found" })
        return
    end

    if (stockin.stockin_status or "draft") ~= "draft" then
        local existing_txns = run_q(
            "SELECT id FROM Transactions WHERE reference_type = 'stockin' AND reference_id = ? AND is_deleted = 0",
            { tostring(stockin_id) }
        )
        if existing_txns and #existing_txns > 0 then
            req.json(400, { error = "Only draft stock in records can be confirmed" })
            return
        end
    end

    local data       = req.bind_json()
    local pay_acc_id = resolve_payment_account_id(data)

    if pay_acc_id ~= nil and stockin.payment_status == "paid" then
        local p_acc, _ = potato.db.find_by_id("Accounts", pay_acc_id)
        if not p_acc or p_acc.acc_type ~= "assets" then
            req.json(400, { error = "Payment account must have account type 'assets'" })
            return
        end
    end

    local update_err = potato.db.update_by_id("ProductStockIn", stockin_id, {
        stockin_status = "confirmed",
        updated_by     = userId
    })
    if update_err ~= nil then
        req.json(400, { error = "Failed to confirm stock in: " .. tostring(update_err) })
        return
    end

    local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })
    stockin.stockin_status = "confirmed"
    stockin.lines = lines or {}
    resolve_stockin_vendor_name(stockin)

    local _, post_err = post_stockin_transaction(stockin, lines, pay_acc_id, userId)
    if post_err ~= nil then
        print("Warning: failed to post stockin transaction on confirm: " .. tostring(post_err))
        req.json(400, { error = "Failed to post stock in transaction: " .. tostring(post_err) })
        return
    end

    adjust_lines_inventory(lines, "stockin", 1, userId)

    req.json(200, stockin)
end

--- @param ctx HttpContext
--- @param stockin_id number
function register_stockin_payment(ctx, stockin_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "stockin_id", stockin_id) then return end

    local stockin, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or stockin == nil then
        req.json(404, { error = "StockIn not found" })
        return
    end
    if stockin.stockin_status == "cancelled" then
        req.json(400, { error = "Cannot register payment for cancelled stock in" })
        return
    end
    if stockin.payment_status == "paid" then
        req.json(400, { error = "Stock in is already paid" })
        return
    end

    local data         = req.bind_json()
    local pay_acc_id   = resolve_payment_account_id(data)
    local payment_date = (type(data) == "table" and data.payment_date ~= nil and data.payment_date ~= "") and data.payment_date or nil

    if pay_acc_id ~= nil then
        local p_acc, _ = potato.db.find_by_id("Accounts", pay_acc_id)
        if not p_acc then
            req.json(400, { error = "Selected payment account not found" })
            return
        end
        if p_acc.acc_type ~= "assets" then
            req.json(400, { error = "Payment account must have account type 'assets'" })
            return
        end
    end

    local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })
    stockin.lines = lines or {}
    resolve_stockin_vendor_name(stockin)

    -- Flow A: Draft stockin -> register payment (confirm + paid in one go, single transaction)
    if (stockin.stockin_status or "draft") == "draft" then
        local update_err = potato.db.update_by_id("ProductStockIn", stockin_id, {
            stockin_status = "confirmed",
            payment_status = "paid",
            updated_by     = userId
        })
        if update_err ~= nil then
            req.json(400, { error = "Failed to update stock in: " .. tostring(update_err) })
            return
        end
        stockin.stockin_status = "confirmed"
        stockin.payment_status = "paid"
        local _, post_err = post_stockin_transaction(stockin, lines, pay_acc_id, userId)
        if post_err ~= nil then
            print("Warning: failed to post stockin transaction on draft payment: " .. tostring(post_err))
        end
        adjust_lines_inventory(lines, "stockin", 1, userId)
        req.json(200, stockin)
        return
    end

    -- Flow B: Confirmed + Unpaid -> register payment (separate payment transaction)
    if stockin.stockin_status == "confirmed" then
        local update_err = potato.db.update_by_id("ProductStockIn", stockin_id, {
            payment_status = "paid",
            updated_by     = userId
        })
        if update_err ~= nil then
            req.json(400, { error = "Failed to update payment status: " .. tostring(update_err) })
            return
        end
        stockin.payment_status = "paid"
        local _, post_err = post_stockin_payment_transaction(stockin, pay_acc_id, payment_date, userId)
        if post_err ~= nil then
            print("Warning: failed to post stock in payment transaction: " .. tostring(post_err))
        end
        req.json(200, stockin)
        return
    end
end

--- @param ctx HttpContext
--- @param stockin_id number
function cancel_stockin(ctx, stockin_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "stockin_id", stockin_id) then return end

    local stockin, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or stockin == nil then
        req.json(404, { error = "StockIn not found" })
        return
    end
    if stockin.stockin_status == "cancelled" then
        req.json(400, { error = "Stock in is already cancelled" })
        return
    end

    local prev_status = stockin.stockin_status or "draft"

    local update_err = potato.db.update_by_id("ProductStockIn", stockin_id, {
        stockin_status = "cancelled",
        updated_by     = userId
    })
    if update_err ~= nil then
        req.json(400, { error = "Failed to cancel stock in: " .. tostring(update_err) })
        return
    end

    local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })
    stockin.lines = lines or {}
    stockin.stockin_status = "cancelled"

    -- Revert linked transactions and inventory only if the stock in was previously confirmed
    if prev_status == "confirmed" then
        revert_stockin_transactions(stockin_id, userId)
        adjust_lines_inventory(lines or {}, "stockin", -1, userId)
    end

    resolve_stockin_vendor_name(stockin)

    req.json(200, stockin)
end

--- @param ctx HttpContext
--- @param stockin_id number
function delete_stockin(ctx, stockin_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "stockin_id", stockin_id) then return end

    local stockin, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or stockin == nil then
        req.json(404, { error = "StockIn not found" })
        return
    end

    if stockin.stockin_status == "confirmed" then
        local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })
        adjust_lines_inventory(lines or {}, "stockin", -1, userId)
    end

    revert_stockin_transactions(stockin_id, userId)

    local del_err = potato.db.delete_by_id("ProductStockIn", stockin_id)
    if del_err ~= nil then
        req.json(400, { error = tostring(del_err) })
        return
    end
    potato.db.delete_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })

    req.json(200, { message = "StockIn deleted" })
end

-- ============================================================
-- TAXES
-- ============================================================

--- @param ctx HttpContext
function list_taxes(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local taxes, err = potato.db.find_all_by_cond("Tax", { is_deleted = 0 })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json_array(200, taxes)
end

--- @param ctx HttpContext
function create_tax(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local tax = req.bind_json()
    tax.created_by = userId
    tax.updated_by = userId

    local id, err = potato.db.insert("Tax", tax)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local created, err = potato.db.find_by_id("Tax", id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, created)
end

--- @param ctx HttpContext
--- @param tax_id number
function update_tax(ctx, tax_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "tax_id", tax_id) then return end

    local tax = req.bind_json()
    tax.updated_by = userId

    local err = potato.db.update_by_id("Tax", tax_id, tax)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local updated, err = potato.db.find_by_id("Tax", tax_id)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param tax_id number
function delete_tax(ctx, tax_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "tax_id", tax_id) then return end

    local err = soft_delete("Tax", tax_id, userId)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json(200, { message = "Tax deleted" })
end

-- ============================================================
-- APP SETTINGS
-- ============================================================

function get_app_settings(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    req.json(200, get_app_settings_table())
end

function update_app_settings(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if type(data) ~= "table" then
        req.json(400, { error = "Invalid JSON payload" })
        return
    end

    -- currency
    local currency_symbol = data.currency_symbol and tostring(data.currency_symbol):match("^%s*(.-)%s*$") or "$"
    if currency_symbol == "" then currency_symbol = "$" end

    -- Validate each optional account field before persisting
    local tax_rate_id = data.default_tax_rate_id and tonumber(data.default_tax_rate_id) or nil

    local function validate_setting_account(raw_id, allowed_types, label)
        local id = raw_id and tonumber(raw_id) or nil
        if id and id > 0 then
            local acc, _ = potato.db.find_by_id("Accounts", id)
            local type_ok = false
            if acc and acc.is_deleted ~= 1 then
                for _, t in ipairs(allowed_types) do
                    if acc.acc_type == t then type_ok = true; break end
                end
            end
            if not type_ok then
                return nil, label .. " must be an account of type: " .. table.concat(allowed_types, " or ")
            end
        end
        return id, nil
    end

    local sales_acc_id,    sa_err  = validate_setting_account(data.default_sales_account_id,    { "revenue" },               "Default sales account")
    if sa_err  ~= nil then req.json(400, { error = sa_err  }); return end

    local purchase_acc_id, pa_err  = validate_setting_account(data.default_purchase_account_id, { "expenses", "assets" },    "Default purchase account")
    if pa_err  ~= nil then req.json(400, { error = pa_err  }); return end

    local rec_acc_id,      ra_err  = validate_setting_account(data.default_receivable_account_id, { "assets" },              "Default accounts receivable account")
    if ra_err  ~= nil then req.json(400, { error = ra_err  }); return end

    local payab_acc_id,    pba_err = validate_setting_account(data.default_payable_account_id,  { "liabilities" },          "Default accounts payable account")
    if pba_err ~= nil then req.json(400, { error = pba_err }); return end

    local pay_acc_id,      pya_err = validate_setting_account(data.default_payment_account_id,  { "assets" },               "Default payment account")
    if pya_err ~= nil then req.json(400, { error = pya_err }); return end

    local tax_acc_id,      ta_err  = validate_setting_account(data.default_tax_account_id,      { "liabilities" },          "Default tax account")
    if ta_err  ~= nil then req.json(400, { error = ta_err  }); return end

    -- Persist individual KV entries (for fast point reads)
    space_kv_upsert("CONFIG", "CURRENCY_SYMBOL",             { value = currency_symbol })
    space_kv_upsert("CONFIG", "DEFAULT_TAX_RATE_ID",         { value = tax_rate_id    and tostring(tax_rate_id)    or "" })
    space_kv_upsert("CONFIG", "DEFAULT_SALES_ACCOUNT_ID",    { value = sales_acc_id   and tostring(sales_acc_id)   or "" })
    space_kv_upsert("CONFIG", "DEFAULT_PURCHASE_ACCOUNT_ID", { value = purchase_acc_id and tostring(purchase_acc_id) or "" })
    space_kv_upsert("CONFIG", "DEFAULT_RECEIVABLE_ACCOUNT_ID", { value = rec_acc_id   and tostring(rec_acc_id)     or "" })
    space_kv_upsert("CONFIG", "DEFAULT_PAYABLE_ACCOUNT_ID",  { value = payab_acc_id   and tostring(payab_acc_id)   or "" })
    space_kv_upsert("CONFIG", "DEFAULT_PAYMENT_ACCOUNT_ID",  { value = pay_acc_id     and tostring(pay_acc_id)     or "" })
    space_kv_upsert("CONFIG", "DEFAULT_TAX_ACCOUNT_ID",      { value = tax_acc_id     and tostring(tax_acc_id)     or "" })

    local combined = {
        currency_symbol               = currency_symbol,
        default_tax_rate_id           = tax_rate_id,
        default_sales_account_id      = sales_acc_id,
        default_purchase_account_id   = purchase_acc_id,
        default_receivable_account_id = rec_acc_id,
        default_payable_account_id    = payab_acc_id,
        default_payment_account_id    = pay_acc_id,
        default_tax_account_id        = tax_acc_id
    }
    space_kv_upsert("CONFIG", "SETTINGS", { value = json.encode(combined) })

    req.json(200, combined)
end

-- ============================================================
-- SALES
-- ============================================================

-- Resolve client fields: prefer contact id, fall back to alt name.
local function resolve_client(data)
    local cid = nil
    if data.client_contact_id ~= nil and data.client_contact_id ~= "" then
        cid = tonumber(data.client_contact_id)
    elseif data.client_id ~= nil and data.client_id ~= "" then
        cid = tonumber(data.client_id)
    end
    local alt = data.client_alt_name or data.client_name or ""
    return cid, alt
end

-- Annotate a sale with client_name, resolved from Contacts or alt name.
local function resolve_sale_client_name(sale)
    if sale.client_contact_id ~= nil then
        local c, _ = potato.db.find_by_id("Contacts", sale.client_contact_id)
        sale.client_name = (c ~= nil) and c.name or (sale.client_alt_name or "")
    else
        sale.client_name = sale.client_alt_name or ""
    end
end

-- Insert all lines for a sale.
-- Returns nil on success, or an error string on the first failure.
local function insert_sale_lines(lines, sale_id, userId)
    for _, line in ipairs(lines) do
        local _, err = potato.db.insert("SalesLines", {
            sale_id         = sale_id,
            info            = line.info or "",
            qty             = line.qty or 0,
            product_id      = line.product_id or 0,
            variant_id      = line.variant_id or nil,
            price           = line.price or 0,
            tax_amount      = line.tax_amount or 0,
            discount_amount = line.discount_amount or 0,
            total_amount    = line.total_amount or 0,
            created_by      = userId,
            updated_by      = userId
        })
        if err ~= nil then
            return "Failed to create sale line: " .. tostring(err)
        end
    end
    return nil
end

-- Replace all lines for a sale (delete then re-insert).
-- Returns nil on success, or an error string on the first failure.
local function replace_sale_lines(lines, sale_id, userId)
    local existing, _ = potato.db.find_all_by_cond("SalesLines", { sale_id = sale_id })
    for _, line in ipairs(existing or {}) do
        local del_err = potato.db.delete_by_id("SalesLines", line.id)
        if del_err ~= nil then
            return "Failed to delete existing line: " .. tostring(del_err)
        end
    end
    return insert_sale_lines(lines, sale_id, userId)
end

--- @param ctx HttpContext
function list_sales(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local page_str       = get_query_param(req, "page", "")
    local raw_array      = get_query_param(req, "raw_array", "") == "1"
    local search         = (get_query_param(req, "search", "") or get_query_param(req, "q", "")):match("^%s*(.-)%s*$") or ""
    local sales_status   = get_query_param(req, "salesStatus", "") or get_query_param(req, "sales_status", "")
    if sales_status == "all" then sales_status = "" end
    local payment_status = get_query_param(req, "paymentStatus", "") or get_query_param(req, "payment_status", "")
    if payment_status == "all" then payment_status = "" end
    local sort_by        = get_query_param(req, "sortBy", "date_desc")

    -- If no pagination or filtering requested, return flat array for compatibility
    if page_str == "" and not raw_array and search == "" and sales_status == "" and payment_status == "" then
        local sales, err = potato.db.find_all_by_cond("Sales", {})
        if err ~= nil then
            req.json(400, { error = tostring(err) })
            return
        end
        local contact_map = {}
        local all_contacts, _ = potato.db.find_all_by_cond("Contacts", {})
        for _, c in ipairs(all_contacts or {}) do contact_map[c.id] = c.name end

        for _, sale in ipairs(sales) do
            attach_lines(sale, "SalesLines", "sale_id", sale.id)
            sale.client_name = (sale.client_contact_id ~= nil and contact_map[sale.client_contact_id])
                and contact_map[sale.client_contact_id]
                or (sale.client_alt_name or "")
        end
        req.json_array(200, sales)
        return
    end

    local page      = math.max(1, tonumber(page_str) or 1)
    local page_size = tonumber(get_query_param(req, "pageSize", "15")) or 15
    page_size = math.max(1, math.min(page_size, 200))

    local where_clauses = { "1=1" }
    local args = {}

    if sales_status ~= "" then
        table.insert(where_clauses, "s.sales_status = ?")
        table.insert(args, sales_status)
    end

    if payment_status ~= "" then
        table.insert(where_clauses, "s.payment_status = ?")
        table.insert(args, payment_status)
    end

    if search ~= "" then
        local like = "%" .. search .. "%"
        table.insert(where_clauses, [[
            (
                s.title LIKE ?
                OR CAST(s.id AS TEXT) LIKE ?
                OR s.notes LIKE ?
                OR s.client_alt_name LIKE ?
                OR s.client_contact_id IN (SELECT id FROM Contacts WHERE name LIKE ?)
            )
        ]])
        for _ = 1, 5 do table.insert(args, like) end
    end

    local where_sql = table.concat(where_clauses, " AND ")

    local order_sql = "ORDER BY s.sales_date DESC, s.id DESC"
    if sort_by == "date_asc" then
        order_sql = "ORDER BY s.sales_date ASC, s.id ASC"
    elseif sort_by == "amount_desc" then
        order_sql = "ORDER BY s.total DESC, s.id DESC"
    elseif sort_by == "amount_asc" then
        order_sql = "ORDER BY s.total ASC, s.id ASC"
    end

    -- Count total
    local count_rows = run_q("SELECT COUNT(*) as cnt FROM Sales s WHERE " .. where_sql, args)
    local total_count = (count_rows and #count_rows > 0) and (tonumber(count_rows[1].cnt) or 0) or 0

    if raw_array then
        local all_sales, s_err = run_q("SELECT s.* FROM Sales s WHERE " .. where_sql .. " " .. order_sql, args)
        if s_err ~= nil or all_sales == nil then
            req.json(400, { error = tostring(s_err or "Failed to query sales") })
            return
        end
        local contact_map = {}
        local all_contacts, _ = potato.db.find_all_by_cond("Contacts", {})
        for _, c in ipairs(all_contacts or {}) do contact_map[c.id] = c.name end
        for _, sale in ipairs(all_sales) do
            attach_lines(sale, "SalesLines", "sale_id", sale.id)
            sale.client_name = (sale.client_contact_id ~= nil and contact_map[sale.client_contact_id])
                and contact_map[sale.client_contact_id]
                or (sale.client_alt_name or "")
        end
        req.json_array(200, all_sales)
        return
    end

    -- Paginated
    local offset = (page - 1) * page_size
    local page_args = {}
    for _, a in ipairs(args) do table.insert(page_args, a) end
    table.insert(page_args, page_size)
    table.insert(page_args, offset)

    local sales, s_err = run_q("SELECT s.* FROM Sales s WHERE " .. where_sql .. " " .. order_sql .. " LIMIT ? OFFSET ?", page_args)
    if s_err ~= nil or sales == nil then
        req.json(400, { error = tostring(s_err or "Failed to query sales") })
        return
    end

    local contact_map = {}
    local all_contacts, _ = potato.db.find_all_by_cond("Contacts", {})
    for _, c in ipairs(all_contacts or {}) do contact_map[c.id] = c.name end

    for _, sale in ipairs(sales) do
        attach_lines(sale, "SalesLines", "sale_id", sale.id)
        sale.client_name = (sale.client_contact_id ~= nil and contact_map[sale.client_contact_id])
            and contact_map[sale.client_contact_id]
            or (sale.client_alt_name or "")
    end

    req.json(200, {
        items       = sales or {},
        total       = total_count,
        page        = page,
        page_size   = page_size,
        total_pages = math.max(1, math.ceil(total_count / page_size))
    })
end

--- @param ctx HttpContext
--- @param sale_id number
function get_sale(ctx, sale_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "sale_id", sale_id) then return end

    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, { error = "Sale not found" })
        return
    end

    resolve_sale_client_name(sale)
    attach_lines(sale, "SalesLines", "sale_id", sale_id)
    req.json(200, sale)
end

-- ============================================================
-- SALES ACCOUNTING HELPERS
-- ============================================================

local function resolve_sales_accounts()
    local s = get_app_settings_table()

    local receivable_acc_id = (s.default_receivable_account_id ~= 0) and s.default_receivable_account_id
        or find_account_by_type("assets", { "Receivable", "Debtor" })

    local payment_acc_id = (s.default_payment_account_id ~= 0) and s.default_payment_account_id
        or find_account_by_type("assets", { "Cash", "Bank" })

    local revenue_acc_id = (s.default_sales_account_id ~= 0) and s.default_sales_account_id
        or find_account_by_type("revenue", { "Sales", "Revenue" })

    local tax_acc_id = (s.default_tax_account_id ~= 0) and s.default_tax_account_id
        or find_account_by_type("liabilities", { "Tax" })

    return {
        receivable_acc_id = receivable_acc_id,
        payment_acc_id    = payment_acc_id,
        revenue_acc_id    = revenue_acc_id,
        tax_acc_id        = tax_acc_id
    }
end

local function post_sale_transaction(sale, lines, payment_account_id, userId)
    local accounts = resolve_sales_accounts()

    -- Debit the asset account: Cash/Bank if paid, otherwise Accounts Receivable
    local debit_acc_id = (sale.payment_status == "paid")
        and (payment_account_id or accounts.payment_acc_id)
        or accounts.receivable_acc_id

    if not debit_acc_id then
        return nil, "No valid account found for debit (Receivable or Payment asset account)"
    end

    local txn_title = "Sale #" .. tostring(sale.id)
    if sale.title and sale.title ~= "" then
        txn_title = txn_title .. " - " .. sale.title
    end

    local txn_id, err = potato.db.insert("Transactions", {
        title          = txn_title,
        notes          = "Auto-generated transaction for Sale #" .. tostring(sale.id),
        txn_type       = "sales",
        reference_id   = tostring(sale.id),
        reference_type = "sales",
        attachments    = "",
        created_by     = userId,
        updated_by     = userId,
        txn_date       = to_sqlite_datetime(sale.sales_date),
        is_editable    = 0,
        is_deleted     = 0
    })
    if err ~= nil or txn_id == nil then
        return nil, "Failed to create transaction: " .. tostring(err)
    end

    -- Debit line (Asset account)
    potato.db.insert("TransactionLines", {
        account_id             = debit_acc_id,
        txn_id                 = txn_id,
        debit_amount           = tonumber(sale.total) or 0,
        credit_amount          = 0,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = nil,
        linked_stockin_line_id = nil
    })

    -- Build credit lines (revenue per line item, plus tax if applicable)
    local credit_lines = {}
    local total_credits = 0

    for _, line in ipairs(lines or {}) do
        -- Per-product revenue account, falling back to the global one
        local rev_acc = nil
        if line.product_id and tonumber(line.product_id) and tonumber(line.product_id) > 0 then
            local prod, _ = potato.db.find_by_id("Products", tonumber(line.product_id))
            if prod and prod.sales_account_id and tonumber(prod.sales_account_id) and tonumber(prod.sales_account_id) > 0 then
                rev_acc = tonumber(prod.sales_account_id)
            end
        end
        if not rev_acc then rev_acc = accounts.revenue_acc_id end

        local line_tax    = (tonumber(line.tax_amount) or 0) * (tonumber(line.qty) or 1)
        local line_credit = math.max(0, (tonumber(line.total_amount) or 0) - line_tax)

        table.insert(credit_lines, {
            account_id             = rev_acc,
            txn_id                 = txn_id,
            debit_amount           = 0,
            credit_amount          = line_credit,
            created_by             = userId,
            updated_by             = userId,
            linked_sales_line_id   = line.id,
            linked_stockin_line_id = nil
        })
        total_credits = total_credits + line_credit
    end

    -- Tax credit line
    local total_tax = (tonumber(sale.overall_tax_amount) or 0) + (tonumber(sale.total_item_tax_amount) or 0)
    if total_tax > 0 and accounts.tax_acc_id then
        table.insert(credit_lines, {
            account_id             = accounts.tax_acc_id,
            txn_id                 = txn_id,
            debit_amount           = 0,
            credit_amount          = total_tax,
            created_by             = userId,
            updated_by             = userId,
            linked_sales_line_id   = nil,
            linked_stockin_line_id = nil
        })
        total_credits = total_credits + total_tax
    end

    -- Fallback: if no line items produced credits, credit the full total to revenue
    if #credit_lines == 0 and accounts.revenue_acc_id then
        table.insert(credit_lines, {
            account_id             = accounts.revenue_acc_id,
            txn_id                 = txn_id,
            debit_amount           = 0,
            credit_amount          = tonumber(sale.total) or 0,
            created_by             = userId,
            updated_by             = userId,
            linked_sales_line_id   = nil,
            linked_stockin_line_id = nil
        })
        total_credits = tonumber(sale.total) or 0
    end

    -- Ensure the transaction balances (debit == sum of credits)
    local diff = (tonumber(sale.total) or 0) - total_credits
    if diff ~= 0 and #credit_lines > 0 then
        credit_lines[1].credit_amount = credit_lines[1].credit_amount + diff
    end

    for _, cl in ipairs(credit_lines) do
        potato.db.insert("TransactionLines", cl)
    end

    return txn_id
end

local function post_payment_transaction(sale, payment_account_id, payment_date, userId)
    local accounts   = resolve_sales_accounts()
    local pay_acc_id = payment_account_id or accounts.payment_acc_id
    local rec_acc_id = accounts.receivable_acc_id

    if not pay_acc_id or not rec_acc_id then
        return nil, "Missing payment or receivable account"
    end

    local txn_id, err = potato.db.insert("Transactions", {
        title          = "Payment for Sale #" .. tostring(sale.id),
        notes          = "Payment received for Sale #" .. tostring(sale.id),
        txn_type       = "sales",
        reference_id   = tostring(sale.id),
        reference_type = "sales",
        attachments    = "",
        created_by     = userId,
        updated_by     = userId,
        txn_date       = to_sqlite_datetime(payment_date),
        is_editable    = 0,
        is_deleted     = 0
    })
    if err ~= nil or txn_id == nil then
        return nil, "Failed to create payment transaction: " .. tostring(err)
    end

    -- Debit Cash/Bank
    potato.db.insert("TransactionLines", {
        account_id             = pay_acc_id,
        txn_id                 = txn_id,
        debit_amount           = tonumber(sale.total) or 0,
        credit_amount          = 0,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = nil,
        linked_stockin_line_id = nil
    })

    -- Credit Accounts Receivable
    potato.db.insert("TransactionLines", {
        account_id             = rec_acc_id,
        txn_id                 = txn_id,
        debit_amount           = 0,
        credit_amount          = tonumber(sale.total) or 0,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = nil,
        linked_stockin_line_id = nil
    })

    return txn_id
end

local function revert_sale_transactions(sale_id, userId)
    local txns = run_q(
        "SELECT id FROM Transactions WHERE reference_type = 'sales' AND reference_id = ? AND is_deleted = 0",
        { tostring(sale_id) }
    )
    for _, t in ipairs(txns or {}) do
        potato.db.update_by_id("Transactions", t.id, { is_deleted = 1, updated_by = userId })
    end
end

--- @param ctx HttpContext
function create_sale(ctx)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if data.sales_status == "scrapped" then
        req.json(400, { error = "Cannot set sales_status to 'scrapped' directly. Use the scrap flow from products instead." })
        return
    end
    if data.lines == nil or type(data.lines) ~= "table" or #data.lines == 0 then
        req.json(400, { error = "Sale must have at least one line" })
        return
    end

    local client_cid, client_alt = resolve_client(data)

    local sale_id, err = potato.db.insert("Sales", {
        title                      = data.title or "",
        sales_status               = data.sales_status or "draft",
        client_contact_id          = client_cid,
        client_alt_name            = client_alt,
        notes                      = data.notes or "",
        attachments                = data.attachments or "",
        total_item_price           = data.total_item_price or 0,
        total_item_tax_amount      = data.total_item_tax_amount or 0,
        total_item_discount_amount = data.total_item_discount_amount or 0,
        sub_total                  = data.sub_total or 0,
        overall_discount_amount    = data.overall_discount_amount or 0,
        overall_tax_amount         = data.overall_tax_amount or 0,
        total                      = data.total or 0,
        sales_date                 = to_sqlite_datetime(data.sales_date),
        payment_status             = data.payment_status or "unpaid",
        created_by                 = userId,
        updated_by                 = userId
    })
    if err ~= nil then
        req.json(400, { error = "Failed to create sale: " .. tostring(err) })
        return
    end

    local lines_err = insert_sale_lines(data.lines, sale_id, userId)
    if lines_err ~= nil then
        req.json(400, { error = lines_err })
        return
    end

    local sale, fetch_err = potato.db.find_by_id("Sales", sale_id)
    if fetch_err ~= nil then
        req.json(400, { error = "Failed to fetch sale: " .. tostring(fetch_err) })
        return
    end
    attach_lines(sale, "SalesLines", "sale_id", sale_id)

    -- Auto-post transaction when sale is created directly as confirmed
    if data.sales_status == "confirmed" then
        local pay_acc_id = resolve_payment_account_id(data)
        if pay_acc_id ~= nil and data.payment_status == "paid" then
            local p_acc, _ = potato.db.find_by_id("Accounts", pay_acc_id)
            if not p_acc or p_acc.acc_type ~= "assets" then
                req.json(400, { error = "Payment account must have account type 'assets'" })
                return
            end
        end
        local _, post_err = post_sale_transaction(sale, sale.lines, pay_acc_id, userId)
        if post_err ~= nil then
            print("Warning: failed to post sale transaction on creation: " .. tostring(post_err))
        end
        adjust_lines_inventory(sale.lines, "sale", 1, userId)
    end

    req.json(200, sale)
end

--- @param ctx HttpContext
--- @param sale_id number
function update_sale(ctx, sale_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "sale_id", sale_id) then return end

    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, { error = "Sale not found" })
        return
    end
    if (sale.sales_status or "draft") ~= "draft" then
        req.json(400, { error = "Cannot edit sale unless it is in draft state" })
        return
    end

    local data = req.bind_json()
    if data.sales_status == "scrapped" then
        req.json(400, { error = "Cannot set sales_status to 'scrapped' directly. Use the scrap flow from products instead." })
        return
    end

    if data.lines ~= nil and type(data.lines) == "table" and #data.lines > 0 then
        local lines_err = replace_sale_lines(data.lines, sale_id, userId)
        if lines_err ~= nil then
            req.json(400, { error = lines_err })
            return
        end
    end

    local update_data = { updated_by = userId }
    if data.title ~= nil then update_data.title = data.title end

    if data.client_contact_id ~= nil then
        update_data.client_contact_id = (data.client_contact_id == "" or data.client_contact_id == 0)
            and nil or tonumber(data.client_contact_id)
    elseif data.client_id ~= nil then
        update_data.client_contact_id = tonumber(data.client_id) or nil
    end

    if data.client_alt_name ~= nil then
        update_data.client_alt_name = data.client_alt_name
    elseif data.client_name ~= nil then
        update_data.client_alt_name = data.client_name
    end

    local simple_patch = {
        "notes", "attachments", "total_item_price", "total_item_tax_amount",
        "total_item_discount_amount", "sub_total", "overall_discount_amount",
        "overall_tax_amount", "total", "sales_date", "sales_status", "payment_status"
    }
    for _, f in ipairs(simple_patch) do
        if data[f] ~= nil then update_data[f] = data[f] end
    end

    local update_err = potato.db.update_by_id("Sales", sale_id, update_data)
    if update_err ~= nil then
        req.json(400, { error = "Failed to update sale: " .. tostring(update_err) })
        return
    end

    local updated_sale, fetch_err = potato.db.find_by_id("Sales", sale_id)
    if fetch_err ~= nil then
        req.json(400, { error = "Failed to fetch sale: " .. tostring(fetch_err) })
        return
    end
    attach_lines(updated_sale, "SalesLines", "sale_id", sale_id)

    -- Auto-post transaction when transitioning to confirmed for the first time
    if update_data.sales_status == "confirmed" then
        local existing_txns = run_q(
            "SELECT id FROM Transactions WHERE reference_type = 'sales' AND reference_id = ? AND is_deleted = 0",
            { tostring(sale_id) }
        )
        if not existing_txns or #existing_txns == 0 then
            local pay_acc_id = resolve_payment_account_id(data)
            local _, post_err = post_sale_transaction(updated_sale, updated_sale.lines, pay_acc_id, userId)
            if post_err ~= nil then
                print("Warning: failed to post sale transaction on update: " .. tostring(post_err))
            end
            adjust_lines_inventory(updated_sale.lines, "sale", 1, userId)
        end
    end

    req.json(200, updated_sale)
end

--- @param ctx HttpContext
--- @param sale_id number
function confirm_sale(ctx, sale_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "sale_id", sale_id) then return end

    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, { error = "Sale not found" })
        return
    end

    if sale.sales_status == "scrapped" then
        req.json(400, { error = "Scrapped sales are already finalized" })
        return
    end
    if (sale.sales_status or "draft") ~= "draft" then
        -- Allow re-confirmation only if no transaction has been posted yet
        local existing_txns = run_q(
            "SELECT id FROM Transactions WHERE reference_type = 'sales' AND reference_id = ? AND is_deleted = 0",
            { tostring(sale_id) }
        )
        if existing_txns and #existing_txns > 0 then
            req.json(400, { error = "Only draft sales can be confirmed" })
            return
        end
    end

    local data       = req.bind_json()
    local pay_acc_id = resolve_payment_account_id(data)

    if pay_acc_id ~= nil and sale.payment_status == "paid" then
        local p_acc, _ = potato.db.find_by_id("Accounts", pay_acc_id)
        if not p_acc or p_acc.acc_type ~= "assets" then
            req.json(400, { error = "Payment account must have account type 'assets'" })
            return
        end
    end

    local update_err = potato.db.update_by_id("Sales", sale_id, {
        sales_status = "confirmed",
        updated_by   = userId
    })
    if update_err ~= nil then
        req.json(400, { error = "Failed to confirm sale: " .. tostring(update_err) })
        return
    end

    local lines, _ = potato.db.find_all_by_cond("SalesLines", { sale_id = sale_id })
    sale.sales_status = "confirmed"
    sale.lines = lines or {}

    local _, post_err = post_sale_transaction(sale, lines, pay_acc_id, userId)
    if post_err ~= nil then
        print("Warning: failed to post sale transaction on confirm: " .. tostring(post_err))
        req.json(400, { error = "Failed to post sale transaction: " .. tostring(post_err) })
        return
    end

    adjust_lines_inventory(lines, "sale", 1, userId)

    req.json(200, sale)
end

--- @param ctx HttpContext
--- @param sale_id number
function register_sale_payment(ctx, sale_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "sale_id", sale_id) then return end

    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, { error = "Sale not found" })
        return
    end
    if sale.sales_status == "cancelled" then
        req.json(400, { error = "Cannot register payment for cancelled sale" })
        return
    end
    if sale.sales_status == "scrapped" then
        req.json(400, { error = "Cannot register payment for scrapped sales" })
        return
    end
    if sale.payment_status == "paid" then
        req.json(400, { error = "Sale is already paid" })
        return
    end

    local data         = req.bind_json()
    local pay_acc_id   = resolve_payment_account_id(data)
    local payment_date = (type(data) == "table" and data.payment_date ~= nil and data.payment_date ~= "") and data.payment_date or nil

    if pay_acc_id ~= nil then
        local p_acc, _ = potato.db.find_by_id("Accounts", pay_acc_id)
        if not p_acc then
            req.json(400, { error = "Selected payment account not found" })
            return
        end
        if p_acc.acc_type ~= "assets" then
            req.json(400, { error = "Payment account must have account type 'assets'" })
            return
        end
    end

    local lines, _ = potato.db.find_all_by_cond("SalesLines", { sale_id = sale_id })
    sale.lines = lines or {}

    -- Flow A: Draft sale → register payment (confirm + paid in one go, single transaction)
    if (sale.sales_status or "draft") == "draft" then
        local update_err = potato.db.update_by_id("Sales", sale_id, {
            sales_status   = "confirmed",
            payment_status = "paid",
            updated_by     = userId
        })
        if update_err ~= nil then
            req.json(400, { error = "Failed to update sale: " .. tostring(update_err) })
            return
        end
        sale.sales_status   = "confirmed"
        sale.payment_status = "paid"
        local _, post_err = post_sale_transaction(sale, lines, pay_acc_id, userId)
        if post_err ~= nil then
            print("Warning: failed to post sale transaction on draft payment: " .. tostring(post_err))
        end
        adjust_lines_inventory(lines, "sale", 1, userId)
        req.json(200, sale)
        return
    end

    -- Flow B: Confirmed + Unpaid → register payment (separate payment transaction)
    if sale.sales_status == "confirmed" then
        local update_err = potato.db.update_by_id("Sales", sale_id, {
            payment_status = "paid",
            updated_by     = userId
        })
        if update_err ~= nil then
            req.json(400, { error = "Failed to update payment status: " .. tostring(update_err) })
            return
        end
        sale.payment_status = "paid"
        local _, post_err = post_payment_transaction(sale, pay_acc_id, payment_date, userId)
        if post_err ~= nil then
            print("Warning: failed to post payment transaction: " .. tostring(post_err))
        end
        req.json(200, sale)
        return
    end
end

--- @param ctx HttpContext
--- @param sale_id number
function cancel_sale(ctx, sale_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "sale_id", sale_id) then return end

    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, { error = "Sale not found" })
        return
    end
    if sale.sales_status == "cancelled" then
        req.json(400, { error = "Sale is already cancelled" })
        return
    end

    local prev_status = sale.sales_status or "draft"

    local update_err = potato.db.update_by_id("Sales", sale_id, {
        sales_status = "cancelled",
        updated_by   = userId
    })
    if update_err ~= nil then
        req.json(400, { error = "Failed to cancel sale: " .. tostring(update_err) })
        return
    end

    local lines, _ = potato.db.find_all_by_cond("SalesLines", { sale_id = sale_id })
    sale.lines = lines or {}
    sale.sales_status = "cancelled"

    -- Revert linked transactions and inventory if the sale was previously confirmed or scrapped
    if prev_status == "confirmed" or prev_status == "scrapped" then
        revert_sale_transactions(sale_id, userId)
        adjust_lines_inventory(lines or {}, "sale", -1, userId)
    end

    req.json(200, sale)
end

--- @param ctx HttpContext
--- @param sale_id number
function delete_sale(ctx, sale_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "sale_id", sale_id) then return end

    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, { error = "Sale not found" })
        return
    end

    if sale.sales_status == "confirmed" or sale.sales_status == "scrapped" then
        local lines, _ = potato.db.find_all_by_cond("SalesLines", { sale_id = sale_id })
        adjust_lines_inventory(lines or {}, "sale", -1, userId)
    end

    revert_sale_transactions(sale_id, userId)

    local del_err = potato.db.delete_by_id("Sales", sale_id)
    if del_err ~= nil then
        req.json(400, { error = tostring(del_err) })
        return
    end
    potato.db.delete_by_cond("SalesLines", { sale_id = sale_id })

    req.json(200, { message = "Sale deleted" })
end

-- ============================================================
-- SCRAP / DAMAGED GOODS FLOW
-- ============================================================

local function post_scrap_transaction(sale, line, userId)
    local accounts = resolve_sales_accounts()

    -- 1. Debit account: Scrap/Loss Expense account
    local expense_acc_id = find_account_by_type("expenses", { "Scrap", "Damage", "Shrinkage", "Loss", "Cost of Goods", "Expense" })
    if not expense_acc_id then
        expense_acc_id = find_account_by_type("expenses", {})
    end
    if not expense_acc_id then
        expense_acc_id = accounts.payment_acc_id or accounts.revenue_acc_id
    end

    -- 2. Credit account: Inventory Asset or Purchase/Sales account
    local inventory_acc_id = find_account_by_type("assets", { "Inventory", "Stock" })
    if not inventory_acc_id then
        if line and line.product_id then
            local prod, _ = potato.db.find_by_id("Products", line.product_id)
            if prod and prod.purchase_account_id and tonumber(prod.purchase_account_id) and tonumber(prod.purchase_account_id) > 0 then
                inventory_acc_id = tonumber(prod.purchase_account_id)
            elseif prod and prod.sales_account_id and tonumber(prod.sales_account_id) and tonumber(prod.sales_account_id) > 0 then
                inventory_acc_id = tonumber(prod.sales_account_id)
            end
        end
    end
    if not inventory_acc_id then
        inventory_acc_id = accounts.revenue_acc_id or accounts.payment_acc_id
    end

    if not expense_acc_id or not inventory_acc_id then
        return nil, "Missing accounts for scrap transaction (requires expense and asset/inventory accounts)"
    end

    local total_amount = tonumber(sale.total) or 0
    local txn_title = "Scrap #" .. tostring(sale.id)
    if sale.title and sale.title ~= "" then
        txn_title = txn_title .. " - " .. sale.title
    end

    local txn_id, err = potato.db.insert("Transactions", {
        title          = txn_title,
        notes          = "Auto-generated transaction for Scrap #" .. tostring(sale.id) .. (sale.notes and (": " .. sale.notes) or ""),
        txn_type       = "sales",
        reference_id   = tostring(sale.id),
        reference_type = "sales",
        attachments    = "",
        created_by     = userId,
        updated_by     = userId,
        txn_date       = to_sqlite_datetime(sale.sales_date),
        is_editable    = 0,
        is_deleted     = 0
    })
    if err ~= nil or txn_id == nil then
        return nil, "Failed to create scrap transaction: " .. tostring(err)
    end

    -- Debit line (Loss / Expense)
    potato.db.insert("TransactionLines", {
        account_id             = expense_acc_id,
        txn_id                 = txn_id,
        debit_amount           = total_amount,
        credit_amount          = 0,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = line and line.id or nil,
        linked_stockin_line_id = nil
    })

    -- Credit line (Inventory Asset write-off)
    potato.db.insert("TransactionLines", {
        account_id             = inventory_acc_id,
        txn_id                 = txn_id,
        debit_amount           = 0,
        credit_amount          = total_amount,
        created_by             = userId,
        updated_by             = userId,
        linked_sales_line_id   = line and line.id or nil,
        linked_stockin_line_id = nil
    })

    return txn_id
end

local function perform_scrap_product(req, product_id, data, userId)
    local product, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil or product == nil or is_deleted_val(product.is_deleted) then
        req.json(404, { error = "Product not found" })
        return
    end

    local qty = math.floor(tonumber(data.qty) or 0)
    if qty <= 0 then
        req.json(400, { error = "Scrap quantity must be a positive integer" })
        return
    end

    local variant_id = (data.variant_id ~= nil and data.variant_id ~= "" and tonumber(data.variant_id) > 0)
        and tonumber(data.variant_id) or nil
    local variant = nil
    if variant_id ~= nil then
        variant, err = potato.db.find_by_id("ProductVariants", variant_id)
        if err ~= nil or variant == nil or is_deleted_val(variant.is_deleted) or variant.product_id ~= product_id then
            req.json(404, { error = "Variant not found for this product" })
            return
        end
    end

    local is_tracked = not (product.track_inventory == false or product.track_inventory == 0)
    if is_tracked then
        local current_stock = 0
        if variant ~= nil then
            current_stock = (variant.total_stockin_qty or 0) - (variant.total_sold_qty or 0)
        else
            current_stock = (product.total_stockin_qty or 0) - (product.total_sold_qty or 0)
        end
        if qty > current_stock then
            req.json(400, { error = "Cannot scrap " .. tostring(qty) .. " items: only " .. tostring(current_stock) .. " currently available in stock" })
            return
        end
    end

    local unit_price = 0
    if data.unit_cost ~= nil then
        unit_price = tonumber(data.unit_cost) or 0
    elseif data.price ~= nil then
        unit_price = tonumber(data.price) or 0
    elseif variant ~= nil and variant.sales_price ~= nil and tonumber(variant.sales_price) > 0 then
        unit_price = tonumber(variant.sales_price) or 0
    else
        unit_price = tonumber(product.sales_price) or 0
    end

    local total_amount = qty * unit_price
    local reason = (data.reason and data.reason ~= "") and data.reason or "Damaged goods / lost order"

    local item_label = product.name
    if variant ~= nil then
        item_label = item_label .. " (" .. variant.name .. ")"
    end

    local sale_title = "SCRAP - " .. item_label

    -- 1. Create Sale record with status 'scrapped'
    local sale_id, create_err = potato.db.insert("Sales", {
        title                      = sale_title,
        sales_status               = "scrapped",
        payment_status             = "paid",
        client_contact_id          = nil,
        client_alt_name            = "Internal Write-Off (Scrapped)",
        notes                      = reason,
        attachments                = data.attachments or "",
        total_item_price           = total_amount,
        total_item_tax_amount      = 0,
        total_item_discount_amount = 0,
        sub_total                  = total_amount,
        overall_discount_amount    = 0,
        overall_tax_amount         = 0,
        total                      = total_amount,
        sales_date                 = to_sqlite_datetime(data.scrap_date or os.time()),
        created_by                 = userId,
        updated_by                 = userId
    })
    if create_err ~= nil or sale_id == nil then
        req.json(500, { error = "Failed to create scrap sale record: " .. tostring(create_err) })
        return
    end

    -- 2. Insert the single SalesLine
    local line_id, line_err = potato.db.insert("SalesLines", {
        sale_id         = sale_id,
        product_id      = product_id,
        variant_id      = variant_id,
        info            = "Scrapped: " .. item_label .. " - " .. reason,
        qty             = qty,
        price           = unit_price,
        tax_amount      = 0,
        discount_amount = 0,
        total_amount    = total_amount,
        created_by      = userId,
        updated_by      = userId
    })
    if line_err ~= nil then
        req.json(500, { error = "Failed to create scrap sales line: " .. tostring(line_err) })
        return
    end

    local line = {
        id           = line_id,
        sale_id      = sale_id,
        product_id   = product_id,
        variant_id   = variant_id,
        qty          = qty,
        price        = unit_price,
        total_amount = total_amount
    }

    local sale, _ = potato.db.find_by_id("Sales", sale_id)
    if sale ~= nil then
        sale.lines = { line }
    end

    -- 3. Adjust inventory outflow
    adjust_lines_inventory({ line }, "sale", 1, userId)

    -- 4. Post accounting transaction
    local txn_id, post_err = post_scrap_transaction(sale, line, userId)
    if post_err ~= nil then
        print("Warning: failed to post scrap transaction: " .. tostring(post_err))
    end

    -- 5. Return updated product and created sale
    local updated_prod, _ = potato.db.find_by_id("Products", product_id)
    local variants, _     = potato.db.find_all_by_cond("ProductVariants", { product_id = product_id, is_deleted = 0 })
    calculate_product_stocks({ updated_prod }, variants or {})

    req.json(200, {
        success = true,
        sale    = sale,
        txn_id  = txn_id,
        product = updated_prod
    })
end

--- @param ctx HttpContext
--- @param product_id number
function scrap_product_endpoint(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end
    local data = req.bind_json() or {}
    return perform_scrap_product(req, product_id, data, userId)
end

--- @param ctx HttpContext
--- @param variant_id number
function scrap_variant_endpoint(ctx, variant_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "variant_id", variant_id) then return end

    local variant, err = potato.db.find_by_id("ProductVariants", variant_id)
    if err ~= nil or variant == nil or is_deleted_val(variant.is_deleted) then
        req.json(404, { error = "Variant not found" })
        return
    end

    local data = req.bind_json() or {}
    data.variant_id = variant_id
    return perform_scrap_product(req, variant.product_id, data, userId)
end

-- ============================================================
-- REPORTS HANDLERS
-- ============================================================

local function parse_report_dates(req)
    local start_date = req.default_query("startDate", "")
    local end_date   = req.default_query("endDate", "")
    local as_of_date = req.default_query("asOfDate", "")
    local preset     = req.default_query("datePreset", "")

    if type(start_date) == "string" and #start_date > 10 then start_date = string.sub(start_date, 1, 10) end
    if type(end_date) == "string" and #end_date > 10 then end_date = string.sub(end_date, 1, 10) end
    if type(as_of_date) == "string" and #as_of_date > 10 then as_of_date = string.sub(as_of_date, 1, 10) end

    if start_date == "" then start_date = nil end
    if end_date == "" then end_date = nil end
    if as_of_date == "" then as_of_date = nil end

    return start_date, end_date, as_of_date, preset
end

-- 1. Profit & Loss Statement
local function report_profit_loss(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local start_date, end_date = parse_report_dates(req)

    local date_where = ""
    local date_args = {}
    if start_date then
        date_where = date_where .. " AND substr(t.txn_date, 1, 10) >= ?"
        table.insert(date_args, start_date)
    end
    if end_date then
        date_where = date_where .. " AND substr(t.txn_date, 1, 10) <= ?"
        table.insert(date_args, end_date)
    end

    -- Revenue
    local rev_args = {}
    for _, a in ipairs(date_args) do table.insert(rev_args, a) end
    local rev_sql = [[
        SELECT a.id, a.name, a.acc_type,
               COALESCE(SUM(tl.credit_amount - tl.debit_amount), 0) as balance
        FROM Accounts a
        LEFT JOIN TransactionLines tl ON tl.account_id = a.id
        LEFT JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 ]] .. date_where .. [[
        WHERE a.is_deleted = 0 AND a.acc_type = 'revenue'
        GROUP BY a.id, a.name, a.acc_type
        ORDER BY balance DESC, a.name ASC
    ]]
    local rev_rows = run_q(rev_sql, rev_args) or {}
    local total_revenue = 0
    local revenue_items = {}
    for _, r in ipairs(rev_rows) do
        local bal = tonumber(r.balance) or 0
        total_revenue = total_revenue + bal
        table.insert(revenue_items, {
            id = tonumber(r.id),
            name = r.name or "",
            acc_type = r.acc_type,
            amount = bal
        })
    end

    -- Expenses
    local exp_args = {}
    for _, a in ipairs(date_args) do table.insert(exp_args, a) end
    local exp_sql = [[
        SELECT a.id, a.name, a.acc_type,
               COALESCE(SUM(tl.debit_amount - tl.credit_amount), 0) as balance
        FROM Accounts a
        LEFT JOIN TransactionLines tl ON tl.account_id = a.id
        LEFT JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 ]] .. date_where .. [[
        WHERE a.is_deleted = 0 AND a.acc_type = 'expenses'
        GROUP BY a.id, a.name, a.acc_type
        ORDER BY balance DESC, a.name ASC
    ]]
    local exp_rows = run_q(exp_sql, exp_args) or {}
    local total_expenses = 0
    local expense_items = {}
    for _, r in ipairs(exp_rows) do
        local bal = tonumber(r.balance) or 0
        total_expenses = total_expenses + bal
        table.insert(expense_items, {
            id = tonumber(r.id),
            name = r.name or "",
            acc_type = r.acc_type,
            amount = bal
        })
    end

    local net_profit = total_revenue - total_expenses
    local net_margin_pct = total_revenue > 0 and ((net_profit / total_revenue) * 100) or 0

    req.json(200, {
        start_date = start_date,
        end_date = end_date,
        total_revenue = total_revenue,
        total_expenses = total_expenses,
        net_profit = net_profit,
        net_margin_pct = net_margin_pct,
        revenue = revenue_items,
        expenses = expense_items,
    })
end

-- 2. Balance Sheet
local function report_balance_sheet(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local _, _, as_of_date = parse_report_dates(req)
    if not as_of_date or as_of_date == "" then
        as_of_date = os.date("%Y-%m-%d")
    end

    -- Assets: sum(debit - credit) up to as_of_date
    local asset_sql = [[
        SELECT a.id, a.name, a.acc_type,
               COALESCE(SUM(tl.debit_amount - tl.credit_amount), 0) as balance
        FROM Accounts a
        LEFT JOIN TransactionLines tl ON tl.account_id = a.id
        LEFT JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 AND substr(t.txn_date, 1, 10) <= ?
        WHERE a.is_deleted = 0 AND a.acc_type = 'assets'
        GROUP BY a.id, a.name, a.acc_type
        ORDER BY balance DESC, a.name ASC
    ]]
    local asset_rows = run_q(asset_sql, { as_of_date }) or {}
    local total_assets = 0
    local asset_items = {}
    for _, r in ipairs(asset_rows) do
        local bal = tonumber(r.balance) or 0
        total_assets = total_assets + bal
        table.insert(asset_items, {
            id = tonumber(r.id),
            name = r.name or "",
            acc_type = r.acc_type,
            amount = bal
        })
    end

    -- Liabilities: sum(credit - debit) up to as_of_date
    local liab_sql = [[
        SELECT a.id, a.name, a.acc_type,
               COALESCE(SUM(tl.credit_amount - tl.debit_amount), 0) as balance
        FROM Accounts a
        LEFT JOIN TransactionLines tl ON tl.account_id = a.id
        LEFT JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 AND substr(t.txn_date, 1, 10) <= ?
        WHERE a.is_deleted = 0 AND a.acc_type = 'liabilities'
        GROUP BY a.id, a.name, a.acc_type
        ORDER BY balance DESC, a.name ASC
    ]]
    local liab_rows = run_q(liab_sql, { as_of_date }) or {}
    local total_liabilities = 0
    local liab_items = {}
    for _, r in ipairs(liab_rows) do
        local bal = tonumber(r.balance) or 0
        total_liabilities = total_liabilities + bal
        table.insert(liab_items, {
            id = tonumber(r.id),
            name = r.name or "",
            acc_type = r.acc_type,
            amount = bal
        })
    end

    -- Equity accounts: sum(credit - debit) up to as_of_date
    local eq_sql = [[
        SELECT a.id, a.name, a.acc_type,
               COALESCE(SUM(tl.credit_amount - tl.debit_amount), 0) as balance
        FROM Accounts a
        LEFT JOIN TransactionLines tl ON tl.account_id = a.id
        LEFT JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 AND substr(t.txn_date, 1, 10) <= ?
        WHERE a.is_deleted = 0 AND a.acc_type = 'equity'
        GROUP BY a.id, a.name, a.acc_type
        ORDER BY balance DESC, a.name ASC
    ]]
    local eq_rows = run_q(eq_sql, { as_of_date }) or {}
    local equity_accounts_total = 0
    local eq_items = {}
    for _, r in ipairs(eq_rows) do
        local bal = tonumber(r.balance) or 0
        equity_accounts_total = equity_accounts_total + bal
        table.insert(eq_items, {
            id = tonumber(r.id),
            name = r.name or "",
            acc_type = r.acc_type,
            amount = bal
        })
    end

    -- Retained Earnings: Cumulative revenue minus cumulative expenses up to as_of_date
    local rev_cum_sql = [[
        SELECT COALESCE(SUM(tl.credit_amount - tl.debit_amount), 0) as amt
        FROM TransactionLines tl
        JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 AND substr(t.txn_date, 1, 10) <= ?
        JOIN Accounts a ON a.id = tl.account_id AND a.is_deleted = 0 AND a.acc_type = 'revenue'
    ]]
    local rev_cum_row = run_q(rev_cum_sql, { as_of_date })
    local cum_revenue = (rev_cum_row and #rev_cum_row > 0) and (tonumber(rev_cum_row[1].amt) or 0) or 0

    local exp_cum_sql = [[
        SELECT COALESCE(SUM(tl.debit_amount - tl.credit_amount), 0) as amt
        FROM TransactionLines tl
        JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 AND substr(t.txn_date, 1, 10) <= ?
        JOIN Accounts a ON a.id = tl.account_id AND a.is_deleted = 0 AND a.acc_type = 'expenses'
    ]]
    local exp_cum_row = run_q(exp_cum_sql, { as_of_date })
    local cum_expenses = (exp_cum_row and #exp_cum_row > 0) and (tonumber(exp_cum_row[1].amt) or 0) or 0

    local retained_earnings = cum_revenue - cum_expenses
    local total_equity = equity_accounts_total + retained_earnings
    local total_liabilities_equity = total_liabilities + total_equity
    local diff = total_assets - total_liabilities_equity
    local is_balanced = (math.abs(diff) <= 1)

    req.json(200, {
        as_of_date = as_of_date,
        assets = asset_items,
        total_assets = total_assets,
        liabilities = liab_items,
        total_liabilities = total_liabilities,
        equity = eq_items,
        retained_earnings = retained_earnings,
        total_equity = total_equity,
        total_liabilities_equity = total_liabilities_equity,
        difference = diff,
        is_balanced = is_balanced,
    })
end

-- 3. Cash Flow Statement
local function report_cash_flow(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local start_date, end_date = parse_report_dates(req)

    -- Detect cash / bank accounts
    local cash_acc_rows = run_q([[
        SELECT id, name, acc_type FROM Accounts
        WHERE is_deleted = 0 AND acc_type = 'assets'
          AND (LOWER(name) LIKE '%cash%' OR LOWER(name) LIKE '%bank%' OR LOWER(name) LIKE '%wallet%')
        ORDER BY id ASC
    ]]) or {}

    local cash_ids = {}
    local cash_id_set = {}
    for _, ca in ipairs(cash_acc_rows) do
        local id = tonumber(ca.id)
        if id then
            table.insert(cash_ids, id)
            cash_id_set[id] = true
        end
    end

    if #cash_ids == 0 then
        local first_asset = run_q("SELECT id, name, acc_type FROM Accounts WHERE is_deleted = 0 AND acc_type = 'assets' ORDER BY id ASC LIMIT 1")
        if first_asset and #first_asset > 0 then
            local id = tonumber(first_asset[1].id)
            table.insert(cash_ids, id)
            cash_id_set[id] = true
            table.insert(cash_acc_rows, first_asset[1])
        end
    end

    local in_clause = table.concat(cash_ids, ",")
    if in_clause == "" then in_clause = "0" end

    -- Opening cash balance prior to start_date
    local opening_balance = 0
    if start_date then
        local op_sql = "SELECT COALESCE(SUM(tl.debit_amount - tl.credit_amount), 0) as bal FROM TransactionLines tl JOIN Transactions t ON t.id = tl.txn_id WHERE t.is_deleted = 0 AND tl.account_id IN (" .. in_clause .. ") AND substr(t.txn_date, 1, 10) < ?"
        local op_rows = run_q(op_sql, { start_date })
        if op_rows and #op_rows > 0 then
            opening_balance = tonumber(op_rows[1].bal) or 0
        end
    end

    -- Transactions in range that touch cash accounts
    local range_where = "t.is_deleted = 0 AND tl.account_id IN (" .. in_clause .. ")"
    local range_args = {}
    if start_date then
        range_where = range_where .. " AND substr(t.txn_date, 1, 10) >= ?"
        table.insert(range_args, start_date)
    end
    if end_date then
        range_where = range_where .. " AND substr(t.txn_date, 1, 10) <= ?"
        table.insert(range_args, end_date)
    end

    local cash_lines_sql = [[
        SELECT tl.id as line_id, tl.account_id, tl.txn_id, tl.debit_amount, tl.credit_amount,
               t.txn_date, t.title, t.notes, t.txn_type, t.reference_id, a.name as cash_account_name
        FROM TransactionLines tl
        JOIN Transactions t ON t.id = tl.txn_id
        JOIN Accounts a ON a.id = tl.account_id
        WHERE ]] .. range_where .. [[
        ORDER BY t.txn_date ASC, t.id ASC
    ]]
    local cash_lines = run_q(cash_lines_sql, range_args) or {}

    local operating_inflows = 0
    local operating_outflows = 0
    local investing_inflows = 0
    local investing_outflows = 0
    local financing_inflows = 0
    local financing_outflows = 0

    local movement_items = {}

    for _, line in ipairs(cash_lines) do
        local debit = tonumber(line.debit_amount) or 0
        local credit = tonumber(line.credit_amount) or 0
        local net = debit - credit
        local txn_id = tonumber(line.txn_id)

        local cp_rows = run_q([[
            SELECT tl.account_id, tl.debit_amount, tl.credit_amount, a.name, a.acc_type
            FROM TransactionLines tl
            JOIN Accounts a ON a.id = tl.account_id
            WHERE tl.txn_id = ? AND tl.id != ?
        ]], { txn_id, line.line_id }) or {}

        local category = "operating"
        local cp_name = ""
        for _, cp in ipairs(cp_rows) do
            local atype = cp.acc_type
            if atype == "equity" then
                category = "financing"
                cp_name = cp.name
                break
            elseif atype == "assets" and not cash_id_set[tonumber(cp.account_id)] and (string.find(string.lower(cp.name or ""), "equipment") or string.find(string.lower(cp.name or ""), "asset")) then
                category = "investing"
                cp_name = cp.name
            else
                if cp_name == "" then cp_name = cp.name end
            end
        end

        if net > 0 then
            if category == "financing" then
                financing_inflows = financing_inflows + net
            elseif category == "investing" then
                investing_inflows = investing_inflows + net
            else
                operating_inflows = operating_inflows + net
            end
        elseif net < 0 then
            local amt = -net
            if category == "financing" then
                financing_outflows = financing_outflows + amt
            elseif category == "investing" then
                investing_outflows = investing_outflows + amt
            else
                operating_outflows = operating_outflows + amt
            end
        end

        table.insert(movement_items, {
            line_id = tonumber(line.line_id),
            txn_id = txn_id,
            date = line.txn_date,
            title = line.title,
            reference_id = line.reference_id,
            account_name = line.cash_account_name,
            counterpart_account = cp_name,
            category = category,
            inflow = net > 0 and net or 0,
            outflow = net < 0 and (-net) or 0,
            net = net,
        })
    end

    local net_operating = operating_inflows - operating_outflows
    local net_investing = investing_inflows - investing_outflows
    local net_financing = financing_inflows - financing_outflows
    local total_inflows = operating_inflows + investing_inflows + financing_inflows
    local total_outflows = operating_outflows + investing_outflows + financing_outflows
    local net_cash_change = total_inflows - total_outflows
    local closing_balance = opening_balance + net_cash_change

    local cash_acc_details = {}
    for _, ca in ipairs(cash_acc_rows) do
        local id = tonumber(ca.id)
        local cur_bal_sql = "SELECT COALESCE(SUM(tl.debit_amount - tl.credit_amount), 0) as bal FROM TransactionLines tl JOIN Transactions t ON t.id = tl.txn_id WHERE t.is_deleted = 0 AND tl.account_id = ?"
        local cur_args = { id }
        if end_date then
            cur_bal_sql = cur_bal_sql .. " AND substr(t.txn_date, 1, 10) <= ?"
            table.insert(cur_args, end_date)
        end
        local c_rows = run_q(cur_bal_sql, cur_args)
        local c_bal = (c_rows and #c_rows > 0) and (tonumber(c_rows[1].bal) or 0) or 0
        table.insert(cash_acc_details, {
            id = id,
            name = ca.name,
            balance = c_bal,
        })
    end

    req.json(200, {
        start_date = start_date,
        end_date = end_date,
        opening_balance = opening_balance,
        operating_inflows = operating_inflows,
        operating_outflows = operating_outflows,
        net_operating = net_operating,
        investing_inflows = investing_inflows,
        investing_outflows = investing_outflows,
        net_investing = net_investing,
        financing_inflows = financing_inflows,
        financing_outflows = financing_outflows,
        net_financing = net_financing,
        total_inflows = total_inflows,
        total_outflows = total_outflows,
        net_cash_change = net_cash_change,
        closing_balance = closing_balance,
        cash_accounts = cash_acc_details,
        items = movement_items,
    })
end

-- 4. Trial Balance
local function report_trial_balance(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local start_date, end_date, as_of_date = parse_report_dates(req)

    local date_where = ""
    local date_args = {}
    if as_of_date then
        date_where = " AND substr(t.txn_date, 1, 10) <= ?"
        table.insert(date_args, as_of_date)
    else
        if start_date then
            date_where = date_where .. " AND substr(t.txn_date, 1, 10) >= ?"
            table.insert(date_args, start_date)
        end
        if end_date then
            date_where = date_where .. " AND substr(t.txn_date, 1, 10) <= ?"
            table.insert(date_args, end_date)
        end
    end

    local tb_sql = [[
        SELECT a.id, a.name, a.acc_type,
               COALESCE(SUM(tl.debit_amount), 0) as total_debit,
               COALESCE(SUM(tl.credit_amount), 0) as total_credit
        FROM Accounts a
        LEFT JOIN TransactionLines tl ON tl.account_id = a.id
        LEFT JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0 ]] .. date_where .. [[
        WHERE a.is_deleted = 0
        GROUP BY a.id, a.name, a.acc_type
        ORDER BY a.acc_type ASC, a.id ASC
    ]]
    local rows = run_q(tb_sql, date_args) or {}

    local total_debits = 0
    local total_credits = 0
    local total_net_debits = 0
    local total_net_credits = 0
    local items = {}

    for _, r in ipairs(rows) do
        local deb = tonumber(r.total_debit) or 0
        local cred = tonumber(r.total_credit) or 0
        total_debits = total_debits + deb
        total_credits = total_credits + cred

        local net_debit = deb > cred and (deb - cred) or 0
        local net_credit = cred > deb and (cred - deb) or 0
        total_net_debits = total_net_debits + net_debit
        total_net_credits = total_net_credits + net_credit

        table.insert(items, {
            id = tonumber(r.id),
            name = r.name,
            acc_type = r.acc_type,
            debit = deb,
            credit = cred,
            net_debit = net_debit,
            net_credit = net_credit,
        })
    end

    local is_balanced = (math.abs(total_debits - total_credits) <= 1) and (math.abs(total_net_debits - total_net_credits) <= 1)

    req.json(200, {
        as_of_date = as_of_date,
        start_date = start_date,
        end_date = end_date,
        total_debits = total_debits,
        total_credits = total_credits,
        total_net_debits = total_net_debits,
        total_net_credits = total_net_credits,
        difference = total_debits - total_credits,
        is_balanced = is_balanced,
        items = items,
    })
end

-- 5. General Ledger
local function report_general_ledger(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local start_date, end_date = parse_report_dates(req)
    local account_id_str = req.default_query("accountId", "")
    local search = req.default_query("search", ""):match("^%s*(.-)%s*$") or ""

    local target_account_id = (account_id_str ~= "" and account_id_str ~= "all") and tonumber(account_id_str) or nil

    local acc_sql = "SELECT id, name, acc_type FROM Accounts WHERE is_deleted = 0"
    local acc_args = {}
    if target_account_id then
        acc_sql = acc_sql .. " AND id = ?"
        table.insert(acc_args, target_account_id)
    end
    acc_sql = acc_sql .. " ORDER BY acc_type ASC, name ASC"
    local accounts = run_q(acc_sql, acc_args) or {}

    local result_accounts = {}
    local grand_debits = 0
    local grand_credits = 0

    for _, a in ipairs(accounts) do
        local acc_id = tonumber(a.id)
        local is_debit_normal = (a.acc_type == "assets" or a.acc_type == "expenses")

        local opening_bal = 0
        if start_date then
            local op_sql = "SELECT COALESCE(SUM(tl.debit_amount), 0) as deb, COALESCE(SUM(tl.credit_amount), 0) as cred FROM TransactionLines tl JOIN Transactions t ON t.id = tl.txn_id WHERE t.is_deleted = 0 AND tl.account_id = ? AND substr(t.txn_date, 1, 10) < ?"
            local op_r = run_q(op_sql, { acc_id, start_date })
            if op_r and #op_r > 0 then
                local d = tonumber(op_r[1].deb) or 0
                local c = tonumber(op_r[1].cred) or 0
                opening_bal = is_debit_normal and (d - c) or (c - d)
            end
        end

        local tx_where = "t.is_deleted = 0 AND tl.account_id = ?"
        local tx_args = { acc_id }
        if start_date then
            tx_where = tx_where .. " AND substr(t.txn_date, 1, 10) >= ?"
            table.insert(tx_args, start_date)
        end
        if end_date then
            tx_where = tx_where .. " AND substr(t.txn_date, 1, 10) <= ?"
            table.insert(tx_args, end_date)
        end
        if search ~= "" then
            tx_where = tx_where .. " AND (t.title LIKE ? OR t.notes LIKE ? OR t.reference_id LIKE ?)"
            local s = "%" .. search .. "%"
            table.insert(tx_args, s)
            table.insert(tx_args, s)
            table.insert(tx_args, s)
        end

        local lines_sql = [[
            SELECT t.id as txn_id, t.txn_date, t.title, t.notes, t.txn_type, t.reference_id,
                   tl.id as line_id, tl.debit_amount, tl.credit_amount
            FROM TransactionLines tl
            JOIN Transactions t ON t.id = tl.txn_id
            WHERE ]] .. tx_where .. [[
            ORDER BY t.txn_date ASC, t.id ASC
        ]]
        local lines = run_q(lines_sql, tx_args) or {}

        local running_balance = opening_bal
        local acc_debits = 0
        local acc_credits = 0
        local entries = {}

        for _, l in ipairs(lines) do
            local deb = tonumber(l.debit_amount) or 0
            local cred = tonumber(l.credit_amount) or 0
            acc_debits = acc_debits + deb
            acc_credits = acc_credits + cred

            if is_debit_normal then
                running_balance = running_balance + deb - cred
            else
                running_balance = running_balance + cred - deb
            end

            table.insert(entries, {
                line_id = tonumber(l.line_id),
                txn_id = tonumber(l.txn_id),
                date = l.txn_date,
                title = l.title,
                notes = l.notes,
                txn_type = l.txn_type,
                reference_id = l.reference_id,
                debit = deb,
                credit = cred,
                running_balance = running_balance,
            })
        end

        grand_debits = grand_debits + acc_debits
        grand_credits = grand_credits + acc_credits

        if target_account_id or #entries > 0 or opening_bal ~= 0 then
            table.insert(result_accounts, {
                id = acc_id,
                name = a.name,
                acc_type = a.acc_type,
                is_debit_normal = is_debit_normal,
                opening_balance = opening_bal,
                total_debit = acc_debits,
                total_credit = acc_credits,
                closing_balance = running_balance,
                entries = entries,
            })
        end
    end

    req.json(200, {
        start_date = start_date,
        end_date = end_date,
        total_accounts = #result_accounts,
        total_debits = grand_debits,
        total_credits = grand_credits,
        accounts = result_accounts,
    })
end

-- 6. Accounts Receivable Aging
local function report_accounts_receivable(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local _, _, as_of_date = parse_report_dates(req)
    if not as_of_date or as_of_date == "" then
        as_of_date = os.date("%Y-%m-%d")
    end

    local ar_sql = [[
        SELECT s.id, s.title, s.total, s.sales_status, s.payment_status, s.sales_date,
               s.client_contact_id, s.client_alt_name,
               c.name as contact_name, c.primary_email, c.primary_phone,
               CAST(julianday(?) - julianday(substr(s.sales_date, 1, 10)) AS INTEGER) as days_overdue
        FROM Sales s
        LEFT JOIN Contacts c ON c.id = s.client_contact_id
        WHERE s.sales_status = 'confirmed' AND s.payment_status != 'paid'
          AND substr(s.sales_date, 1, 10) <= ?
        ORDER BY s.sales_date ASC
    ]]
    local rows = run_q(ar_sql, { as_of_date, as_of_date }) or {}

    local total_receivables = 0
    local bucket_current = 0
    local bucket_31_60 = 0
    local bucket_61_90 = 0
    local bucket_over_90 = 0

    local contact_groups = {}
    local invoices = {}

    for _, r in ipairs(rows) do
        local amt = tonumber(r.total) or 0
        local days = tonumber(r.days_overdue) or 0
        if days < 0 then days = 0 end

        total_receivables = total_receivables + amt

        local bucket = "current"
        if days <= 30 then
            bucket_current = bucket_current + amt
            bucket = "current"
        elseif days <= 60 then
            bucket_31_60 = bucket_31_60 + amt
            bucket = "31_60"
        elseif days <= 90 then
            bucket_61_90 = bucket_61_90 + amt
            bucket = "61_90"
        else
            bucket_over_90 = bucket_over_90 + amt
            bucket = "over_90"
        end

        local c_id = tonumber(r.client_contact_id) or 0
        local c_name = r.contact_name or r.client_alt_name or "Unknown Customer"
        if c_name == "" then c_name = "Customer #" .. c_id end

        if not contact_groups[c_name] then
            contact_groups[c_name] = {
                contact_id = c_id,
                contact_name = c_name,
                email = r.primary_email or "",
                phone = r.primary_phone or "",
                total_due = 0,
                current = 0,
                days_31_60 = 0,
                days_61_90 = 0,
                days_over_90 = 0,
                invoices_count = 0,
            }
        end

        local cg = contact_groups[c_name]
        cg.total_due = cg.total_due + amt
        cg.invoices_count = cg.invoices_count + 1
        if bucket == "current" then cg.current = cg.current + amt
        elseif bucket == "31_60" then cg.days_31_60 = cg.days_31_60 + amt
        elseif bucket == "61_90" then cg.days_61_90 = cg.days_61_90 + amt
        else cg.days_over_90 = cg.days_over_90 + amt end

        table.insert(invoices, {
            id = tonumber(r.id),
            title = r.title,
            sales_date = r.sales_date,
            contact_name = c_name,
            amount = amt,
            payment_status = r.payment_status,
            days_overdue = days,
            bucket = bucket,
        })
    end

    local contact_list = {}
    for _, cg in pairs(contact_groups) do
        table.insert(contact_list, cg)
    end
    table.sort(contact_list, function(a, b) return a.total_due > b.total_due end)

    req.json(200, {
        as_of_date = as_of_date,
        total_receivables = total_receivables,
        bucket_current = bucket_current,
        bucket_31_60 = bucket_31_60,
        bucket_61_90 = bucket_61_90,
        bucket_over_90 = bucket_over_90,
        contacts = contact_list,
        invoices = invoices,
    })
end

-- 7. Accounts Payable Aging
local function report_accounts_payable(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local _, _, as_of_date = parse_report_dates(req)
    if not as_of_date or as_of_date == "" then
        as_of_date = os.date("%Y-%m-%d")
    end

    local ap_sql = [[
        SELECT psi.id, psi.info, psi.amount, psi.stockin_status, psi.payment_status, psi.stockin_date,
               psi.reference_id, psi.vendor_contact_id, psi.vendor_alt_name,
               c.name as contact_name, c.primary_email, c.primary_phone,
               CAST(julianday(?) - julianday(substr(psi.stockin_date, 1, 10)) AS INTEGER) as days_overdue
        FROM ProductStockIn psi
        LEFT JOIN Contacts c ON c.id = psi.vendor_contact_id
        WHERE psi.stockin_status = 'confirmed' AND psi.payment_status != 'paid'
          AND substr(psi.stockin_date, 1, 10) <= ?
        ORDER BY psi.stockin_date ASC
    ]]
    local rows = run_q(ap_sql, { as_of_date, as_of_date }) or {}

    local total_payables = 0
    local bucket_current = 0
    local bucket_31_60 = 0
    local bucket_61_90 = 0
    local bucket_over_90 = 0

    local vendor_groups = {}
    local bills = {}

    for _, r in ipairs(rows) do
        local amt = tonumber(r.amount) or 0
        local days = tonumber(r.days_overdue) or 0
        if days < 0 then days = 0 end

        total_payables = total_payables + amt

        local bucket = "current"
        if days <= 30 then
            bucket_current = bucket_current + amt
            bucket = "current"
        elseif days <= 60 then
            bucket_31_60 = bucket_31_60 + amt
            bucket = "31_60"
        elseif days <= 90 then
            bucket_61_90 = bucket_61_90 + amt
            bucket = "61_90"
        else
            bucket_over_90 = bucket_over_90 + amt
            bucket = "over_90"
        end

        local v_id = tonumber(r.vendor_contact_id) or 0
        local v_name = r.contact_name or r.vendor_alt_name or "Unknown Vendor"
        if v_name == "" then v_name = "Vendor #" .. v_id end

        if not vendor_groups[v_name] then
            vendor_groups[v_name] = {
                contact_id = v_id,
                contact_name = v_name,
                email = r.primary_email or "",
                phone = r.primary_phone or "",
                total_payable = 0,
                current = 0,
                days_31_60 = 0,
                days_61_90 = 0,
                days_over_90 = 0,
                bills_count = 0,
            }
        end

        local vg = vendor_groups[v_name]
        vg.total_payable = vg.total_payable + amt
        vg.bills_count = vg.bills_count + 1
        if bucket == "current" then vg.current = vg.current + amt
        elseif bucket == "31_60" then vg.days_31_60 = vg.days_31_60 + amt
        elseif bucket == "61_90" then vg.days_61_90 = vg.days_61_90 + amt
        else vg.days_over_90 = vg.days_over_90 + amt end

        table.insert(bills, {
            id = tonumber(r.id),
            info = r.info,
            reference_id = r.reference_id,
            stockin_date = r.stockin_date,
            vendor_name = v_name,
            amount = amt,
            payment_status = r.payment_status,
            days_overdue = days,
            bucket = bucket,
        })
    end

    local vendor_list = {}
    for _, vg in pairs(vendor_groups) do
        table.insert(vendor_list, vg)
    end
    table.sort(vendor_list, function(a, b) return a.total_payable > b.total_payable end)

    req.json(200, {
        as_of_date = as_of_date,
        total_payables = total_payables,
        bucket_current = bucket_current,
        bucket_31_60 = bucket_31_60,
        bucket_61_90 = bucket_61_90,
        bucket_over_90 = bucket_over_90,
        vendors = vendor_list,
        bills = bills,
    })
end

-- 8. Sales Report
local function report_sales(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local start_date, end_date = parse_report_dates(req)

    local date_where = ""
    local date_args = {}
    if start_date then
        date_where = date_where .. " AND substr(sales_date, 1, 10) >= ?"
        table.insert(date_args, start_date)
    end
    if end_date then
        date_where = date_where .. " AND substr(sales_date, 1, 10) <= ?"
        table.insert(date_args, end_date)
    end

    local metrics_sql = [[
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(total_item_price), 0) as gross_sales,
               COALESCE(SUM(total_item_discount_amount + overall_discount_amount), 0) as total_discounts,
               COALESCE(SUM(total_item_tax_amount + overall_tax_amount), 0) as total_tax,
               COALESCE(SUM(total), 0) as net_sales,
               COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as paid_sales,
               COALESCE(SUM(CASE WHEN payment_status != 'paid' THEN total ELSE 0 END), 0) as unpaid_sales
        FROM Sales
        WHERE sales_status = 'confirmed' ]] .. date_where
    local m_rows = run_q(metrics_sql, date_args) or {}
    local m = m_rows[1] or {}

    local total_orders = tonumber(m.total_orders) or 0
    local gross_sales = tonumber(m.gross_sales) or 0
    local total_discounts = tonumber(m.total_discounts) or 0
    local total_tax = tonumber(m.total_tax) or 0
    local net_sales = tonumber(m.net_sales) or 0
    local paid_sales = tonumber(m.paid_sales) or 0
    local unpaid_sales = tonumber(m.unpaid_sales) or 0
    local avg_order_value = total_orders > 0 and math.floor(net_sales / total_orders) or 0

    local status_sql = "SELECT sales_status, COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM Sales WHERE 1=1 " .. date_where .. " GROUP BY sales_status"
    local status_rows = run_q(status_sql, date_args) or {}
    local status_breakdown = {}
    for _, sr in ipairs(status_rows) do
        table.insert(status_breakdown, {
            status = sr.sales_status,
            count = tonumber(sr.count) or 0,
            amount = tonumber(sr.amount) or 0,
        })
    end

    local prod_where = ""
    local prod_args = {}
    if start_date then
        prod_where = prod_where .. " AND substr(s.sales_date, 1, 10) >= ?"
        table.insert(prod_args, start_date)
    end
    if end_date then
        prod_where = prod_where .. " AND substr(s.sales_date, 1, 10) <= ?"
        table.insert(prod_args, end_date)
    end
    local prod_sql = [[
        SELECT sl.product_id, COALESCE(p.name, sl.info) as product_name,
               SUM(sl.qty) as total_qty, SUM(sl.total_amount) as total_revenue
        FROM SalesLines sl
        JOIN Sales s ON s.id = sl.sale_id
        LEFT JOIN Products p ON p.id = sl.product_id
        WHERE s.sales_status = 'confirmed' ]] .. prod_where .. [[
        GROUP BY sl.product_id, product_name
        ORDER BY total_revenue DESC
        LIMIT 10
    ]]
    local prod_rows = run_q(prod_sql, prod_args) or {}
    local top_products = {}
    for _, pr in ipairs(prod_rows) do
        table.insert(top_products, {
            product_id = tonumber(pr.product_id),
            product_name = pr.product_name or "Custom Item",
            qty = tonumber(pr.total_qty) or 0,
            revenue = tonumber(pr.total_revenue) or 0,
        })
    end

    local cust_sql = [[
        SELECT s.client_contact_id,
               COALESCE(c.name, s.client_alt_name, 'Guest Customer') as customer_name,
               COUNT(s.id) as orders_count,
               SUM(s.total) as total_spent
        FROM Sales s
        LEFT JOIN Contacts c ON c.id = s.client_contact_id
        WHERE s.sales_status = 'confirmed' ]] .. prod_where .. [[
        GROUP BY s.client_contact_id, customer_name
        ORDER BY total_spent DESC
        LIMIT 10
    ]]
    local cust_rows = run_q(cust_sql, prod_args) or {}
    local top_customers = {}
    for _, cr in ipairs(cust_rows) do
        table.insert(top_customers, {
            contact_id = tonumber(cr.client_contact_id),
            name = cr.customer_name,
            orders_count = tonumber(cr.orders_count) or 0,
            total_spent = tonumber(cr.total_spent) or 0,
        })
    end

    local timeline_sql = [[
        SELECT substr(sales_date, 1, 10) as day_date,
               COUNT(*) as order_count,
               COALESCE(SUM(total), 0) as total_revenue
        FROM Sales
        WHERE sales_status = 'confirmed' ]] .. date_where .. [[
        GROUP BY day_date
        ORDER BY day_date ASC
    ]]
    local tl_rows = run_q(timeline_sql, date_args) or {}
    local timeline = {}
    for _, tr in ipairs(tl_rows) do
        table.insert(timeline, {
            date = tr.day_date,
            order_count = tonumber(tr.order_count) or 0,
            revenue = tonumber(tr.total_revenue) or 0,
        })
    end

    req.json(200, {
        start_date = start_date,
        end_date = end_date,
        total_orders = total_orders,
        gross_sales = gross_sales,
        total_discounts = total_discounts,
        total_tax = total_tax,
        net_sales = net_sales,
        paid_sales = paid_sales,
        unpaid_sales = unpaid_sales,
        avg_order_value = avg_order_value,
        status_breakdown = status_breakdown,
        top_products = top_products,
        top_customers = top_customers,
        timeline = timeline,
    })
end

-- 9. Expense Report
local function report_expenses(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local start_date, end_date = parse_report_dates(req)
    local account_id_str = req.default_query("accountId", "")
    local target_account_id = (account_id_str ~= "" and account_id_str ~= "all") and tonumber(account_id_str) or nil

    local date_where = "t.is_deleted = 0 AND a.is_deleted = 0 AND a.acc_type = 'expenses'"
    local date_args = {}
    if target_account_id then
        date_where = date_where .. " AND a.id = ?"
        table.insert(date_args, target_account_id)
    end
    if start_date then
        date_where = date_where .. " AND substr(t.txn_date, 1, 10) >= ?"
        table.insert(date_args, start_date)
    end
    if end_date then
        date_where = date_where .. " AND substr(t.txn_date, 1, 10) <= ?"
        table.insert(date_args, end_date)
    end

    local by_acc_sql = [[
        SELECT a.id, a.name, COALESCE(SUM(tl.debit_amount - tl.credit_amount), 0) as amount,
               COUNT(DISTINCT t.id) as txn_count
        FROM Accounts a
        JOIN TransactionLines tl ON tl.account_id = a.id
        JOIN Transactions t ON t.id = tl.txn_id
        WHERE ]] .. date_where .. [[
        GROUP BY a.id, a.name
        ORDER BY amount DESC
    ]]
    local acc_rows = run_q(by_acc_sql, date_args) or {}
    local total_expenses = 0
    local by_account = {}
    for _, ar in ipairs(acc_rows) do
        local amt = tonumber(ar.amount) or 0
        total_expenses = total_expenses + amt
        table.insert(by_account, {
            id = tonumber(ar.id),
            name = ar.name,
            amount = amt,
            txn_count = tonumber(ar.txn_count) or 0,
        })
    end

    for _, item in ipairs(by_account) do
        item.percentage = total_expenses > 0 and ((item.amount / total_expenses) * 100) or 0
    end

    local txns_sql = [[
        SELECT t.id as txn_id, t.txn_date, t.title, t.notes, t.reference_id,
               a.name as account_name, tl.debit_amount as amount
        FROM TransactionLines tl
        JOIN Transactions t ON t.id = tl.txn_id
        JOIN Accounts a ON a.id = tl.account_id
        WHERE ]] .. date_where .. [[ AND tl.debit_amount > 0
        ORDER BY t.txn_date DESC, t.id DESC
        LIMIT 100
    ]]
    local txn_rows = run_q(txns_sql, date_args) or {}
    local transactions = {}
    for _, tr in ipairs(txn_rows) do
        table.insert(transactions, {
            txn_id = tonumber(tr.txn_id),
            date = tr.txn_date,
            title = tr.title,
            notes = tr.notes,
            reference_id = tr.reference_id,
            account_name = tr.account_name,
            amount = tonumber(tr.amount) or 0,
        })
    end

    local tl_sql = [[
        SELECT substr(t.txn_date, 1, 10) as day_date,
               COALESCE(SUM(tl.debit_amount - tl.credit_amount), 0) as amount
        FROM TransactionLines tl
        JOIN Transactions t ON t.id = tl.txn_id
        JOIN Accounts a ON a.id = tl.account_id
        WHERE ]] .. date_where .. [[
        GROUP BY day_date
        ORDER BY day_date ASC
    ]]
    local tl_rows = run_q(tl_sql, date_args) or {}
    local timeline = {}
    for _, r in ipairs(tl_rows) do
        table.insert(timeline, {
            date = r.day_date,
            amount = tonumber(r.amount) or 0,
        })
    end

    local total_entries = #transactions
    local avg_expense = total_entries > 0 and math.floor(total_expenses / total_entries) or 0

    req.json(200, {
        start_date = start_date,
        end_date = end_date,
        total_expenses = total_expenses,
        total_entries = total_entries,
        avg_expense = avg_expense,
        by_account = by_account,
        transactions = transactions,
        timeline = timeline,
    })
end

-- 10. Tax Report
local function report_tax(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local start_date, end_date = parse_report_dates(req)

    local date_where = ""
    local date_args = {}
    if start_date then
        date_where = date_where .. " AND substr(sales_date, 1, 10) >= ?"
        table.insert(date_args, start_date)
    end
    if end_date then
        date_where = date_where .. " AND substr(sales_date, 1, 10) <= ?"
        table.insert(date_args, end_date)
    end

    local sales_tax_sql = [[
        SELECT COALESCE(SUM(total_item_tax_amount + overall_tax_amount), 0) as tax_collected,
               COALESCE(SUM(total_item_price), 0) as taxable_sales,
               COUNT(*) as sales_count
        FROM Sales
        WHERE sales_status = 'confirmed' ]] .. date_where
    local st_rows = run_q(sales_tax_sql, date_args) or {}
    local st = st_rows[1] or {}

    local tax_collected = tonumber(st.tax_collected) or 0
    local taxable_sales = tonumber(st.taxable_sales) or 0
    local sales_count = tonumber(st.sales_count) or 0

    local taxes = run_q("SELECT id, name, ttype, rate, info FROM Tax WHERE is_deleted = 0 ORDER BY name ASC") or {}
    local tax_rates = {}
    for _, t in ipairs(taxes) do
        table.insert(tax_rates, {
            id = tonumber(t.id),
            name = t.name,
            ttype = t.ttype,
            rate = tonumber(t.rate) or 0,
            info = t.info,
        })
    end

    local tax_acc_sql = [[
        SELECT a.id, a.name, COALESCE(SUM(tl.credit_amount - tl.debit_amount), 0) as balance,
               COALESCE(SUM(tl.credit_amount), 0) as total_credited,
               COALESCE(SUM(tl.debit_amount), 0) as total_debited
        FROM Accounts a
        LEFT JOIN TransactionLines tl ON tl.account_id = a.id
        LEFT JOIN Transactions t ON t.id = tl.txn_id AND t.is_deleted = 0
        WHERE a.is_deleted = 0 AND (LOWER(a.name) LIKE '%tax%' OR a.acc_type = 'liabilities' AND LOWER(a.name) LIKE '%tax%')
        GROUP BY a.id, a.name
    ]]
    local tax_acc_rows = run_q(tax_acc_sql) or {}
    local tax_payable_balance = 0
    local tax_accounts = {}
    for _, ta in ipairs(tax_acc_rows) do
        local bal = tonumber(ta.balance) or 0
        tax_payable_balance = tax_payable_balance + bal
        table.insert(tax_accounts, {
            id = tonumber(ta.id),
            name = ta.name,
            balance = bal,
            total_credited = tonumber(ta.total_credited) or 0,
            total_debited = tonumber(ta.total_debited) or 0,
        })
    end

    local tax_sales_where = "s.sales_status = 'confirmed' AND (s.total_item_tax_amount > 0 OR s.overall_tax_amount > 0)"
    local tax_sales_args = {}
    if start_date then
        tax_sales_where = tax_sales_where .. " AND substr(s.sales_date, 1, 10) >= ?"
        table.insert(tax_sales_args, start_date)
    end
    if end_date then
        tax_sales_where = tax_sales_where .. " AND substr(s.sales_date, 1, 10) <= ?"
        table.insert(tax_sales_args, end_date)
    end

    local items_sql = [[
        SELECT s.id, s.title, s.sales_date, s.client_alt_name, c.name as contact_name,
               s.total_item_price, (s.total_item_tax_amount + s.overall_tax_amount) as tax_amount,
               s.total
        FROM Sales s
        LEFT JOIN Contacts c ON c.id = s.client_contact_id
        WHERE ]] .. tax_sales_where .. [[
        ORDER BY s.sales_date DESC
        LIMIT 50
    ]]
    local item_rows = run_q(items_sql, tax_sales_args) or {}
    local tax_items = {}
    for _, ir in ipairs(item_rows) do
        table.insert(tax_items, {
            id = tonumber(ir.id),
            title = ir.title,
            date = ir.sales_date,
            customer = ir.contact_name or ir.client_alt_name or "Customer",
            taxable_amount = tonumber(ir.total_item_price) or 0,
            tax_amount = tonumber(ir.tax_amount) or 0,
            total = tonumber(ir.total) or 0,
        })
    end

    req.json(200, {
        start_date = start_date,
        end_date = end_date,
        tax_collected = tax_collected,
        taxable_sales = taxable_sales,
        sales_count = sales_count,
        tax_payable_balance = tax_payable_balance,
        tax_rates = tax_rates,
        tax_accounts = tax_accounts,
        items = tax_items,
    })
end

-- ============================================================
-- HTTP ROUTER
-- ============================================================

--- @class HttpContext
--- @field param fun(key: string): string
--- @field type fun(): string -- "http"

local _schema_migrated = false
local function ensure_schema_migrations()
    if _schema_migrated then return end
    _schema_migrated = true
    pcall(function()
        potato.db.run_ddl("ALTER TABLE ProductStockIn ADD COLUMN attachments TEXT NOT NULL DEFAULT '';")
    end)
end

--- @param ctx HttpContext
function on_http(ctx)
    ensure_schema_migrations()
    local req    = ctx.request()
    local path   = ctx.param("subpath")
    local method = ctx.param("method")

    local userId = get_user_id(req)
    if userId == nil then return end

    -- Initialization
    if path == "/init_status"    and method == "GET"  then return get_init_status(ctx) end
    if path == "/init_app"       and method == "POST" then return init_app(ctx) end
    if path == "/run_schema_sql" and method == "POST" then return init_app(ctx) end  -- compat
    if path == "/seed"           and method == "POST" then return init_app(ctx) end  -- compat

    -- Settings
    if path == "/settings" and method == "GET"                        then return get_app_settings(ctx) end
    if path == "/settings" and (method == "POST" or method == "PUT")  then return update_app_settings(ctx) end

    -- Accounts
    if path == "/accounts" and method == "GET"  then return list_accounts(ctx) end
    if path == "/accounts" and method == "POST" then return create_account(ctx) end
    local account_id_match = string.match(path, "^/accounts/(%d+)$")
    if account_id_match then
        local account_id = tonumber(account_id_match)
        if method == "PUT" or method == "PATCH" then return update_account(ctx, account_id) end
        if method == "DELETE"                   then return delete_account(ctx, account_id) end
    end

    -- Transactions
    if path == "/transactions" and method == "GET"  then return transaction_list(ctx) end
    if path == "/transactions" and method == "POST" then return transaction_create(ctx) end
    local txn_id_match = string.match(path, "^/transactions/(%d+)$")
    if txn_id_match then
        local txn_id = tonumber(txn_id_match)
        if method == "PUT" or method == "PATCH" then return transaction_update(ctx, txn_id) end
        if method == "DELETE"                   then return transaction_delete(ctx, txn_id) end
    end

    -- Categories
    if path == "/categories" and method == "GET"  then return list_categories(ctx) end
    if path == "/categories" and method == "POST" then return create_category(ctx) end
    local category_id_match = string.match(path, "^/categories/(%d+)$")
    if category_id_match then
        local category_id = tonumber(category_id_match)
        if method == "PUT" or method == "PATCH" then return update_category(ctx, category_id) end
        if method == "DELETE"                   then return delete_category(ctx, category_id) end
    end

    -- Contacts
    if path == "/contacts" and method == "GET"  then return list_contacts(ctx) end
    if path == "/contacts" and method == "POST" then return create_contact(ctx) end
    local contact_id_match = string.match(path, "^/contacts/(%d+)$")
    if contact_id_match then
        local contact_id = tonumber(contact_id_match)
        if method == "GET"                                              then return get_contact(ctx, contact_id) end
        if method == "PUT" or method == "PATCH" or method == "POST"    then return update_contact(ctx, contact_id) end
        if method == "DELETE"                                           then return delete_contact(ctx, contact_id) end
    end

    -- Products
    if path == "/products" and method == "GET"  then return list_products(ctx) end
    if path == "/products" and method == "POST" then return create_product(ctx) end
    if path == "/products/sync-stock" and method == "POST" then
        sync_all_product_stock_counts()
        req.json(200, { message = "Stock counts synchronized successfully" })
        return
    end
    local product_variants_match = string.match(path, "^/products/(%d+)/variants$")
    if product_variants_match then
        local product_id = tonumber(product_variants_match)
        if method == "GET"  then return list_product_variants(ctx, product_id) end
        if method == "POST" then return create_product_variant(ctx, product_id) end
    end
    local variant_id_adjust = string.match(path, "^/variants/(%d+)/adjust%-stock$")
    if variant_id_adjust and method == "POST" then return adjust_variant_stock_endpoint(ctx, tonumber(variant_id_adjust)) end
    local variant_id_scrap  = string.match(path, "^/variants/(%d+)/scrap$")
    if variant_id_scrap and method == "POST" then return scrap_variant_endpoint(ctx, tonumber(variant_id_scrap)) end
    local variant_id_match = string.match(path, "^/variants/(%d+)$")
    if variant_id_match then
        local variant_id = tonumber(variant_id_match)
        if method == "GET"                      then return get_product_variant(ctx, variant_id) end
        if method == "PUT" or method == "PATCH" then return update_product_variant(ctx, variant_id) end
        if method == "DELETE"                   then return delete_product_variant(ctx, variant_id) end
    end
    local product_id_adjust = string.match(path, "^/products/(%d+)/adjust%-stock$")
    if product_id_adjust and method == "POST" then return adjust_product_stock_endpoint(ctx, tonumber(product_id_adjust)) end
    local product_id_scrap  = string.match(path, "^/products/(%d+)/scrap$")
    if product_id_scrap and method == "POST" then return scrap_product_endpoint(ctx, tonumber(product_id_scrap)) end
    local product_id_match = string.match(path, "^/products/(%d+)$")
    if product_id_match then
        local product_id = tonumber(product_id_match)
        if method == "GET"                      then return get_product(ctx, product_id) end
        if method == "PUT" or method == "PATCH" then return update_product(ctx, product_id) end
        if method == "DELETE"                   then return delete_product(ctx, product_id) end
    end

    -- Stock In
    if path == "/stockin" and method == "GET"  then return list_stockin(ctx) end
    if path == "/stockin" and method == "POST" then return create_stockin(ctx) end
    local stockin_id_confirm = string.match(path, "^/stockin/(%d+)/confirm$")
    if stockin_id_confirm and method == "POST" then return confirm_stockin(ctx, tonumber(stockin_id_confirm)) end
    local stockin_id_payment = string.match(path, "^/stockin/(%d+)/register%-payment$")
    if stockin_id_payment and method == "POST" then return register_stockin_payment(ctx, tonumber(stockin_id_payment)) end
    local stockin_id_cancel  = string.match(path, "^/stockin/(%d+)/cancel$")
    if stockin_id_cancel  and method == "POST" then return cancel_stockin(ctx, tonumber(stockin_id_cancel)) end
    local stockin_id_match = string.match(path, "^/stockin/(%d+)$")
    if stockin_id_match then
        local stockin_id = tonumber(stockin_id_match)
        if method == "GET"                                           then return get_stockin(ctx, stockin_id) end
        if method == "PUT" or method == "PATCH" or method == "POST" then return update_stockin(ctx, stockin_id) end
        if method == "DELETE"                                        then return delete_stockin(ctx, stockin_id) end
    end

    -- Taxes
    if path == "/taxes" and method == "GET"  then return list_taxes(ctx) end
    if path == "/taxes" and method == "POST" then return create_tax(ctx) end
    local tax_id_match = string.match(path, "^/taxes/(%d+)$")
    if tax_id_match then
        local tax_id = tonumber(tax_id_match)
        if method == "PUT" or method == "PATCH" then return update_tax(ctx, tax_id) end
        if method == "DELETE"                   then return delete_tax(ctx, tax_id) end
    end

    -- Sales
    if path == "/sales" and method == "GET"  then return list_sales(ctx) end
    if path == "/sales" and method == "POST" then return create_sale(ctx) end
    local sale_id_confirm = string.match(path, "^/sales/(%d+)/confirm$")
    if sale_id_confirm  and method == "POST" then return confirm_sale(ctx, tonumber(sale_id_confirm)) end
    local sale_id_payment = string.match(path, "^/sales/(%d+)/register%-payment$")
    if sale_id_payment  and method == "POST" then return register_sale_payment(ctx, tonumber(sale_id_payment)) end
    local sale_id_cancel  = string.match(path, "^/sales/(%d+)/cancel$")
    if sale_id_cancel   and method == "POST" then return cancel_sale(ctx, tonumber(sale_id_cancel)) end
    local sale_id_match = string.match(path, "^/sales/(%d+)$")
    if sale_id_match then
        local sale_id = tonumber(sale_id_match)
        if method == "GET"                      then return get_sale(ctx, sale_id) end
        if method == "PUT" or method == "PATCH" then return update_sale(ctx, sale_id) end
        if method == "DELETE"                   then return delete_sale(ctx, sale_id) end
    end

    -- Reports
    if path == "/reports/profit-loss"          and method == "GET" then return report_profit_loss(ctx) end
    if path == "/reports/balance-sheet"        and method == "GET" then return report_balance_sheet(ctx) end
    if path == "/reports/cash-flow"            and method == "GET" then return report_cash_flow(ctx) end
    if path == "/reports/trial-balance"        and method == "GET" then return report_trial_balance(ctx) end
    if path == "/reports/general-ledger"       and method == "GET" then return report_general_ledger(ctx) end
    if path == "/reports/accounts-receivable"  and method == "GET" then return report_accounts_receivable(ctx) end
    if path == "/reports/accounts-payable"     and method == "GET" then return report_accounts_payable(ctx) end
    if path == "/reports/sales"                and method == "GET" then return report_sales(ctx) end
    if path == "/reports/expenses"             and method == "GET" then return report_expenses(ctx) end
    if path == "/reports/tax"                  and method == "GET" then return report_tax(ctx) end

    req.json(404, { error = "Not found" })
end