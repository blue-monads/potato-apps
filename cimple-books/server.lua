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

    if not inited then
        local kv2 = space_kv_get("", "INIT_VERSION")
        if kv2 ~= nil and (kv2.value == "26-7-alpha" or kv2.Value == "26-7-alpha") then
            inited = true
            version = kv2.value or kv2.Value
        end
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

function seed_template_data(userId, template)
    if template == "blank" then
        return
    end

    local is_pharmacy = (template == "pharmacy")
    local is_tech = (template == "tech_electronics")
    local is_consulting = (template == "consulting")

    -- 1. Accounts
    local accounts = {}
    if is_pharmacy then
        accounts = {
            { name = "Pharmacy Cash Register", acc_type = "assets", info = "Point-of-sale cash counter", parent_id = 0, total_debit = 800000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Pharmacy Operating Account", acc_type = "assets", info = "Main bank account", parent_id = 0, total_debit = 4500000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Accounts Receivable - Insurance", acc_type = "assets", info = "Claims pending reimbursement", parent_id = 0, total_debit = 320000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Prescription Medicine Inventory", acc_type = "assets", info = "Value of Rx drugs in stock", parent_id = 0, total_debit = 2500000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "OTC & Health Inventory", acc_type = "assets", info = "Over the counter medicine stock", parent_id = 0, total_debit = 1200000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Accounts Payable - Distributors", acc_type = "liabilities", info = "Pharma wholesalers payable", parent_id = 0, total_debit = 0, total_credit = 450000, contact_id = 0, is_deleted = 0 },
            { name = "Sales Tax Payable", acc_type = "liabilities", info = "Collected healthcare sales tax", parent_id = 0, total_debit = 0, total_credit = 35000, contact_id = 0, is_deleted = 0 },
            { name = "Owner's Equity", acc_type = "equity", info = "Initial capital investment", parent_id = 0, total_debit = 0, total_credit = 8000000, contact_id = 0, is_deleted = 0 },
            { name = "Prescription Sales Revenue", acc_type = "revenue", info = "Income from Rx dispensary", parent_id = 0, total_debit = 0, total_credit = 1800000, contact_id = 0, is_deleted = 0 },
            { name = "OTC Sales Revenue", acc_type = "revenue", info = "General health & wellness retail", parent_id = 0, total_debit = 0, total_credit = 650000, contact_id = 0, is_deleted = 0 },
            { name = "Clinical Consultation Income", acc_type = "revenue", info = "Health checkup and consultation", parent_id = 0, total_debit = 0, total_credit = 210000, contact_id = 0, is_deleted = 0 },
            { name = "Staff Pharmacist Salaries", acc_type = "expenses", info = "Pharmacist and tech payroll", parent_id = 0, total_debit = 420000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Pharmacy Store Rent", acc_type = "expenses", info = "Commercial premises rent", parent_id = 0, total_debit = 150000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Medical Waste Disposal", acc_type = "expenses", info = "Biohazard and expired drug disposal", parent_id = 0, total_debit = 25000, total_credit = 0, contact_id = 0, is_deleted = 0 }
        }
    elseif is_tech then
        accounts = {
            { name = "Cash Register", acc_type = "assets", info = "Store floor cash drawer", parent_id = 0, total_debit = 500000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Tech Venture Bank Account", acc_type = "assets", info = "Primary operating checking", parent_id = 0, total_debit = 6500000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Merchant Account Clearing", acc_type = "assets", info = "Credit card & stripe payments", parent_id = 0, total_debit = 450000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Hardware Inventory Asset", acc_type = "assets", info = "Computers, components, gadgets", parent_id = 0, total_debit = 3800000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Accounts Payable - OEMs", acc_type = "liabilities", info = "Suppliers and component vendors", parent_id = 0, total_debit = 0, total_credit = 600000, contact_id = 0, is_deleted = 0 },
            { name = "Warranty Reserve", acc_type = "liabilities", info = "Provision for device repairs", parent_id = 0, total_debit = 0, total_credit = 120000, contact_id = 0, is_deleted = 0 },
            { name = "Founder's Capital", acc_type = "equity", info = "Equity investment", parent_id = 0, total_debit = 0, total_credit = 9000000, contact_id = 0, is_deleted = 0 },
            { name = "Hardware Sales Revenue", acc_type = "revenue", info = "Sales of electronics & laptops", parent_id = 0, total_debit = 0, total_credit = 2500000, contact_id = 0, is_deleted = 0 },
            { name = "Repair & Support Revenue", acc_type = "revenue", info = "Technical repairs & diagnostics", parent_id = 0, total_debit = 0, total_credit = 480000, contact_id = 0, is_deleted = 0 },
            { name = "Store Lease Expense", acc_type = "expenses", info = "Retail showroom lease", parent_id = 0, total_debit = 180000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Engineering & Tech Salaries", acc_type = "expenses", info = "Repair techs and sales reps", parent_id = 0, total_debit = 380000, total_credit = 0, contact_id = 0, is_deleted = 0 }
        }
    elseif is_consulting then
        accounts = {
            { name = "Operating Bank Account", acc_type = "assets", info = "Primary business bank account", parent_id = 0, total_debit = 5500000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Accounts Receivable - Clients", acc_type = "assets", info = "Uncollected client invoices", parent_id = 0, total_debit = 850000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Client Retainer Escrow", acc_type = "liabilities", info = "Unearned retainer deposits", parent_id = 0, total_debit = 0, total_credit = 400000, contact_id = 0, is_deleted = 0 },
            { name = "Partner Equity", acc_type = "equity", info = "Partner capital contributions", parent_id = 0, total_debit = 0, total_credit = 5000000, contact_id = 0, is_deleted = 0 },
            { name = "Professional Advisory Fees", acc_type = "revenue", info = "Consulting and advisory revenue", parent_id = 0, total_debit = 0, total_credit = 2800000, contact_id = 0, is_deleted = 0 },
            { name = "Monthly Retainer Income", acc_type = "revenue", info = "Ongoing client retainers", parent_id = 0, total_debit = 0, total_credit = 950000, contact_id = 0, is_deleted = 0 },
            { name = "Office Space Rent", acc_type = "expenses", info = "Executive suite lease", parent_id = 0, total_debit = 140000, total_credit = 0, contact_id = 0, is_deleted = 0 },
            { name = "Software & SaaS Tooling", acc_type = "expenses", info = "Cloud accounting & research tools", parent_id = 0, total_debit = 45000, total_credit = 0, contact_id = 0, is_deleted = 0 }
        }
    else
        -- Small Business / Retail (Default)
        accounts = {
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
    end

    local created_accounts = {}
    for _, acc in ipairs(accounts) do
        local id, _ = potato.db.insert("Accounts", acc)
        if id ~= nil then
            created_accounts[acc.name] = id
        end
    end

    -- 2. Tax Rates
    local taxes = {}
    if is_pharmacy then
        taxes = {
            { name = "Prescription Drugs (0%)", ttype = "sales", info = "Exempt essential medicines", rate = 0, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "OTC Medicines VAT (5%)", ttype = "sales", info = "Reduced healthcare VAT", rate = 500, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "General Health Goods (13%)", ttype = "sales", info = "Standard retail VAT", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Wholesale Purchase VAT (13%)", ttype = "purchase", info = "Input VAT on purchases", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    elseif is_tech then
        taxes = {
            { name = "Consumer Electronics VAT (13%)", ttype = "sales", info = "Hardware standard VAT", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Tech Services Tax (10%)", ttype = "sales", info = "Repairs & technical services", rate = 1000, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Component Purchase VAT (13%)", ttype = "purchase", info = "Input VAT on hardware imports", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    elseif is_consulting then
        taxes = {
            { name = "Professional Services VAT (13%)", ttype = "sales", info = "Standard advisory VAT", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Withholding Tax (1.5%)", ttype = "sales", info = "Contractor withholding", rate = 150, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Remote Services (0%)", ttype = "sales", info = "Tax exempt offshore clients", rate = 0, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    else
        taxes = {
            { name = "Standard Sales VAT (13%)", ttype = "sales", info = "Standard Value Added Tax on sales", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Purchase VAT (13%)", ttype = "purchase", info = "Input VAT on purchases", rate = 1300, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Sales Tax (5%)", ttype = "sales", info = "State sales tax", rate = 500, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Zero Tax (0%)", ttype = "sales", info = "Tax exempt items", rate = 0, ["strict"] = 0, created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    end

    for _, t in ipairs(taxes) do
        potato.db.insert("Tax", t)
    end

    -- 3. Categories
    local categories = {}
    if is_pharmacy then
        categories = {
            { name = "Prescription Drugs", info = "Dispensed prescription medications", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Over-The-Counter (OTC)", info = "Non-prescription medications & remedies", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Vitamins & Supplements", info = "Dietary supplements, probiotics, minerals", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "First Aid & Equipment", info = "Dressings, monitors, medical diagnostics", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    elseif is_tech then
        categories = {
            { name = "Computers & Laptops", info = "Notebooks, desktops, mini PCs", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Audio & Smart Devices", info = "Headphones, wireless earbuds, smart speakers", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Accessories & Power", info = "Chargers, cables, docks, keyboards", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Repair Services", info = "Device repairs, screen replacements, upgrades", product_class = "service", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    elseif is_consulting then
        categories = {
            { name = "Accounting & Tax Advisory", info = "Tax prep, bookkeeping, financial modeling", product_class = "service", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Management Consulting", info = "Operational strategy and turnaround", product_class = "service", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Audit & Compliance", info = "Financial review and regulatory compliance", product_class = "service", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    else
        categories = {
            { name = "Office Supplies", info = "Stationery, paper, desk equipment", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "Electronics & Gadgets", info = "Hardware, peripherals, and electronics", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 },
            { name = "General Merchandise", info = "Everyday consumables and store goods", product_class = "physical_item", parent_id = 0, image = "", created_by = userId, updated_by = userId, is_deleted = 0 }
        }
    end

    local created_categories = {}
    for _, cat in ipairs(categories) do
        local id, _ = potato.db.insert("Catagories", cat)
        if id ~= nil then
            table.insert(created_categories, id)
        end
    end

    -- 4. Products & ProductVariants
    local cat1 = created_categories[1] or 1
    local cat2 = created_categories[2] or 2
    local cat3 = created_categories[3] or 3

    local products_with_variants = {}
    if is_pharmacy then
        products_with_variants = {
            {
                prod = { name = "Paracetamol 500mg", info = "Rapid pain relief and fever reducer caplets", catagory_id = cat2, sales_price = 350, image = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 150, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Blister Pack (20 Caplets)", description = "Standard pack of 20", sales_price = 350, images = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60" },
                    { name = "Economy Bottle (100 Caplets)", description = "Value family size bottle of 100", sales_price = 1250, images = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60" }
                }
            },
            {
                prod = { name = "Digital Blood Pressure Monitor", info = "Automatic upper-arm cuff digital sphygmomanometer", catagory_id = cat1, sales_price = 4500, image = "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 25, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Standard Arm Cuff (22-32cm)", description = "Medium adult cuff", sales_price = 4500, images = "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=500&auto=format&fit=crop&q=60" },
                    { name = "Large Arm Cuff (32-45cm)", description = "XL adult cuff", sales_price = 4900, images = "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=500&auto=format&fit=crop&q=60" }
                }
            },
            {
                prod = { name = "Vitamin C 1000mg + Zinc Effervescent", info = "Immune support effervescent drink tablets", catagory_id = cat3, sales_price = 1100, image = "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 80, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Zesty Orange Flavor", description = "Tube of 20 dissolving tablets", sales_price = 1100, images = "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=500&auto=format&fit=crop&q=60" },
                    { name = "Wild Berry Flavor", description = "Tube of 20 dissolving tablets", sales_price = 1100, images = "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=500&auto=format&fit=crop&q=60" }
                }
            }
        }
    elseif is_tech then
        products_with_variants = {
            {
                prod = { name = "Ultra Slim Laptop 14\" Pro", info = "Intel Core i7 13th Gen, IPS Display, Thunderbolt 4", catagory_id = cat1, sales_price = 129900, image = "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 12, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "16GB RAM / 512GB SSD", description = "Space Gray edition", sales_price = 129900, images = "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=60" },
                    { name = "32GB RAM / 1TB SSD", description = "Space Gray edition with max specs", sales_price = 159900, images = "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=60" }
                }
            },
            {
                prod = { name = "Active Noise Cancelling Headphones", info = "Wireless over-ear Bluetooth 5.3 headset with 40hr battery", catagory_id = cat2, sales_price = 18900, image = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 35, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Matte Carbon Black", description = "Classic stealth black", sales_price = 18900, images = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60" },
                    { name = "Silver Mist", description = "Brushed aluminum finish", sales_price = 18900, images = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60" }
                }
            },
            {
                prod = { name = "Mechanical Gaming Keyboard RGB", info = "Hot-swappable switches, sound dampening foam, PBT keycaps", catagory_id = cat3, sales_price = 7999, image = "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 40, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Red Linear Switches", description = "Smooth and quiet keypresses", sales_price = 7999, images = "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60" },
                    { name = "Brown Tactile Switches", description = "Subtle tactile bump for typing", sales_price = 7999, images = "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60" }
                }
            }
        }
    elseif is_consulting then
        products_with_variants = {
            {
                prod = { name = "Monthly Accounting & Tax Retainer", info = "Comprehensive monthly bookkeeping and compliance", catagory_id = cat1, sales_price = 30000, image = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 999, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Starter Tier (Up to 50 Transactions)", description = "Ideal for sole proprietors", sales_price = 30000, images = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop&q=60" },
                    { name = "Growth Tier (Up to 250 Transactions)", description = "Includes quarterly advisory session", sales_price = 65000, images = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop&q=60" }
                }
            },
            {
                prod = { name = "Corporate Tax Return Filing", info = "Annual corporate tax compilation and e-filing package", catagory_id = cat1, sales_price = 45000, image = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 999, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Standard Entity (< $1M Revenue)", description = "Full compliance preparation", sales_price = 45000, images = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500&auto=format&fit=crop&q=60" }
                }
            }
        }
    else
        -- Small Business / Retail (Default)
        products_with_variants = {
            {
                prod = { name = "Executive Desk Notebook Set", info = "Premium hardcover dotted & ruled notebooks", catagory_id = cat1, sales_price = 1850, image = "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 120, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Hardcover Ruled (A5)", description = "192 pages, 100gsm fountain-pen friendly paper", sales_price = 1850, images = "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60" },
                    { name = "Hardcover Dotted (A5)", description = "5mm dot grid layout, emerald ribbon bookmark", sales_price = 1950, images = "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60" }
                }
            },
            {
                prod = { name = "Ergonomic Wireless Mouse", info = "Quiet click optical rechargeable Bluetooth mouse", catagory_id = cat2, sales_price = 2999, image = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 60, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Graphite Charcoal", description = "Matte ergonomic grip", sales_price = 2999, images = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60" },
                    { name = "Off-White Chalk", description = "Sleek contemporary colorway", sales_price = 2999, images = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60" }
                }
            },
            {
                prod = { name = "Artisan Whole Bean Coffee (1kg)", info = "Single origin medium roast Arabica beans", catagory_id = cat3, sales_price = 2200, image = "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=60", images = "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=60", alt_images = "", epoch = 0, stock_count = 45, created_by = userId, updated_by = userId, is_deleted = 0 },
                variants = {
                    { name = "Whole Bean 1kg", description = "Direct trade freshly roasted", sales_price = 2200, images = "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=60" },
                    { name = "French Press Coarse Grind 1kg", description = "Ground for immersion brewing", sales_price = 2300, images = "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=60" }
                }
            }
        }
    end

    local created_product_ids = {}
    for _, item in ipairs(products_with_variants) do
        local pid, _ = potato.db.insert("Products", item.prod)
        if pid ~= nil then
            table.insert(created_product_ids, pid)
            if item.variants ~= nil then
                for _, var in ipairs(item.variants) do
                    var.product_id = pid
                    var.created_by = userId
                    var.updated_by = userId
                    var.is_deleted = 0
                    potato.db.insert("ProductVariants", var)
                end
            end
        end
    end

    -- 5. Sample Sale
    if #created_product_ids >= 2 then
        local p1_id = created_product_ids[1]
        local p2_id = created_product_ids[2]

        local sale_id, _ = potato.db.insert("Sales", {
            title = "INV-001 - First Customer Order",
            client_id = 101,
            client_name = "Global Ventures Inc.",
            notes = "Initial demo order created upon system setup",
            attachments = "",
            total_item_price = 6699,
            total_item_tax_amount = 871,
            total_item_discount_amount = 200,
            sub_total = 7370,
            overall_discount_amount = 0,
            overall_tax_amount = 0,
            total = 7370,
            created_by = userId,
            updated_by = userId,
            payment_status = "paid",
            invalidated_reason = "",
            is_deleted = 0
        })

        if sale_id ~= nil then
            potato.db.insert("SalesLines", {
                sale_id = sale_id,
                product_id = p1_id,
                info = "Item Line 1",
                qty = 2,
                price = 1850,
                tax_amount = 481,
                discount_amount = 100,
                total_amount = 4081,
                created_by = userId,
                updated_by = userId
            })
            potato.db.insert("SalesLines", {
                sale_id = sale_id,
                product_id = p2_id,
                info = "Item Line 2",
                qty = 1,
                price = 2999,
                tax_amount = 390,
                discount_amount = 100,
                total_amount = 3289,
                created_by = userId,
                updated_by = userId
            })
        end
    end

    -- 6. Sample Initial Capital Transaction
    local bank_id = created_accounts["Operating Bank Account"] or created_accounts["Pharmacy Operating Account"] or created_accounts["Tech Venture Bank Account"] or 2
    local equity_id = created_accounts["Owner's Equity"] or created_accounts["Founder's Capital"] or created_accounts["Partner Equity"] or 7

    local txn_id, _ = potato.db.insert("Transactions", {
        title = "Opening Capital Deposit",
        notes = "Opening journal entry for business inception",
        txn_type = "manual",
        reference_id = "TXN-SETUP-001",
        attachments = "",
        created_by = userId,
        updated_by = userId,
        is_editable = 1,
        is_deleted = 0
    })
    if txn_id ~= nil then
        potato.db.insert("TransactionLines", {
            account_id = bank_id,
            txn_id = txn_id,
            debit_amount = 5000000,
            credit_amount = 0,
            created_by = userId,
            updated_by = userId,
            linked_sales_id = 0,
            linked_stockin_id = 0
        })
        potato.db.insert("TransactionLines", {
            account_id = equity_id,
            txn_id = txn_id,
            debit_amount = 0,
            credit_amount = 5000000,
            created_by = userId,
            updated_by = userId,
            linked_sales_id = 0,
            linked_stockin_id = 0
        })
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
    if not inited then
        local kv2 = space_kv_get("", "INIT_VERSION")
        if kv2 ~= nil and (kv2.value == "26-7-alpha" or kv2.Value == "26-7-alpha") then
            inited = true
        end
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
    space_kv_upsert("", "INIT_VERSION", { value = "26-7-alpha" })

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

    -- Attach variants
    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {
        is_deleted = 0
    })
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

    for _, p in ipairs(products) do
        p.variants = variants_by_product[p.id] or {}
        if p.sales_price == nil and p.price ~= nil then
            p.sales_price = p.price
        end
    end

    req.json_array(200, products)
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
    product.variants = variants or {}
    req.json(200, product)
end

--- @param ctx HttpContext
function create_product(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local product = req.bind_json()
    product.created_by = userId
    product.updated_by = userId
    if product.sales_price == nil and product.price ~= nil then
        product.sales_price = product.price
        product.price = nil
    end

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
    product.variants = {}
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
    if product.sales_price == nil and product.price ~= nil then
        product.sales_price = product.price
        product.price = nil
    end

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
    local variants, _ = potato.db.find_all_by_cond("ProductVariants", {
        product_id = product_id,
        is_deleted = 0
    })
    product.variants = variants or {}
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
    variant.product_id = product_id
    variant.created_by = userId
    variant.updated_by = userId
    variant.is_deleted = 0
    if variant.sales_price == nil and variant.price ~= nil then
        variant.sales_price = variant.price
        variant.price = nil
    end

    local id, err = potato.db.insert("ProductVariants", variant)
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
    variant.updated_by = userId
    if variant.sales_price == nil and variant.price ~= nil then
        variant.sales_price = variant.price
        variant.price = nil
    end

    local err = potato.db.update_by_id("ProductVariants", variant_id, variant)
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