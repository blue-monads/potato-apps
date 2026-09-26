local potato = require("potato")
local json = require("json")
local llm = require("./server/llm")

local _unpack = table.unpack or unpack

local M = {}



--- Read base prompt template from package file or fallback
local function get_base_prompt_template()
    return potato.core.read_package_file("server/autodash/prompt.txt")
end


--- Read starter HTML template from package file or fallback
local function get_starter_html()
    local content, err = potato.core.read_package_file("server/autodash/ddash.html")
    if err == nil and content and content ~= "" then
        return content
    end

end


--- Get table shapes using potato.db.list_tables() and potato.db.list_columns()
--- Formatted as:
--- <table_name>: <description>
--- <Actual Table Schema>
local function get_tables_shape()
    local lines = {}

    -- 1. Fetch all datatables from Datatables metadata
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

    -- 2. Inspect all tables from list_tables()
    local all_tables = potato.db.list_tables() or {}
    local processed_tids = {}

    local function build_table_schema(tid, dt, raw_tbl_name)
        local tbl_name = "Actual" .. tid
        local desc = (dt and dt.name) or tbl_name
        if dt and dt.info and dt.info ~= "" then
            desc = desc .. " - " .. dt.info
        end

        -- Query physical columns
        local cols = potato.db.list_columns(tbl_name) or {}
        if #cols == 0 and raw_tbl_name then
            cols = potato.db.list_columns(raw_tbl_name) or {}
        end

        -- Query column friendly metadata
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
            -- If physical table has not run DDL yet, build from metadata
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

    -- Match against list_tables() (matching "Actual<id>" or "zz_...__Actual<id>")
    for _, raw_tbl_name in ipairs(all_tables) do
        local tid = string.match(raw_tbl_name, "[Aa]ctual(%d+)")
        if tid and dt_map[tid] and not processed_tids[tid] then
            processed_tids[tid] = true
            build_table_schema(tid, dt_map[tid], raw_tbl_name)
        end
    end

    -- Also process any active datatables from dt_map not yet present in list_tables
    for tid, dt in pairs(dt_map) do
        if not processed_tids[tid] then
            processed_tids[tid] = true
            build_table_schema(tid, dt, nil)
        end
    end

    if #lines == 0 then
        table.insert(lines, "No Actual data tables found in database.")
    end

    local final_shape = table.concat(lines, "\n")
    print(string.format("[AutoDash Schema] Found %d tables\n%s", (function() local c = 0 for _ in pairs(processed_tids) do c = c + 1 end return c end)(), final_shape))
    return final_shape
end

--- Validates that an SQL query is safe and read-only
local function is_safe_query(sql)
    if not sql or type(sql) ~= "string" then
        return false, "SQL query string is required"
    end

    local clean = string.gsub(sql, "^%s+", "")
    local first_word = string.upper(string.match(clean, "^(%a+)") or "")
    if first_word ~= "SELECT" and first_word ~= "WITH" and first_word ~= "EXPLAIN" then
        return false, "Only SELECT and WITH queries are allowed in the dashboard"
    end

    local upper = " " .. string.upper(sql) .. " "
    local forbidden = { "DROP ", "DELETE ", "UPDATE ", "INSERT ", "ALTER ", "ATTACH ", "DETACH ", "PRAGMA ", "REINDEX ", "VACUUM " }
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
        plain_text = "Dashboard updated successfully."
    end

    return html_content, plain_text
end

--- Main route handler for /autodash endpoints
function M.handle_routes(ctx, path, method)
    local req = ctx.request()

    -- 1. POST /autodash/query - Safe read-only SQL execution for dashboard iframe
    if path == "/autodash/query" and method == "POST" then
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
            print(string.format("[AutoDash Query Error] SQL: %s, error: %s", tostring(sql), tostring(err)))
            req.json(500, { error = tostring(err) })
            return
        end

        req.json(200, { rows = rows or {} })
        return
    end

    -- 2. GET /autodash/schema - Returns the formatted database schema shape
    if path == "/autodash/schema" and method == "GET" then
        local schema_text = get_tables_shape()
        req.json(200, { schema = schema_text })
        return
    end

    -- 2b. GET /autodash/template - Returns the base prompt template
    if path == "/autodash/template" and method == "GET" then
        req.json(200, { template = get_base_prompt_template() })
        return
    end

    -- 3. GET /autodash - List all dashboards
    if path == "/autodash" and method == "GET" then
        local list, err = potato.db.find_all_by_cond("AutoDash", {})
        if err ~= nil then
            req.json(500, { error = "Failed to list dashboards: " .. tostring(err) })
            return
        end
        req.json(200, { dashboards = list or {} })
        return
    end

    -- 4. POST /autodash - Create a new dashboard
    if path == "/autodash" and method == "POST" then
        local body = req.bind_json() or {}
        local name = body.name
        if not name or name == "" then
            name = "New Dashboard"
        end

        local user_prompt = body.base_prompt or body.prompt or ""
        local dash_id, err = potato.db.insert("AutoDash", {
            name = name,
            base_prompt = user_prompt,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        if err ~= nil or not dash_id then
            req.json(500, { error = "Failed to create dashboard: " .. tostring(err) })
            return
        end

        local starter_html = get_starter_html()
        potato.db.insert("AutoDashItem", {
            auto_dash_id = dash_id,
            role = "assistant",
            content = "Welcome to Dashy! I've loaded your database tables. What would you like to build or visualize?",
            html_content = starter_html,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        local dash, _ = potato.db.find_by_id("AutoDash", dash_id)
        req.json(200, { dashboard = dash })
        return
    end

    -- Match /autodash/:id routes
    local dash_id_str = string.match(path, "^/autodash/(%d+)$")
    if dash_id_str then
        local dash_id = tonumber(dash_id_str)

        -- GET /autodash/:id
        if method == "GET" then
            local dash, err = potato.db.find_by_id("AutoDash", dash_id)
            if not dash or err ~= nil then
                req.json(404, { error = "Dashboard not found" })
                return
            end

            local items = potato.db.find_all_by_cond("AutoDashItem", { auto_dash_id = dash_id }) or {}
            table.sort(items, function(a, b)
                return (tonumber(a.id) or 0) < (tonumber(b.id) or 0)
            end)

            req.json(200, {
                dashboard = dash,
                items = items
            })
            return
        end

        -- PUT /autodash/:id (Rename or update base prompt)
        if method == "PUT" or method == "PATCH" then
            local body = req.bind_json() or {}
            local updates = { updated_at = os.date("!%Y-%m-%d %H:%M:%SZ") }
            if body.name then updates.name = body.name end
            if body.base_prompt then updates.base_prompt = body.base_prompt end

            potato.db.update_by_id("AutoDash", dash_id, updates)
            local dash, _ = potato.db.find_by_id("AutoDash", dash_id)
            req.json(200, { dashboard = dash })
            return
        end

        -- DELETE /autodash/:id
        if method == "DELETE" then
            potato.db.delete_by_cond("AutoDashItem", { auto_dash_id = dash_id })
            potato.db.delete_by_id("AutoDash", dash_id)
            req.json(200, { success = true })
            return
        end
    end

    -- 5. POST /autodash/:id/chat - Process user message with LLM and tools
    local chat_dash_id_str = string.match(path, "^/autodash/(%d+)/chat$")
    if chat_dash_id_str and method == "POST" then
        local dash_id = tonumber(chat_dash_id_str)
        local dash, d_err = potato.db.find_by_id("AutoDash", dash_id)
        if not dash or d_err ~= nil then
            req.json(404, { error = "Dashboard not found" })
            return
        end

        local body = req.bind_json() or {}
        local user_content = body.content or body.message
        if not user_content or user_content == "" then
            req.json(400, { error = "Message content is required" })
            return
        end

        -- Insert user message item
        potato.db.insert("AutoDashItem", {
            auto_dash_id = dash_id,
            role = "user",
            content = user_content,
            html_content = nil,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        -- Find latest HTML from previous items
        local items = potato.db.find_all_by_cond("AutoDashItem", { auto_dash_id = dash_id }) or {}
        table.sort(items, function(a, b)
            return (tonumber(a.id) or 0) < (tonumber(b.id) or 0)
        end)

        local current_html = get_starter_html()
        for _, it in ipairs(items) do
            if it.html_content and it.html_content ~= "" then
                current_html = it.html_content
            end
        end

        -- Get concise table shapes (<table_name>: <description>\n<Actual Table Schema>)
        local tables_shape = get_tables_shape()

        -- Build system prompt from internal prompt template
        local system_prompt = get_base_prompt_template()
        system_prompt = string.gsub(system_prompt, "{{schema}}", tables_shape)
        system_prompt = string.gsub(system_prompt, "{{template}}", current_html)

        if dash.base_prompt and dash.base_prompt ~= "" then
            system_prompt = system_prompt .. "\n\n## Dashboard Goal / User Objective:\n" .. dash.base_prompt
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

        -- Define tools for list_columns and list_meta_columns
        local tools = {
            list_columns = {
                description = "List physical SQLite database columns and types for a table using potato.db.list_columns (e.g. 'Actual1')",
                parameters = {
                    type = "object",
                    properties = {
                        table_name = {
                            type = "string",
                            description = "Name of the table to inspect (e.g. 'Actual1')"
                        }
                    },
                    required = { "table_name" }
                },
                handler = function(ctx, input)
                    local tbl = input.table_name
                    if not tbl or tbl == "" then
                        return { error = "table_name is required" }
                    end

                    -- Try direct
                    local cols = potato.db.list_columns(tbl)
                    if (not cols or #cols == 0) then
                        local tid = tonumber(string.match(tbl, "[Aa]ctual(%d+)"))
                        if not tid then
                            -- Try matching by Datatable name (e.g. "Events")
                            local dts = potato.db.find_all_by_cond("Datatables", {}) or {}
                            local target = string.lower(tbl)
                            for _, dt in ipairs(dts) do
                                if string.lower(dt.name or "") == target then
                                    tid = dt.id
                                    break
                                end
                            end
                        end
                        if tid then
                            cols = potato.db.list_columns("Actual" .. tostring(tid))
                        end
                    end
                    return cols or {}
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
                            description = "Optional table name (e.g. 'Actual1' or 'Events') to resolve table_id automatically"
                        }
                    }
                },
                handler = function(ctx, input)
                    local tid = input.table_id
                    if not tid and input.table_name then
                        tid = tonumber(string.match(input.table_name, "[Aa]ctual(%d+)"))
                        if not tid then
                            local dts = potato.db.find_all_by_cond("Datatables", {}) or {}
                            local target = string.lower(input.table_name)
                            for _, dt in ipairs(dts) do
                                if string.lower(dt.name or "") == target then
                                    tid = dt.id
                                    break
                                end
                            end
                        end
                    end
                    if not tid then
                        return { error = "table_id or Actual<id> or table_name is required" }
                    end
                    local cols = potato.db.find_all_by_cond("DatatableColumns", { table_id = tid })
                    return cols or {}
                end
            }
        }

        -- Call LLM using tool call loop abstraction
        local model = body.model or "openai/gpt-4o-mini"
        local api_key = body.api_key
        print(string.format("[AutoDash Chat] Processing message for dashboard %d with model %s (content snippet: %.80s)",
            dash_id, model, user_content))

        local result, llm_err = llm.llm_chat_with_tools(llm_messages, {
            model_options = {
                model = model,
                api_key = api_key
            },
            tools = tools,
            func_ctx = { dash_id = dash_id }
        })

        if llm_err ~= nil or not result or not result.llm_response then
            local err_msg = tostring(llm_err or "Unknown LLM error (no response returned)")
            print(string.format("[AutoDash Chat ERROR] %s", err_msg))
            req.json(500, { error = "LLM generation failed: " .. err_msg })
            return
        end

        local asst_msg = result.llm_response.choices and result.llm_response.choices[1] and result.llm_response.choices[1].message
        local raw_content = (asst_msg and asst_msg.content) or ""

        local extracted_html, plain_text = extract_html_and_text(raw_content)
        local final_html = extracted_html or current_html

        -- Save assistant response item
        local asst_item_id = potato.db.insert("AutoDashItem", {
            auto_dash_id = dash_id,
            role = "assistant",
            content = plain_text,
            html_content = final_html,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        local asst_item, _ = potato.db.find_by_id("AutoDashItem", asst_item_id)

        req.json(200, {
            message = plain_text,
            html_content = final_html,
            item = asst_item,
            tool_calls = result and result.tool_calls or {}
        })
        return
    end

    -- 6. PUT /autodash/:id/code - Manually save code from Code tab
    local code_dash_id_str = string.match(path, "^/autodash/(%d+)/code$")
    if code_dash_id_str and method == "PUT" then
        local dash_id = tonumber(code_dash_id_str)
        local body = req.bind_json() or {}
        local code = body.html_content or body.code
        if not code then
            req.json(400, { error = "html_content is required" })
            return
        end

        local item_id = potato.db.insert("AutoDashItem", {
            auto_dash_id = dash_id,
            role = "assistant",
            content = "Manually edited and saved code.",
            html_content = code,
            created_at = os.date("!%Y-%m-%d %H:%M:%SZ"),
            updated_at = os.date("!%Y-%m-%d %H:%M:%SZ")
        })

        local item, _ = potato.db.find_by_id("AutoDashItem", item_id)
        req.json(200, { success = true, item = item })
        return
    end

    req.json(404, { error = "Not found" })
end

return M
