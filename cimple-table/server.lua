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

    local _, ddlerr = potato.db.run_ddl(schema)
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

-- HELPER FUNCTIONS FOR DDL & PHYSICAL TABLES

local function sql_type_for_column(col_type)
    if col_type == "number" then
        return "NUMERIC DEFAULT 0"
    elseif col_type == "checkbox" then
        return "INTEGER DEFAULT 0"
    else
        return "TEXT DEFAULT ''"
    end
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

local function ensure_actual_table(table_id)
    local table_name = "Actual" .. tostring(table_id)
    local ddl = string.format([[
        CREATE TABLE IF NOT EXISTS %s (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ]], table_name)
    local _, err = potato.db.run_ddl(ddl)
    if err ~= nil then
        print("ensure_actual_table run_ddl err:", err)
    end

    -- Verify columns in DatatableColumns are present in Actual<table_id>
    local columns = get_table_columns(table_id)
    if columns ~= nil and type(columns) == "table" and #columns > 0 then
        local existing_cols = get_existing_table_columns(table_name)
        for _, col in ipairs(columns) do
            local slug = col.slug
            if slug == nil or slug == "" then
                slug = generate_column_slug(table_id, col.name)
                col.slug = slug
                potato.db.update_by_id("DatatableColumns", col.id, { slug = slug })
            end
            if not existing_cols[string.lower(slug)] then
                local col_type_sql = sql_type_for_column(col.column_type)
                local alter_ddl = string.format("ALTER TABLE %s ADD COLUMN %s %s", table_name, slug, col_type_sql)
                local _, alter_err = potato.db.run_ddl(alter_ddl)
                if alter_err ~= nil then
                    print("ensure_actual_table alter_ddl err:", alter_err)
                end
                existing_cols[string.lower(slug)] = true
            end
        end
    end

    return table_name
end

local function get_table_rows(table_id, cols_array)
    ensure_actual_table(table_id)

    local actual_list, _ = potato.db.find_all_by_cond("Actual" .. tostring(table_id), {})
    if actual_list == nil or type(actual_list) ~= "table" then
        return {}
    end

    local rows = {}
    for _, arow in ipairs(actual_list) do
        local r = {
            id = tonumber(arow.id) or arow.id,
            created_at = arow.created_at or "",
            updated_at = arow.updated_at or ""
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
    
    local result, fetch_err = potato.db.find_by_id("Datatables", id)
    if fetch_err ~= nil or result == nil then
        datatable.id = id
        result = datatable
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

    -- Ensure Actual<table_id> table exists
    ensure_actual_table(table_id)

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
    ensure_actual_table(table_id)

    local slug = data.slug
    if slug == nil or slug == "" then
        slug = generate_column_slug(table_id, data.name or "")
    end

    local column = {
        table_id = table_id,
        name = data.name or "",
        slug = slug,
        column_type = data.column_type or "text",
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

    -- Run DDL to add column to Actual<table_id>
    local col_type_sql = sql_type_for_column(column.column_type)
    local ddl = string.format("ALTER TABLE Actual%s ADD COLUMN %s %s", tostring(table_id), slug, col_type_sql)
    local _, ddl_err = potato.db.run_ddl(ddl)
    if ddl_err ~= nil then
        print("Warning: ALTER TABLE ADD COLUMN error:", ddl_err)
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
    ensure_actual_table(table_id)

    local columns = get_table_columns(table_id)
    local col_map_by_id = {}
    for _, col in ipairs(columns) do
        col_map_by_id[tonumber(col.id) or col.id] = col.slug
    end

    local new_row = {}

    -- Accept row values by column slug (data.task or data.data.task)
    local source = data.data or data
    for _, col in ipairs(columns) do
        if col.slug and col.slug ~= "" and source[col.slug] ~= nil then
            new_row[col.slug] = source[col.slug]
        end
    end

    -- If submitted as cells array [{ column_id, value }]
    if data.cells ~= nil and type(data.cells) == "table" then
        for _, c in ipairs(data.cells) do
            local slug = col_map_by_id[tonumber(c.column_id) or c.column_id]
            if slug ~= nil and slug ~= "" then
                new_row[slug] = c.value or ""
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

    row_id = tonumber(row_id) or row_id
    local actual_rec, _ = potato.db.find_by_id("Actual" .. tostring(table_id), row_id)
    if actual_rec == nil then
        actual_rec = new_row
        actual_rec.id = row_id
    end

    local result = {
        id = tonumber(actual_rec.id) or actual_rec.id,
        created_at = actual_rec.created_at or "",
        updated_at = actual_rec.updated_at or ""
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

    ensure_actual_table(table_id)

    local columns = get_table_columns(table_id)
    local col_map_by_id = {}
    for _, col in ipairs(columns) do
        col_map_by_id[tonumber(col.id) or col.id] = col.slug
    end

    local updates = {}

    -- Accept row values by column slug (data.task or data.data.task)
    local source = data.data or data
    for _, col in ipairs(columns) do
        if col.slug and col.slug ~= "" and source[col.slug] ~= nil then
            updates[col.slug] = source[col.slug]
        end
    end

    -- If submitted as cells array [{ column_id, value }]
    if data.cells ~= nil and type(data.cells) == "table" then
        for _, c in ipairs(data.cells) do
            local slug = col_map_by_id[tonumber(c.column_id) or c.column_id]
            if slug ~= nil and slug ~= "" then
                updates[slug] = c.value or ""
            end
        end
    end

    if next(updates) ~= nil then
        potato.db.update_by_id("Actual" .. tostring(table_id), n_row_id, updates)
    end

    local actual_rec, _ = potato.db.find_by_id("Actual" .. tostring(table_id), n_row_id)
    if actual_rec == nil then
        actual_rec = updates
        actual_rec.id = n_row_id
    end

    local result = {
        id = tonumber(actual_rec.id) or actual_rec.id,
        created_at = actual_rec.created_at or "",
        updated_at = actual_rec.updated_at or ""
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

    if table_id ~= nil and table_id ~= "" then
        potato.db.delete_by_id("Actual" .. tostring(table_id), n_row_id)
    else
        local datatables, _ = potato.db.find_all_by_cond("Datatables", { is_deleted = 0 })
        if datatables ~= nil and type(datatables) == "table" then
            for _, dt in ipairs(datatables) do
                local rec, _ = potato.db.find_by_id("Actual" .. tostring(dt.id), n_row_id)
                if rec ~= nil then
                    potato.db.delete_by_id("Actual" .. tostring(dt.id), n_row_id)
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

    ensure_actual_table(table_id)

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

    ensure_actual_table(table_id)
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

    -- Rows routes
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
