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
            message = "Cimple Table has already been initialized (version: 26-7-alpha)."
        })
    else
        req.json(200, {
            initialized = false,
            message = "System not initialized."
        })
    end
end

-- HELPER FUNCTIONS FOR DDL & PHYSICAL TABLES

local _unpack = table.unpack or unpack

local function normalize_timestamp(val)
    if val == nil then return "" end
    local t = type(val)
    if t == "string" then
        if string.sub(val, 1, 7) == "table: " then
            return ""
        end
        return val
    elseif t == "number" then
        return os.date("!%Y-%m-%d %H:%M:%SZ", val)
    elseif t == "table" then
        if val.year and val.month and val.day then
            return string.format("%04d-%02d-%02d %02d:%02d:%02d",
                val.year, val.month, val.day,
                val.hour or 0, val.min or 0, val.sec or 0)
        end
        return ""
    end
    return ""
end


local function sql_type_for_column(col_type)
    if col_type == "number" or col_type == "ref" or col_type == "percent" or col_type == "rating" or col_type == "duration" then
        return "NUMERIC DEFAULT NULL"
    elseif col_type == "checkbox" then
        return "INTEGER DEFAULT 0"
    else
        return "TEXT DEFAULT ''"
    end
end

local function format_column_value(col, raw_val)
    if raw_val == nil then return nil end
    if col.column_type == "duration" or col.column_type == "number" then
        if raw_val == "" then
            return nil
        end
        local num = tonumber(raw_val)
        if num ~= nil then
            return num
        end
    end
    return raw_val
end

local function generate_column_slug(table_id, name)
    local slug = string.lower(name or "")
    slug = string.gsub(slug, "[^%w_]", "_")
    slug = string.gsub(slug, "^_+", "")
    slug = string.gsub(slug, "_+$", "")
    
    local reserved = {
        id = true,
        created_at = true,
        updated_at = true,
        table_id = true,
        row_id = true,
        ["order"] = true,
        ["group"] = true,
        ["table"] = true,
        ["select"] = true,
        ["where"] = true,
        ["from"] = true,
        ["desc"] = true,
        ["asc"] = true,
        ["limit"] = true,
        ["offset"] = true,
        ["index"] = true,
        ["primary"] = true,
        ["key"] = true,
        ["check"] = true
    }

    if slug == "" or reserved[slug] then
        slug = "col"
    end

    local existing_cols, _ = potato.db.find_all_by_cond("DatatableColumns", {
        table_id = table_id
    })
    local used = {}
    if existing_cols ~= nil and type(existing_cols) == "table" then
        for _, c in ipairs(existing_cols) do
            if c.slug ~= nil and c.slug ~= "" then
                used[c.slug] = true
            end
        end
    end

    local candidate = slug
    local suffix = 1
    while used[candidate] do
        suffix = suffix + 1
        candidate = slug .. "_" .. tostring(suffix)
    end
    return candidate
end

local function seed_table_group(userId, group, with_seed)
    if group == nil or group.tables == nil or #group.tables == 0 then
        return
    end

    local created_map = {}
    local created_cols = {}

    -- Pass 1: Create all datatables and their physical Actual<id> tables
    for _, tbl in ipairs(group.tables) do
        local datatable = {
            name = tbl.name or "",
            info = tbl.description or tbl.info or "",
            icon = tbl.icon or "table",
            color = tbl.color or group.color or "blue",
            default_order = (tbl.default_order == "newest") and "newest" or "oldest",
            is_deleted = 0
        }
        local id, err = potato.db.insert("Datatables", datatable)
        if id ~= nil then
            if tbl.id ~= nil then
                created_map[tbl.id] = id
            end
            created_map[tbl.name] = id

            local table_name = "Actual" .. tostring(id)
            local ddl = string.format([[
                CREATE TABLE IF NOT EXISTS %s (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            ]], table_name)
            potato.db.run_ddl(ddl)
            potato.db.run_ddl(string.format("CREATE INDEX IF NOT EXISTS idx_%s_updated_at ON %s (updated_at);", table_name, table_name))
        end
    end

    -- Pass 2: Create columns and wire up relational references
    for _, tbl in ipairs(group.tables) do
        local table_id = created_map[tbl.id] or created_map[tbl.name]
        if table_id ~= nil and tbl.columns ~= nil then
            created_cols[table_id] = {}
            for col_idx, col in ipairs(tbl.columns) do
                local slug = generate_column_slug(table_id, col.name)
                local options = col.options or ""

                if (col.column_type == "ref" or col.column_type == "multiref") and col.target_group_table then
                    local target_id = created_map[col.target_group_table]
                    if target_id ~= nil then
                        local target_col = col.target_column or "name"
                        options = string.format('{"target_table_id":%d,"identity_column":"%s"}', target_id, target_col)
                    end
                end

                local col_data = {
                    table_id = table_id,
                    name = col.name or "",
                    slug = slug,
                    column_type = col.column_type or "text",
                    icon = col.icon or "",
                    order_index = col_idx,
                    info = col.info or "",
                    required = (col.required == true or col.required == 1) and 1 or 0,
                    options = options
                }

                potato.db.insert("DatatableColumns", col_data)

                if col.column_type ~= "reverse_ref" then
                    local col_type_sql = sql_type_for_column(col.column_type)
                    local ddl = string.format("ALTER TABLE Actual%s ADD COLUMN %s %s", tostring(table_id), slug, col_type_sql)
                    potato.db.run_ddl(ddl)
                end

                table.insert(created_cols[table_id], {
                    name = col.name,
                    slug = slug,
                    column_type = col.column_type,
                    target_group_table = col.target_group_table
                })
            end
        end
    end

    -- Pass 3: Static seed data insertion with relational reference resolution
    if with_seed == true then
        local created_row_ids = {}
        for _, tbl in ipairs(group.tables) do
            if tbl.id ~= nil then
                created_row_ids[tbl.id] = {}
            end
            created_row_ids[tbl.name] = {}
        end

        local now_ts = os.date("!%Y-%m-%d %H:%M:%SZ")

        for _, tbl in ipairs(group.tables) do
            local table_id = created_map[tbl.id] or created_map[tbl.name]
            local cols = (table_id and created_cols[table_id]) or {}

            if table_id ~= nil and tbl.rows ~= nil and type(tbl.rows) == "table" then
                for _, seed_row in ipairs(tbl.rows) do
                    local new_row = {
                        created_at = now_ts,
                        updated_at = now_ts
                    }

                    for _, col in ipairs(cols) do
                        if col.column_type ~= "reverse_ref" and col.slug and col.slug ~= "" then
                            local raw_val = nil
                            if seed_row[col.name] ~= nil then
                                raw_val = seed_row[col.name]
                            elseif seed_row[col.slug] ~= nil then
                                raw_val = seed_row[col.slug]
                            end

                            if raw_val ~= nil then
                                if col.column_type == "ref" and col.target_group_table ~= nil then
                                    local target_ref_list = created_row_ids[col.target_group_table]
                                    local ref_idx = tonumber(raw_val)
                                    if ref_idx ~= nil and target_ref_list ~= nil and target_ref_list[ref_idx] ~= nil then
                                        raw_val = target_ref_list[ref_idx]
                                    end
                                elseif col.column_type == "multiref" and col.target_group_table ~= nil then
                                    local target_ref_list = created_row_ids[col.target_group_table]
                                    if target_ref_list ~= nil then
                                        if type(raw_val) == "table" then
                                            local resolved = {}
                                            for _, item in ipairs(raw_val) do
                                                local ref_idx = tonumber(item)
                                                if ref_idx ~= nil and target_ref_list[ref_idx] ~= nil then
                                                    table.insert(resolved, tostring(target_ref_list[ref_idx]))
                                                else
                                                    table.insert(resolved, tostring(item))
                                                end
                                            end
                                            raw_val = table.concat(resolved, ",")
                                        elseif type(raw_val) == "number" and target_ref_list[raw_val] ~= nil then
                                            raw_val = tostring(target_ref_list[raw_val])
                                        end
                                    end
                                end

                                if col.column_type == "checkbox" then
                                    new_row[col.slug] = (raw_val == true or raw_val == 1 or raw_val == "1") and 1 or 0
                                else
                                    new_row[col.slug] = format_column_value(col, raw_val)
                                end
                            end
                        end
                    end

                    local row_id, _ = potato.db.insert("Actual" .. tostring(table_id), new_row)
                    if row_id ~= nil then
                        if tbl.id ~= nil and created_row_ids[tbl.id] ~= nil then
                            table.insert(created_row_ids[tbl.id], row_id)
                        end
                        if created_row_ids[tbl.name] ~= nil then
                            table.insert(created_row_ids[tbl.name], row_id)
                        end
                    end
                end
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
            message = "Cimple Table has already been initialized (version: 26-7-alpha)."
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
        print("DDL notice: " .. tostring(ddlerr))
    end

    local body = req.bind_json() or {}
    local template_key = body.template or "school-attendance"
    local with_seed = (body.seed_data == true or body.seed == true or body.seed_with_data == true)

    if template_key ~= "blank" then
        local templates_mod = require("./server/templates")
        local group = body.group or templates_mod.get_template(template_key)
        if group ~= nil then
            seed_table_group(userId, group, with_seed)
        end
    end

    -- Record initialization in spacekv
    space_kv_upsert("SYSTEM", "INIT_VERSION", { value = "26-7-alpha" })
    space_kv_upsert("", "INIT_VERSION", { value = "26-7-alpha" })

    req.json(200, {
        success = true,
        initialized = true,
        version = "26-7-alpha",
        template = template_key,
        seeded = with_seed,
        message = "Cimple Table initialized successfully with template: " .. template_key
    })
end

function run_schema_sql(ctx)
    return init_app(ctx)
end

local function get_existing_table_columns(table_name)
    local col_set = {}
    local cols = potato.db.list_columns(table_name)
    if cols ~= nil and type(cols) == "table" and #cols > 0 then
        for _, c in ipairs(cols) do
            local name = c.Name or c.name
            if name ~= nil then
                col_set[string.lower(name)] = true
            end
        end
        return col_set
    end

    -- Fallback via PRAGMA
    local pragma_rows, _ = potato.db.run_query("PRAGMA table_info(" .. table_name .. ")")
    if pragma_rows ~= nil and type(pragma_rows) == "table" then
        for _, r in ipairs(pragma_rows) do
            local name = r.name or r.Name
            if name ~= nil then
                col_set[string.lower(name)] = true
            end
        end
    end

    return col_set
end

local function get_table_columns(table_id)
    local n_id = tonumber(table_id)
    local s_id = tostring(table_id)
    local columns = nil
    if n_id ~= nil then
        columns, _ = potato.db.find_all_by_cond("DatatableColumns", {
            table_id = n_id
        })
    end
    if columns == nil or #columns == 0 then
        columns, _ = potato.db.find_all_by_cond("DatatableColumns", {
            table_id = s_id
        })
    end
    return columns or {}
end


local function get_table_rows(table_id, cols_array)

    local actual_list, _ = potato.db.find_all_by_cond("Actual" .. tostring(table_id), {})
    if actual_list == nil or type(actual_list) ~= "table" then
        return {}
    end

    local rows = {}
    for _, arow in ipairs(actual_list) do
        local r = {
            id = tonumber(arow.id) or arow.id,
            created_at = normalize_timestamp(arow.created_at),
            updated_at = normalize_timestamp(arow.updated_at)
        }
        for _, col in ipairs(cols_array) do
            if col.slug and col.slug ~= "" then
                r[col.slug] = arow[col.slug] or ""
            end
        end

        table.insert(rows, r)
    end

    return rows
end


-- DATATABLES CRUD

function list_datatables(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local datatables, err = potato.db.find_all_by_cond("Datatables", {
        is_deleted = 0
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    if datatables ~= nil and type(datatables) == "table" then
        for _, dt in ipairs(datatables) do
            dt.created_at = normalize_timestamp(dt.created_at)
            dt.updated_at = normalize_timestamp(dt.updated_at)
            dt.default_order = dt.default_order or "oldest"
        end
    end
    req.json_array(200, datatables)
end

function create_datatable(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    local datatable = {
        name = data.name or "",
        info = data.info or "",
        icon = data.icon or "table",
        color = data.color or "",
        default_order = (data.default_order == "newest") and "newest" or "oldest",
        is_deleted = 0
    }
    
    local id, err = potato.db.insert("Datatables", datatable)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    -- Run DDL to create physical table Actual<table_id>
    local table_name = "Actual" .. tostring(id)
    local ddl = string.format([[
        CREATE TABLE IF NOT EXISTS %s (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ]], table_name)
    local _, ddl_err = potato.db.run_ddl(ddl)
    if ddl_err ~= nil then
        print("Warning: CREATE TABLE " .. table_name .. " error:", ddl_err)
    end
    potato.db.run_ddl(string.format("CREATE INDEX IF NOT EXISTS idx_%s_updated_at ON %s (updated_at);", table_name, table_name))
    
    local result, fetch_err = potato.db.find_by_id("Datatables", id)
    if fetch_err ~= nil or result == nil then
        datatable.id = id
        result = datatable
    end
    if result ~= nil then
        result.created_at = normalize_timestamp(result.created_at)
        result.updated_at = normalize_timestamp(result.updated_at)
    end
    req.json(200, result)
end

function get_datatable(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local datatable, err = potato.db.find_by_id("Datatables", table_id)
    if err ~= nil or datatable == nil then
        req.json(404, {
            error = "Datatable not found"
        })
        return
    end

    if datatable.is_deleted == 1 then
        req.json(404, {
            error = "Datatable not found"
        })
        return
    end

    datatable.created_at = normalize_timestamp(datatable.created_at)
    datatable.updated_at = normalize_timestamp(datatable.updated_at)
    datatable.default_order = datatable.default_order or "oldest"

    -- Get columns
    local columns, cols_err = potato.db.find_all_by_cond("DatatableColumns", {
        table_id = table_id
    })
    local cols_array = {}
    if cols_err == nil and columns ~= nil and type(columns) == "table" then
        for i, col in ipairs(columns) do
            if col.slug == nil or col.slug == "" then
                col.slug = generate_column_slug(table_id, col.name)
                potato.db.update_by_id("DatatableColumns", col.id, { slug = col.slug })
            end
            table.insert(cols_array, col)
        end
        datatable.columns = cols_array
    else
        datatable.columns = {}
    end

    datatable.rows = get_table_rows(table_id, cols_array)

    req.json(200, datatable)
end

function update_datatable(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local data = req.bind_json()
    local updates = {}
    if data.name ~= nil then updates.name = data.name end
    if data.info ~= nil then updates.info = data.info end
    if data.icon ~= nil then updates.icon = data.icon end
    if data.color ~= nil then updates.color = data.color end
    if data.default_order ~= nil then
        updates.default_order = (data.default_order == "newest") and "newest" or "oldest"
    end

    local err = potato.db.update_by_id("Datatables", table_id, updates)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local result, err = potato.db.find_by_id("Datatables", table_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    if result ~= nil then
        result.created_at = normalize_timestamp(result.created_at)
        result.updated_at = normalize_timestamp(result.updated_at)
        result.default_order = result.default_order or "oldest"
    end
    req.json(200, result)
end

function delete_datatable(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    -- Soft delete
    local err = potato.db.update_by_id("Datatables", table_id, {
        is_deleted = 1
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, {
        message = "Datatable deleted"
    })
end

-- DATATABLE COLUMNS CRUD

function list_columns(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local columns, err = potato.db.find_all_by_cond("DatatableColumns", {
        table_id = table_id
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local cols_array = {}
    if columns ~= nil and type(columns) == "table" then
        for _, col in ipairs(columns) do
            if col.slug == nil or col.slug == "" then
                col.slug = generate_column_slug(table_id, col.name)
                potato.db.update_by_id("DatatableColumns", col.id, { slug = col.slug })
            end
            table.insert(cols_array, col)
        end
    end

    req.json_array(200, cols_array)
end

function create_column(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if data.table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local table_id = tonumber(data.table_id)

    local slug = data.slug
    if slug == nil or slug == "" then
        slug = generate_column_slug(table_id, data.name or "")
    end

    local column = {
        table_id = table_id,
        name = data.name or "",
        slug = slug,
        column_type = data.column_type or "text",
        icon = data.icon or "",
        order_index = data.order_index or 0,
        info = data.info or "",
        required = data.required == true or false,
        options = data.options or ""
    }
    
    local id, err = potato.db.insert("DatatableColumns", column)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    if column.column_type ~= "reverse_ref" then
        -- Run DDL to add column to Actual<table_id>
        local col_type_sql = sql_type_for_column(column.column_type)
        local ddl = string.format("ALTER TABLE Actual%s ADD COLUMN %s %s", tostring(table_id), slug, col_type_sql)
        local _, ddl_err = potato.db.run_ddl(ddl)
        if ddl_err ~= nil then
            print("Warning: ALTER TABLE ADD COLUMN error:", ddl_err)
        end
    end
    
    local result, fetch_err = potato.db.find_by_id("DatatableColumns", id)
    if fetch_err ~= nil or result == nil then
        column.id = id
        result = column
    end
    req.json(200, result)
end

function update_column(ctx, column_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if column_id == nil then
        req.json(400, {
            error = "column_id is required"
        })
        return
    end

    local data = req.bind_json()
    local updates = {}
    if data.name ~= nil then updates.name = data.name end
    if data.column_type ~= nil then updates.column_type = data.column_type end
    if data.icon ~= nil then updates.icon = data.icon end
    if data.info ~= nil then updates.info = data.info end
    if data.required ~= nil then updates.required = data.required == true or false end
    if data.options ~= nil then updates.options = data.options end
    if data.order_index ~= nil then updates.order_index = data.order_index end

    local err = potato.db.update_by_id("DatatableColumns", column_id, updates)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local result, fetch_err = potato.db.find_by_id("DatatableColumns", column_id)
    if fetch_err ~= nil then
        req.json(400, {
            error = tostring(fetch_err)
        })
        return
    end
    req.json(200, result)
end

function delete_column(ctx, column_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if column_id == nil then
        req.json(400, {
            error = "column_id is required"
        })
        return
    end

    local col, err = potato.db.find_by_id("DatatableColumns", column_id)
    if col ~= nil then
        local slug = col.slug
        local table_id = col.table_id

        -- Run DDL to drop column from Actual<table_id>
        if slug ~= nil and slug ~= "" then
            local ddl = string.format("ALTER TABLE Actual%s DROP COLUMN %s", tostring(table_id), slug)
            local _, ddl_err = potato.db.run_ddl(ddl)
            if ddl_err ~= nil then
                print("Warning: ALTER TABLE DROP COLUMN error:", ddl_err)
            end
        end
        potato.db.delete_by_id("DatatableColumns", column_id)
    end

    req.json(200, {
        message = "Column deleted"
    })
end

-- DATATABLE ROWS CRUD

function query_datatable(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, { error = "table_id is required" })
        return
    end

    local n_tid = tonumber(table_id) or table_id
    local dt, err = potato.db.find_by_id("Datatables", n_tid)
    if err ~= nil or dt == nil or dt.is_deleted == 1 then
        req.json(404, { error = "Datatable not found" })
        return
    end

    local data = req.bind_json() or {}
    local offset = tonumber(data.offset) or 0
    if offset < 0 then offset = 0 end
    local limit = tonumber(data.limit) or 100
    if limit < 1 then limit = 100 end
    if limit > 500 then limit = 500 end

    -- Fetch valid columns for whitelist
    local columns = get_table_columns(n_tid)
    local allowed_cols = { id = true, created_at = true, updated_at = true }
    local cols_array = {}
    local text_cols = {}

    if columns ~= nil and type(columns) == "table" then
        for _, col in ipairs(columns) do
            local slug = col.slug
            if slug == nil or slug == "" then
                slug = generate_column_slug(n_tid, col.name)
                col.slug = slug
                potato.db.update_by_id("DatatableColumns", col.id, { slug = slug })
            end
            if col.column_type ~= "reverse_ref" then
                allowed_cols[slug] = true
            end
            table.insert(cols_array, col)
            if col.column_type == "text" or col.column_type == "textarea" or col.column_type == "link" or col.column_type == "image" or col.column_type == "file" or col.column_type == "email" or col.column_type == "barcode" or col.column_type == "datetime" or col.column_type == "date_time" or col.column_type == "date" or col.column_type == "time" then
                table.insert(text_cols, slug)
            end
        end
    end

    local actual_tbl = "Actual" .. tostring(n_tid)

    -- Build WHERE conditions
    local where_clauses = {}
    local where_params = {}

    -- 1. Structured Filters (Single or Multiple)
    local function apply_filter_item(f)
        if type(f) ~= "table" then return end
        local col = f.column
        local op = f.op or "contains"
        local val = tostring(f.value or "")

        if col and allowed_cols[col] then
            if op == "empty" then
                table.insert(where_clauses, "(" .. col .. " IS NULL OR " .. col .. " = '')")
            elseif op == "not_empty" then
                table.insert(where_clauses, "(" .. col .. " IS NOT NULL AND " .. col .. " != '')")
            elseif op == "contains" and val ~= "" then
                table.insert(where_clauses, "LOWER(" .. col .. ") LIKE ?")
                table.insert(where_params, "%" .. string.lower(val) .. "%")
            elseif op == "not_contains" and val ~= "" then
                table.insert(where_clauses, "(LOWER(" .. col .. ") NOT LIKE ? OR " .. col .. " IS NULL)")
                table.insert(where_params, "%" .. string.lower(val) .. "%")
            elseif op == "equals" and val ~= "" then
                table.insert(where_clauses, "LOWER(" .. col .. ") = LOWER(?)")
                table.insert(where_params, val)
            elseif op == "not_equals" and val ~= "" then
                table.insert(where_clauses, "(LOWER(" .. col .. ") != LOWER(?) OR " .. col .. " IS NULL)")
                table.insert(where_params, val)
            elseif (op == "gt" or op == "gte" or op == "lt" or op == "lte") and val ~= "" then
                local sql_op = ">"
                if op == "gte" then sql_op = ">="
                elseif op == "lt" then sql_op = "<"
                elseif op == "lte" then sql_op = "<="
                end
                local num_val = tonumber(val)
                if num_val ~= nil then
                    table.insert(where_clauses, "CAST(" .. col .. " AS NUMERIC) " .. sql_op .. " ?")
                    table.insert(where_params, num_val)
                else
                    table.insert(where_clauses, col .. " " .. sql_op .. " ?")
                    table.insert(where_params, val)
                end
            end
        end
    end

    if data.filters and type(data.filters) == "table" then
        for _, f in ipairs(data.filters) do
            apply_filter_item(f)
        end
    elseif data.filter and type(data.filter) == "table" then
        if data.filter[1] ~= nil then
            for _, f in ipairs(data.filter) do
                apply_filter_item(f)
            end
        else
            apply_filter_item(data.filter)
        end
    end

    -- 2. General Search
    if data.search and type(data.search) == "string" and data.search ~= "" then
        local q = "%" .. string.lower(data.search) .. "%"
        local search_parts = {}
        local targets = #text_cols > 0 and text_cols or {}
        if #targets == 0 then
            for _, col in ipairs(cols_array) do
                if col.slug and col.slug ~= "" then
                    table.insert(targets, col.slug)
                end
            end
        end
        for _, col in ipairs(targets) do
            table.insert(search_parts, "LOWER(" .. col .. ") LIKE ?")
            table.insert(where_params, q)
        end
        if #search_parts > 0 then
            table.insert(where_clauses, "(" .. table.concat(search_parts, " OR ") .. ")")
        end
    end

    local where_sql = ""
    if #where_clauses > 0 then
        where_sql = " WHERE " .. table.concat(where_clauses, " AND ")
    end

    -- Count Query
    local count_sql = "SELECT COUNT(*) as total FROM " .. actual_tbl .. where_sql
    local count_res, count_err
    if #where_params > 0 then
        count_res, count_err = potato.db.run_query_one(count_sql, _unpack(where_params))
    else
        count_res, count_err = potato.db.run_query_one(count_sql)
    end

    local total = 0
    if count_res ~= nil then
        total = tonumber(count_res.total) or tonumber(count_res["COUNT(*)"]) or 0
    end

    -- Order By: default depends on dt.default_order ("newest" -> id DESC, otherwise id ASC)
    local default_dir = "ASC"
    if dt.default_order and string.lower(dt.default_order) == "newest" then
        default_dir = "DESC"
    end

    local order_col = "id"
    local order_dir = default_dir
    if data.sort and type(data.sort) == "table" then
        local sc = data.sort.column
        if sc and allowed_cols[sc] then
            order_col = sc
            if data.sort.dir and string.lower(data.sort.dir) == "desc" then
                order_dir = "DESC"
            else
                order_dir = "ASC"
            end
        end
    end

    local order_sql
    if order_col == "id" then
        order_sql = " ORDER BY id " .. order_dir
    else
        order_sql = " ORDER BY " .. order_col .. " " .. order_dir .. ", id ASC"
    end

    -- Data Query with limit & offset
    local data_sql = "SELECT * FROM " .. actual_tbl .. where_sql .. order_sql .. " LIMIT " .. tostring(limit) .. " OFFSET " .. tostring(offset)
    local query_rows, query_err
    if #where_params > 0 then
        query_rows, query_err = potato.db.run_query(data_sql, _unpack(where_params))
    else
        query_rows, query_err = potato.db.run_query(data_sql)
    end

    if query_err ~= nil then
        print("query_datatable query_err:", query_err, "data_sql:", data_sql)
    end

    local rows = {}
    if query_rows ~= nil and type(query_rows) == "table" then
        for _, arow in ipairs(query_rows) do
            local r = {
                id = tonumber(arow.id) or arow.id,
                created_at = normalize_timestamp(arow.created_at),
                updated_at = normalize_timestamp(arow.updated_at)
            }
            for _, col in ipairs(cols_array) do
                if col.slug and col.slug ~= "" then
                    r[col.slug] = arow[col.slug] or ""
                end
            end
            table.insert(rows, r)
        end
    else
        local all_rows = get_table_rows(n_tid, cols_array)
        total = #all_rows
        rows = {}
        for i = offset + 1, math.min(offset + limit, #all_rows) do
            table.insert(rows, all_rows[i])
        end
    end

    local last_updated = ""
    local last_res, _ = potato.db.run_query_one("SELECT CAST(COALESCE(MAX(updated_at), '') AS TEXT) as last_updated FROM " .. actual_tbl)
    if last_res ~= nil and last_res.last_updated ~= nil then
        last_updated = normalize_timestamp(last_res.last_updated)
    end
    local meta_res, _ = potato.db.run_query_one("SELECT CAST(COALESCE(updated_at, '') AS TEXT) as updated_at FROM Datatables WHERE id = ?", n_tid)
    if meta_res ~= nil and meta_res.updated_at ~= nil then
        local meta_updated = normalize_timestamp(meta_res.updated_at)
        if meta_updated > last_updated then
            last_updated = meta_updated
        end
    end

    req.json(200, {
        rows = rows,
        total = total,
        offset = offset,
        limit = limit,
        last_updated = last_updated
    })
end

function get_table_last_updated(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local n_tid = tonumber(table_id) or table_id
    local actual_tbl = "Actual" .. tostring(n_tid)

    local last_updated = ""
    local last_res, _ = potato.db.run_query_one("SELECT CAST(COALESCE(MAX(updated_at), '') AS TEXT) as last_updated FROM " .. actual_tbl)
    if last_res ~= nil and last_res.last_updated ~= nil then
        last_updated = normalize_timestamp(last_res.last_updated)
    end

    local meta_res, _ = potato.db.run_query_one("SELECT CAST(COALESCE(updated_at, '') AS TEXT) as updated_at FROM Datatables WHERE id = ?", n_tid)
    if meta_res ~= nil and meta_res.updated_at ~= nil then
        local meta_updated = normalize_timestamp(meta_res.updated_at)
        if meta_updated > last_updated then
            last_updated = meta_updated
        end
    end

    req.json(200, {
        table_id = n_tid,
        last_updated = last_updated
    })
end

function resolve_ref_ids(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json() or {}
    local tid = table_id or data.table_id or ctx.query("table_id")
    if tid == nil then
        req.json(400, { error = "table_id is required" })
        return
    end

    local n_tid = tonumber(tid) or tid
    local ids = data.ids or {}
    if type(ids) ~= "table" or #ids == 0 then
        req.json(200, {
            table_id = n_tid,
            rows = {}
        })
        return
    end

    local valid_ids = {}
    local seen = {}
    for _, id_val in ipairs(ids) do
        local n = tonumber(id_val)
        if n ~= nil and not seen[n] then
            seen[n] = true
            table.insert(valid_ids, n)
        end
    end

    if #valid_ids == 0 then
        req.json(200, {
            table_id = n_tid,
            rows = {}
        })
        return
    end

    local columns = get_table_columns(n_tid)
    local cols_array = {}
    if columns ~= nil and type(columns) == "table" then
        for _, col in ipairs(columns) do
            if col.slug and col.slug ~= "" then
                table.insert(cols_array, col)
            end
        end
    end

    local placeholders = {}
    for i = 1, #valid_ids do
        table.insert(placeholders, "?")
    end
    local in_clause = table.concat(placeholders, ", ")
    local actual_tbl = "Actual" .. tostring(n_tid)
    local sql = string.format("SELECT * FROM %s WHERE id IN (%s)", actual_tbl, in_clause)

    local query_rows, err = potato.db.run_query(sql, _unpack(valid_ids))
    local result_rows = {}

    if query_rows ~= nil and type(query_rows) == "table" then
        for _, arow in ipairs(query_rows) do
            local r = {
                id = tonumber(arow.id) or arow.id,
                created_at = normalize_timestamp(arow.created_at),
                updated_at = normalize_timestamp(arow.updated_at)
            }
            for _, col in ipairs(cols_array) do
                r[col.slug] = arow[col.slug] or ""
            end
            table.insert(result_rows, r)
        end
    end

    req.json(200, {
        table_id = n_tid,
        rows = result_rows
    })
end

function resolve_reverse_refs(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json() or {}
    local target_table_id = tonumber(data.target_table_id)
    local target_column_slug = data.target_column_slug
    local row_ids = data.row_ids or {}

    if target_table_id == nil or target_column_slug == nil or target_column_slug == "" then
        req.json(400, { error = "target_table_id and target_column_slug are required" })
        return
    end

    if type(row_ids) ~= "table" or #row_ids == 0 then
        req.json(200, {
            target_table_id = target_table_id,
            target_column_slug = target_column_slug,
            mapping = {},
            rows = {}
        })
        return
    end

    local valid_ids = {}
    local seen = {}
    for _, id_val in ipairs(row_ids) do
        local n = tonumber(id_val)
        if n ~= nil and not seen[n] then
            seen[n] = true
            table.insert(valid_ids, n)
        end
    end

    if #valid_ids == 0 then
        req.json(200, {
            target_table_id = target_table_id,
            target_column_slug = target_column_slug,
            mapping = {},
            rows = {}
        })
        return
    end

    local target_columns = get_table_columns(target_table_id)
    local target_cols_array = {}
    local target_col_def = nil
    if target_columns ~= nil and type(target_columns) == "table" then
        for _, col in ipairs(target_columns) do
            if col.slug and col.slug ~= "" then
                table.insert(target_cols_array, col)
                if col.slug == target_column_slug then
                    target_col_def = col
                end
            end
        end
    end

    -- Determine query strategy based on column type
    local is_multi = false
    if target_col_def ~= nil and (target_col_def.column_type == "multiref" or target_col_def.column_type == "text") then
        is_multi = true
    end

    local query_rows = nil
    local query_err = nil
    local actual_tbl = "Actual" .. tostring(target_table_id)

    if not is_multi then
        -- Single ref: use simple IN (?, ?, ...)
        local placeholders = {}
        for i = 1, #valid_ids do
            table.insert(placeholders, "?")
        end
        local in_clause = table.concat(placeholders, ", ")
        local sql = string.format("SELECT * FROM %s WHERE %s IN (%s)", actual_tbl, target_column_slug, in_clause)
        query_rows, query_err = potato.db.run_query(sql, _unpack(valid_ids))
    else
        -- Multi ref: target column can be single ID, comma-separated "1,2", or "[1, 2]"
        local clauses = {}
        local params = {}
        for _, id in ipairs(valid_ids) do
            local s_id = tostring(id)
            table.insert(clauses, string.format(
                "(%s = ? OR %s LIKE ? OR %s LIKE ? OR %s LIKE ?)",
                target_column_slug, target_column_slug, target_column_slug, target_column_slug
            ))
            table.insert(params, s_id)
            table.insert(params, s_id .. ",%")
            table.insert(params, "%," .. s_id)
            table.insert(params, "%," .. s_id .. ",%")
        end
        local sql = string.format("SELECT * FROM %s WHERE %s", actual_tbl, table.concat(clauses, " OR "))
        query_rows, query_err = potato.db.run_query(sql, _unpack(params))
    end

    if query_err ~= nil then
        print("resolve_reverse_refs query_err:", query_err)
    end

    -- Helper to check if a row value contains a specific id
    local function row_matches_id(val, check_id)
        if val == nil then return false end
        if type(val) == "number" then
            return val == check_id
        end
        local s = tostring(val):gsub("%s+", "")
        if s == tostring(check_id) then return true end
        for part in string.gmatch(s, "([^,]+)") do
            part = part:gsub("[^%d]", "")
            if tonumber(part) == check_id then
                return true
            end
        end
        return false
    end

    local mapping = {}
    for _, id in ipairs(valid_ids) do
        mapping[tostring(id)] = {}
    end

    local result_rows = {}
    local seen_rows = {}

    if query_rows ~= nil and type(query_rows) == "table" then
        for _, arow in ipairs(query_rows) do
            local r_id = tonumber(arow.id) or arow.id
            if not seen_rows[r_id] then
                seen_rows[r_id] = true
                local r = {
                    id = r_id,
                    created_at = arow.created_at or "",
                    updated_at = arow.updated_at or ""
                }
                for _, col in ipairs(target_cols_array) do
                    r[col.slug] = arow[col.slug] or ""
                end
                table.insert(result_rows, r)
            end

            local raw_val = arow[target_column_slug]
            for _, id in ipairs(valid_ids) do
                if row_matches_id(raw_val, id) then
                    table.insert(mapping[tostring(id)], r_id)
                end
            end
        end
    end

    req.json(200, {
        target_table_id = target_table_id,
        target_column_slug = target_column_slug,
        mapping = mapping,
        rows = result_rows
    })
end

function seed_datatable_rows(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, { error = "table_id is required" })
        return
    end

    local n_tid = tonumber(table_id) or table_id
    local dt, err = potato.db.find_by_id("Datatables", n_tid)
    if err ~= nil or dt == nil or dt.is_deleted == 1 then
        req.json(404, { error = "Datatable not found" })
        return
    end

    local data = req.bind_json() or {}
    local rows_input = data.rows or {}
    local columns = get_table_columns(n_tid)

    local inserted_count = 0
    local now_ts = os.date("!%Y-%m-%d %H:%M:%SZ")
    for _, r in ipairs(rows_input) do
        local new_row = {
            created_at = now_ts,
            updated_at = now_ts
        }
        for _, col in ipairs(columns) do
            if col.column_type ~= "reverse_ref" and col.slug and col.slug ~= "" and r[col.slug] ~= nil then
                new_row[col.slug] = r[col.slug]
            end
        end
        local _, err = potato.db.insert("Actual" .. tostring(n_tid), new_row)
        if err == nil then
            inserted_count = inserted_count + 1
        end
    end

    if inserted_count > 0 then
        potato.db.update_by_id("Datatables", n_tid, {
            updated_at = now_ts
        })
    end

    req.json(200, {
        success = true,
        inserted = inserted_count,
        total_requested = #rows_input
    })
end

function list_rows(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local columns = get_table_columns(table_id)
    local cols_array = {}
    if columns ~= nil and type(columns) == "table" then
        for _, col in ipairs(columns) do
            if col.slug == nil or col.slug == "" then
                col.slug = generate_column_slug(table_id, col.name)
                potato.db.update_by_id("DatatableColumns", col.id, { slug = col.slug })
            end
            table.insert(cols_array, col)
        end
    end

    local rows_array = get_table_rows(table_id, cols_array)
    req.json_array(200, rows_array)
end

function create_row(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if data.table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local table_id = tonumber(data.table_id) or data.table_id

    local columns = get_table_columns(table_id)
    local col_map_by_id = {}
    for _, col in ipairs(columns) do
        col_map_by_id[tonumber(col.id) or col.id] = col.slug
    end

    local now_ts = os.date("!%Y-%m-%d %H:%M:%SZ")
    local new_row = {
        created_at = now_ts,
        updated_at = now_ts
    }

    -- Accept row values by column slug (data.task or data.data.task)
    local source = data.data or data
    for _, col in ipairs(columns) do
        if col.column_type ~= "reverse_ref" and col.slug and col.slug ~= "" and source[col.slug] ~= nil then
            new_row[col.slug] = format_column_value(col, source[col.slug])
        end
    end

    -- If submitted as cells array [{ column_id, value }]
    if data.cells ~= nil and type(data.cells) == "table" then
        for _, c in ipairs(data.cells) do
            local c_id = tonumber(c.column_id) or c.column_id
            local col_obj = nil
            for _, col in ipairs(columns) do
                if (tonumber(col.id) or col.id) == c_id then
                    col_obj = col
                    break
                end
            end
            if col_obj and col_obj.column_type ~= "reverse_ref" and col_obj.slug and col_obj.slug ~= "" then
                new_row[col_obj.slug] = format_column_value(col_obj, c.value)
            end
        end
    end

    local row_id, err = potato.db.insert("Actual" .. tostring(table_id), new_row)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    potato.db.update_by_id("Datatables", tonumber(table_id) or table_id, {
        updated_at = now_ts
    })

    row_id = tonumber(row_id) or row_id
    local actual_rec, _ = potato.db.find_by_id("Actual" .. tostring(table_id), row_id)
    if actual_rec == nil then
        actual_rec = new_row
        actual_rec.id = row_id
    end

    local result = {
        id = tonumber(actual_rec.id) or actual_rec.id,
        created_at = normalize_timestamp(actual_rec.created_at),
        updated_at = normalize_timestamp(actual_rec.updated_at)
    }
    for _, col in ipairs(columns) do
        if col.slug and col.slug ~= "" then
            result[col.slug] = actual_rec[col.slug] or ""
        end
    end

    req.json(200, result)
end

function update_row(ctx, row_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if row_id == nil then
        req.json(400, {
            error = "row_id is required"
        })
        return
    end

    local n_row_id = tonumber(row_id) or row_id
    local data = req.bind_json()
    local table_id = tonumber(data.table_id) or data.table_id
    if table_id == nil then
        req.json(400, {
            error = "table_id is required"
        })
        return
    end

    local columns = get_table_columns(table_id)
    local col_map_by_id = {}
    for _, col in ipairs(columns) do
        col_map_by_id[tonumber(col.id) or col.id] = col.slug
    end

    local now_ts = os.date("!%Y-%m-%d %H:%M:%SZ")
    local updates = {
        updated_at = now_ts
    }

    -- Accept row values by column slug (data.task or data.data.task)
    local source = data.data or data
    for _, col in ipairs(columns) do
        if col.column_type ~= "reverse_ref" and col.slug and col.slug ~= "" and source[col.slug] ~= nil then
            updates[col.slug] = format_column_value(col, source[col.slug])
        end
    end

    -- If submitted as cells array [{ column_id, value }]
    if data.cells ~= nil and type(data.cells) == "table" then
        for _, c in ipairs(data.cells) do
            local c_id = tonumber(c.column_id) or c.column_id
            local col_obj = nil
            for _, col in ipairs(columns) do
                if (tonumber(col.id) or col.id) == c_id then
                    col_obj = col
                    break
                end
            end
            if col_obj and col_obj.column_type ~= "reverse_ref" and col_obj.slug and col_obj.slug ~= "" then
                updates[col_obj.slug] = format_column_value(col_obj, c.value)
            end
        end
    end

    potato.db.update_by_id("Actual" .. tostring(table_id), n_row_id, updates)
    potato.db.update_by_id("Datatables", tonumber(table_id) or table_id, {
        updated_at = now_ts
    })

    local actual_rec, _ = potato.db.find_by_id("Actual" .. tostring(table_id), n_row_id)
    if actual_rec == nil then
        actual_rec = updates
        actual_rec.id = n_row_id
    end

    local result = {
        id = tonumber(actual_rec.id) or actual_rec.id,
        created_at = normalize_timestamp(actual_rec.created_at),
        updated_at = normalize_timestamp(actual_rec.updated_at)
    }
    for _, col in ipairs(columns) do
        if col.slug and col.slug ~= "" then
            result[col.slug] = actual_rec[col.slug] or ""
        end
    end

    req.json(200, result)
end

function delete_row(ctx, row_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if row_id == nil then
        req.json(400, {
            error = "row_id is required"
        })
        return
    end

    local n_row_id = tonumber(row_id) or row_id
    local table_id = ctx.query("table_id")
    if table_id == nil or table_id == "" then
        local data = req.bind_json()
        if data and data.table_id then
            table_id = data.table_id
        end
    end

    local now_ts = os.date("!%Y-%m-%d %H:%M:%SZ")
    if table_id ~= nil and table_id ~= "" then
        potato.db.delete_by_id("Actual" .. tostring(table_id), n_row_id)
        potato.db.update_by_id("Datatables", tonumber(table_id) or table_id, {
            updated_at = now_ts
        })
    else
        local datatables, _ = potato.db.find_all_by_cond("Datatables", { is_deleted = 0 })
        if datatables ~= nil and type(datatables) == "table" then
            for _, dt in ipairs(datatables) do
                local rec, _ = potato.db.find_by_id("Actual" .. tostring(dt.id), n_row_id)
                if rec ~= nil then
                    potato.db.delete_by_id("Actual" .. tostring(dt.id), n_row_id)
                    potato.db.update_by_id("Datatables", dt.id, {
                        updated_at = now_ts
                    })
                    break
                end
            end
        end
    end

    req.json(200, {
        message = "Row deleted"
    })
end

-- DATATABLE CELLS CRUD

function update_cell(ctx, cell_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    req.json(200, {
        message = "Ok"
    })
end

function upsert_cell(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    local table_id = tonumber(data.table_id) or data.table_id
    local row_id = tonumber(data.row_id) or data.row_id
    local val = data.value or ""

    if table_id == nil or row_id == nil then
        req.json(400, {
            error = "table_id and row_id are required"
        })
        return
    end

    local slug = data.slug
    local column_id = data.column_id
    if (slug == nil or slug == "") and column_id ~= nil then
        local col = potato.db.find_by_id("DatatableColumns", tonumber(column_id) or column_id)
        if col ~= nil then
            slug = col.slug
        end
    end

    if slug == nil or slug == "" then
        req.json(400, {
            error = "slug or column_id is required"
        })
        return
    end

    local actual_rec, _ = potato.db.find_by_id("Actual" .. tostring(table_id), row_id)
    if actual_rec ~= nil then
        local u = {}
        u[slug] = val
        potato.db.update_by_id("Actual" .. tostring(table_id), row_id, u)
    else
        local rec = { id = row_id }
        rec[slug] = val
        potato.db.insert("Actual" .. tostring(table_id), rec)
    end

    req.json(200, {
        row_id = row_id,
        slug = slug,
        value = val
    })
end

-- RAW ACTUAL TABLE ENDPOINT
function get_actual_table_data(ctx, table_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    if table_id == nil then
        req.json(400, { error = "table_id is required" })
        return
    end

    local records, err = potato.db.find_all_by_cond("Actual" .. tostring(table_id), {})
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end
    req.json_array(200, records or {})
end

-- HTTP ENDPOINTS
function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method = ctx.param("method")

    print("on_http - path:", path, "method:", method)

    if path == "/run_schema_sql" and method == "POST" then
        return run_schema_sql(ctx)
    end

    local userId = get_user_id(req)
    if userId == nil then return end

    -- Initialization routes
    if path == "/init_status" and method == "GET" then
        return get_init_status(ctx)
    end

    if path == "/init_app" and method == "POST" then
        return init_app(ctx)
    end

    if path == "/templates" and method == "GET" then
        local templates_mod = require("./server/templates")
        local idx = templates_mod.get_template_index()
        req.json_array(200, idx)
        return
    end

    local tpl_match = string.match(path, "^/templates/([%w%-_]+)$")
    if tpl_match and method == "GET" then
        local templates_mod = require("./server/templates")
        local tpl = templates_mod.get_template(tpl_match)
        if tpl ~= nil then
            req.json(200, tpl)
        else
            req.json(404, { error = "Template not found" })
        end
        return
    end

    -- AutoDash routes
    if string.sub(path, 1, 9) == "/autodash" then
        local autodash = require("./server/autodash/autodash")
        return autodash.handle_routes(ctx, path, method)
    end

    -- AutoForm routes
    if string.sub(path, 1, 9) == "/autoform" then
        local autoform = require("./server/autoform/autoform")
        return autoform.handle_routes(ctx, path, method)
    end

    -- Datatables routes
    if path == "/datatables" and method == "GET" then
        return list_datatables(ctx)
    end

    if path == "/datatables" and method == "POST" then
        return create_datatable(ctx)
    end

    local actual_match = string.match(path, "^/datatables/(%d+)/actual$")
    if actual_match then
        local datatable_id = tonumber(actual_match)
        if datatable_id ~= nil and method == "GET" then
            return get_actual_table_data(ctx, datatable_id)
        end
    end

    local datatable_id_match = string.match(path, "^/datatables/(%d+)$")
    if datatable_id_match then
        local datatable_id = tonumber(datatable_id_match)
        if datatable_id ~= nil then
            if method == "GET" then
                return get_datatable(ctx, datatable_id)
            elseif method == "PUT" or method == "PATCH" then
                return update_datatable(ctx, datatable_id)
            elseif method == "DELETE" then
                return delete_datatable(ctx, datatable_id)
            end
        end
    end

    -- Columns routes
    local columns_match = string.match(path, "^/datatables/(%d+)/columns$")
    if columns_match then
        local table_id = tonumber(columns_match)
        if table_id ~= nil then
            if method == "GET" then
                return list_columns(ctx, table_id)
            end
        end
    end

    if path == "/columns" and method == "POST" then
        return create_column(ctx)
    end

    local column_id_match = string.match(path, "^/columns/(%d+)$")
    if column_id_match then
        local column_id = tonumber(column_id_match)
        if column_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_column(ctx, column_id)
            elseif method == "DELETE" then
                return delete_column(ctx, column_id)
            end
        end
    end

    -- Rows & Query routes
    local last_updated_match = string.match(path, "^/datatables/(%d+)/last_updated$")
    if last_updated_match and method == "GET" then
        local table_id = tonumber(last_updated_match)
        if table_id ~= nil then
            return get_table_last_updated(ctx, table_id)
        end
    end

    if path == "/last_updated" and (method == "GET" or method == "POST") then
        local table_id = ctx.query("table_id")
        if table_id == nil or table_id == "" then
            local data = req.bind_json()
            if data and data.table_id then
                table_id = data.table_id
            end
        end
        if table_id ~= nil then
            return get_table_last_updated(ctx, tonumber(table_id) or table_id)
        else
            req.json(400, { error = "table_id is required" })
            return
        end
    end

    local resolve_match = string.match(path, "^/datatables/(%d+)/resolve_ref_ids$")
    if resolve_match and method == "POST" then
        local table_id = tonumber(resolve_match)
        if table_id ~= nil then
            return resolve_ref_ids(ctx, table_id)
        end
    end

    if path == "/resolve_ref_ids" and method == "POST" then
        return resolve_ref_ids(ctx)
    end

    local resolve_rev_match = string.match(path, "^/datatables/(%d+)/resolve_reverse_refs$")
    if resolve_rev_match and method == "POST" then
        local table_id = tonumber(resolve_rev_match)
        if table_id ~= nil then
            return resolve_reverse_refs(ctx, table_id)
        end
    end

    if path == "/resolve_reverse_refs" and method == "POST" then
        return resolve_reverse_refs(ctx)
    end

    local query_match = string.match(path, "^/datatables/(%d+)/query$")
    if query_match and method == "POST" then
        local table_id = tonumber(query_match)
        if table_id ~= nil then
            return query_datatable(ctx, table_id)
        end
    end

    local seed_match = string.match(path, "^/datatables/(%d+)/seed$")
    if seed_match and method == "POST" then
        local table_id = tonumber(seed_match)
        if table_id ~= nil then
            return seed_datatable_rows(ctx, table_id)
        end
    end

    if path == "/query" and method == "POST" then
        local data = req.bind_json()
        local table_id = data and (tonumber(data.table_id) or data.table_id)
        if table_id ~= nil then
            return query_datatable(ctx, table_id)
        else
            req.json(400, { error = "table_id is required" })
            return
        end
    end

    local rows_match = string.match(path, "^/datatables/(%d+)/rows$")
    if rows_match then
        local table_id = tonumber(rows_match)
        if table_id ~= nil then
            if method == "GET" then
                return list_rows(ctx, table_id)
            end
        end
    end

    if path == "/rows" and method == "POST" then
        return create_row(ctx)
    end

    local row_id_match = string.match(path, "^/rows/(%d+)$")
    if row_id_match then
        local row_id = tonumber(row_id_match)
        if row_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_row(ctx, row_id)
            elseif method == "DELETE" then
                return delete_row(ctx, row_id)
            end
        end
    end

    -- Cells routes
    if path == "/cells/upsert" and method == "POST" then
        return upsert_cell(ctx)
    end

    local cell_id_match = string.match(path, "^/cells/(%d+)$")
    if cell_id_match then
        local cell_id = tonumber(cell_id_match)
        if cell_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_cell(ctx, cell_id)
            end
        end
    end

    req.json(200, {
        message = "Ok"
    })
end
