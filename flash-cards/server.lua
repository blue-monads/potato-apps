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
    print("run schema sql 1", userId)

    if userId == nil then return end

    local tables = potato.db.list_tables()

     print("run schema sql 2-", tables)


    if tables ~= nil and #tables > 0 then
        req.json(200, {
            message = "Tables already exist"
        })
        return
    end

    local schema, err = potato.core.read_package_file("schema.sql")

     print("run schema sql 3-", schema)
    if err ~= nil then 
        req.json(500, {
            message = "Failed to read schema.sql: " .. err
        })
        return
    end

    local result, ddlerr = potato.db.run_ddl(schema)
     print("run schema sql 4", result)
    if ddlerr ~= nil then 
        req.json(500, {
            message = "Failed to apply schema: " .. tostring(ddlerr)
        })
        return 
    end

     print("run schema sql 5")

    req.json(200, {
        message = "Schema applied"
    })
end



-- list all the decks
function list_decks(ctx)
    local req = ctx.request()
    print(req)
    local userId = get_user_id(req)
    if userId == nil then return end
    print(string.format("[LOG] Action: list_decks | UserID: %s | Time: %s", 
          tostring(userId), os.date("!%Y-%m-%dT%H:%M:%SZ")))

    local decks, err = potato.db.find_all_by_cond("Decks", { is_deleted = 0})

    if err ~= nil then
        print("[ERROR] Database failure: " .. tostring(err))
        req.json(400, { error = tostring(err) })
        return
    end
    req.json_array(200, decks)
end

-- get deck info and its cards
function get_cards_from_deck_id(ctx, deck_id) 
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local deck, err = potato.db.find_all_by_cond("Decks", { is_deleted = 0})

    if err ~= nil or deck == nil or deck.is_deleted == 1 then
        req.json(404, { error  =  "Deck not found"})
        return 
    end


    local cards, cards_err = potato.db.find_all_by_cond("Cards", {
        deck_id = deck_id,
        is_deleted = 0
    })

    deck.cards = cards or {}
    req.json(200, deck)
end


function create_deck(ctx)
    local req = ctx.request()
    local data = req.bind_json()
    local userId = get_user_id(req)
    if userId == nil then return end

    local deck = {
        name = data.name,
        icon = data.icon,
        is_deleted = 0
    }

    local id, err = potato.db.insert("Decks", deck)
    if err ~= nil then
        req.json(400, { error = tostring(err) })
        return
    end

    req.json(200, { id = id, message = "Deck created!"})
end



function update_deck(ctx, deck_id)
    local req = ctx.request()
    local data = req.bing_json()
    local userId = get_user_id(req)
    if userId == nil then return end


    local deck = {
        name = data.name, 
        icon = data.icon,
        is_deleted = 0
    }

    local res = db.query([[
        UPDATE decks
        SET name = ?, icon = ?
        WHERE id = ? AND user_id = ?
    ]], deck.name, deck.icon, deck_id, userId)


    if res.affected_rows == 0 then
        return { status = 404, json = {error = "Deck not found or access denied"} }
    end
    
    return {
        status = 200,
        json = {
            message = "Deck updated sucessfully",
            deck = deck
        }
    }
end


function delete_deck(ctx, deck_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userID == nil then return end

    if deck_id == nil then 
        req.json(400, {
            error = "deck_id is required"
        })
        return 
    end

    local err =  potato.db.update_by_id("Decks", deck_id, {
        is_deleted = 1
    })

    if err ~= nil then 
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    req.json(200, {
        message = "Deck is deleted"
    })
end



function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method =  ctx.param("method")

    print("on_http - path:", path, "method:", method)

    if path == "/run_schema_sql" and method == "POST" then
        return run_schema_sql(ctx)
    end

    local userId = get_user_id(req)
    if userId  == nil then return end

    -- Datatables routes
    if path == "/decks" and method == "GET" then 
        return list_decks(ctx)
    end

    if path == "decks" and method == "POST" then
        return create_deck(ctx)
    end

    local deck_id_match = string.match(path, "^/decks/(%d+)$")
    if deck_id_match then
        local deck_id = tonumber(deck_id_match)
        if deck_id ~= nil then
            if method == "PUT" or method == "PATCH" then
                return update_deck(ctx, deck_id)
            end
            if method == "DELETE" then
                return delete_deck(ctx, deck_id)
            end
        end
    end


    local card_deck_id_match = string.match(path, "^/decks/(%d+)$/cards")
    if card_deck_id_match then
        local deck_id = tonumber(card_deck_id_match)
        if deck_id ~= nil then
            if method == "GET" then
                return get_cards_from_deck(ctx, deck_id)
            end
        end
    end

    req.json(200, {
        message = "OK"
    })
end


