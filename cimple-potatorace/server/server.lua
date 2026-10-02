local potato = require("potato")
local json = require("json")

-- ─── helpers ──────────────────────────────────────────────────────────────────

function get_user_id(req)
    local userId, err = req.get_user_id()
    if err then
        req.json(401, { error = "Unauthorized" })
        return nil
    end
    return userId
end

function random_code()
    local chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    local code = ""
    math.randomseed(os.time() + math.random(1000))
    for _ = 1, 5 do
        local idx = math.random(1, #chars)
        code = code .. string.sub(chars, idx, idx)
    end
    return code
end

function decode_players(room)
    local ok, players = pcall(json.decode, room.players_json or "[]")
    if not ok or type(players) ~= "table" then
        players = {}
    end
    room.players = players
    room.players_json = nil
    return room
end

-- broadcast room state to everyone in the room topic
function broadcast_room(room_id, event_type, payload)
    local _, err = potato.cap.execute("xEasyWS", "broadcast", {
        type    = event_type,
        room_id = room_id,
        data    = payload
    })
    if err then
        print("broadcast_room error: " .. tostring(err))
    end
end

-- ─── setup / migrations ───────────────────────────────────────────────────────

function run_migrations(ctx)
    local req = ctx.request()
    local result, err = potato.cap.execute("xMigrator", "run_migrations", { folder = "migration" })
    if err then
        req.json(500, { error = tostring(err) })
        return
    end
    req.json(200, { message = "Migrations completed" })
end

-- ─── WS token ─────────────────────────────────────────────────────────────────

function get_ws_token(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local rand = math.random(100000, 999999)
    local conn_id = "u" .. tostring(userId) .. "t" .. tostring(os.time()) .. "r" .. tostring(rand)

    local token, err = potato.cap.sign_token("xEasyWS", {
        user_id     = userId,
        resource_id = conn_id
    })
    if err then
        req.json(500, { error = "Failed to sign ws token: " .. tostring(err) })
        return
    end

    req.json(200, { token = token, conn_id = conn_id })
end

-- ─── room CRUD ────────────────────────────────────────────────────────────────

function create_room(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json() or {}
    local name  = body.name or ""
    local code  = random_code()

    local id, err = potato.db.insert("rooms", {
        code          = code,
        name          = name,
        host_user_id  = userId,
        host_conn_id  = body.conn_id or "",
        status        = "waiting",
        max_players   = body.max_players or 4,
        player_count  = 0,
        players_json  = "[]",
    })
    if err then
        req.json(500, { error = "Failed to create room: " .. tostring(err) })
        return
    end

    local room, fetchErr = potato.db.find_by_id("rooms", id)
    if fetchErr then
        req.json(500, { error = "Failed to fetch room: " .. tostring(fetchErr) })
        return
    end

    room = decode_players(room)
    req.json(201, room)
end

function list_rooms(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local rows, err = potato.db.find_all_by_cond("rooms", { status = "waiting" })
    if err then
        req.json(500, { error = tostring(err) })
        return
    end
    local result = {}
    for _, r in ipairs(rows) do
        table.insert(result, decode_players(r))
    end
    req.json(200, result)
end

function get_room(ctx, room_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local room, err = potato.db.find_by_id("rooms", room_id)
    if err then
        req.json(404, { error = "Room not found" })
        return
    end
    room = decode_players(room)
    req.json(200, room)
end

-- public, no auth required – used by the TV display screen
function get_room_view(ctx, room_id)
    local req = ctx.request()
    local room, err = potato.db.find_by_id("rooms", room_id)
    if err then
        req.json(404, { error = "Room not found" })
        return
    end
    room = decode_players(room)
    req.json(200, room)
end

function get_room_by_code(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json() or {}
    local code = body.code or ""
    if code == "" then
        req.json(400, { error = "code is required" })
        return
    end

    local rows, err = potato.db.find_all_by_cond("rooms", { code = string.upper(code) })
    if err or #rows == 0 then
        req.json(404, { error = "Room not found" })
        return
    end
    local room = decode_players(rows[1])
    req.json(200, room)
end

function join_room(ctx, room_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local room, err = potato.db.find_by_id("rooms", room_id)
    if err then
        req.json(404, { error = "Room not found" })
        return
    end
    if room.status ~= "waiting" then
        req.json(400, { error = "Room is not open for joining" })
        return
    end

    local body = req.bind_json() or {}
    local conn_id = body.conn_id or ""

    local ok, players = pcall(json.decode, room.players_json or "[]")
    if not ok or type(players) ~= "table" then players = {} end

    -- check if already in room (by conn_id so same user can join from different sessions)
    for _, p in ipairs(players) do
        if p.conn_id ~= "" and p.conn_id == conn_id then
            req.json(400, { error = "Already in this room" })
            return
        end
    end

    if #players >= room.max_players then
        req.json(400, { error = "Room is full" })
        return
    end

    local is_first = (#players == 0)

    table.insert(players, {
        user_id = userId,
        conn_id = conn_id,
        ready   = false,
        is_host = is_first
    })

    local players_json_str, encErr = json.encode(players)
    if encErr then
        req.json(500, { error = "Failed to encode players" })
        return
    end

    local updateData = {
        player_count = #players,
        players_json = players_json_str
    }
    if is_first then
        updateData.host_user_id = userId
        updateData.host_conn_id = conn_id
    end

    local updateErr = potato.db.update_by_id("rooms", room_id, updateData)
    if updateErr then
        req.json(500, { error = "Failed to update room: " .. tostring(updateErr) })
        return
    end


    -- fetch updated room
    local updated, fetchErr = potato.db.find_by_id("rooms", room_id)
    if fetchErr then
        req.json(500, { error = "Failed to fetch updated room" })
        return
    end
    updated.players = players
    updated.players_json = nil

    -- broadcast join event
    broadcast_room(room_id, "player_joined", updated)

    req.json(200, updated)
end

function leave_room(ctx, room_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local room, err = potato.db.find_by_id("rooms", room_id)
    if err then
        req.json(404, { error = "Room not found" })
        return
    end

    local body = req.bind_json() or {}
    local conn_id = body.conn_id or ""

    local ok, players = pcall(json.decode, room.players_json or "[]")
    if not ok or type(players) ~= "table" then players = {} end

    local new_players = {}
    local removed_was_host = false
    for _, p in ipairs(players) do
        local is_target = (conn_id ~= "" and p.conn_id == conn_id) or
                          (conn_id == "" and p.user_id == userId)
        if not is_target then
            table.insert(new_players, p)
        else
            if p.is_host then removed_was_host = true end
        end
    end

    -- if room is now empty, reset players and keep TV room open
    if #new_players == 0 then
        potato.db.update_by_id("rooms", room_id, {
            player_count = 0,
            players_json = "[]",
            status       = "waiting"
        })
        local emptyRoom = {
            id           = room.id,
            code         = room.code,
            name         = room.name,
            status       = "waiting",
            max_players  = room.max_players,
            player_count = 0,
            players      = {},
            created_at   = room.created_at
        }
        broadcast_room(room_id, "player_left", emptyRoom)
        req.json(200, emptyRoom)
        return
    end

    -- if the host/admin left, assign new host to the next player
    if removed_was_host or room.host_user_id == userId then
        new_players[1].is_host = true
    end

    local players_json_str, _ = json.encode(new_players)

    potato.db.update_by_id("rooms", room_id, {
        player_count = #new_players,
        players_json = players_json_str,
        host_user_id = new_players[1].user_id,
        host_conn_id = new_players[1].conn_id or ""
    })

    local updated = {
        id           = room.id,
        code         = room.code,
        name         = room.name,
        status       = room.status,
        max_players  = room.max_players,
        player_count = #new_players,
        players      = new_players,
        created_at   = room.created_at
    }

    broadcast_room(room_id, "player_left", updated)
    req.json(200, updated)
end

function set_ready(ctx, room_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local room, err = potato.db.find_by_id("rooms", room_id)
    if err then
        req.json(404, { error = "Room not found" })
        return
    end

    local body = req.bind_json() or {}
    local ready = body.ready
    if ready == nil then ready = true end
    local conn_id = body.conn_id or ""

    local ok, players = pcall(json.decode, room.players_json or "[]")
    if not ok or type(players) ~= "table" then players = {} end

    for _, p in ipairs(players) do
        -- match by conn_id if provided, otherwise fall back to user_id
        local matched = (conn_id ~= "" and p.conn_id == conn_id) or
                        (conn_id == "" and p.user_id == userId)
        if matched then
            p.ready = ready
            break
        end
    end

    local players_json_str, _ = json.encode(players)
    potato.db.update_by_id("rooms", room_id, { players_json = players_json_str })

    local updated = {
        id           = room.id,
        code         = room.code,
        name         = room.name,
        status       = room.status,
        max_players  = room.max_players,
        player_count = room.player_count,
        players      = players,
        created_at   = room.created_at
    }

    broadcast_room(room_id, "ready_changed", updated)
    req.json(200, updated)
end

function start_game(ctx, room_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local room, err = potato.db.find_by_id("rooms", room_id)
    if err then
        req.json(404, { error = "Room not found" })
        return
    end

    local body = req.bind_json() or {}
    local conn_id = body.conn_id or ""

    local ok, players = pcall(json.decode, room.players_json or "[]")
    if not ok or type(players) ~= "table" then players = {} end

    if #players == 0 then
        req.json(400, { error = "Need at least 1 player to start" })
        return
    end

    -- authorized if room creator (host_user_id == userId) or player with conn_id is_host
    local authorized = (room.host_user_id == userId)
    for _, p in ipairs(players) do
        if conn_id ~= "" and p.conn_id == conn_id and p.is_host then
            authorized = true
            break
        end
    end

    if not authorized then
        req.json(403, { error = "Only the admin or room host can start the game" })
        return
    end

    -- all non-host players must be ready
    for _, p in ipairs(players) do
        if not p.is_host and not p.ready then
            req.json(400, { error = "Not all players are ready" })
            return
        end
    end

    potato.db.update_by_id("rooms", room_id, { status = "playing" })

    local updated = {
        id           = room.id,
        code         = room.code,
        name         = room.name,
        status       = "playing",
        max_players  = room.max_players,
        player_count = #players,
        players      = players,
        created_at   = room.created_at
    }

    broadcast_room(room_id, "game_started", updated)
    req.json(200, updated)
end

function reset_game(ctx, room_id)
    local req = ctx.request()
    local room, err = potato.db.find_by_id("rooms", room_id)
    if err then
        req.json(404, { error = "Room not found" })
        return
    end

    local ok, players = pcall(json.decode, room.players_json or "[]")
    if not ok or type(players) ~= "table" then players = {} end

    for _, p in ipairs(players) do
        p.ready = false
    end

    local players_json_str, _ = json.encode(players)
    potato.db.update_by_id("rooms", room_id, {
        status       = "waiting",
        players_json = players_json_str
    })

    local updated = {
        id           = room.id,
        code         = room.code,
        name         = room.name,
        status       = "waiting",
        max_players  = room.max_players,
        player_count = #players,
        players      = players,
        created_at   = room.created_at
    }

    broadcast_room(room_id, "game_reset", updated)
    req.json(200, updated)
end

-- ─── router ───────────────────────────────────────────────────────────────────

function on_http(ctx)
    local req    = ctx.request()
    local path   = ctx.param("subpath")
    local method = ctx.param("method")

    -- setup
    if path == "/setup" and method == "POST" then
        return run_migrations(ctx)
    end

    -- ws token
    if path == "/ws-token" and method == "GET" then
        return get_ws_token(ctx)
    end

    -- rooms collection
    if path == "/rooms" and method == "GET" then
        return list_rooms(ctx)
    end
    if path == "/rooms" and method == "POST" then
        return create_room(ctx)
    end

    -- join by code (POST /rooms/join)
    if path == "/rooms/join" and method == "POST" then
        return get_room_by_code(ctx)
    end

    -- individual room
    local room_id_match = string.match(path, "^/rooms/(%d+)$")
    if room_id_match then
        local room_id = tonumber(room_id_match)
        if method == "GET" then
            return get_room(ctx, room_id)
        end
    end

    -- public room view (no auth) for TV display screen
    local view_match = string.match(path, "^/rooms/(%d+)/view$")
    if view_match then
        local room_id = tonumber(view_match)
        if method == "GET" then
            return get_room_view(ctx, room_id)
        end
    end

    -- join room
    local join_match = string.match(path, "^/rooms/(%d+)/join$")
    if join_match then
        local room_id = tonumber(join_match)
        if method == "POST" then
            return join_room(ctx, room_id)
        end
    end

    -- leave room
    local leave_match = string.match(path, "^/rooms/(%d+)/leave$")
    if leave_match then
        local room_id = tonumber(leave_match)
        if method == "POST" then
            return leave_room(ctx, room_id)
        end
    end

    -- set ready
    local ready_match = string.match(path, "^/rooms/(%d+)/ready$")
    if ready_match then
        local room_id = tonumber(ready_match)
        if method == "POST" then
            return set_ready(ctx, room_id)
        end
    end

    -- start game
    local start_match = string.match(path, "^/rooms/(%d+)/start$")
    if start_match then
        local room_id = tonumber(start_match)
        if method == "POST" then
            return start_game(ctx, room_id)
        end
    end

    -- reset game back to lobby
    local reset_match = string.match(path, "^/rooms/(%d+)/reset$")
    if reset_match then
        local room_id = tonumber(reset_match)
        if method == "POST" then
            return reset_game(ctx, room_id)
        end
    end

    req.json(404, { message = "Not Found" })
end