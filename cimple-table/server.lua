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
    
    local result, err = potato.db.find_by_id("Datatables", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
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

    -- Get columns
    local columns, cols_err = potato.db.find_all_by_cond("DatatableColumns", {
        table_id = table_id
    })
    if cols_err == nil and columns ~= nil and type(columns) == "table" then
        -- Ensure it's an array (check if it can be iterated with ipairs)
        local cols_array = {}
        for i, col in ipairs(columns) do
            table.insert(cols_array, col)
        end
        datatable.columns = cols_array
    else
        datatable.columns = {}
    end

    -- Get rows
    local rows, rows_err = potato.db.find_all_by_cond("DatatableRows", {
        table_id = table_id
    })
    if rows_err == nil and rows ~= nil and type(rows) == "table" then
        -- Ensure it's an array and get cells for each row
        local rows_array = {}
        for i, row in ipairs(rows) do
            local cells, cells_err = potato.db.find_all_by_cond("DatatableCells", {
                table_id = table_id,
                row_id = row.id
            })
            if cells_err == nil and cells ~= nil and type(cells) == "table" then
                -- Ensure cells is an array
                local cells_array = {}
                for j, cell in ipairs(cells) do
                    table.insert(cells_array, cell)
                end
                row.cells = cells_array
            else
                row.cells = {}
            end
            table.insert(rows_array, row)
        end
        datatable.rows = rows_array
    else
        datatable.rows = {}
    end

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
    req.json_array(200, columns)
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

    local column = {
        table_id = data.table_id,
        name = data.name or "",
        column_type = data.column_type or "text",
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
    
    local result, err = potato.db.find_by_id("DatatableColumns", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
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

    local err = potato.db.update_by_id("DatatableColumns", column_id, updates)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local result, err = potato.db.find_by_id("DatatableColumns", column_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
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

    -- Delete all cells for this column
    local cells, cells_err = potato.db.find_all_by_cond("DatatableCells", {
        column_id = column_id
    })
    if cells_err == nil and cells ~= nil then
        for _, cell in ipairs(cells) do
            potato.db.delete_by_id("DatatableCells", cell.id)
        end
    end

    local err = potato.db.delete_by_id("DatatableColumns", column_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
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

    local rows, err = potato.db.find_all_by_cond("DatatableRows", {
        table_id = table_id
    })
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    -- Ensure rows is an array and get cells for each row
    local rows_array = {}
    if rows ~= nil and type(rows) == "table" then
        for i, row in ipairs(rows) do
            local cells, cells_err = potato.db.find_all_by_cond("DatatableCells", {
                table_id = table_id,
                row_id = row.id
            })
            if cells_err == nil and cells ~= nil and type(cells) == "table" then
                local cells_array = {}
                for j, cell in ipairs(cells) do
                    table.insert(cells_array, cell)
                end
                row.cells = cells_array
            else
                row.cells = {}
            end
            table.insert(rows_array, row)
        end
    end

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

    local row = {
        table_id = data.table_id,
        row_data = data.row_data or ""
    }
    
    local id, err = potato.db.insert("DatatableRows", row)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    -- Create cells if provided
    if data.cells ~= nil and type(data.cells) == "table" then
        for _, cell_data in ipairs(data.cells) do
            local cell = {
                table_id = data.table_id,
                row_id = id,
                column_id = cell_data.column_id,
                value = cell_data.value or ""
            }
            potato.db.insert("DatatableCells", cell)
        end
    end
    
    local result, err = potato.db.find_by_id("DatatableRows", id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    -- Get cells
    local cells, cells_err = potato.db.find_all_by_cond("DatatableCells", {
        table_id = data.table_id,
        row_id = id
    })
    if cells_err == nil and cells ~= nil and type(cells) == "table" then
        local cells_array = {}
        for i, cell in ipairs(cells) do
            table.insert(cells_array, cell)
        end
        result.cells = cells_array
    else
        result.cells = {}
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

    local data = req.bind_json()
    local updates = {}
    if data.row_data ~= nil then updates.row_data = data.row_data end

    local err = potato.db.update_by_id("DatatableRows", row_id, updates)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local result, err = potato.db.find_by_id("DatatableRows", row_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    -- Get cells
    local row, _ = potato.db.find_by_id("DatatableRows", row_id)
    local cells, cells_err = potato.db.find_all_by_cond("DatatableCells", {
        row_id = row_id
    })
    if cells_err == nil and cells ~= nil and type(cells) == "table" then
        local cells_array = {}
        for i, cell in ipairs(cells) do
            table.insert(cells_array, cell)
        end
        result.cells = cells_array
    else
        result.cells = {}
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

    -- Delete all cells for this row
    local cells, cells_err = potato.db.find_all_by_cond("DatatableCells", {
        row_id = row_id
    })
    if cells_err == nil and cells ~= nil then
        for _, cell in ipairs(cells) do
            potato.db.delete_by_id("DatatableCells", cell.id)
        end
    end

    local err = potato.db.delete_by_id("DatatableRows", row_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
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

    local data = req.bind_json()
    local updates = {}
    if data.value ~= nil then updates.value = data.value end

    local err = potato.db.update_by_id("DatatableCells", cell_id, updates)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    local result, err = potato.db.find_by_id("DatatableCells", cell_id)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
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

    -- Check if cell exists
    local existing_list, err = potato.db.find_all_by_cond("DatatableCells", {
        table_id = data.table_id,
        row_id = data.row_id,
        column_id = data.column_id
    })

    if err == nil and existing_list ~= nil and #existing_list > 0 then
        -- Update existing cell (take the first one)
        local existing = existing_list[1]
        local updates = {
            value = data.value or ""
        }
        local update_err = potato.db.update_by_id("DatatableCells", existing.id, updates)
        if update_err ~= nil then
            req.json(400, {
                error = tostring(update_err)
            })
            return
        end
        local result, fetch_err = potato.db.find_by_id("DatatableCells", existing.id)
        if fetch_err ~= nil then
            req.json(400, {
                error = tostring(fetch_err)
            })
            return
        end
        req.json(200, result)
    else
        -- Create new cell
        local cell = {
            table_id = data.table_id,
            row_id = data.row_id,
            column_id = data.column_id,
            value = data.value or ""
        }
        local id, insert_err = potato.db.insert("DatatableCells", cell)
        if insert_err ~= nil then
            req.json(400, {
                error = tostring(insert_err)
            })
            return
        end
        local result, fetch_err = potato.db.find_by_id("DatatableCells", id)
        if fetch_err ~= nil then
            req.json(400, {
                error = tostring(fetch_err)
            })
            return
        end
        req.json(200, result)
    end
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

