local potato = require("potato")

local unpack_fn = table.unpack or unpack

local function run_q(sql, params)
    if params ~= nil and #params > 0 then
        return potato.db.run_query(sql, unpack_fn(params))
    end
    return potato.db.run_query(sql)
end

local function get_query_param(req, name, default_val)
    local val = req.default_query(name, default_val or "")
    if val == nil or val == "" then return default_val end
    return tostring(val)
end

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

local function ensure_tables()
    local schema = [[
    CREATE TABLE IF NOT EXISTS CalTags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#4f6ef7',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CalEvents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        all_day INTEGER NOT NULL DEFAULT 0,
        tag_id TEXT NOT NULL DEFAULT 'other',
        color_type TEXT NOT NULL DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_calevents_start_date ON CalEvents(start_date);
    CREATE INDEX IF NOT EXISTS idx_calevents_tag_id ON CalEvents(tag_id);
    ]]
    pcall(function()
        potato.db.run_ddl(schema)
    end)

    -- Seed default tags if empty
    local tags_count_res = run_q("SELECT COUNT(*) as cnt FROM CalTags")
    local tags_count = (tags_count_res and #tags_count_res > 0) and tonumber(tags_count_res[1].cnt) or 0
    if tags_count == 0 then
        local default_tags = {
            { id = "work", name = "Work", color = "#46a86a" },
            { id = "personal", name = "Personal", color = "#df8b4c" },
            { id = "focus", name = "Focus", color = "#9b6ad0" },
            { id = "other", name = "Other", color = "#7c8795" }
        }
        for _, t in ipairs(default_tags) do
            run_q("INSERT OR REPLACE INTO CalTags (id, name, color) VALUES (?, ?, ?)", { t.id, t.name, t.color })
        end
    end

    -- Seed initial events if empty
    local events_count_res = run_q("SELECT COUNT(*) as cnt FROM CalEvents")
    local events_count = (events_count_res and #events_count_res > 0) and tonumber(events_count_res[1].cnt) or 0
    if events_count == 0 then
        local today = os.date("%Y-%m-%d")
        local initial_events = {
            {
                title = "Team Standup",
                description = "Daily standup meeting to sync on tasks and blockers.",
                start_date = today .. " 10:00:00",
                end_date = today .. " 10:30:00",
                all_day = 0,
                tag_id = "work",
                color_type = "work"
            },
            {
                title = "Deep Work Session",
                description = "Focused programming and feature refinement.",
                start_date = today .. " 13:30:00",
                end_date = today .. " 15:30:00",
                all_day = 0,
                tag_id = "focus",
                color_type = "focus"
            },
            {
                title = "Dinner with Friends",
                description = "Catching up at the restaurant downtown.",
                start_date = today .. " 19:00:00",
                end_date = today .. " 21:00:00",
                all_day = 0,
                tag_id = "personal",
                color_type = "personal"
            }
        }
        for _, ev in ipairs(initial_events) do
            potato.db.insert("CalEvents", ev)
        end
    end
end

-- ============================================================
-- EVENTS HANDLERS
-- ============================================================

local function list_events(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local tag_id = get_query_param(req, "tag_id", "")
    local start_date = get_query_param(req, "start_date", "")
    local end_date = get_query_param(req, "end_date", "")
    local search = get_query_param(req, "q", "") or get_query_param(req, "search", "")

    local where_clauses = {}
    local args = {}

    if tag_id ~= "" and tag_id ~= "all" then
        table.insert(where_clauses, "tag_id = ?")
        table.insert(args, tag_id)
    end

    if start_date ~= "" then
        table.insert(where_clauses, "end_date >= ?")
        table.insert(args, start_date)
    end

    if end_date ~= "" then
        table.insert(where_clauses, "start_date <= ?")
        table.insert(args, end_date)
    end

    if search ~= "" then
        local pattern = "%" .. search .. "%"
        table.insert(where_clauses, "(title LIKE ? OR description LIKE ?)")
        table.insert(args, pattern)
        table.insert(args, pattern)
    end

    local sql = "SELECT * FROM CalEvents"
    if #where_clauses > 0 then
        sql = sql .. " WHERE " .. table.concat(where_clauses, " AND ")
    end
    sql = sql .. " ORDER BY start_date ASC, id ASC"

    local events, err = run_q(sql, args)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json_array(200, events or {})
end

local function get_event(ctx, event_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local event, err = potato.db.find_by_id("CalEvents", event_id)
    if err ~= nil or event == nil then
        req.json(404, { error = "Event not found" })
        return
    end

    req.json(200, event)
end

local function create_event(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    if not data.title or data.title == "" then
        req.json(400, { error = "Title is required" })
        return
    end

    if not data.start_date or data.start_date == "" then
        req.json(400, { error = "start_date is required" })
        return
    end

    local now_str = os.date("!%Y-%m-%d %H:%M:%S")
    local new_event = {
        title = data.title,
        description = data.description or "",
        start_date = data.start_date,
        end_date = (data.end_date and data.end_date ~= "") and data.end_date or data.start_date,
        all_day = (data.all_day == true or data.all_day == 1) and 1 or 0,
        tag_id = data.tag_id or "other",
        color_type = data.color_type or "default",
        created_at = now_str,
        updated_at = now_str
    }

    local id, err = potato.db.insert("CalEvents", new_event)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    local created, _ = potato.db.find_by_id("CalEvents", id)
    req.json(201, created or new_event)
end

local function update_event(ctx, event_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local update_fields = {
        updated_at = os.date("!%Y-%m-%d %H:%M:%S")
    }

    if data.title ~= nil then update_fields.title = data.title end
    if data.description ~= nil then update_fields.description = data.description end
    if data.start_date ~= nil then update_fields.start_date = data.start_date end
    if data.end_date ~= nil then update_fields.end_date = data.end_date end
    if data.all_day ~= nil then
        update_fields.all_day = (data.all_day == true or data.all_day == 1) and 1 or 0
    end
    if data.tag_id ~= nil then update_fields.tag_id = data.tag_id end
    if data.color_type ~= nil then update_fields.color_type = data.color_type end

    local err = potato.db.update_by_id("CalEvents", event_id, update_fields)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    local updated, _ = potato.db.find_by_id("CalEvents", event_id)
    req.json(200, updated or { id = event_id })
end

local function delete_event(ctx, event_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local err = potato.db.delete_by_id("CalEvents", event_id)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json(200, { message = "Event deleted", id = event_id })
end

-- ============================================================
-- TAGS HANDLERS
-- ============================================================

local function list_tags(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local tags, err = run_q("SELECT * FROM CalTags ORDER BY id ASC")
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json_array(200, tags or {})
end

local function create_tag(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    if not data.name or data.name == "" then
        req.json(400, { error = "Tag name is required" })
        return
    end

    local id = data.id
    if not id or id == "" then
        id = "tag-" .. tostring(os.time()) .. "-" .. tostring(math.random(100, 999))
    end
    local color = data.color or "#4f6ef7"

    local _, err = run_q("INSERT OR REPLACE INTO CalTags (id, name, color) VALUES (?, ?, ?)", { id, data.name, color })
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json(201, { id = id, name = data.name, color = color })
end

local function update_tag(ctx, tag_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local name = data.name
    local color = data.color

    if name and color then
        run_q("UPDATE CalTags SET name = ?, color = ? WHERE id = ?", { name, color, tag_id })
    elseif name then
        run_q("UPDATE CalTags SET name = ? WHERE id = ?", { name, tag_id })
    elseif color then
        run_q("UPDATE CalTags SET color = ? WHERE id = ?", { color, tag_id })
    end

    local rows = run_q("SELECT * FROM CalTags WHERE id = ?", { tag_id })
    if rows and #rows > 0 then
        req.json(200, rows[1])
    else
        req.json(404, { error = "Tag not found" })
    end
end

local function delete_tag(ctx, tag_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    run_q("DELETE FROM CalTags WHERE id = ?", { tag_id })
    -- Reassign events using this tag to 'other'
    run_q("UPDATE CalEvents SET tag_id = 'other' WHERE tag_id = ?", { tag_id })

    req.json(200, { message = "Tag deleted", id = tag_id })
end

-- ============================================================
-- MIGRATION & SEEDING SETUP
-- ============================================================

function run_migrations(ctx)
    print("Running calendar migrations...")
    local req = ctx.request()
    ensure_tables()

    local result, err = potato.cap.execute("xMigrator", "run_migrations", {folder = "migration"})
    if err then
        print("Migration notice: " .. tostring(err))
    end

    print("Running calendar seeders...")
    local seedResult, seedErr = potato.cap.execute("xStaticSeeder", "seed", {seed_folder = "seed"})
    if seedErr then
        print("Seed notice: " .. tostring(seedErr))
    end

    req.json(200, { message = "Migrations and seeding completed successfully" })
end

-- ============================================================
-- ROUTING
-- ============================================================

function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method = ctx.param("method")

    -- Setup endpoint
    if path == "/setup" and method == "POST" then
        return run_migrations(ctx)
    end

    -- Events routes
    if path == "/events" then
        if method == "GET" then
            return list_events(ctx)
        elseif method == "POST" then
            return create_event(ctx)
        end
    end

    local event_id_match = string.match(path, "^/events/(%d+)$")
    if event_id_match then
        local event_id = tonumber(event_id_match)
        if method == "GET" then
            return get_event(ctx, event_id)
        elseif method == "PUT" or method == "PATCH" then
            return update_event(ctx, event_id)
        elseif method == "DELETE" then
            return delete_event(ctx, event_id)
        end
    end

    -- Tags routes
    if path == "/tags" then
        if method == "GET" then
            return list_tags(ctx)
        elseif method == "POST" then
            return create_tag(ctx)
        end
    end

    local tag_id_match = string.match(path, "^/tags/([%w%-_]+)$")
    if tag_id_match then
        local tag_id = tag_id_match
        if method == "PUT" or method == "PATCH" then
            return update_tag(ctx, tag_id)
        elseif method == "DELETE" then
            return delete_tag(ctx, tag_id)
        end
    end

    req.json(404, {
        message = "Not Found",
        path = path,
        method = method
    })
end