local potato = require("potato")

local function get_user_id(req)
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
    CREATE TABLE IF NOT EXISTS Documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER DEFAULT NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        icon TEXT DEFAULT '📄',
        position INTEGER DEFAULT 0,
        is_starred INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON Documents(parent_id);
    ]]
    pcall(function()
        potato.db.run_ddl(schema)
    end)
end

-- LIST all documents (omitting heavy content for efficiency in sidebar tree)
local function list_documents(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local docs, err = potato.db.find_all_by_cond("Documents", { is_archived = 0 })
    if err ~= nil then
        -- Return empty array if table empty or fresh
        req.json_array(200, {})
        return
    end

    if docs == nil then
        docs = {}
    end

    -- If there are no documents at all, create an initial welcome document
    if #docs == 0 then
        local welcome_content = "<h1>Write something worth keeping.</h1><p>A quiet place for ideas, notes, plans, and everything in between.</p><div class=\"callout\"><strong>Try the editor</strong>Type <b>/</b> at the start of an empty line to open a tiny block menu. Everything you edit is saved automatically.</div><h2>A simple canvas</h2><p>Keep the interface out of the way. The page is the product: generous margins, familiar typography, and just enough controls to make writing feel effortless.</p><ul><li>Use the sidebar to create nested subdocuments in a tree hierarchy.</li><li>Use the toolbar for bold, italic, headings, and lists.</li><li>Type markdown shortcuts like <code># </code>, <code>- </code>, or <code>&gt; </code> for quick formatting.</li></ul><blockquote>Good tools disappear into the work.</blockquote><hr><p>Start organizing your thoughts into nested documents.</p>"
        local id, insert_err = potato.db.insert("Documents", {
            title = "Welcome to Cimple Doks",
            icon = "📖",
            content = welcome_content,
            position = 1,
            is_starred = 1,
            is_archived = 0,
            parent_id = nil
        })
        if id then
            local new_doc, _ = potato.db.find_by_id("Documents", id)
            if new_doc then
                docs = { new_doc }
            end
        end
    end

    -- Return lightweight document summaries for tree building
    local summary = {}
    for _, doc in ipairs(docs) do
        table.insert(summary, {
            id = doc.id,
            parent_id = doc.parent_id,
            title = doc.title or "Untitled",
            icon = doc.icon or "📄",
            position = doc.position or 0,
            is_starred = doc.is_starred or 0,
            created_at = doc.created_at,
            updated_at = doc.updated_at
        })
    end

    req.json_array(200, summary)
end

-- GET single document with full content
local function get_document(ctx, doc_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local doc, err = potato.db.find_by_id("Documents", doc_id)
    if err ~= nil or doc == nil then
        req.json(404, { error = "Document not found" })
        return
    end

    -- Also find direct children count or list
    local children, _ = potato.db.find_all_by_cond("Documents", {
        parent_id = doc_id,
        is_archived = 0
    })

    doc.children_count = 0
    if children ~= nil then
        doc.children_count = #children
    end

    req.json(200, doc)
end

-- CREATE new document
local function create_document(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local parent_id = data.parent_id
    if parent_id == 0 or parent_id == "" then
        parent_id = nil
    end

    local new_doc = {
        title = data.title or "Untitled",
        content = data.content or "<h1>" .. (data.title or "Untitled") .. "</h1><p></p>",
        icon = data.icon or "📄",
        parent_id = parent_id,
        position = data.position or 0,
        is_starred = data.is_starred or 0,
        is_archived = 0,
        created_at = os.date("!%Y-%m-%dT%H:%M:%SZ"),
        updated_at = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }

    local id, err = potato.db.insert("Documents", new_doc)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local created, _ = potato.db.find_by_id("Documents", id)
    req.json(201, created or new_doc)
end

-- UPDATE document
local function update_document(ctx, doc_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    local data = req.bind_json() or {}
    local update_fields = {
        updated_at = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }

    if data.title ~= nil then update_fields.title = data.title end
    if data.content ~= nil then update_fields.content = data.content end
    if data.icon ~= nil then update_fields.icon = data.icon end
    if data.position ~= nil then update_fields.position = data.position end
    if data.is_starred ~= nil then update_fields.is_starred = data.is_starred end
    if data.is_archived ~= nil then update_fields.is_archived = data.is_archived end
    if data.parent_id ~= nil then
        if data.parent_id == 0 or data.parent_id == "" then
            update_fields.parent_id = nil
        else
            update_fields.parent_id = data.parent_id
        end
    end

    local err = potato.db.update_by_id("Documents", doc_id, update_fields)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    local updated, _ = potato.db.find_by_id("Documents", doc_id)
    req.json(200, updated or { id = doc_id })
end

-- RECURSIVE DELETE document and all nested children
local function delete_document_recursive(doc_id)
    local children, _ = potato.db.find_all_by_cond("Documents", { parent_id = doc_id })
    if children ~= nil then
        for _, child in ipairs(children) do
            if child.id ~= nil then
                delete_document_recursive(child.id)
            end
        end
    end
    potato.db.delete_by_id("Documents", doc_id)
end

local function delete_document(ctx, doc_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    ensure_tables()

    delete_document_recursive(doc_id)
    req.json(200, { message = "Document and children deleted successfully", id = doc_id })
end

-- SETUP / MIGRATIONS
function run_migrations(ctx)
    print("Running migrations...")
    local req = ctx.request()
    ensure_tables()

    local result, err = potato.cap.execute("xMigrator", "run_migrations", {folder = "migration"})
    if err then
        print("Migrator error: " .. tostring(err))
    end

    print("Running seeders...")
    local seedResult, seedErr = potato.cap.execute("xStaticSeeder", "seed", {seed_folder = "seed"})
    if seedErr then
        print("Seeder error: " .. tostring(seedErr))
    end

    req.json(200, { message = "Migrations and seeding completed" })
end

function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method = ctx.param("method")

    -- Setup endpoint
    if path == "/setup" and method == "POST" then
        return run_migrations(ctx)
    end

    -- Document endpoints
    if path == "/documents" and method == "GET" then
        return list_documents(ctx)
    end

    if path == "/documents" and method == "POST" then
        return create_document(ctx)
    end

    local doc_id_match = string.match(path, "^/documents/(%d+)$")
    if doc_id_match then
        local doc_id = tonumber(doc_id_match)
        if doc_id ~= nil then
            if method == "GET" then
                return get_document(ctx, doc_id)
            elseif method == "PUT" or method == "PATCH" then
                return update_document(ctx, doc_id)
            elseif method == "DELETE" then
                return delete_document(ctx, doc_id)
            end
        end
    end

    req.json(404, {
        message = "Not Found",
        path = path,
        method = method
    })
end