local potato = require("potato")

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





function run_schema_sql(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)

    if userId == nil then return end

    local tables = potato.db.list_tables()
    if tables ~= nil and #tables > 0 then
        req.json(200, {
            message = "Tables already exist"
        })
        return
    end
    
    local schema, err = potato.core.read_package_file("schema.sql")
    if err ~= nil then
        req.json(500, {
            message = "Failed to read schema.sql: " .. err
        })
        return
    end

    local ddlerr = potato.db.run_ddl(schema)
    if ddlerr ~= nil then
        req.json(500, {
            message = "Failed to apply schema: " .. ddlerr
        })
        return
    end

    req.json(200, {
        message = "Schema applied"
    })
end

function seed_database(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    -- Check if tables exist, if not apply schema first
    local tables = potato.db.list_tables()
    if tables == nil or #tables == 0 then
        local schema, err = potato.core.read_package_file("schema.sql")
        if err == nil and schema ~= nil then
            potato.db.run_ddl(schema)
        end
    end

    -- Check if already seeded
    local existing_accounts = potato.db.find_all_by_cond("Accounts", {
        is_deleted = 0
    })
    if existing_accounts ~= nil and #existing_accounts > 0 then
        req.json(200, {
            message = "Database is already seeded.",
            count = #existing_accounts
        })
        return
    end

    -- Seed Accounts
    local accounts = {
        { name = "Cash on Hand", acc_type = "assets", info = "Petty cash and cash register", parent_id = 0, total_debit = 1000000, total_credit = 0, contact_id = 0, is_deleted = 0 },
        { name = "Operating Bank Account", acc_type = "assets", info = "Primary business bank account", parent_id = 0, total_debit = 5000000, total_credit = 0, contact_id = 0, is_deleted = 0 },
        { name = "Accounts Receivable", acc_type = "assets", info = "Money owed by customers", parent_id = 0, total_debit = 250000, total_credit = 0, contact_id = 0, is_deleted = 0 },
        { name = "Inventory Asset", acc_type = "assets", info = "Value of inventory on hand", parent_id = 0, total_debit = 1500000, total_credit = 0, contact_id = 0, is_deleted = 0 },
        { name = "Accounts Payable", acc_type = "liabilities", info = "Money owed to suppliers", parent_id = 0, total_debit = 0, total_credit = 300000, contact_id = 0, is_deleted = 0 },
        { name = "Sales Tax Payable", acc_type = "liabilities", info = "Collected sales tax to remit", parent_id = 0, total_debit = 0, total_credit = 65000, contact_id = 0, is_deleted = 0 },
        { name = "Owner's Equity", acc_type = "equity", info = "Initial capital contribution", parent_id = 0, total_debit = 0, total_credit = 6000000, contact_id = 0, is_deleted = 0 },
        { name = "Sales Revenue", acc_type = "revenue", info = "Revenue from product sales", parent_id = 0, total_debit = 0, total_credit = 1500000, contact_id = 0, is_deleted = 0 },
        { name = "Service Income", acc_type = "revenue", info = "Revenue from consulting and services", parent_id = 0, total_debit = 0, total_credit = 450000, contact_id = 0, is_deleted = 0 },
        { name = "Rent Expense", acc_type = "expenses", info = "Monthly office rent", parent_id = 0, total_debit = 120000, total_credit = 0, contact_id = 0, is_deleted = 0 },
        { name = "Salaries Expense", acc_type = "expenses", info = "Staff payroll expenses", parent_id = 0, total_debit = 350000, total_credit = 0, contact_id = 0, is_deleted = 0 },
        { name = "Office Supplies Expense", acc_type = "expenses", info = "Stationery and supplies", parent_id = 0, total_debit = 15000, total_credit = 0, contact_id = 0, is_deleted = 0 }
    }

    local created_accounts = {}
    for _, acc in ipairs(accounts) do
        local id, err = potato.db.insert("Accounts", acc)
        if id ~= nil then
            created_accounts[acc.name] = id
        end
    end

    -- Seed Tax Rates
    local taxes = {
        { name = "Standard Sales VAT (13%)", ttype = "sales", info = "Standard Value Added Tax on sales", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Purchase VAT (13%)", ttype = "purchase", info = "Input VAT on purchases", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Sales Tax (5%)", ttype = "sales", info = "State sales tax", rate = 500, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Zero Tax (0%)", ttype = "sales", info = "Tax exempt items", rate = 0, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 }
    }

    local created_taxes = {}
    for _, t in ipairs(taxes) do
        local id, err = potato.db.insert("Tax", t)
        if id ~= nil then
            table.insert(created_taxes, id)
        end
    end

    -- Seed Categories (table name is Catagories in schema.sql)
    local categories = {
        { name = "Electronics & Gadgets", info = "Hardware, peripherals, and electronic equipment", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Office Supplies", info = "Stationery, paper, and desk equipment", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Professional Services", info = "Consulting, audit, and advisory services", product_class = "service", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 }
    }

    local created_categories = {}
    for _, cat in ipairs(categories) do
        local id, err = potato.db.insert("Catagories", cat)
        if id ~= nil then
            table.insert(created_categories, id)
        end
    end

    -- Seed Products
    local cat_electronics = created_categories[1] or 1
    local cat_office = created_categories[2] or 2
    local cat_services = created_categories[3] or 3

    local products = {
        { name = "Ultra Slim Laptop 15\"", info = "Core i7, 16GB RAM, 512GB SSD", variant_id = "", catagory_id = cat_electronics, price = 119900, parent_id = 0, image = "", alt_images = "", epoch = 0, stock_count = 15, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Ergonomic Wireless Mouse", info = "Rechargeable Bluetooth optical mouse", variant_id = "", catagory_id = cat_electronics, price = 2999, parent_id = 0, image = "", alt_images = "", epoch = 0, stock_count = 60, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Mechanical Keyboard", info = "RGB Backlit USB-C mechanical keyboard", variant_id = "", catagory_id = cat_electronics, price = 7999, parent_id = 0, image = "", alt_images = "", epoch = 0, stock_count = 35, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Executive Desk Notebook Set", info = "Pack of 3 premium hardcover notebooks", variant_id = "", catagory_id = cat_office, price = 1850, parent_id = 0, image = "", alt_images = "", epoch = 0, stock_count = 120, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Mesh High-Back Ergonomic Chair", info = "Adjustable lumbar support office chair", variant_id = "", catagory_id = cat_office, price = 24900, parent_id = 0, image = "", alt_images = "", epoch = 0, stock_count = 10, created_by = userId, updated_by = userId, is_deleted = 0 },
        { name = "Business Financial Advisory (1 hr)", info = "Hourly accounting & financial consulting", variant_id = "", catagory_id = cat_services, price = 15000, parent_id = 0, image = "", alt_images = "", epoch = 0, stock_count = 999, created_by = userId, updated_by = userId, is_deleted = 0 }
    }

    local created_products = {}
    for _, prod in ipairs(products) do
        local id, err = potato.db.insert("Products", prod)
        if id ~= nil then
            table.insert(created_products, id)
        end
    end

    -- Seed Sample Sales
    local sale_id, _ = potato.db.insert("Sales", {
        title = "INV-2026-001 - Acme Corporation",
        client_id = 101,
        client_name = "Acme Corporation",
        notes = "Invoice for Q1 hardware and consulting services",
        attachments = "",
        total_item_price = 122899,
        total_item_tax_amount = 15976,
        total_item_discount_amount = 5000,
        sub_total = 133875,
        overall_discount_amount = 0,
        overall_tax_amount = 0,
        total = 133875,
        created_by = userId,
        updated_by = userId,
        payment_status = "paid",
        invalidated_reason = "",
        is_deleted = 0
    })

    if sale_id ~= nil and #created_products >= 2 then
        potato.db.insert("SalesLines", {
            sale_id = sale_id,
            product_id = created_products[1],
            info = "Ultra Slim Laptop 15\"",
            qty = 1,
            price = 119900,
            tax_amount = 15587,
            discount_amount = 5000,
            total_amount = 130487,
            created_by = userId,
            updated_by = userId
        })
        potato.db.insert("SalesLines", {
            sale_id = sale_id,
            product_id = created_products[2],
            info = "Ergonomic Wireless Mouse",
            qty = 1,
            price = 2999,
            tax_amount = 389,
            discount_amount = 0,
            total_amount = 3388,
            created_by = userId,
            updated_by = userId
        })
    end

    -- Seed Sample Transactions
    local bank_acc_id = created_accounts["Operating Bank Account"] or 2
    local owner_equity_id = created_accounts["Owner's Equity"] or 7
    local rent_acc_id = created_accounts["Rent Expense"] or 10

    local txn1_id, _ = potato.db.insert("Transactions", {
        title = "Initial Capital Contribution",
        notes = "Owner funding of business account",
        txn_type = "manual",
        reference_id = "TXN-INIT-001",
        attachments = "",
        created_by = userId,
        updated_by = userId,
        is_editable = 1,
        is_deleted = 0
    })
    if txn1_id ~= nil then
        potato.db.insert("TransactionLines", {
            account_id = bank_acc_id,
            txn_id = txn1_id,
            debit_amount = 5000000,
            credit_amount = 0,
            created_by = userId,
            updated_by = userId,
            linked_sales_id = 0,
            linked_stockin_id = 0
        })
        potato.db.insert("TransactionLines", {
            account_id = owner_equity_id,
            txn_id = txn1_id,
            debit_amount = 0,
            credit_amount = 5000000,
            created_by = userId,
            updated_by = userId,
            linked_sales_id = 0,
            linked_stockin_id = 0
        })
    end

    local txn2_id, _ = potato.db.insert("Transactions", {
        title = "Office Rent - September",
        notes = "Paid September commercial space rent",
        txn_type = "manual",
        reference_id = "TXN-RENT-001",
        attachments = "",
        created_by = userId,
        updated_by = userId,
        is_editable = 1,
        is_deleted = 0
    })
    if txn2_id ~= nil then
        potato.db.insert("TransactionLines", {
            account_id = rent_acc_id,
            txn_id = txn2_id,
            debit_amount = 120000,
            credit_amount = 0,
            created_by = userId,
            updated_by = userId,
            linked_sales_id = 0,
            linked_stockin_id = 0
        })
        potato.db.insert("TransactionLines", {
            account_id = bank_acc_id,
            txn_id = txn2_id,
            debit_amount = 0,
            credit_amount = 120000,
            created_by = userId,
            updated_by = userId,
            linked_sales_id = 0,
            linked_stockin_id = 0
        })
    end

    req.json(200, {
        message = "Seed data successfully populated",
        accounts_count = #accounts,
        products_count = #products,
        categories_count = #categories,
        taxes_count = #taxes
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

-- PRODUCTS

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
    req.json_array(200, products)
end

--- @param ctx HttpContext
function create_product(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local product = req.bind_json()
    product.created_by = userId
    product.updated_by = userId
    local id, err = potato.db.insert("Products", product)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local product, err = potato.db.find_by_id("Products", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, product)
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
    product.updated_by = userId
    local err = potato.db.update_by_id("Products", product_id, product)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    local product, err = potato.db.find_by_id("Products", product_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, product)
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

    -- Schema initialization
    if path == "/run_schema_sql" and method == "POST" then
        return run_schema_sql(ctx)
    end

    -- Seeding route
    if path == "/seed" and method == "POST" then
        return seed_database(ctx)
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

    -- Products routes
    if path == "/products" and method == "GET" then
        return list_products(ctx)
    end

    if path == "/products" and method == "POST" then
        return create_product(ctx)
    end

    local product_id_match = string.match(path, "^/products/(%d+)$")
    if product_id_match then
        local product_id = tonumber(product_id_match)
        if product_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_product(ctx, product_id)
            elseif method == "DELETE" then
                return delete_product(ctx, product_id)
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