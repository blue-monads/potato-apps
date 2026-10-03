local potato = require("potato")

local unpack_fn = table.unpack or unpack

local function run_q(sql, params)
    if params ~= nil and #params > 0 then
        return potato.db.run_query(sql, unpack_fn(params))
    end
    return potato.db.run_query(sql)
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
    CREATE TABLE IF NOT EXISTS Cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        card_type TEXT NOT NULL DEFAULT 'text', 
        size_x INTEGER NOT NULL DEFAULT 300,
        size_y INTEGER NOT NULL DEFAULT 180,
        position_x INTEGER NOT NULL DEFAULT 0,
        position_y INTEGER NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '',
        card_data TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CardLinks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_card_id INTEGER NOT NULL,
        linked_card_id INTEGER NOT NULL,
        source_handle TEXT NOT NULL DEFAULT 'r',
        linked_handle TEXT NOT NULL DEFAULT 'l',
        label TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#94a3b8',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cards_type ON Cards(card_type);
    CREATE INDEX IF NOT EXISTS idx_cardlinks_source ON CardLinks(source_card_id);
    CREATE INDEX IF NOT EXISTS idx_cardlinks_linked ON CardLinks(linked_card_id);
    ]]
    pcall(function()
        potato.db.run_ddl(schema)
    end)

    -- Seed starter canvas if Cards table is empty
    local cards_count_res = run_q("SELECT COUNT(*) as cnt FROM Cards")
    local count = (cards_count_res and #cards_count_res > 0) and tonumber(cards_count_res[1].cnt) or 0
    if count == 0 then
        local now = os.date("!%Y-%m-%d %H:%M:%S")
        local starter_cards = {
            {
                title = "Mindmap & Research Hub",
                description = "Infinite canvas for brainstorming, organizing research, and connecting thoughts in public.",
                card_type = "text",
                size_x = 320,
                size_y = 180,
                position_x = 420,
                position_y = 260,
                color = "#3b82f6",
                card_data = "{}"
            },
            {
                title = "Visual References",
                description = "Curated visual ideas and diagrams for rapid synthesis.",
                card_type = "image",
                size_x = 320,
                size_y = 280,
                position_x = 30,
                position_y = 80,
                color = "#8b5cf6",
                card_data = "{\"url\":\"https://images.unsplash.com/photo-1507842229451-7f01be7fe0ab?auto=format&fit=crop&w=800&q=80\",\"caption\":\"Exploring architectures and mental models\"}"
            },
            {
                title = "Knowledge Repositories",
                description = "Essential links and documentation.",
                card_type = "link",
                size_x = 320,
                size_y = 190,
                position_x = 860,
                position_y = 100,
                color = "#10b981",
                card_data = "{\"url\":\"https://en.wikipedia.org/wiki/Mind_map\",\"linkTitle\":\"Mind Map Theory & Cognition\",\"domain\":\"wikipedia.org\"}"
            },
            {
                title = "Guiding Principle",
                description = "Simplicity is prerequisite for reliability.",
                card_type = "quote",
                size_x = 320,
                size_y = 190,
                position_x = 40,
                position_y = 440,
                color = "#f59e0b",
                card_data = "{\"source\":\"Edsger W. Dijkstra\"}"
            },
            {
                title = "Action Checklist",
                description = "Key next milestones for exploration.",
                card_type = "list",
                size_x = 320,
                size_y = 240,
                position_x = 860,
                position_y = 380,
                color = "#ec4899",
                card_data = "{\"items\":[{\"id\":\"1\",\"text\":\"Structure main research branches\",\"done\":true},{\"id\":\"2\",\"text\":\"Connect supporting hypotheses\",\"done\":true},{\"id\":\"3\",\"text\":\"Synthesize actionable insights\",\"done\":false}]}"
            },
            {
                title = "Eureka Note!",
                description = "Connecting disparate nodes creates unexpected cognitive sparks. Keep notes atomic!",
                card_type = "note",
                size_x = 260,
                size_y = 190,
                position_x = 450,
                position_y = 20,
                color = "#eab308",
                card_data = "{}"
            }
        }

        local id_map = {}
        for idx, c in ipairs(starter_cards) do
            c.created_at = now
            c.updated_at = now
            local new_id, err = potato.db.insert("Cards", c)
            if not err and new_id then
                id_map[idx] = new_id
            end
        end

        if id_map[1] and id_map[2] and id_map[3] and id_map[4] and id_map[5] and id_map[6] then
            local starter_links = {
                { source_card_id = id_map[1], linked_card_id = id_map[2], source_handle = "l", linked_handle = "r", label = "visuals", color = "#8b5cf6" },
                { source_card_id = id_map[1], linked_card_id = id_map[3], source_handle = "r", linked_handle = "l", label = "references", color = "#10b981" },
                { source_card_id = id_map[1], linked_card_id = id_map[4], source_handle = "l", linked_handle = "r", label = "philosophy", color = "#f59e0b" },
                { source_card_id = id_map[1], linked_card_id = id_map[5], source_handle = "r", linked_handle = "l", label = "milestones", color = "#ec4899" },
                { source_card_id = id_map[1], linked_card_id = id_map[6], source_handle = "t", linked_handle = "b", label = "spark", color = "#eab308" }
            }
            for _, link in ipairs(starter_links) do
                link.created_at = now
                link.updated_at = now
                potato.db.insert("CardLinks", link)
            end
        end
    end
end

-- ============================================================
-- CARDS HANDLERS
-- ============================================================

local function list_cards(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local cards, err = run_q("SELECT * FROM Cards ORDER BY id ASC")
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json_array(200, cards or {})
end

local function get_card(ctx, card_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local card, err = potato.db.find_by_id("Cards", card_id)
    if err ~= nil or card == nil then
        req.json(404, { error = "Card not found" })
        return
    end

    req.json(200, card)
end

local function create_card(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local now_str = os.date("!%Y-%m-%d %H:%M:%S")

    local new_card = {
        title = data.title or "Untitled Card",
        description = data.description or "",
        card_type = data.card_type or "text",
        size_x = tonumber(data.size_x) or 300,
        size_y = tonumber(data.size_y) or 180,
        position_x = tonumber(data.position_x) or 0,
        position_y = tonumber(data.position_y) or 0,
        color = data.color or "",
        card_data = type(data.card_data) == "table" and potato.json.encode(data.card_data) or (data.card_data or "{}"),
        created_at = now_str,
        updated_at = now_str
    }

    local id, err = potato.db.insert("Cards", new_card)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    local created, _ = potato.db.find_by_id("Cards", id)
    req.json(201, created or new_card)
end

local function update_card(ctx, card_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local update_fields = {
        updated_at = os.date("!%Y-%m-%d %H:%M:%S")
    }

    if data.title ~= nil then update_fields.title = tostring(data.title) end
    if data.description ~= nil then update_fields.description = tostring(data.description) end
    if data.card_type ~= nil then update_fields.card_type = tostring(data.card_type) end
    if data.size_x ~= nil then update_fields.size_x = tonumber(data.size_x) or 300 end
    if data.size_y ~= nil then update_fields.size_y = tonumber(data.size_y) or 180 end
    if data.position_x ~= nil then update_fields.position_x = tonumber(data.position_x) or 0 end
    if data.position_y ~= nil then update_fields.position_y = tonumber(data.position_y) or 0 end
    if data.color ~= nil then update_fields.color = tostring(data.color) end
    if data.card_data ~= nil then
        if type(data.card_data) == "table" then
            update_fields.card_data = potato.json.encode(data.card_data)
        else
            update_fields.card_data = tostring(data.card_data)
        end
    end

    local err = potato.db.update_by_id("Cards", card_id, update_fields)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    local updated, _ = potato.db.find_by_id("Cards", card_id)
    req.json(200, updated or { id = card_id })
end

local function delete_card(ctx, card_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    -- Delete associated links
    run_q("DELETE FROM CardLinks WHERE source_card_id = ? OR linked_card_id = ?", { card_id, card_id })

    local err = potato.db.delete_by_id("Cards", card_id)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json(200, { message = "Card deleted", id = card_id })
end

-- ============================================================
-- LINKS HANDLERS
-- ============================================================

local function list_links(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local links, err = run_q("SELECT * FROM CardLinks ORDER BY id ASC")
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json_array(200, links or {})
end

local function create_link(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local source_id = tonumber(data.source_card_id)
    local linked_id = tonumber(data.linked_card_id)

    if not source_id or not linked_id then
        req.json(400, { error = "source_card_id and linked_card_id are required" })
        return
    end

    local now_str = os.date("!%Y-%m-%d %H:%M:%S")
    local new_link = {
        source_card_id = source_id,
        linked_card_id = linked_id,
        source_handle = data.source_handle or "r",
        linked_handle = data.linked_handle or "l",
        label = data.label or "",
        color = data.color or "#94a3b8",
        created_at = now_str,
        updated_at = now_str
    }

    local id, err = potato.db.insert("CardLinks", new_link)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    local created, _ = potato.db.find_by_id("CardLinks", id)
    req.json(201, created or new_link)
end

local function update_link(ctx, link_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local update_fields = {
        updated_at = os.date("!%Y-%m-%d %H:%M:%S")
    }

    if data.source_handle ~= nil then update_fields.source_handle = tostring(data.source_handle) end
    if data.linked_handle ~= nil then update_fields.linked_handle = tostring(data.linked_handle) end
    if data.label ~= nil then update_fields.label = tostring(data.label) end
    if data.color ~= nil then update_fields.color = tostring(data.color) end

    local err = potato.db.update_by_id("CardLinks", link_id, update_fields)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    local updated, _ = potato.db.find_by_id("CardLinks", link_id)
    req.json(200, updated or { id = link_id })
end

local function delete_link(ctx, link_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local err = potato.db.delete_by_id("CardLinks", link_id)
    if err ~= nil then
        req.json(500, { error = tostring(err) })
        return
    end

    req.json(200, { message = "Link deleted", id = link_id })
end

local function reset_canvas(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    run_q("DELETE FROM CardLinks")
    run_q("DELETE FROM Cards")

    -- Call ensure_tables to re-populate default state
    ensure_tables()

    local cards, _ = run_q("SELECT * FROM Cards ORDER BY id ASC")
    local links, _ = run_q("SELECT * FROM CardLinks ORDER BY id ASC")

    req.json(200, {
        message = "Canvas reset to defaults",
        cards = cards or {},
        links = links or {}
    })
end

-- ============================================================
-- MIGRATION & SEEDING SETUP
-- ============================================================

function run_migrations(ctx)
    print("Running inficanvas migrations...")
    local req = ctx.request()
    ensure_tables()

    local result, err = potato.cap.execute("xMigrator", "run_migrations", {folder = "migration"})
    if err then
        print("Migration notice: " .. tostring(err))
    end

    print("Running inficanvas seeders...")
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

    -- Setup and reset endpoints
    if path == "/setup" and method == "POST" then
        return run_migrations(ctx)
    end

    if path == "/reset" and method == "POST" then
        return reset_canvas(ctx)
    end

    -- Cards collection routes
    if path == "/cards" then
        if method == "GET" then
            return list_cards(ctx)
        elseif method == "POST" then
            return create_card(ctx)
        end
    end

    -- Specific card routes
    local card_id_match = string.match(path, "^/cards/(%d+)$")
    if card_id_match then
        local card_id = tonumber(card_id_match)
        if method == "GET" then
            return get_card(ctx, card_id)
        elseif method == "PUT" or method == "PATCH" then
            return update_card(ctx, card_id)
        elseif method == "DELETE" then
            return delete_card(ctx, card_id)
        end
    end

    -- Links collection routes
    if path == "/links" then
        if method == "GET" then
            return list_links(ctx)
        elseif method == "POST" then
            return create_link(ctx)
        end
    end

    -- Specific link routes
    local link_id_match = string.match(path, "^/links/(%d+)$")
    if link_id_match then
        local link_id = tonumber(link_id_match)
        if method == "PUT" or method == "PATCH" then
            return update_link(ctx, link_id)
        elseif method == "DELETE" then
            return delete_link(ctx, link_id)
        end
    end

    req.json(404, {
        message = "Not Found",
        path = path,
        method = method
    })
end