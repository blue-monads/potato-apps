local potato = require("potato")
local json = require("json")
local llm = require("./server/llm")

local _unpack = table.unpack or unpack

local M = {}


--- Read base prompt template from package file or fallback
local function get_base_prompt_template()
    local content, err = potato.core.read_package_file("server/autoform/prompt.txt")
    if err == nil and content and content ~= "" then
        return content
    end
    return "You are Formy, an expert AI form and mini-app creator. Create single page HTML/JS apps that query and update the database."
end

--- Read starter HTML template from package file or fallback
local function get_starter_html()
    local content, err = potato.core.read_package_file("server/autoform/aform.html")
    if err == nil and content and content ~= "" then
        return content
    end
    return "<!DOCTYPE html><html><head><title>AutoForm</title></head><body><h1>AutoForm</h1></body></html>"
end

--- Resolve table identifier (Actual1, 1, or friendly name like "Students") to table_id and physical table_name
local function resolve_table(table_id_or_name)
    if not table_id_or_name then return nil, "Table identifier required" end
    local s = tostring(table_id_or_name)

    -- Case 1: Numeric id
    local num = tonumber(s)
    if num then
        return num, "Actual" .. tostring(num)
    end

    -- Case 2: Actual<id>
    local tid = tonumber(string.match(s, "^[Aa]ctual(%d+)$"))
    if tid then
        return tid, "Actual" .. tostring(tid)
    end

    -- Case 3: Match Datatables by name (case-insensitive)
    local dts = potato.db.find_all_by_cond("Datatables", {}) or {}
    local lower_target = string.lower(s)
    for _, dt in ipairs(dts) do
        if string.lower(dt.name or "") == lower_target then
            return dt.id, "Actual" .. tostring(dt.id)
        end
    end

    return nil, "Table not found: " .. s
end

--- Get table shapes formatted for Formy prompt & schema endpoint
local function get_tables_shape()
    local lines = {}

    local dts = potato.db.find_all_by_cond("Datatables", {})
    if not dts or #dts == 0 then
        dts = potato.db.run_query("SELECT * FROM Datatables WHERE is_deleted = 0 OR is_deleted IS NULL") or {}
    end

    local dt_map = {}
    for _, dt in ipairs(dts or {}) do
        if dt.is_deleted ~= true and dt.is_deleted ~= 1 then
            dt_map[tostring(dt.id)] = dt
        end
    end

    local all_tables = potato.db.list_tables() or {}
    local processed_tids = {}

    local function build_table_schema(tid, dt, raw_tbl_name)
        local tbl_name = "Actual" .. tid
        local desc = (dt and dt.name) or tbl_name
        if dt and dt.info and dt.info ~= "" then
            desc = desc .. " - " .. dt.info
        end

        local cols = potato.db.list_columns(tbl_name) or {}
        if #cols == 0 and raw_tbl_name then
            cols = potato.db.list_columns(raw_tbl_name) or {}
        end

        local meta_cols = potato.db.find_all_by_cond("DatatableColumns", { table_id = tonumber(tid) }) or {}
        local meta_map = {}
        for _, mc in ipairs(meta_cols) do
            local slug = mc.slug or ""
            if slug ~= "" then
                meta_map[string.lower(slug)] = mc
            end
        end

        local col_lines = {}
        if #cols > 0 then
            for _, c in ipairs(cols) do
                local cname = c.name or c.Name or ""
                local ctype = c.data_type or c.DataType or c.type or "TEXT"
                local is_pk = (c.primary_key == 1 or c.PrimaryKey == 1)
                if cname ~= "" then
                    local def = string.format("    %s %s", cname, ctype)
                    if is_pk then
                        def = def .. " PRIMARY KEY"
                    end
                    local mc = meta_map[string.lower(cname)]
                    if mc and mc.name and mc.name ~= "" and string.lower(mc.name) ~= string.lower(cname) then
                        def = def .. string.format(" -- %s", mc.name)
                    end
                    table.insert(col_lines, def)
                end
            end
        else
            table.insert(col_lines, "    id INTEGER PRIMARY KEY")
            table.insert(col_lines, "    created_at TIMESTAMP")
            table.insert(col_lines, "    updated_at TIMESTAMP")
            for _, mc in ipairs(meta_cols) do
                local slug = mc.slug or string.lower(string.gsub(mc.name or "", "%s+", "_"))
                local col_type = mc.column_type or "text"
                local sql_type = "TEXT"
                if col_type == "number" then sql_type = "REAL"
                elseif col_type == "checkbox" then sql_type = "BOOLEAN"
                elseif col_type == "date" or col_type == "datetime" then sql_type = "TIMESTAMP"
                end
                table.insert(col_lines, string.format("    %s %s -- %s", slug, sql_type, mc.name or slug))
            end
        end

        table.insert(lines, string.format("%s: %s", tbl_name, desc))
        table.insert(lines, string.format("CREATE TABLE %s (\n%s\n);", tbl_name, table.concat(col_lines, ",\n")))
        table.insert(lines, "")
    end

    for _, raw_tbl_name in ipairs(all_tables) do
        local tid = string.match(raw_tbl_name, "[Aa]ctual(%d+)")
        if tid and dt_map[tid] and not processed_tids[tid] then
            processed_tids[tid] = true
            build_table_schema(tid, dt_map[tid], raw_tbl_name)
        end
    end

    for tid, dt in pairs(dt_map) do
        if not processed_tids[tid] then
            processed_tids[tid] = true
            build_table_schema(tid, dt, nil)
        end
    end

    if #lines == 0 then
        table.insert(lines, "No Actual data tables found in database.")
    end

    return table.concat(lines, "\n")
end

--- Validates that an SQL query is safe and strictly read-only (SELECT queries only)
local function is_safe_query(sql)
    if not sql or type(sql) ~= "string" then
        return false, "SQL query string is required"
    end

    local clean = string.gsub(sql, "^%s+", "")
    local first_word = string.upper(string.match(clean, "^(%a+)") or "")
    if first_word ~= "SELECT" and first_word ~= "WITH" and first_word ~= "EXPLAIN" then
        return false, "Only SELECT and WITH queries are allowed for raw SQL. Use CRUD methods (insert, update, delete) for mutations."
    end

    local upper = " " .. string.upper(sql) .. " "
    local forbidden = {
        "DROP ", "DELETE ", "UPDATE ", "INSERT ", "ALTER ", "ATTACH ", "DETACH ",
        "PRAGMA ", "REINDEX ", "VACUUM ", "CREATE ", "TRUNCATE "
    }
    for _, word in ipairs(forbidden) do
        if string.find(upper, "%f[%a]" .. word) then
            return false, "Query contains forbidden statement: " .. word
        end
    end

    return true, nil
end

--- Extract <html_content>...</html_content> and separate plain explanation text
local function extract_html_and_text(raw_text)
    if not raw_text or type(raw_text) ~= "string" then
        return nil, "No response generated"
    end

    local html_content = string.match(raw_text, "<html_content>(.-)</html_content>")
    if not html_content then
        html_content = string.match(raw_text, "<HTML_CONTENT>(.-)</HTML_CONTENT>")
    end

    local plain_text = raw_text
    if html_content then
        plain_text = string.gsub(plain_text, "<html_content>.-</html_content>", "")
        plain_text = string.gsub(plain_text, "<HTML_CONTENT>.-</HTML_CONTENT>", "")
    end

    plain_text = string.gsub(plain_text, "^%s+", "")
    plain_text = string.gsub(plain_text, "%s+$", "")

    if plain_text == "" then
        plain_text = "Form app updated successfully."
    end

    return html_content, plain_text
end

--- Main route handler for /autoform endpoints
function M.handle_routes(ctx, path, method)
    local req = ctx.request()

    -- 1. POST /autoform/query - Safe SQL execution for form iframe
    if path == "/autoform/query" and method == "POST" then
        local body = req.bind_json() or {}
        local sql = body.sql or body.sqlQuery
        local args = body.args or {}

        local safe, reason = is_safe_query(sql)
        if not safe then
            req.json(400, { error = reason })
            return
        end

        local rows, err
        if type(args) == "table" and #args > 0 then
            rows, err = potato.db.run_query(sql, _unpack(args))
        else
            rows, err = potato.db.run_query(sql)
        end

        if err ~= nil then
            print(string.format("[AutoForm Query Error] SQL: %s, error: %s", tostring(sql), tostring(err)))
            req.json(500, { error = tostring(err) })
            return
        end

        req.json(200, { success = true, rows = rows or {} })
        return
    end

    -- 2. POST /autoform/crud - Structured CRUD endpoint for forms
    if path == "/autoform/crud" and method == "POST" then
        local body = req.bind_json() or {}
        local action = body.action
        local table_param = body.table or body.table_name or body.table_id
        local tid, tbl_name = resolve_table(table_param)

        if not tid or not tbl_name then
            req.json(400, { error = tbl_name or "Invalid table" })
            return
        end

        local now_ts = os.date("!%Y-%m-%d %H:%M:%SZ")

        -- INSERT
        if action == "insert" then
            local data = body.data or {}
            local to_insert = {
                created_at = now_ts,
                updated_at = now_ts
            }
            for k, v in pairs(data) do
                if k ~= "id" and k ~= "created_at" and k ~= "updated_at" then
                    to_insert[k] = v
                end
            end

            local new_id, err = potato.db.insert(tbl_name, to_insert)
            if err ~= nil or not new_id then
                req.json(500, { error = "Failed to insert record: " .. tostring(err) })
                return
            end

            potato.db.update_by_id("Datatables", tid, { updated_at = now_ts })
            local rec, _ = potato.db.find_by_id(tbl_name, new_id)
            req.json(200, { success = true, id = new_id, row = rec or to_insert })
            return
        end

        -- UPDATE
        if action == "update" then
            local row_id = tonumber(body.row_id or body.id)
            if not row_id then
                req.json(400, { error = "row_id is required for update" })
                return
            end

            local data = body.data or {}
            local to_update = {
                updated_at = now_ts
            }
            for k, v in pairs(data) do
                if k ~= "id" and k ~= "created_at" then
                    to_update[k] = v
                end
            end

            local ok, err = potato.db.update_by_id(tbl_name, row_id, to_update)
            if err ~= nil then
                req.json(500, { error = "Failed to update record: " .. tostring(err) })
                return
            end

            potato.db.update_by_id("Datatables", tid, { updated_at = now_ts })
            local rec, _ = potato.db.find_by_id(tbl_name, row_id)
            req.json(200, { success = true, id = row_id, row = rec })
            return
        end

        -- DELETE
        if action == "delete" then
            local row_id = tonumber(body.row_id or body.id)
            if not row_id then
                req.json(400, { error = "row_id is required for delete" })
                return
            end

            local ok, err = potato.db.delete_by_id(tbl_name, row_id)
            if err ~= nil then
                req.json(500, { error = "Failed to delete record: " .. tostring(err) })
                return
            end

            potato.db.update_by_id("Datatables", tid, { updated_at = now_ts })
            req.json(200, { success = true, id = row_id })
            return
        end

        -- LIST / QUERY
        if action == "list" then
            local limit = tonumber(body.limit) or 100
            local offset = tonumber(body.offset) or 0
            local order_by = body.order_by or "id DESC"

            -- Sanitization on order_by
            if string.find(string.upper(order_by), "DROP") or string.find(string.upper(order_by), ";") then
                order_by = "id DESC"
            end

            local sql = string.format("SELECT * FROM %s ORDER BY %s LIMIT %d OFFSET %d", tbl_name, order_by, limit, offset)
            local rows, err = potato.db.run_query(sql)
            if err ~= nil then
                req.json(500, { error = "Failed to list records: " .. tostring(err) })
                return
            end
            req.json(200, { success = true, rows = rows or {} })
            return
        end

        -- GET SINGLE ROW
        if action == "get" then
            local row_id = tonumber(body.row_id or body.id)
            if not row_id then
                req.json(400, { error = "row_id is required for get" })
                return
            end

            local rec, err = potato.db.find_by_id(tbl_name, row_id)
            if not rec or err ~= nil then
                req.json(404, { error = "Record not found" })
                return
            end
            req.json(200, { success = true, row = rec })
            return
        end

        req.json(400, { error = "Unsupported CRUD action: " .. tostring(action) })
        return
    end

    -- 3. GET /autoform/schema - Returns the formatted database schema shape
    if path == "/autoform/schema" and method == "GET" then
        local schema_text = get_tables_shape()
        req.json(200, { schema = schema_text })
        return
    end

    -- 4. GET /autoform/template - Returns the starter HTML template
    if path == "/autoform/template" and method == "GET" then
        req.json(200, { template = get_starter_html() })
        return
    end

    -- 5. GET /autoform - List all forms
    if path == "/autoform" and method == "GET" then
        local list, err = potato.db.find_all_by_cond("AutoForm", {})
        if err ~= nil then
            req.json(500, { error = "Failed to list auto forms: " .. tostring(err) })
            return
        end
        req.json(200, { forms = list or {} })
        return
    end

    -- 6. POST /autoform - Create a new form
    if path == "/autoform" and method == "POST" then
        local body = req.bind_json() or {}
        local name = body.name
        if not name or name == "" then
            name = "New AutoForm"
        end

        local user_prompt = body.base_prompt or body.prompt or ""
        local form_id, err = potato.db.insert("AutoForm", {
            name = name,
            base_prompt = user_prompt,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        if err ~= nil or not form_id then
            req.json(500, { error = "Failed to create auto form: " .. tostring(err) })
            return
        end

        if user_prompt == "" then
            potato.db.insert("AutoFormItem", {
                auto_form_id = form_id,
                role = "assistant",
                content = "Welcome to Formy! I've loaded your database tables. What kind of form or mini-app would you like to build?",
                html_content = nil,
                created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
                updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
            })
        end

        local form, _ = potato.db.find_by_id("AutoForm", form_id)
        req.json(200, { form = form })
        return
    end

    -- Match /autoform/:id routes
    local form_id_str = string.match(path, "^/autoform/(%d+)$")
    if form_id_str then
        local form_id = tonumber(form_id_str)

        -- GET /autoform/:id
        if method == "GET" then
            local form, err = potato.db.find_by_id("AutoForm", form_id)
            if not form or err ~= nil then
                req.json(404, { error = "Form not found" })
                return
            end

            local items = potato.db.find_all_by_cond("AutoFormItem", { auto_form_id = form_id }) or {}
            table.sort(items, function(a, b)
                return (tonumber(a.id) or 0) < (tonumber(b.id) or 0)
            end)

            req.json(200, {
                form = form,
                items = items
            })
            return
        end

        -- PUT /autoform/:id
        if method == "PUT" or method == "PATCH" then
            local body = req.bind_json() or {}
            local updates = { updated_at = os.date("!%Y-%m-%d %H:%M:%SZ") }
            if body.name then updates.name = body.name end
            if body.base_prompt then updates.base_prompt = body.base_prompt end

            potato.db.update_by_id("AutoForm", form_id, updates)
            local form, _ = potato.db.find_by_id("AutoForm", form_id)
            req.json(200, { form = form })
            return
        end

        -- DELETE /autoform/:id
        if method == "DELETE" then
            potato.db.delete_by_cond("AutoFormItem", { auto_form_id = form_id })
            potato.db.delete_by_id("AutoForm", form_id)
            req.json(200, { success = true })
            return
        end
    end

    -- 7. POST /autoform/:id/chat - Process user message with LLM and tools
    local chat_form_id_str = string.match(path, "^/autoform/(%d+)/chat$")
    if chat_form_id_str and method == "POST" then
        local form_id = tonumber(chat_form_id_str)
        local form, f_err = potato.db.find_by_id("AutoForm", form_id)
        if not form or f_err ~= nil then
            req.json(404, { error = "Form not found" })
            return
        end

        local body = req.bind_json() or {}
        local user_content = body.content or body.message
        if not user_content or user_content == "" then
            req.json(400, { error = "Message content is required" })
            return
        end

        -- Insert user message item
        potato.db.insert("AutoFormItem", {
            auto_form_id = form_id,
            role = "user",
            content = user_content,
            html_content = nil,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        -- Find latest HTML from previous items
        local items = potato.db.find_all_by_cond("AutoFormItem", { auto_form_id = form_id }) or {}
        table.sort(items, function(a, b)
            return (tonumber(a.id) or 0) < (tonumber(b.id) or 0)
        end)

        local current_html = get_starter_html()
        for _, it in ipairs(items) do
            if it.html_content and it.html_content ~= "" then
                current_html = it.html_content
            end
        end

        -- Get concise table shapes
        local tables_shape = get_tables_shape()

        -- Build system prompt from internal prompt template
        local system_prompt = get_base_prompt_template()
        system_prompt = string.gsub(system_prompt, "{{schema}}", tables_shape)
        system_prompt = string.gsub(system_prompt, "{{template}}", current_html)

        if form.base_prompt and form.base_prompt ~= "" then
            system_prompt = system_prompt .. "\n\n## Form App Goal / User Objective:\n" .. form.base_prompt
        end

        -- Build messages history for LLM
        local llm_messages = {
            { role = "system", content = system_prompt }
        }

        for _, it in ipairs(items) do
            if it.role == "user" or it.role == "assistant" then
                table.insert(llm_messages, {
                    role = it.role,
                    content = it.content or ""
                })
            end
        end

        -- Tools for Formy
        local tools = {
            list_columns = {
                description = "List physical SQLite database columns and types for a table (e.g. 'Actual1')",
                parameters = {
                    type = "object",
                    properties = {
                        table_name = {
                            type = "string",
                            description = "Name of the table to inspect (e.g. 'Actual1' or friendly table name)"
                        }
                    },
                    required = { "table_name" }
                },
                handler = function(ctx, input)
                    local tbl = input.table_name
                    if not tbl or tbl == "" then
                        return { error = "table_name is required" }
                    end

                    local tid, tbl_name = resolve_table(tbl)
                    if tbl_name then
                        local cols = potato.db.list_columns(tbl_name)
                        return cols or {}
                    end
                    return { error = "Table not found: " .. tostring(tbl) }
                end
            },
            list_meta_columns = {
                description = "List user metadata and configuration for datatable columns (friendly labels, slugs, column_type, options)",
                parameters = {
                    type = "object",
                    properties = {
                        table_id = {
                            type = "integer",
                            description = "The datatable id, e.g. 1 for Actual1"
                        },
                        table_name = {
                            type = "string",
                            description = "Optional table name (e.g. 'Actual1' or 'Students') to resolve table_id automatically"
                        }
                    }
                },
                handler = function(ctx, input)
                    local tid = input.table_id
                    if not tid and input.table_name then
                        tid, _ = resolve_table(input.table_name)
                    end
                    if not tid then
                        return { error = "table_id or Actual<id> or table_name is required" }
                    end
                    local cols = potato.db.find_all_by_cond("DatatableColumns", { table_id = tid })
                    return cols or {}
                end
            },
            query_sample_data = {
                description = "Get a sample of up to 5 rows from a table to inspect existing data structure and values",
                parameters = {
                    type = "object",
                    properties = {
                        table_name = {
                            type = "string",
                            description = "Table name, e.g. 'Actual1' or 'Students'"
                        }
                    },
                    required = { "table_name" }
                },
                handler = function(ctx, input)
                    local tid, tbl_name = resolve_table(input.table_name)
                    if not tbl_name then
                        return { error = "Table not found" }
                    end
                    local sql = string.format("SELECT * FROM %s LIMIT 5", tbl_name)
                    local rows, err = potato.db.run_query(sql)
                    if err ~= nil then
                        return { error = tostring(err) }
                    end
                    return rows or {}
                end
            }
        }

        local model = body.model or "openai/gpt-4o-mini"
        local api_key = body.api_key
        print(string.format("[AutoForm Chat] Processing message for form %d with model %s (content snippet: %.80s)",
            form_id, model, user_content))

        local result, llm_err = llm.llm_chat_with_tools(llm_messages, {
            model_options = {
                model = model,
                api_key = api_key
            },
            tools = tools,
            func_ctx = { form_id = form_id }
        })

        if llm_err ~= nil or not result or not result.llm_response then
            local err_msg = tostring(llm_err or "Unknown LLM error (no response returned)")
            print(string.format("[AutoForm Chat ERROR] %s", err_msg))
            req.json(500, { error = "LLM generation failed: " .. err_msg })
            return
        end

        local asst_msg = result.llm_response.choices and result.llm_response.choices[1] and result.llm_response.choices[1].message
        local raw_content = (asst_msg and asst_msg.content) or ""

        local extracted_html, plain_text = extract_html_and_text(raw_content)
        local final_html = extracted_html or current_html

        -- Save assistant response item
        local asst_item_id = potato.db.insert("AutoFormItem", {
            auto_form_id = form_id,
            role = "assistant",
            content = plain_text,
            html_content = extracted_html,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        local asst_item, _ = potato.db.find_by_id("AutoFormItem", asst_item_id)

        req.json(200, {
            message = plain_text,
            html_content = final_html,
            item = asst_item,
            tool_calls = result and result.tool_calls or {}
        })
        return
    end

    -- 8. PUT /autoform/:id/code - Manually save code from Code tab
    local code_form_id_str = string.match(path, "^/autoform/(%d+)/code$")
    if code_form_id_str and method == "PUT" then
        local form_id = tonumber(code_form_id_str)
        local body = req.bind_json() or {}
        local code = body.html_content or body.code
        if not code then
            req.json(400, { error = "html_content is required" })
            return
        end

        local item_id = potato.db.insert("AutoFormItem", {
            auto_form_id = form_id,
            role = "assistant",
            content = "Manually edited and saved form code.",
            html_content = code,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        local item, _ = potato.db.find_by_id("AutoFormItem", item_id)
        req.json(200, { success = true, item = item })
        return
    end

    req.json(404, { error = "Not found" })
end

return M
