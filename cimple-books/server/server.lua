local potato = require("potato")
local json = require("json")

function get_user_id(req)
    local userId, err = req.get_user_id()
    if err then
        req.json(401, {
            error = "Unauthorized"
        })        
        return nil
    end
    return userId
end





local function space_kv_get(group, key)
    if potato.kv ~= nil then
        if type(potato.kv.kv_get) == "function" then
            local ok, res = pcall(potato.kv.kv_get, group, key)
            if ok and res ~= nil then return res end
        elseif type(potato.kv.get) == "function" then
            local ok, res = pcall(potato.kv.get, group, key)
            if ok and res ~= nil then return res end
        end
    end
    return nil
end

local function space_kv_upsert(group, key, data)
    if potato.kv ~= nil then
        if type(potato.kv.kv_upsert) == "function" then
            pcall(potato.kv.kv_upsert, group, key, data)
        elseif type(potato.kv.upsert) == "function" then
            pcall(potato.kv.upsert, group, key, data)
        end
    end
end

function get_init_status(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local inited = false
    local version = nil

    local kv = space_kv_get("SYSTEM", "INIT_VERSION")
    if kv ~= nil and (kv.value == "26-7-alpha" or kv.Value == "26-7-alpha") then
        inited = true
        version = kv.value or kv.Value
    end


    if inited then
        req.json(200, {
            initialized = true,
            version = version,
            message = "Cimple Books has already been initialized (version: 26-7-alpha)."
        })
    else
        req.json(200, {
            initialized = false,
            message = "System not initialized."
        })
    end
end

function run_schema_sql(ctx)
    return init_app(ctx)
end

function seed_database(ctx)
    return init_app(ctx)
end

local function read_seed_file(file_name)
    local rel_paths = {
        "public/seed/" .. file_name,
        "seed/" .. file_name,
        file_name
    }

    -- 1. Try reading via potato.core.read_package_file (packaged runtime)
    if potato and potato.core and potato.core.read_package_file then
        for _, p in ipairs(rel_paths) do
            local c, _ = potato.core.read_package_file(p)
            if c ~= nil and c ~= "" then
                return c
            end
        end
    end

    -- 2. Try direct filesystem read (for dev/local execution)
    local disk_prefixes = {
        "",
        "cimple-books/",
        "potato-apps/cimple-books/",
        "/home/bigbird/zhome/code/blue-monads/potato-apps/cimple-books/",
        "../",
        "../../"
    }
    for _, p in ipairs(rel_paths) do
        for _, prefix in ipairs(disk_prefixes) do
            local f = io.open(prefix .. p, "r")
            if f then
                local content = f:read("*all")
                f:close()
                if content ~= nil and content ~= "" then
                    return content
                end
            end
        end
    end

    return nil
end

local function load_template_data(template)
    if template == nil or template == "" then
        template = "small_business"
    end

    -- 1. Try template-specific JSON file (e.g. small_business.json)
    local raw = read_seed_file(template .. ".json")
    if raw ~= nil and raw ~= "" then
        local ok, data = pcall(json.decode, raw)
        if ok and type(data) == "table" then
            return data
        end
    end

    -- 2. Try consolidated seed.json
    local combined_raw = read_seed_file("seed.json")
    if combined_raw ~= nil and combined_raw ~= "" then
        local ok, combined_data = pcall(json.decode, combined_raw)
        if ok and type(combined_data) == "table" and type(combined_data[template]) == "table" then
            return combined_data[template]
        end
    end

    -- 3. Fallback to small_business if requested template was not found
    if template ~= "small_business" then
        return load_template_data("small_business")
    end

    return nil
end

function seed_template_data(userId, template)
    if template == "blank" then
        return
    end

    local seed_data = load_template_data(template)
    if not seed_data then
        print("Warning: No seed data found for template: " .. tostring(template))
        return
    end

    -- 1. Accounts
    local created_accounts = {}
    if seed_data.accounts then
        for _, acc in ipairs(seed_data.accounts) do
            local acc_record = {
                name = acc.name,
                acc_type = acc.acc_type,
                info = acc.info or "",
                parent_id = acc.parent_id or 0,
                total_debit = acc.total_debit or 0,
                total_credit = acc.total_credit or 0,
                contact_id = acc.contact_id or 0,
                is_deleted = acc.is_deleted or 0
            }
            local id, _ = potato.db.insert("Accounts", acc_record)
            if id ~= nil then
                created_accounts[acc.name] = id
            end
        end
    end

    -- 2. Tax Rates
    if seed_data.taxes then
        for _, t in ipairs(seed_data.taxes) do
            local tax_record = {
                name = t.name,
                ttype = t.ttype or "sales",
                info = t.info or "",
                rate = t.rate or 0,
                ["strict"] = t["strict"] or 0,
                created_by = userId,
                updated_by = userId,
                is_deleted = t.is_deleted or 0
            }
            potato.db.insert("Tax", tax_record)
        end
    end

    -- 3. Categories
    local created_categories = {}
    if seed_data.categories then
        for _, cat in ipairs(seed_data.categories) do
            local cat_record = {
                name = cat.name,
                info = cat.info or "",
                product_class = cat.product_class or "physical_item",
                parent_id = cat.parent_id or 0,
                image = cat.image or "",
                created_by = userId,
                updated_by = userId,
                is_deleted = cat.is_deleted or 0
            }
            local id, _ = potato.db.insert("Catagories", cat_record)
            if id ~= nil then
                table.insert(created_categories, id)
            end
        end
    end

    -- 4. Products & ProductVariants
    local created_product_ids = {}
    if seed_data.products then
        for _, item in ipairs(seed_data.products) do
            local prod_data = item.prod or item
            local cat_idx = prod_data.category_index or 1
            local cat_id = created_categories[cat_idx] or cat_idx

            local has_vars = 0
            if (item.variants ~= nil and #item.variants > 0) or prod_data.has_variants == true or prod_data.has_variants == 1 then
                has_vars = 1
            end

            local track_inv = 1
            if prod_data.track_inventory ~= nil then
                if prod_data.track_inventory == false or prod_data.track_inventory == 0 then
                    track_inv = 0
                end
            end

            local img_str = prod_data.images or prod_data.image or ""
            local prod_record = {
                name = prod_data.name,
                info = prod_data.info or "",
                catagory_id = cat_id,
                sales_price = prod_data.sales_price or 0,
                images = img_str,
                stock_count = prod_data.stock_count or 0,
                track_inventory = track_inv,
                has_variants = has_vars,
                sales_account_id = prod_data.sales_account_id,
                purchase_account_id = prod_data.purchase_account_id,
                tax_id = prod_data.tax_id,
                created_by = userId,
                updated_by = userId,
                is_deleted = prod_data.is_deleted or 0
            }

            local pid, _ = potato.db.insert("Products", prod_record)
            if pid ~= nil then
                table.insert(created_product_ids, pid)
                if item.variants ~= nil then
                    for _, var in ipairs(item.variants) do
                        local var_record = {
                            product_id = pid,
                            name = var.name,
                            description = var.description or "",
                            sales_price = var.sales_price or 0,
                            stock_count = var.stock_count or 0,
                            images = var.images or "",
                            created_by = userId,
                            updated_by = userId,
                            is_deleted = var.is_deleted or 0
                        }
                        potato.db.insert("ProductVariants", var_record)
                    end
                end
            end
        end
    end

    -- 5. Sample Sale
    if seed_data.sale and #created_product_ids >= 1 then
        local s = seed_data.sale
        local sale_record = {
            title = s.title or "INV-001 - First Customer Order",
            client_id = s.client_id or 101,
            client_name = s.client_name or "Global Ventures Inc.",
            notes = s.notes or "Initial demo order created upon system setup",
            attachments = s.attachments or "",
            total_item_price = s.total_item_price or 0,
            total_item_tax_amount = s.total_item_tax_amount or 0,
            total_item_discount_amount = s.total_item_discount_amount or 0,
            sub_total = s.sub_total or 0,
            overall_discount_amount = s.overall_discount_amount or 0,
            overall_tax_amount = s.overall_tax_amount or 0,
            total = s.total or 0,
            created_by = userId,
            updated_by = userId,
            payment_status = s.payment_status or "paid",
            invalidated_reason = s.invalidated_reason or "",
            is_deleted = s.is_deleted or 0
        }

        local sale_id, _ = potato.db.insert("Sales", sale_record)
        if sale_id ~= nil and s.lines then
            for idx, line in ipairs(s.lines) do
                local p_idx = line.product_index or idx
                local p_id = created_product_ids[p_idx] or created_product_ids[1]
                local line_record = {
                    sale_id = sale_id,
                    product_id = p_id,
                    info = line.info or ("Item Line " .. tostring(idx)),
                    qty = line.qty or 1,
                    price = line.price or 0,
                    tax_amount = line.tax_amount or 0,
                    discount_amount = line.discount_amount or 0,
                    total_amount = line.total_amount or 0,
                    created_by = userId,
                    updated_by = userId
                }
                potato.db.insert("SalesLines", line_record)
            end
        end
    end

    -- 6. Sample Initial Capital Transaction
    if seed_data.transaction then
        local tx = seed_data.transaction
        local txn_record = {
            title = tx.title or "Opening Capital Deposit",
            notes = tx.notes or "Opening journal entry for business inception",
            txn_type = tx.txn_type or "manual",
            reference_id = tx.reference_id or "TXN-SETUP-001",
            attachments = tx.attachments or "",
            created_by = userId,
            updated_by = userId,
            is_editable = tx.is_editable or 1,
            is_deleted = tx.is_deleted or 0
        }
        local txn_id, _ = potato.db.insert("Transactions", txn_record)
        if txn_id ~= nil and tx.lines then
            for _, tline in ipairs(tx.lines) do
                local acc_id = created_accounts[tline.account_name] or tline.account_id or 1
                local tl_record = {
                    account_id = acc_id,
                    txn_id = txn_id,
                    debit_amount = tline.debit_amount or 0,
                    credit_amount = tline.credit_amount or 0,
                    created_by = userId,
                    updated_by = userId,
                    linked_sales_id = 0,
                    linked_stockin_id = 0
                }
                potato.db.insert("TransactionLines", tl_record)
            end
        end
    end
end

function init_app(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    -- Check if already initialized in SpaceKV
    local inited = false
    local kv = space_kv_get("SYSTEM", "INIT_VERSION")
    if kv ~= nil and (kv.value == "26-7-alpha" or kv.Value == "26-7-alpha") then
        inited = true
    end

    if inited then
        req.json(200, {
            success = true,
            initialized = true,
            version = "26-7-alpha",
            message = "Cimple Books has already been initialized (version: 26-7-alpha)."
        })
        return
    end

    -- Run DDL schema
    local schema, err = potato.core.read_package_file("schema.sql")
    if err ~= nil or schema == nil then
        req.json(500, {
            error = "Failed to read schema.sql: " .. tostring(err)
        })
        return
    end

    local ddlerr = potato.db.run_ddl(schema)
    if ddlerr ~= nil then
        -- Continue if tables already exist or partial
        print("DDL notice: " .. tostring(ddlerr))
    end

    local body = req.bind_json() or {}
    local template = body.template or "small_business"

    seed_template_data(userId, template)

    -- Record initialization in spacekv
    space_kv_upsert("SYSTEM", "INIT_VERSION", { value = "26-7-alpha" })

    req.json(200, {
        success = true,
        initialized = true,
        version = "26-7-alpha",
        template = template,
        message = "Cimple Books initialized successfully with template: " .. template
    })
end

-- ACCOUNTS

--- @param ctx HttpContext
function list_accounts(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local accounts, err = potato.db.find_all_by_cond("Accounts", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json_array(200, accounts)
end

--- @param ctx HttpContext
function create_account(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local account = req.bind_json()
    local id, err = potato.db.insert("Accounts", account)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local account, err = potato.db.find_by_id("Accounts", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, account)
end

--- @param ctx HttpContext
--- @param account_id number
function update_account(ctx, account_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if account_id == nil then
        req.json(400, {
            error = "account_id is required"
        })
        return
    end

    local account = req.bind_json()
    local err = potato.db.update_by_id("Accounts", account_id, account)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local account, err = potato.db.find_by_id("Accounts", account_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, account)
end

--- @param ctx HttpContext
--- @param account_id number
function delete_account(ctx, account_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if account_id == nil then
        req.json(400, {
            error = "account_id is required"
        })
        return
    end

    -- Soft delete
    local err = potato.db.update_by_id("Accounts", account_id, {
        is_deleted = 1
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, {
        message = "Account deleted"
    })
end

-- TRANSACTIONS

--- @param ctx HttpContext
function transaction_list(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local transactions, err = potato.db.find_all_by_cond("Transactions", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    -- Fetch lines for each transaction
    for i, txn in ipairs(transactions) do
        local lines, lines_err = potato.db.find_all_by_cond("TransactionLines", {
            txn_id = txn.id
        })
        if lines_err == nil and lines ~= nil then
            txn.lines = lines
        else
            txn.lines = {}
        end
    end

    req.json_array(200, transactions)
end

--- @param ctx HttpContext
function transaction_create(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    
    -- Validate that lines are provided
    if data.lines == nil or type(data.lines) ~= "table" or #data.lines == 0 then
        req.json(400, {
            error = "Transaction must have at least one line"
        })
        return
    end

    -- Validate that debits and credits balance
    local total_debit = 0
    local total_credit = 0
    for _, line in ipairs(data.lines) do
        total_debit = total_debit + (line.debit_amount or 0)
        total_credit = total_credit + (line.credit_amount or 0)
    end

    if total_debit ~= total_credit then
        req.json(400, {
            error = "Transaction must balance: debits (" .. total_debit .. ") must equal credits (" .. total_credit .. ")"
        })
        return
    end

    -- Create transaction
    local txn_data = {
        title = data.title or "",
        notes = data.notes or "",
        txn_type = data.txn_type or "normal",
        reference_id = data.reference_id or "",
        attachments = data.attachments or "",
        created_by = userId,
        updated_by = userId,
        txn_date = data.txn_date or os.time(),
        is_editable = data.is_editable or false
    }

    local txn_id, err = potato.db.insert("Transactions", txn_data)
    if err ~= nil then
        req.json(400, {
            error = "Failed to create transaction: " .. tostring(err)
        })
        return
    end

    -- Create transaction lines
    for _, line in ipairs(data.lines) do
        local line_data = {
            account_id = line.account_id,
            txn_id = txn_id,
            debit_amount = line.debit_amount or 0,
            credit_amount = line.credit_amount or 0,
            created_by = userId,
            updated_by = userId,
            linked_sales_id = line.linked_sales_id or 0,
            linked_stockin_id = line.linked_stockin_id or 0
        }
        local _, line_err = potato.db.insert("TransactionLines", line_data)
        if line_err ~= nil then
            req.json(400, {
                error = "Failed to create transaction line: " .. tostring(line_err)
            })
            return
        end
    end

    -- Fetch the complete transaction with lines
    local txn, fetch_err = potato.db.find_by_id("Transactions", txn_id)
    if fetch_err ~= nil then
        req.json(400, {
            error = "Failed to fetch transaction: " .. tostring(fetch_err)
        })
        return
    end

    local lines, lines_err = potato.db.find_all_by_cond("TransactionLines", {
        txn_id = txn_id
    })
    if lines_err == nil and lines ~= nil then
        txn.lines = lines
    else
        txn.lines = {}
    end

    req.json(200, txn)
end

--- @param ctx HttpContext
--- @param txn_id number
function transaction_update(ctx, txn_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if txn_id == nil then
        req.json(400, {
            error = "txn_id is required"
        })
        return
    end

    -- Check if transaction exists and is editable
    local txn, err = potato.db.find_by_id("Transactions", txn_id)
    if err ~= nil or txn == nil then
        req.json(404, {
            error = "Transaction not found"
        })
        return
    end

    if txn.is_deleted == 1 then
        req.json(400, {
            error = "Cannot update deleted transaction"
        })
        return
    end

    if txn.is_editable == 0 then
        req.json(400, {
            error = "Transaction is not editable"
        })
        return
    end

    local data = req.bind_json()

    -- If lines are provided, validate and update them
    if data.lines ~= nil and type(data.lines) == "table" and #data.lines > 0 then
        -- Validate that debits and credits balance
        local total_debit = 0
        local total_credit = 0
        for _, line in ipairs(data.lines) do
            total_debit = total_debit + (line.debit_amount or 0)
            total_credit = total_credit + (line.credit_amount or 0)
        end

        if total_debit ~= total_credit then
            req.json(400, {
                error = "Transaction must balance: debits (" .. total_debit .. ") must equal credits (" .. total_credit .. ")"
            })
            return
        end

        -- Delete existing lines
        local existing_lines, _ = potato.db.find_all_by_cond("TransactionLines", {
            txn_id = txn_id
        })
        if existing_lines ~= nil then
            for _, line in ipairs(existing_lines) do
                local delete_err = potato.db.delete_by_id("TransactionLines", line.id)
                if delete_err ~= nil then
                    req.json(400, {
                        error = "Failed to delete existing line: " .. tostring(delete_err)
                    })
                    return
                end
            end
        end

        -- Create new lines
        for _, line in ipairs(data.lines) do
            local line_data = {
                account_id = line.account_id,
                txn_id = txn_id,
                debit_amount = line.debit_amount or 0,
                credit_amount = line.credit_amount or 0,
                created_by = userId,
                updated_by = userId,
                linked_sales_id = line.linked_sales_id or 0,
                linked_stockin_id = line.linked_stockin_id or 0
            }
            local _, line_err = potato.db.insert("TransactionLines", line_data)
            if line_err ~= nil then
                req.json(400, {
                    error = "Failed to create transaction line: " .. tostring(line_err)
                })
                return
            end
        end
    end

    -- Update transaction
    local update_data = {
        updated_by = userId
    }
    if data.title ~= nil then update_data.title = data.title end
    if data.notes ~= nil then update_data.notes = data.notes end
    if data.txn_type ~= nil then update_data.txn_type = data.txn_type end
    if data.reference_id ~= nil then update_data.reference_id = data.reference_id end
    if data.attachments ~= nil then update_data.attachments = data.attachments end
    if data.txn_date ~= nil then update_data.txn_date = data.txn_date end
    if data.is_editable ~= nil then update_data.is_editable = data.is_editable end

    local update_err = potato.db.update_by_id("Transactions", txn_id, update_data)
    if update_err ~= nil then
        req.json(400, {
            error = "Failed to update transaction: " .. tostring(update_err)
        })
        return
    end

    -- Fetch the complete transaction with lines
    local updated_txn, fetch_err = potato.db.find_by_id("Transactions", txn_id)
    if fetch_err ~= nil then
        req.json(400, {
            error = "Failed to fetch transaction: " .. tostring(fetch_err)
        })
        return
    end

    local lines, lines_err = potato.db.find_all_by_cond("TransactionLines", {
        txn_id = txn_id
    })
    if lines_err == nil and lines ~= nil then
        updated_txn.lines = lines
    else
        updated_txn.lines = {}
    end

    req.json(200, updated_txn)
end

--- @param ctx HttpContext
--- @param txn_id number
function transaction_delete(ctx, txn_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if txn_id == nil then
        req.json(400, {
            error = "txn_id is required"
        })
        return
    end

    -- Check if transaction exists and is editable
    local txn, err = potato.db.find_by_id("Transactions", txn_id)
    if err ~= nil or txn == nil then
        req.json(404, {
            error = "Transaction not found"
        })
        return
    end

    if txn.is_deleted == 1 then
        req.json(400, {
            error = "Transaction already deleted"
        })
        return
    end

    if txn.is_editable == 0 then
        req.json(400, {
            error = "Transaction is not editable and cannot be deleted"
        })
        return
    end

    -- Soft delete
    local delete_err = potato.db.update_by_id("Transactions", txn_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if delete_err ~= nil then
        req.json(400, {
            error = tostring(delete_err)
        })
        return
    end
    req.json(200, {
        message = "Transaction deleted"
    })
end

-- CATEGORIES

--- @param ctx HttpContext
function list_categories(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local categories, err = potato.db.find_all_by_cond("Catagories", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json_array(200, categories)
end

--- @param ctx HttpContext
function create_category(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local category = req.bind_json()
    category.created_by = userId
    category.updated_by = userId
    local id, err = potato.db.insert("Catagories", category)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local category, err = potato.db.find_by_id("Catagories", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, category)
end

--- @param ctx HttpContext
--- @param category_id number
function update_category(ctx, category_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if category_id == nil then
        req.json(400, {
            error = "category_id is required"
        })
        return
    end

    local category = req.bind_json()
    category.updated_by = userId
    local err = potato.db.update_by_id("Catagories", category_id, category)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local category, err = potato.db.find_by_id("Catagories", category_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, category)
end

--- @param ctx HttpContext
--- @param category_id number
function delete_category(ctx, category_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if category_id == nil then
        req.json(400, {
            error = "category_id is required"
        })
        return
    end

    -- Soft delete
    local err = potato.db.update_by_id("Catagories", category_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, {
        message = "Category deleted"
    })
end

-- CONTACTS

--- @param ctx HttpContext
function list_contacts(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local contacts, err = potato.db.find_all_by_cond("Contacts", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    table.sort(contacts or {}, function(a, b)
        return (a.id or 0) > (b.id or 0)
    end)

    req.json_array(200, contacts or {})
end

--- @param ctx HttpContext
--- @param contact_id number
function get_contact(ctx, contact_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if contact_id == nil then
        req.json(400, {
            error = "contact_id is required"
        })
        return
    end

    local contact, err = potato.db.find_by_id("Contacts", contact_id)
    if err ~= nil or contact == nil or contact.is_deleted == 1 then
        req.json(404, {
            error = "Contact not found"
        })
        return
    end

    req.json(200, contact)
end

--- @param ctx HttpContext
function create_contact(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if data.name == nil or data.name == "" then
        req.json(400, {
            error = "name is required"
        })
        return
    end

    local record = {
        name = data.name or "",
        parent_contact_id = data.parent_contact_id and tonumber(data.parent_contact_id) or nil,
        info = data.info or "",
        images = data.images or data.image or "",
        contact_type = data.contact_type or "individual",
        relation_type = data.relation_type or "customer",
        primary_email = data.primary_email or "",
        primary_phone = data.primary_phone or "",
        primary_address = data.primary_address or "",
        notes = data.notes or "",
        extra_data = data.extra_data or "{}",
        created_by = userId,
        updated_by = userId,
        is_deleted = 0
    }

    local id, err = potato.db.insert("Contacts", record)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local created, err = potato.db.find_by_id("Contacts", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    req.json(200, created)
end

--- @param ctx HttpContext
--- @param contact_id number
function update_contact(ctx, contact_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if contact_id == nil then
        req.json(400, {
            error = "contact_id is required"
        })
        return
    end

    local existing, err = potato.db.find_by_id("Contacts", contact_id)
    if err ~= nil or existing == nil or existing.is_deleted == 1 then
        req.json(404, {
            error = "Contact not found"
        })
        return
    end

    local data = req.bind_json()
    local update_data = {
        updated_by = userId
    }

    if data.name ~= nil then update_data.name = data.name end
    if data.parent_contact_id ~= nil then
        update_data.parent_contact_id = tonumber(data.parent_contact_id) or nil
    end
    if data.info ~= nil then update_data.info = data.info end
    if data.images ~= nil then update_data.images = data.images
    elseif data.image ~= nil then update_data.images = data.image end
    if data.contact_type ~= nil then update_data.contact_type = data.contact_type end
    if data.relation_type ~= nil then update_data.relation_type = data.relation_type end
    if data.primary_email ~= nil then update_data.primary_email = data.primary_email end
    if data.primary_phone ~= nil then update_data.primary_phone = data.primary_phone end
    if data.primary_address ~= nil then update_data.primary_address = data.primary_address end
    if data.notes ~= nil then update_data.notes = data.notes end
    if data.extra_data ~= nil then update_data.extra_data = data.extra_data end

    local update_err = potato.db.update_by_id("Contacts", contact_id, update_data)
    if update_err ~= nil then
        req.json(400, {
            error = tostring(update_err)
        })
        return
    end

    local updated, _ = potato.db.find_by_id("Contacts", contact_id)
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param contact_id number
function delete_contact(ctx, contact_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if contact_id == nil then
        req.json(400, {
            error = "contact_id is required"
        })
        return
    end

    local err = potato.db.update_by_id("Contacts", contact_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    req.json(200, {
        message = "Contact deleted"
    })
end

-- PRODUCTS

local function calculate_product_stocks(products, variants)
    local variants_by_product = {}
    if variants ~= nil then
        for _, v in ipairs(variants) do
            local pid = v.product_id
            if variants_by_product[pid] == nil then
                variants_by_product[pid] = {}
            end
            table.insert(variants_by_product[pid], v)
        end
    end

    -- Query stockin lines for inventory tracking (only active, non-deleted stockins)
    local active_stockins, _ = potato.db.find_all_by_cond("ProductStockIn", { is_deleted = 0 })
    local active_sid_map = {}
    if active_stockins ~= nil then
        for _, s in ipairs(active_stockins) do
            active_sid_map[s.id] = true
        end
    end

    local stockin_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {})
    local stock_by_product = {}
    local stock_by_variant = {}
    if stockin_lines ~= nil then
        for _, line in ipairs(stockin_lines) do
            if active_sid_map[line.product_stockin_id] then
                local pid = line.product_id
                local vid = line.variant_id or 0
                local q = line.qty or 0
                if pid ~= nil then
                    stock_by_product[pid] = (stock_by_product[pid] or 0) + q
                end
                if vid ~= nil and vid > 0 then
                    stock_by_variant[vid] = (stock_by_variant[vid] or 0) + q
                end
            end
        end
    end

    for _, p in ipairs(products) do
        local p_vars = variants_by_product[p.id] or {}
        p.variants = p_vars
        if p.sales_price == nil and p.price ~= nil then
            p.sales_price = p.price
        end

        local track_inv = true
        if p.track_inventory == false or p.track_inventory == 0 then
            track_inv = false
        end
        p.track_inventory = track_inv

        local has_vars = false
        if p.has_variants == true or p.has_variants == 1 or #p_vars > 0 then
            has_vars = true
        end
        p.has_variants = has_vars

        if track_inv then
            -- stock count comes from stockin/stockinlines
            if has_vars then
                local total_stock = 0
                for _, v in ipairs(p_vars) do
                    local v_stock = stock_by_variant[v.id] or 0
                    v.stock_count = v_stock
                    total_stock = total_stock + v_stock
                end
                if total_stock == 0 and (stock_by_product[p.id] or 0) > 0 then
                    p.stock_count = stock_by_product[p.id]
                else
                    p.stock_count = total_stock
                end
            else
                p.stock_count = stock_by_product[p.id] or 0
            end
        else
            -- otherwise we use stock_count directly product or if it has variants in that case from variants
            if has_vars then
                local total_stock = 0
                for _, v in ipairs(p_vars) do
                    total_stock = total_stock + (v.stock_count or 0)
                end
                p.stock_count = total_stock
            else
                p.stock_count = p.stock_count or 0
            end
        end
    end
end

--- @param ctx HttpContext
function list_products(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local products, err = potato.db.find_all_by_cond("Products", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {
        is_deleted = 0
    })

    calculate_product_stocks(products or {}, variants or {})

    req.json_array(200, products or {})
end

--- @param ctx HttpContext
--- @param product_id number
function get_product(ctx, product_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if product_id == nil then
        req.json(400, {
            error = "product_id is required"
        })
        return
    end

    local product, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil or product == nil or product.is_deleted == 1 then
        req.json(404, {
            error = "Product not found"
        })
        return
    end

    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {
        product_id = product_id,
        is_deleted = 0
    })

    calculate_product_stocks({product}, variants or {})

    req.json(200, product)
end

--- @param ctx HttpContext
function create_product(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local product = req.bind_json()
    local sales_price = product.sales_price
    if sales_price == nil and product.price ~= nil then
        sales_price = product.price
    end

    local track_inv = 1
    if product.track_inventory == false or product.track_inventory == 0 then
        track_inv = 0
    end

    local has_vars = 0
    if product.has_variants == true or product.has_variants == 1 then
        has_vars = 1
    end

    local img_str = product.images or product.image or ""

    local record = {
        name = product.name or "",
        info = product.info or "",
        catagory_id = tonumber(product.catagory_id) or 0,
        images = img_str,
        sales_price = tonumber(sales_price) or 0,
        stock_count = tonumber(product.stock_count) or 0,
        track_inventory = track_inv,
        has_variants = has_vars,
        sales_account_id = product.sales_account_id,
        purchase_account_id = product.purchase_account_id,
        tax_id = product.tax_id,
        created_by = userId,
        updated_by = userId,
        is_deleted = 0
    }

    local id, err = potato.db.insert("Products", record)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local created_product, err = potato.db.find_by_id("Products", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    calculate_product_stocks({created_product}, {})
    req.json(200, created_product)
end

--- @param ctx HttpContext
--- @param product_id number
function update_product(ctx, product_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if product_id == nil then
        req.json(400, {
            error = "product_id is required"
        })
        return
    end

    local product = req.bind_json()
    local update_data = {
        updated_by = userId
    }

    if product.name ~= nil then update_data.name = product.name end
    if product.info ~= nil then update_data.info = product.info end
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
    if product.stock_count ~= nil then
        update_data.stock_count = tonumber(product.stock_count) or 0
    end
    if product.track_inventory ~= nil then
        update_data.track_inventory = (product.track_inventory == true or product.track_inventory == 1) and 1 or 0
    end
    if product.has_variants ~= nil then
        update_data.has_variants = (product.has_variants == true or product.has_variants == 1) and 1 or 0
    end
    if product.sales_account_id ~= nil then update_data.sales_account_id = product.sales_account_id end
    if product.purchase_account_id ~= nil then update_data.purchase_account_id = product.purchase_account_id end
    if product.tax_id ~= nil then update_data.tax_id = product.tax_id end

    local err = potato.db.update_by_id("Products", product_id, update_data)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local updated_product, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {
        product_id = product_id,
        is_deleted = 0
    })
    calculate_product_stocks({updated_product}, variants or {})
    req.json(200, updated_product)
end

--- @param ctx HttpContext
--- @param product_id number
function delete_product(ctx, product_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if product_id == nil then
        req.json(400, {
            error = "product_id is required"
        })
        return
    end

    -- Soft delete
    local err = potato.db.update_by_id("Products", product_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, {
        message = "Product deleted"
    })
end

-- PRODUCT VARIANTS

--- @param ctx HttpContext
--- @param product_id number
function list_product_variants(ctx, product_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if product_id == nil then
        req.json(400, { error = "product_id is required" })
        return
    end

    local variants, err = potato.db.find_all_by_cond("ProductVariants", {
        product_id = product_id,
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local parent_prod, _ = potato.db.find_by_id("Products", product_id)
    local track_inv = true
    if parent_prod ~= nil and (parent_prod.track_inventory == false or parent_prod.track_inventory == 0) then
        track_inv = false
    end

    if track_inv then
        local stockin_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {
            product_id = product_id
        })
        local stock_by_variant = {}
        if stockin_lines ~= nil then
            for _, l in ipairs(stockin_lines) do
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

    req.json_array(200, variants or {})
end

--- @param ctx HttpContext
--- @param product_id number
function create_product_variant(ctx, product_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if product_id == nil then
        req.json(400, { error = "product_id is required" })
        return
    end

    local variant = req.bind_json()
    local sales_price = variant.sales_price
    if sales_price == nil and variant.price ~= nil then
        sales_price = variant.price
    end

    local record = {
        product_id = product_id,
        name = variant.name or "",
        description = variant.description or "",
        images = variant.images or variant.image or "",
        sales_price = tonumber(sales_price) or 0,
        stock_count = tonumber(variant.stock_count) or 0,
        created_by = userId,
        updated_by = userId,
        is_deleted = 0
    }

    local id, err = potato.db.insert("ProductVariants", record)
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
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if variant_id == nil then
        req.json(400, { error = "variant_id is required" })
        return
    end

    local variant, err = potato.db.find_by_id("ProductVariants", variant_id)
    if err ~= nil or variant == nil then
        req.json(404, { error = "Variant not found" })
        return
    end

    local parent_prod, _ = potato.db.find_by_id("Products", variant.product_id)
    local track_inv = true
    if parent_prod ~= nil and (parent_prod.track_inventory == false or parent_prod.track_inventory == 0) then
        track_inv = false
    end

    if track_inv then
        local stockin_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {
            variant_id = variant_id
        })
        local total_qty = 0
        if stockin_lines ~= nil then
            for _, l in ipairs(stockin_lines) do
                total_qty = total_qty + (l.qty or 0)
            end
        end
        variant.stock_count = total_qty
    else
        variant.stock_count = variant.stock_count or 0
    end

    req.json(200, variant)
end

--- @param ctx HttpContext
--- @param variant_id number
function update_product_variant(ctx, variant_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if variant_id == nil then
        req.json(400, { error = "variant_id is required" })
        return
    end

    local variant = req.bind_json()
    local update_data = {
        updated_by = userId
    }
    if variant.name ~= nil then update_data.name = variant.name end
    if variant.description ~= nil then update_data.description = variant.description end
    if variant.images ~= nil then
        update_data.images = variant.images
    elseif variant.image ~= nil then
        update_data.images = variant.image
    end
    if variant.sales_price ~= nil then
        update_data.sales_price = tonumber(variant.sales_price) or 0
    elseif variant.price ~= nil then
        update_data.sales_price = tonumber(variant.price) or 0
    end
    if variant.stock_count ~= nil then
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
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if variant_id == nil then
        req.json(400, { error = "variant_id is required" })
        return
    end

    local err = potato.db.update_by_id("ProductVariants", variant_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    req.json(200, { message = "Variant deleted" })
end

-- STOCK IN

--- @param ctx HttpContext
function list_stockin(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local stockins, err = potato.db.find_all_by_cond("ProductStockIn", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local all_prods, _ = potato.db.find_all_by_cond("Products", {})
    local prod_map = {}
    if all_prods ~= nil then
        for _, p in ipairs(all_prods) do
            prod_map[p.id] = p.name
        end
    end

    local all_vars, _ = potato.db.find_all_by_cond("ProductVariants", {})
    local var_map = {}
    if all_vars ~= nil then
        for _, v in ipairs(all_vars) do
            var_map[v.id] = v.name
        end
    end

    local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {})
    local lines_by_stockin = {}
    if lines ~= nil then
        for _, l in ipairs(lines) do
            local sid = l.product_stockin_id
            if lines_by_stockin[sid] == nil then
                lines_by_stockin[sid] = {}
            end
            l.product_name = prod_map[l.product_id] or ("Product #" .. tostring(l.product_id))
            if l.variant_id ~= nil and l.variant_id > 0 then
                l.variant_name = var_map[l.variant_id] or ("Variant #" .. tostring(l.variant_id))
            end
            table.insert(lines_by_stockin[sid], l)
        end
    end

    for _, s in ipairs(stockins or {}) do
        s.lines = lines_by_stockin[s.id] or {}
    end

    table.sort(stockins or {}, function(a, b)
        return (a.id or 0) > (b.id or 0)
    end)

    req.json_array(200, stockins or {})
end

--- @param ctx HttpContext
function create_stockin(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    local lines = data.lines or {}
    
    local total_amount = 0
    for _, line in ipairs(lines) do
        local q = tonumber(line.qty) or 0
        local p = tonumber(line.price) or 0
        local amt = tonumber(line.amount)
        if amt == nil or amt == 0 then
            amt = q * p
        end
        total_amount = total_amount + amt
    end

    if (total_amount == 0) and data.amount ~= nil then
        total_amount = tonumber(data.amount) or 0
    end

    local stockin_data = {
        info = data.info or "",
        amount = total_amount,
        vendor_id = tonumber(data.vendor_id) or 0,
        vendor_name = data.vendor_name or "",
        stockin_date = data.stockin_date or os.date("!%Y-%m-%dT%H:%M:%SZ"),
        created_by = userId,
        updated_by = userId,
        is_deleted = 0
    }

    local id, err = potato.db.insert("ProductStockIn", stockin_data)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    for _, line in ipairs(lines) do
        local q = tonumber(line.qty) or 0
        local p = tonumber(line.price) or 0
        local amt = tonumber(line.amount)
        if amt == nil or amt == 0 then
            amt = q * p
        end

        local line_data = {
            product_stockin_id = id,
            product_id = tonumber(line.product_id) or 0,
            variant_id = tonumber(line.variant_id) or 0,
            qty = q,
            price = p,
            amount = amt,
            info = line.info or "",
            created_by = userId,
            updated_by = userId
        }
        potato.db.insert("ProductStockInLines", line_data)
    end

    local stockin, _ = potato.db.find_by_id("ProductStockIn", id)
    local inserted_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {
        product_stockin_id = id
    })
    if stockin ~= nil then
        stockin.lines = inserted_lines or {}
    end
    req.json(200, stockin)
end

--- @param ctx HttpContext
--- @param stockin_id number
function get_stockin(ctx, stockin_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if stockin_id == nil then
        req.json(400, { error = "stockin_id is required" })
        return
    end

    local stockin, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or stockin == nil or stockin.is_deleted == 1 then
        req.json(404, { error = "StockIn not found" })
        return
    end

    local all_prods, _ = potato.db.find_all_by_cond("Products", {})
    local prod_map = {}
    if all_prods ~= nil then
        for _, p in ipairs(all_prods) do
            prod_map[p.id] = p.name
        end
    end

    local all_vars, _ = potato.db.find_all_by_cond("ProductVariants", {})
    local var_map = {}
    if all_vars ~= nil then
        for _, v in ipairs(all_vars) do
            var_map[v.id] = v.name
        end
    end

    local lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {
        product_stockin_id = stockin_id
    })
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
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if stockin_id == nil then
        req.json(400, { error = "stockin_id is required" })
        return
    end

    local existing, err = potato.db.find_by_id("ProductStockIn", stockin_id)
    if err ~= nil or existing == nil or existing.is_deleted == 1 then
        req.json(404, { error = "StockIn not found" })
        return
    end

    local data = req.bind_json()
    local update_data = {
        updated_by = userId
    }

    if data.info ~= nil then update_data.info = data.info end
    if data.vendor_id ~= nil then update_data.vendor_id = tonumber(data.vendor_id) or 0 end
    if data.vendor_name ~= nil then update_data.vendor_name = data.vendor_name end
    if data.stockin_date ~= nil then update_data.stockin_date = data.stockin_date end

    local lines = data.lines
    if lines ~= nil and type(lines) == "table" then
        local total_amount = 0
        potato.db.delete_by_cond("ProductStockInLines", {
            product_stockin_id = stockin_id
        })
        for _, line in ipairs(lines) do
            local q = tonumber(line.qty) or 0
            local p = tonumber(line.price) or 0
            local amt = tonumber(line.amount)
            if amt == nil or amt == 0 then
                amt = q * p
            end
            total_amount = total_amount + amt

            local line_data = {
                product_stockin_id = stockin_id,
                product_id = tonumber(line.product_id) or 0,
                variant_id = tonumber(line.variant_id) or 0,
                qty = q,
                price = p,
                amount = amt,
                info = line.info or "",
                created_by = userId,
                updated_by = userId
            }
            potato.db.insert("ProductStockInLines", line_data)
        end
        update_data.amount = total_amount
    elseif data.amount ~= nil then
        update_data.amount = tonumber(data.amount) or 0
    end

    local update_err = potato.db.update_by_id("ProductStockIn", stockin_id, update_data)
    if update_err ~= nil then
        req.json(400, { error = tostring(update_err) })
        return
    end

    local updated, _ = potato.db.find_by_id("ProductStockIn", stockin_id)
    local updated_lines, _ = potato.db.find_all_by_cond("ProductStockInLines", {
        product_stockin_id = stockin_id
    })
    if updated ~= nil then
        updated.lines = updated_lines or {}
    end
    req.json(200, updated)
end

--- @param ctx HttpContext
--- @param stockin_id number
function delete_stockin(ctx, stockin_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if stockin_id == nil then
        req.json(400, { error = "stockin_id is required" })
        return
    end

    local err = potato.db.update_by_id("ProductStockIn", stockin_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    potato.db.delete_by_cond("ProductStockInLines", {
        product_stockin_id = stockin_id
    })

    req.json(200, { message = "StockIn deleted" })
end

-- TAXES

--- @param ctx HttpContext
function list_taxes(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local taxes, err = potato.db.find_all_by_cond("Tax", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json_array(200, taxes)
end

--- @param ctx HttpContext
function create_tax(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local tax = req.bind_json()
    tax.created_by = userId
    tax.updated_by = userId
    local id, err = potato.db.insert("Tax", tax)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local tax, err = potato.db.find_by_id("Tax", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, tax)
end

--- @param ctx HttpContext
--- @param tax_id number
function update_tax(ctx, tax_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if tax_id == nil then
        req.json(400, {
            error = "tax_id is required"
        })
        return
    end

    local tax = req.bind_json()
    tax.updated_by = userId
    local err = potato.db.update_by_id("Tax", tax_id, tax)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local tax, err = potato.db.find_by_id("Tax", tax_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, tax)
end

--- @param ctx HttpContext
--- @param tax_id number
function delete_tax(ctx, tax_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if tax_id == nil then
        req.json(400, {
            error = "tax_id is required"
        })
        return
    end

    -- Soft delete
    local err = potato.db.update_by_id("Tax", tax_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, {
        message = "Tax deleted"
    })
end

-- SALES

--- @param ctx HttpContext
function list_sales(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local sales, err = potato.db.find_all_by_cond("Sales", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    -- Fetch lines for each sale
    for i, sale in ipairs(sales) do
        local lines, lines_err = potato.db.find_all_by_cond("SalesLines", {
            sale_id = sale.id
        })
        if lines_err == nil and lines ~= nil then
            sale.lines = lines
        else
            sale.lines = {}
        end
    end

    req.json_array(200, sales)
end

--- @param ctx HttpContext
--- @param sale_id number
function get_sale(ctx, sale_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if sale_id == nil then
        req.json(400, {
            error = "sale_id is required"
        })
        return
    end

    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, {
            error = "Sale not found"
        })
        return
    end

    if sale.is_deleted == 1 then
        req.json(404, {
            error = "Sale not found"
        })
        return
    end

    -- Fetch lines
    local lines, lines_err = potato.db.find_all_by_cond("SalesLines", {
        sale_id = sale_id
    })
    if lines_err == nil and lines ~= nil then
        sale.lines = lines
    else
        sale.lines = {}
    end

    req.json(200, sale)
end

--- @param ctx HttpContext
function create_sale(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    
    -- Validate that lines are provided
    if data.lines == nil or type(data.lines) ~= "table" or #data.lines == 0 then
        req.json(400, {
            error = "Sale must have at least one line"
        })
        return
    end

    -- Create sale
    local sale_data = {
        title = data.title or "",
        client_id = data.client_id or 0,
        client_name = data.client_name or "",
        notes = data.notes or "",
        attachments = data.attachments or "",
        total_item_price = data.total_item_price or 0,
        total_item_tax_amount = data.total_item_tax_amount or 0,
        total_item_discount_amount = data.total_item_discount_amount or 0,
        sub_total = data.sub_total or 0,
        overall_discount_amount = data.overall_discount_amount or 0,
        overall_tax_amount = data.overall_tax_amount or 0,
        total = data.total or 0,
        sales_date = data.sales_date or os.time(),
        payment_status = data.payment_status or "unpaid",
        created_by = userId,
        updated_by = userId
    }

    local sale_id, err = potato.db.insert("Sales", sale_data)
    if err ~= nil then
        req.json(400, {
            error = "Failed to create sale: " .. tostring(err)
        })
        return
    end

    -- Create sale lines
    for _, line in ipairs(data.lines) do
        local line_data = {
            sale_id = sale_id,
            info = line.info or "",
            qty = line.qty or 0,
            product_id = line.product_id or 0,
            variant_id = line.variant_id or nil,
            price = line.price or 0,
            tax_amount = line.tax_amount or 0,
            discount_amount = line.discount_amount or 0,
            total_amount = line.total_amount or 0,
            created_by = userId,
            updated_by = userId
        }
        local _, line_err = potato.db.insert("SalesLines", line_data)
        if line_err ~= nil then
            req.json(400, {
                error = "Failed to create sale line: " .. tostring(line_err)
            })
            return
        end
    end

    -- Fetch the complete sale with lines
    local sale, fetch_err = potato.db.find_by_id("Sales", sale_id)
    if fetch_err ~= nil then
        req.json(400, {
            error = "Failed to fetch sale: " .. tostring(fetch_err)
        })
        return
    end

    local lines, lines_err = potato.db.find_all_by_cond("SalesLines", {
        sale_id = sale_id
    })
    if lines_err == nil and lines ~= nil then
        sale.lines = lines
    else
        sale.lines = {}
    end

    req.json(200, sale)
end

--- @param ctx HttpContext
--- @param sale_id number
function update_sale(ctx, sale_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if sale_id == nil then
        req.json(400, {
            error = "sale_id is required"
        })
        return
    end

    -- Check if sale exists
    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, {
            error = "Sale not found"
        })
        return
    end

    if sale.is_deleted == 1 then
        req.json(400, {
            error = "Cannot update deleted sale"
        })
        return
    end

    local data = req.bind_json()

    -- If lines are provided, update them
    if data.lines ~= nil and type(data.lines) == "table" and #data.lines > 0 then
        -- Delete existing lines
        local existing_lines, _ = potato.db.find_all_by_cond("SalesLines", {
            sale_id = sale_id
        })
        if existing_lines ~= nil then
            for _, line in ipairs(existing_lines) do
                local delete_err = potato.db.delete_by_id("SalesLines", line.id)
                if delete_err ~= nil then
                    req.json(400, {
                        error = "Failed to delete existing line: " .. tostring(delete_err)
                    })
                    return
                end
            end
        end

        -- Create new lines
        for _, line in ipairs(data.lines) do
            local line_data = {
                sale_id = sale_id,
                info = line.info or "",
                qty = line.qty or 0,
                product_id = line.product_id or 0,
                variant_id = line.variant_id or nil,
                price = line.price or 0,
                tax_amount = line.tax_amount or 0,
                discount_amount = line.discount_amount or 0,
                total_amount = line.total_amount or 0,
                created_by = userId,
                updated_by = userId
            }
            local _, line_err = potato.db.insert("SalesLines", line_data)
            if line_err ~= nil then
                req.json(400, {
                    error = "Failed to create sale line: " .. tostring(line_err)
                })
                return
            end
        end
    end

    -- Update sale
    local update_data = {
        updated_by = userId
    }
    if data.title ~= nil then update_data.title = data.title end
    if data.client_id ~= nil then update_data.client_id = data.client_id end
    if data.client_name ~= nil then update_data.client_name = data.client_name end
    if data.notes ~= nil then update_data.notes = data.notes end
    if data.attachments ~= nil then update_data.attachments = data.attachments end
    if data.total_item_price ~= nil then update_data.total_item_price = data.total_item_price end
    if data.total_item_tax_amount ~= nil then update_data.total_item_tax_amount = data.total_item_tax_amount end
    if data.total_item_discount_amount ~= nil then update_data.total_item_discount_amount = data.total_item_discount_amount end
    if data.sub_total ~= nil then update_data.sub_total = data.sub_total end
    if data.overall_discount_amount ~= nil then update_data.overall_discount_amount = data.overall_discount_amount end
    if data.overall_tax_amount ~= nil then update_data.overall_tax_amount = data.overall_tax_amount end
    if data.total ~= nil then update_data.total = data.total end
    if data.sales_date ~= nil then update_data.sales_date = data.sales_date end
    if data.payment_status ~= nil then update_data.payment_status = data.payment_status end

    local update_err = potato.db.update_by_id("Sales", sale_id, update_data)
    if update_err ~= nil then
        req.json(400, {
            error = "Failed to update sale: " .. tostring(update_err)
        })
        return
    end

    -- Fetch the complete sale with lines
    local updated_sale, fetch_err = potato.db.find_by_id("Sales", sale_id)
    if fetch_err ~= nil then
        req.json(400, {
            error = "Failed to fetch sale: " .. tostring(fetch_err)
        })
        return
    end

    local lines, lines_err = potato.db.find_all_by_cond("SalesLines", {
        sale_id = sale_id
    })
    if lines_err == nil and lines ~= nil then
        updated_sale.lines = lines
    else
        updated_sale.lines = {}
    end

    req.json(200, updated_sale)
end

--- @param ctx HttpContext
--- @param sale_id number
function delete_sale(ctx, sale_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if sale_id == nil then
        req.json(400, {
            error = "sale_id is required"
        })
        return
    end

    -- Check if sale exists
    local sale, err = potato.db.find_by_id("Sales", sale_id)
    if err ~= nil or sale == nil then
        req.json(404, {
            error = "Sale not found"
        })
        return
    end

    if sale.is_deleted == 1 then
        req.json(400, {
            error = "Sale already deleted"
        })
        return
    end

    -- Soft delete
    local delete_err = potato.db.update_by_id("Sales", sale_id, {
        is_deleted = 1,
        updated_by = userId
    })
    if delete_err ~= nil then
        req.json(400, {
            error = tostring(delete_err)
        })
        return
    end
    req.json(200, {
        message = "Sale deleted"
    })
end

-- Settings Handlers
function get_app_settings(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local default_tax_rate_id = nil
    local default_sales_account_id = nil
    local default_purchase_account_id = nil

    local tax_kv = space_kv_get("CONFIG", "DEFAULT_TAX_RATE_ID")
    if tax_kv and (tax_kv.value or tax_kv.Value) and (tax_kv.value ~= "" and tax_kv.Value ~= "") then
        local v = tax_kv.value or tax_kv.Value
        default_tax_rate_id = tonumber(v)
    end

    local sales_kv = space_kv_get("CONFIG", "DEFAULT_SALES_ACCOUNT_ID")
    if sales_kv and (sales_kv.value or sales_kv.Value) and (sales_kv.value ~= "" and sales_kv.Value ~= "") then
        local v = sales_kv.value or sales_kv.Value
        default_sales_account_id = tonumber(v)
    end

    local purchase_kv = space_kv_get("CONFIG", "DEFAULT_PURCHASE_ACCOUNT_ID")
    if purchase_kv and (purchase_kv.value or purchase_kv.Value) and (purchase_kv.value ~= "" and purchase_kv.Value ~= "") then
        local v = purchase_kv.value or purchase_kv.Value
        default_purchase_account_id = tonumber(v)
    end

    if default_tax_rate_id == nil and default_sales_account_id == nil and default_purchase_account_id == nil then
        local cfg_kv = space_kv_get("CONFIG", "SETTINGS") or space_kv_get("CONFIG", "DEFAULTS")
        if cfg_kv and (cfg_kv.value or cfg_kv.Value) and (cfg_kv.value ~= "" and cfg_kv.Value ~= "") then
            local v = cfg_kv.value or cfg_kv.Value
            local ok, parsed = pcall(json.decode, v)
            if ok and type(parsed) == "table" then
                if parsed.default_tax_rate_id ~= nil then
                    default_tax_rate_id = tonumber(parsed.default_tax_rate_id)
                end
                if parsed.default_sales_account_id ~= nil then
                    default_sales_account_id = tonumber(parsed.default_sales_account_id)
                end
                if parsed.default_purchase_account_id ~= nil then
                    default_purchase_account_id = tonumber(parsed.default_purchase_account_id)
                end
            end
        end
    end

    req.json(200, {
        default_tax_rate_id = default_tax_rate_id,
        default_sales_account_id = default_sales_account_id,
        default_purchase_account_id = default_purchase_account_id
    })
end

function update_app_settings(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if type(data) ~= "table" then
        req.json(400, {
            error = "Invalid JSON payload"
        })
        return
    end

    local tax_rate_id = data.default_tax_rate_id and tonumber(data.default_tax_rate_id) or nil
    local sales_acc_id = data.default_sales_account_id and tonumber(data.default_sales_account_id) or nil
    local purchase_acc_id = data.default_purchase_account_id and tonumber(data.default_purchase_account_id) or nil

    space_kv_upsert("CONFIG", "DEFAULT_TAX_RATE_ID", { value = tax_rate_id and tostring(tax_rate_id) or "" })
    space_kv_upsert("CONFIG", "DEFAULT_SALES_ACCOUNT_ID", { value = sales_acc_id and tostring(sales_acc_id) or "" })
    space_kv_upsert("CONFIG", "DEFAULT_PURCHASE_ACCOUNT_ID", { value = purchase_acc_id and tostring(purchase_acc_id) or "" })

    local combined = {
        default_tax_rate_id = tax_rate_id,
        default_sales_account_id = sales_acc_id,
        default_purchase_account_id = purchase_acc_id
    }
    space_kv_upsert("CONFIG", "SETTINGS", { value = json.encode(combined) })

    req.json(200, combined)
end

--- HTTP ENDPOINTS ---
--- @class HttpContext
--- @field param fun(key: string): string
--- @field type fun(): string -- http

--- @param ctx HttpContext
function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method = ctx.param("method")

    local userId = get_user_id(req)
    if userId == nil then return end

    -- Initialization routes
    if path == "/init_status" and method == "GET" then
        return get_init_status(ctx)
    end

    if path == "/init_app" and method == "POST" then
        return init_app(ctx)
    end

    -- Schema initialization (backward compat)
    if path == "/run_schema_sql" and method == "POST" then
        return init_app(ctx)
    end

    -- Seeding route (backward compat)
    if path == "/seed" and method == "POST" then
        return init_app(ctx)
    end

    -- Settings routes
    if path == "/settings" and method == "GET" then
        return get_app_settings(ctx)
    end

    if path == "/settings" and (method == "POST" or method == "PUT") then
        return update_app_settings(ctx)
    end

    -- Accounts routes
    if path == "/accounts" and method == "GET" then
        return list_accounts(ctx)
    end

    if path == "/accounts" and method == "POST" then
        return create_account(ctx)
    end

    local account_id_match = string.match(path, "^/accounts/(%d+)$")
    if account_id_match then
        local account_id = tonumber(account_id_match)
        if account_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_account(ctx, account_id)
            elseif method == "DELETE" then
                return delete_account(ctx, account_id)
            end
        end
    end

    -- Transactions routes
    if path == "/transactions" and method == "GET" then
        return transaction_list(ctx)
    end

    if path == "/transactions" and method == "POST" then
        return transaction_create(ctx)
    end

    local txn_id_match = string.match(path, "^/transactions/(%d+)$")
    if txn_id_match then
        local txn_id = tonumber(txn_id_match)
        if txn_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return transaction_update(ctx, txn_id)
            elseif method == "DELETE" then
                return transaction_delete(ctx, txn_id)
            end
        end
    end

    -- Categories routes
    if path == "/categories" and method == "GET" then
        return list_categories(ctx)
    end

    if path == "/categories" and method == "POST" then
        return create_category(ctx)
    end

    local category_id_match = string.match(path, "^/categories/(%d+)$")
    if category_id_match then
        local category_id = tonumber(category_id_match)
        if category_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_category(ctx, category_id)
            elseif method == "DELETE" then
                return delete_category(ctx, category_id)
            end
        end
    end

    -- Contacts routes
    if path == "/contacts" and method == "GET" then
        return list_contacts(ctx)
    end

    if path == "/contacts" and method == "POST" then
        return create_contact(ctx)
    end

    local contact_id_match = string.match(path, "^/contacts/(%d+)$")
    if contact_id_match then
        local contact_id = tonumber(contact_id_match)
        if contact_id ~= nil then
            if method == "GET" then
                return get_contact(ctx, contact_id)
            elseif method == "PUT" or method == "PATCH" or method == "POST" then
                return update_contact(ctx, contact_id)
            elseif method == "DELETE" then
                return delete_contact(ctx, contact_id)
            end
        end
    end

    -- Products routes
    if path == "/products" and method == "GET" then
        return list_products(ctx)
    end

    if path == "/products" and method == "POST" then
        return create_product(ctx)
    end

    local product_variants_match = string.match(path, "^/products/(%d+)/variants$")
    if product_variants_match then
        local product_id = tonumber(product_variants_match)
        if product_id ~= nil then
            if method == "GET" then
                return list_product_variants(ctx, product_id)
            elseif method == "POST" then
                return create_product_variant(ctx, product_id)
            end
        end
    end

    local variant_id_match = string.match(path, "^/variants/(%d+)$")
    if variant_id_match then
        local variant_id = tonumber(variant_id_match)
        if variant_id ~= nil then
            if method == "GET" then
                return get_product_variant(ctx, variant_id)
            elseif method == "PUT" or method == "PATCH" then
                return update_product_variant(ctx, variant_id)
            elseif method == "DELETE" then
                return delete_product_variant(ctx, variant_id)
            end
        end
    end

    local product_id_match = string.match(path, "^/products/(%d+)$")
    if product_id_match then
        local product_id = tonumber(product_id_match)
        if product_id ~= nil then
            if method == "GET" then
                return get_product(ctx, product_id)
            elseif method == "PUT" or method == "PATCH" then
                return update_product(ctx, product_id)
            elseif method == "DELETE" then
                return delete_product(ctx, product_id)
            end
        end
    end

    -- Stock In routes
    if path == "/stockin" and method == "GET" then
        return list_stockin(ctx)
    end

    if path == "/stockin" and method == "POST" then
        return create_stockin(ctx)
    end

    local stockin_id_match = string.match(path, "^/stockin/(%d+)$")
    if stockin_id_match then
        local stockin_id = tonumber(stockin_id_match)
        if stockin_id ~= nil then
            if method == "GET" then
                return get_stockin(ctx, stockin_id)
            elseif method == "PUT" or method == "PATCH" or method == "POST" then
                return update_stockin(ctx, stockin_id)
            elseif method == "DELETE" then
                return delete_stockin(ctx, stockin_id)
            end
        end
    end

    -- Taxes routes
    if path == "/taxes" and method == "GET" then
        return list_taxes(ctx)
    end

    if path == "/taxes" and method == "POST" then
        return create_tax(ctx)
    end

    local tax_id_match = string.match(path, "^/taxes/(%d+)$")
    if tax_id_match then
        local tax_id = tonumber(tax_id_match)
        if tax_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_tax(ctx, tax_id)
            elseif method == "DELETE" then
                return delete_tax(ctx, tax_id)
            end
        end
    end

    -- Sales routes
    if path == "/sales" and method == "GET" then
        return list_sales(ctx)
    end

    if path == "/sales" and method == "POST" then
        return create_sale(ctx)
    end

    local sale_id_match = string.match(path, "^/sales/(%d+)$")
    if sale_id_match then
        local sale_id = tonumber(sale_id_match)
        if sale_id ~= nil then
            if method == "GET" then
                return get_sale(ctx, sale_id)
            elseif method == "PUT" or method == "PATCH" then
                return update_sale(ctx, sale_id)
            elseif method == "DELETE" then
                return delete_sale(ctx, sale_id)
            end
        end
    end

    req.json(404, {
        error = "Not found"
    })
end