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
    elseif col_type == "boolean" or col_type == "checkbox" then
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

local function build_rows_with_cells(table_id, cols_array)
    ensure_actual_table(table_id)

    -- 1. Get DatatableRows
    local rows, _ = potato.db.find_all_by_cond("DatatableRows", {
        table_id = table_id
    })

    -- 2. Get all records from Actual<table_id>
    local actual_rows_map = {}
    local actual_list, _ = potato.db.find_all_by_cond("Actual" .. tostring(table_id), {})
    if actual_list ~= nil and type(actual_list) == "table" then
        for _, arow in ipairs(actual_list) do
            if arow.id ~= nil then
                actual_rows_map[arow.id] = arow
            end
        end
    end

    -- 3. Get cell metadata from DatatableCells (color, meta, etc.)
    local cell_metas = {}
    local cells_list, _ = potato.db.find_all_by_cond("DatatableCells", {
        table_id = table_id
    })
    if cells_list ~= nil and type(cells_list) == "table" then
        for _, c in ipairs(cells_list) do
            local key = tostring(c.row_id) .. "_" .. tostring(c.column_id)
            cell_metas[key] = c
        end
    end

    local rows_array = {}
    local seen_row_ids = {}

    if rows ~= nil and type(rows) == "table" then
        for _, row in ipairs(rows) do
            local rid = tonumber(row.id) or row.id
            seen_row_ids[rid] = true
            seen_row_ids[row.id] = true
            local arow = actual_rows_map[rid] or actual_rows_map[row.id] or {}

            -- Copy all fields from actual table row directly onto row
            for k, v in pairs(arow) do
                row[k] = v
            end

            -- Also populate row[columnId] for direct lookup by ID
            for _, col in ipairs(cols_array) do
                if col.slug ~= nil and col.slug ~= "" and arow[col.slug] ~= nil then
                    row[tostring(col.id)] = arow[col.slug]
                end
            end

            -- Cells: ONLY include if cell actually has color or meta in DatatableCells
            local cells_array = {}
            for _, col in ipairs(cols_array) do
                local cid = tonumber(col.id) or col.id
                local key = tostring(rid) .. "_" .. tostring(cid)
                local meta = cell_metas[key]
                if meta ~= nil and ((meta.color ~= nil and meta.color ~= "") or (meta.meta ~= nil and meta.meta ~= "")) then
                    local cell_obj = {
                        id = tonumber(meta.id) or meta.id,
                        table_id = tonumber(table_id) or table_id,
                        row_id = rid,
                        column_id = cid,
                        color = meta.color or "",
                        meta = meta.meta or ""
                    }
                    if arow[col.slug] ~= nil then
                        cell_obj.value = tostring(arow[col.slug])
                    end
                    table.insert(cells_array, cell_obj)
                end
            end

            row.id = rid
            row.table_id = tonumber(table_id) or table_id
            row.cells = cells_array
            row.actual_data = arow
            table.insert(rows_array, row)
        end
    end

    -- Include any records that exist directly in Actual<table_id> but not yet in DatatableRows
    for aid, arow in pairs(actual_rows_map) do
        local n_aid = tonumber(aid) or aid
        if not seen_row_ids[n_aid] and not seen_row_ids[aid] then
            local cells_array = {}
            for _, col in ipairs(cols_array) do
                local cid = tonumber(col.id) or col.id
                local key = tostring(n_aid) .. "_" .. tostring(cid)
                local meta = cell_metas[key]
                if meta ~= nil and ((meta.color ~= nil and meta.color ~= "") or (meta.meta ~= nil and meta.meta ~= "")) then
                    local cell_obj = {
                        id = tonumber(meta.id) or meta.id,
                        table_id = tonumber(table_id) or table_id,
                        row_id = n_aid,
                        column_id = cid,
                        color = meta.color or "",
                        meta = meta.meta or ""
                    }
                    if arow[col.slug] ~= nil then
                        cell_obj.value = tostring(arow[col.slug])
                    end
                    table.insert(cells_array, cell_obj)
                end
            end

            local new_row = {
                id = n_aid,
                table_id = tonumber(table_id) or table_id,
                row_data = "",
                created_at = arow.created_at or "",
                updated_at = arow.updated_at or "",
                cells = cells_array,
                actual_data = arow
            }
            for k, v in pairs(arow) do
                new_row[k] = v
            end
            for _, col in ipairs(cols_array) do
                if col.slug ~= nil and col.slug ~= "" and arow[col.slug] ~= nil then
                    new_row[tostring(col.id)] = arow[col.slug]
                end
            end

            table.insert(rows_array, new_row)
        end
    end

    return rows_array
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

    -- Get rows and cells from Actual<table_id> and DatatableRows
    datatable.rows = build_rows_with_cells(table_id, cols_array)

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

        -- Delete all cells for this column in DatatableCells
        local cells, cells_err = potato.db.find_all_by_cond("DatatableCells", {
            column_id = column_id
        })
        if cells_err == nil and cells ~= nil then
            for _, cell in ipairs(cells) do
                potato.db.delete_by_id("DatatableCells", cell.id)
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

    local columns, _ = potato.db.find_all_by_cond("DatatableColumns", {
        table_id = table_id
    })
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

    local rows_array = build_rows_with_cells(table_id, cols_array)
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

    local row = {
        table_id = table_id,
        row_data = data.row_data or ""
    }
    
    local id, err = potato.db.insert("DatatableRows", row)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    id = tonumber(id) or id

    local columns = get_table_columns(table_id)
    local col_map = {}
    local existing_cols = get_existing_table_columns("Actual" .. tostring(table_id))

    for _, col in ipairs(columns) do
        local slug = col.slug
        if slug == nil or slug == "" then
            slug = generate_column_slug(table_id, col.name)
            col.slug = slug
            potato.db.update_by_id("DatatableColumns", col.id, { slug = slug })
        end

        if not existing_cols[string.lower(slug)] then
            local col_type_sql = sql_type_for_column(col.column_type)
            potato.db.run_ddl(string.format("ALTER TABLE Actual%s ADD COLUMN %s %s", tostring(table_id), slug, col_type_sql))
            existing_cols[string.lower(slug)] = true
        end

        local cid = tonumber(col.id) or col.id
        col_map[cid] = slug
        col_map[tostring(col.id)] = slug
    end

    local actual_row = {
        id = id
    }

    local cells_response = {}
    if data.cells ~= nil and type(data.cells) == "table" then
        for _, cell_data in ipairs(data.cells) do
            local raw_cid = cell_data.column_id
            local cid = tonumber(raw_cid) or raw_cid
            local slug = col_map[cid] or col_map[tostring(raw_cid)]
            local val = cell_data.value or ""

            if slug == nil or slug == "" then
                local col = potato.db.find_by_id("DatatableColumns", cid)
                if col == nil then
                    col = potato.db.find_by_id("DatatableColumns", tostring(raw_cid))
                end
                if col ~= nil then
                    slug = col.slug
                    if slug == nil or slug == "" then
                        slug = generate_column_slug(table_id, col.name)
                        col.slug = slug
                        potato.db.update_by_id("DatatableColumns", col.id, { slug = slug })
                    end
                    if not existing_cols[string.lower(slug)] then
                        local col_type_sql = sql_type_for_column(col.column_type)
                        potato.db.run_ddl(string.format("ALTER TABLE Actual%s ADD COLUMN %s %s", tostring(table_id), slug, col_type_sql))
                        existing_cols[string.lower(slug)] = true
                    end
                end
            end

            if slug ~= nil and slug ~= "" then
                actual_row[slug] = val
            end

            -- Only insert into DatatableCells if cell has metadata (like color, style, or meta)
            local has_meta = (cell_data.color and cell_data.color ~= "") or (cell_data.meta and cell_data.meta ~= "")
            if has_meta then
                local cell_entry = {
                    table_id = table_id,
                    row_id = id,
                    column_id = cid,
                    value = val,
                    color = cell_data.color or "",
                    meta = cell_data.meta or ""
                }
                local cell_id, _ = potato.db.insert("DatatableCells", cell_entry)
                if cell_id ~= nil then
                    cell_entry.id = tonumber(cell_id) or cell_id
                end
                table.insert(cells_response, cell_entry)
            end
        end
    end

    if data.values ~= nil and type(data.values) == "table" then
        for k, v in pairs(data.values) do
            actual_row[k] = v
        end
    end

    -- Insert into Actual<table_id>
    local _, actual_err = potato.db.insert("Actual" .. tostring(table_id), actual_row)
    if actual_err ~= nil then
        print("Warning: insert into Actual" .. tostring(table_id) .. " error:", actual_err)
    end

    local result, fetch_err = potato.db.find_by_id("DatatableRows", id)
    if fetch_err ~= nil or result == nil then
        result = {
            id = id,
            table_id = table_id,
            row_data = data.row_data or ""
        }
    end
    result.id = id
    result.table_id = table_id

    for k, v in pairs(actual_row) do
        result[k] = v
    end
    for _, col in ipairs(columns) do
        if col.slug ~= nil and col.slug ~= "" and actual_row[col.slug] ~= nil then
            result[tostring(col.id)] = actual_row[col.slug]
        end
    end

    result.cells = cells_response
    result.actual_data = actual_row

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
    local row, err = potato.db.find_by_id("DatatableRows", n_row_id)
    if row == nil then
        row, err = potato.db.find_by_id("DatatableRows", tostring(row_id))
    end
    if row == nil then
        req.json(404, {
            error = "Row not found"
        })
        return
    end

    local table_id = tonumber(row.table_id) or row.table_id
    ensure_actual_table(table_id)

    local data = req.bind_json()
    local updates = {}
    if data.row_data ~= nil then updates.row_data = data.row_data end

    if next(updates) ~= nil then
        potato.db.update_by_id("DatatableRows", n_row_id, updates)
    end

    local columns = get_table_columns(table_id)
    local col_map = {}
    local existing_cols = get_existing_table_columns("Actual" .. tostring(table_id))

    for _, col in ipairs(columns) do
        local slug = col.slug
        if slug == nil or slug == "" then
            slug = generate_column_slug(table_id, col.name)
            col.slug = slug
            potato.db.update_by_id("DatatableColumns", col.id, { slug = slug })
        end
        if not existing_cols[string.lower(slug)] then
            local col_type_sql = sql_type_for_column(col.column_type)
            potato.db.run_ddl(string.format("ALTER TABLE Actual%s ADD COLUMN %s %s", tostring(table_id), slug, col_type_sql))
            existing_cols[string.lower(slug)] = true
        end
        local cid = tonumber(col.id) or col.id
        col_map[cid] = slug
        col_map[tostring(col.id)] = slug
    end

    local actual_updates = {}
    if data.cells ~= nil and type(data.cells) == "table" then
        for _, cell_data in ipairs(data.cells) do
            local raw_cid = cell_data.column_id
            local cid = tonumber(raw_cid) or raw_cid
            local slug = col_map[cid] or col_map[tostring(raw_cid)]
            local val = cell_data.value or ""
            if slug ~= nil and slug ~= "" then
                actual_updates[slug] = val
            end

            -- Update DatatableCells ONLY if cell has metadata (like color, style, or meta)
            local has_meta = (cell_data.color ~= nil and cell_data.color ~= "") or (cell_data.meta ~= nil and cell_data.meta ~= "")
            if has_meta then
                local exist_c = potato.db.find_all_by_cond("DatatableCells", {
                    table_id = table_id,
                    row_id = n_row_id,
                    column_id = cid
                })
                if exist_c == nil or #exist_c == 0 then
                    exist_c = potato.db.find_all_by_cond("DatatableCells", {
                        table_id = tostring(table_id),
                        row_id = tostring(n_row_id),
                        column_id = tostring(cid)
                    })
                end
                local c_up = { color = cell_data.color or "", meta = cell_data.meta or "" }
                if cell_data.value ~= nil then c_up.value = cell_data.value end
                if exist_c ~= nil and #exist_c > 0 then
                    potato.db.update_by_id("DatatableCells", exist_c[1].id, c_up)
                else
                    c_up.table_id = table_id
                    c_up.row_id = n_row_id
                    c_up.column_id = cid
                    potato.db.insert("DatatableCells", c_up)
                end
            end
        end
    end

    if data.values ~= nil and type(data.values) == "table" then
        for k, v in pairs(data.values) do
            actual_updates[k] = v
        end
    end

    if next(actual_updates) ~= nil then
        local actual_rec, _ = potato.db.find_by_id("Actual" .. tostring(table_id), n_row_id)
        if actual_rec ~= nil then
            potato.db.update_by_id("Actual" .. tostring(table_id), n_row_id, actual_updates)
        else
            actual_updates.id = n_row_id
            potato.db.insert("Actual" .. tostring(table_id), actual_updates)
        end
    end

    local result, _ = potato.db.find_by_id("DatatableRows", n_row_id)
    if result == nil then
        result = row
    end
    result.id = n_row_id
    result.table_id = table_id

    local actual_rec, _ = potato.db.find_by_id("Actual" .. tostring(table_id), n_row_id)
    result.actual_data = actual_rec or {}
    if actual_rec ~= nil then
        for k, v in pairs(actual_rec) do
            result[k] = v
        end
        for _, col in ipairs(columns) do
            if col.slug ~= nil and col.slug ~= "" and actual_rec[col.slug] ~= nil then
                result[tostring(col.id)] = actual_rec[col.slug]
            end
        end
    end

    local cells_array = {}
    local meta_cells, _ = potato.db.find_all_by_cond("DatatableCells", {
        table_id = table_id,
        row_id = n_row_id
    })
    if meta_cells ~= nil and type(meta_cells) == "table" then
        for _, mc in ipairs(meta_cells) do
            if (mc.color ~= nil and mc.color ~= "") or (mc.meta ~= nil and mc.meta ~= "") then
                table.insert(cells_array, {
                    id = tonumber(mc.id) or mc.id,
                    table_id = table_id,
                    row_id = n_row_id,
                    column_id = tonumber(mc.column_id) or mc.column_id,
                    color = mc.color or "",
                    meta = mc.meta or ""
                })
            end
        end
    end
    result.cells = cells_array

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
    local row, _ = potato.db.find_by_id("DatatableRows", n_row_id)
    if row == nil then
        row, _ = potato.db.find_by_id("DatatableRows", tostring(row_id))
    end

    if row ~= nil then
        local table_id = row.table_id
        potato.db.delete_by_id("Actual" .. tostring(table_id), n_row_id)

        local cells = potato.db.find_all_by_cond("DatatableCells", {
            row_id = n_row_id
        })
        if cells == nil or #cells == 0 then
            cells = potato.db.find_all_by_cond("DatatableCells", {
                row_id = tostring(row_id)
            })
        end
        if cells ~= nil and type(cells) == "table" then
            for _, cell in ipairs(cells) do
                potato.db.delete_by_id("DatatableCells", cell.id)
            end
        end

        potato.db.delete_by_id("DatatableRows", n_row_id)
    else
        potato.db.delete_by_id("DatatableRows", n_row_id)
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

    if cell_id == nil then
        req.json(400, {
            error = "cell_id is required"
        })
        return
    end

    local n_cid = tonumber(cell_id) or cell_id
    local cell, _ = potato.db.find_by_id("DatatableCells", n_cid)
    if cell == nil then
        cell, _ = potato.db.find_by_id("DatatableCells", tostring(cell_id))
    end
    local data = req.bind_json()
    local val = data.value or ""

    if cell ~= nil then
        local updates = {}
        if data.value ~= nil then updates.value = data.value end
        if data.color ~= nil then updates.color = data.color end
        if data.meta ~= nil then updates.meta = data.meta end

        potato.db.update_by_id("DatatableCells", n_cid, updates)

        -- Update Actual<table_id>
        local col, _ = potato.db.find_by_id("DatatableColumns", cell.column_id)
        if col == nil then
            col, _ = potato.db.find_by_id("DatatableColumns", tostring(cell.column_id))
        end
        if col ~= nil then
            local slug = col.slug
            if slug == nil or slug == "" then
                slug = generate_column_slug(cell.table_id, col.name)
                col.slug = slug
                potato.db.update_by_id("DatatableColumns", col.id, { slug = slug })
            end
            local u = {}
            u[slug] = val
            potato.db.update_by_id("Actual" .. tostring(cell.table_id), cell.row_id, u)
        end
    end

    local result, err = potato.db.find_by_id("DatatableCells", n_cid)
    if err ~= nil or result == nil then
        req.json(200, { id = n_cid, value = val })
        return
    end
    req.json(200, result)
end

function upsert_cell(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local data = req.bind_json()
    if data.table_id == nil or data.row_id == nil or data.column_id == nil then
        req.json(400, {
            error = "table_id, row_id, and column_id are required"
        })
        return
    end

    local table_id = tonumber(data.table_id) or data.table_id
    local row_id = tonumber(data.row_id) or data.row_id
    local column_id = tonumber(data.column_id) or data.column_id
    local val = data.value or ""

    ensure_actual_table(table_id)

    -- Resolve column slug
    local col, _ = potato.db.find_by_id("DatatableColumns", column_id)
    if col == nil then
        col, _ = potato.db.find_by_id("DatatableColumns", tostring(column_id))
    end

    local slug = ""
    if col ~= nil then
        slug = col.slug
        if slug == nil or slug == "" then
            slug = generate_column_slug(table_id, col.name)
            col.slug = slug
            potato.db.update_by_id("DatatableColumns", col.id, { slug = slug })
        end

        local existing_cols = get_existing_table_columns("Actual" .. tostring(table_id))
        if not existing_cols[string.lower(slug)] then
            local col_type_sql = sql_type_for_column(col.column_type)
            potato.db.run_ddl(string.format("ALTER TABLE Actual%s ADD COLUMN %s %s", tostring(table_id), slug, col_type_sql))
        end
    end

    if slug ~= "" then
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
    end

    local has_meta = (data.color ~= nil and data.color ~= "") or (data.meta ~= nil and data.meta ~= "")
    local cell_id = nil
    if has_meta then
        local cell_updates = {
            table_id = table_id,
            row_id = row_id,
            column_id = column_id,
            value = val
        }
        if data.color ~= nil then cell_updates.color = data.color end
        if data.meta ~= nil then cell_updates.meta = data.meta end

        local existing_list = potato.db.find_all_by_cond("DatatableCells", {
            table_id = table_id,
            row_id = row_id,
            column_id = column_id
        })
        if existing_list == nil or #existing_list == 0 then
            existing_list = potato.db.find_all_by_cond("DatatableCells", {
                table_id = tostring(table_id),
                row_id = tostring(row_id),
                column_id = tostring(column_id)
            })
        end

        if existing_list ~= nil and #existing_list > 0 then
            cell_id = existing_list[1].id
            potato.db.update_by_id("DatatableCells", cell_id, cell_updates)
        else
            local cid, _ = potato.db.insert("DatatableCells", cell_updates)
            cell_id = cid
        end
    end

    local result = {
        id = (cell_id and (tonumber(cell_id) or cell_id)) or nil,
        table_id = table_id,
        row_id = row_id,
        column_id = column_id,
        value = val,
        color = data.color or "",
        meta = data.meta or ""
    }

    req.json(200, result)
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
