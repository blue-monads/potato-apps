local potato = require("potato")
local json = require("json")

-- ============================================================
-- UTILITIES
-- ============================================================

local unpack_fn = table.unpack or unpack

-- Run a parameterized SQL query.
local function run_q(sql, params)
    if params ~= nil and #params > 0 then
        return potato.db.run_query(sql, unpack_fn(params))
    end
    return potato.db.run_query(sql)
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
    if not acc or acc.is_deleted == 1 then
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
    return potato.db.update_by_id(table_name, id, {
        is_deleted = 1,
        updated_by = userId
    })
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

        local pid, _ = potato.db.insert("Products", {
            name                = prod.name,
            info                = prod.info or "",
            catagory_id         = cat_id,
            sales_price         = prod.sales_price or 0,
            images              = prod.images or prod.image or "",
            stock_count         = prod.stock_count or 0,
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
                potato.db.insert("ProductVariants", {
                    product_id   = pid,
                    name         = var.name,
                    description  = var.description or "",
                    sales_price  = var.sales_price or 0,
                    stock_count  = var.stock_count or 0,
                    images       = var.images or "",
                    created_by   = userId,
                    updated_by   = userId,
                    is_deleted   = var.is_deleted or 0
                })
            end
        end
    end

    -- 5. Sample Sale
    local s = seed_data.sale
    if s and #created_product_ids >= 1 then
        local sale_id, _ = potato.db.insert("Sales", {
            title                        = s.title or "INV-001 - First Customer Order",
            client_id                    = s.client_id or 101,
            client_name                  = s.client_name or "Global Ventures Inc.",
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

    local accounts, err = potato.db.find_all_by_cond("Accounts", { is_deleted = 0 })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json_array(200, accounts)
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
    if txn.is_deleted == 1 then
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
    if txn.is_deleted == 1 then
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

    local categories, err = potato.db.find_all_by_cond("Catagories", { is_deleted = 0 })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json_array(200, categories)
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

    local contacts, err = potato.db.find_all_by_cond("Contacts", { is_deleted = 0 })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    table.sort(contacts or {}, function(a, b) return (a.id or 0) > (b.id or 0) end)
    req.json_array(200, contacts or {})
end

--- @param ctx HttpContext
--- @param contact_id number
function get_contact(ctx, contact_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "contact_id", contact_id) then return end

    local contact, err = potato.db.find_by_id("Contacts", contact_id)
    if err ~= nil or contact == nil or contact.is_deleted == 1 then
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
    if err ~= nil or existing == nil or existing.is_deleted == 1 then
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

local function get_confirmed_stockin_id_map()
    local map = {}
    local stockins, _ = potato.db.find_all_by_cond("ProductStockIn", {})
    for _, s in ipairs(stockins or {}) do
        if s.stockin_status == "confirmed" then
            map[s.id] = true
        end
    end
    return map
end

local function calculate_product_stocks(products, variants)
    -- Index variants by product
    local variants_by_product = {}
    for _, v in ipairs(variants or {}) do
        local pid = v.product_id
        if variants_by_product[pid] == nil then
            variants_by_product[pid] = {}
        end
        table.insert(variants_by_product[pid], v)
    end

    -- Build a set of active stockin IDs (confirmed only)
    local active_sid_map = get_confirmed_stockin_id_map()

    -- Aggregate stock from active stockin lines
    local stock_by_product = {}
    local stock_by_variant = {}
    local stockin_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {})
    for _, line in ipairs(stockin_lines or {}) do
        if active_sid_map[line.product_stockin_id] then
            local pid = line.product_id
            local vid = line.variant_id or 0
            local q   = line.qty or 0
            if pid ~= nil then
                stock_by_product[pid] = (stock_by_product[pid] or 0) + q
            end
            if vid > 0 then
                stock_by_variant[vid] = (stock_by_variant[vid] or 0) + q
            end
        end
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

        if track_inv then
            -- Stock comes from stockin lines
            if has_vars then
                local total = 0
                for _, v in ipairs(p_vars) do
                    v.stock_count = stock_by_variant[v.id] or 0
                    total = total + v.stock_count
                end
                -- Fall back to product-level stockin if variants have no lines yet
                p.stock_count = (total == 0 and (stock_by_product[p.id] or 0) > 0)
                    and stock_by_product[p.id] or total
            else
                p.stock_count = stock_by_product[p.id] or 0
            end
        else
            -- Stock is stored directly on the record
            if has_vars then
                local total = 0
                for _, v in ipairs(p_vars) do total = total + (v.stock_count or 0) end
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

    local products, err = potato.db.find_all_by_cond("Products", { is_deleted = 0 })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local variants, _ = potato.db.find_all_by_cond("ProductVariants", { is_deleted = 0 })
    calculate_product_stocks(products or {}, variants or {})
    req.json_array(200, products or {})
end

--- @param ctx HttpContext
--- @param product_id number
function get_product(ctx, product_id)
    local req    = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end
    if not require_param(req, "product_id", product_id) then return end

    local product, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil or product == nil or product.is_deleted == 1 then
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

    local id, err = potato.db.insert("Products", {
        name                = product.name or "",
        info                = product.info or "",
        catagory_id         = tonumber(product.catagory_id) or 0,
        images              = product.images or product.image or "",
        sales_price         = tonumber(product.sales_price or product.price) or 0,
        stock_count         = tonumber(product.stock_count) or 0,
        track_inventory     = (product.track_inventory == false or product.track_inventory == 0) and 0 or 1,
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

    if product.stock_count     ~= nil then update_data.stock_count     = tonumber(product.stock_count) or 0 end
    if product.track_inventory ~= nil then update_data.track_inventory = (product.track_inventory == true or product.track_inventory == 1) and 1 or 0 end
    if product.has_variants    ~= nil then update_data.has_variants    = (product.has_variants == true or product.has_variants == 1) and 1 or 0 end

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

-- Compute stock_count for each variant from stockin lines (if tracked).
local function enrich_variant_stocks(variants, product_id, track_inv)
    if track_inv then
        local stockin_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {
            product_id = product_id
        })
        local active_sid_map = get_confirmed_stockin_id_map()
        local stock_by_variant = {}
        for _, l in ipairs(stockin_lines or {}) do
            if active_sid_map[l.product_stockin_id] then
                local vid = l.variant_id or 0
                if vid > 0 then
                    stock_by_variant[vid] = (stock_by_variant[vid] or 0) + (l.qty or 0)
                end
            end
        end
        for _, v in ipairs(variants or {}) do
            v.stock_count = stock_by_variant[v.id] or 0
        end
    else
        for _, v in ipairs(variants or {}) do
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

    local variant = req.bind_json()
    local id, err = potato.db.insert("ProductVariants", {
        product_id  = product_id,
        name        = variant.name or "",
        description = variant.description or "",
        images      = variant.images or variant.image or "",
        sales_price = tonumber(variant.sales_price or variant.price) or 0,
        stock_count = tonumber(variant.stock_count) or 0,
        created_by  = userId,
        updated_by  = userId,
        is_deleted  = 0
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
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
    if track_inv then
        local stockin_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {
            variant_id = variant_id
        })
        local active_sid_map = get_confirmed_stockin_id_map()
        local total = 0
        for _, l in ipairs(stockin_lines or {}) do
            if active_sid_map[l.product_stockin_id] then
                total = total + (l.qty or 0)
            end
        end
        variant.stock_count = total
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
    if variant.stock_count ~= nil then update_data.stock_count = tonumber(variant.stock_count) or 0 end

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
        attachments    = "",
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

    -- Revert linked transactions only if the stock in was previously confirmed
    if prev_status == "confirmed" then
        revert_stockin_transactions(stockin_id, userId)
    end

    stockin.stockin_status = "cancelled"
    local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", { product_stockin_id = stockin_id })
    stockin.lines = lines or {}
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

    -- Revert linked transactions only if the sale was previously confirmed
    if prev_status == "confirmed" then
        revert_sale_transactions(sale_id, userId)
    end

    sale.sales_status = "cancelled"
    local lines, _ = potato.db.find_all_by_cond("SalesLines", { sale_id = sale_id })
    sale.lines = lines or {}

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
-- HTTP ROUTER
-- ============================================================

--- @class HttpContext
--- @field param fun(key: string): string
--- @field type fun(): string -- "http"

--- @param ctx HttpContext
function on_http(ctx)
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
    local product_variants_match = string.match(path, "^/products/(%d+)/variants$")
    if product_variants_match then
        local product_id = tonumber(product_variants_match)
        if method == "GET"  then return list_product_variants(ctx, product_id) end
        if method == "POST" then return create_product_variant(ctx, product_id) end
    end
    local variant_id_match = string.match(path, "^/variants/(%d+)$")
    if variant_id_match then
        local variant_id = tonumber(variant_id_match)
        if method == "GET"                      then return get_product_variant(ctx, variant_id) end
        if method == "PUT" or method == "PATCH" then return update_product_variant(ctx, variant_id) end
        if method == "DELETE"                   then return delete_product_variant(ctx, variant_id) end
    end
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

    req.json(404, { error = "Not found" })
end