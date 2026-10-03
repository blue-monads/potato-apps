local potato = require("potato")
local utils = require("./utils")
local ws = require("./ws")
local json = require("json")

local mod = {}

function mod.run_migrations(ctx)
    print("Running migrations...")
    local req = ctx.request()
    local result, err = potato.cap.execute("xMigrator", "run_migrations", {folder = "migration"})
    if err then
        req.json(500, {error = tostring(err)})
        return
    end
    print("Migrations completed.")
    return req.json(200, {status = "ok", message = "Migrations completed"})
end

function mod.core_get_users(userId)
    local users, err = potato.cap.execute("xUser", "get_space_users", {})
    if not users or #users == 0 then
        local rawUsers, _ = potato.db.run_query("SELECT id, name, email FROM Users")
        if rawUsers then users = rawUsers end
    end
    return users, err
end

function mod.core_get_users_with_dchan(userId)
    local users, err = potato.cap.execute("xUser", "get_space_users", {})
    if not users or #users == 0 then
        local rawUsers, _ = potato.db.run_query("SELECT id, name, email FROM Users")
        if rawUsers and #rawUsers > 0 then
            users = rawUsers
        end
    end
    if not users then users = {} end

    local directChannels, err2 = potato.db.run_query([[
        SELECT 
            c.id AS channel_id,
            other_member.user_id AS other_user_id
        FROM chat_channels c
        JOIN chat_channel_members current_user ON c.id = current_user.channel_id
        JOIN chat_channel_members other_member ON c.id = other_member.channel_id
        WHERE c.visibility = 'direct'
        AND current_user.user_id = ?
        AND other_member.user_id != ?;
    ]], userId, userId)

    local mapping = {}
    for _, duser in ipairs(directChannels or {}) do
        mapping[tonumber(duser.other_user_id)] = tonumber(duser.channel_id)
    end

    local onlineMap = {}
    local conns, _ = potato.cap.execute("xWebsocket", "list_connections", {})
    if conns then
        for _, c in ipairs(conns) do
            if c.user_id then
                onlineMap[tonumber(c.user_id)] = true
            end
        end
    end

    local userList = {}
    for _, user in ipairs(users or {}) do
        local uid = tonumber(user.id)
        local uName = user.name
        if not uName or uName == "" then
            uName = user.username or user.email or ("User " .. tostring(uid))
        end

        local other_channel = mapping[uid]
        table.insert(userList, {
            id = uid,
            name = uName,
            email = user.email or "",
            associated_channel = other_channel,
            is_self = (uid == userId),
            is_online = (onlineMap[uid] == true)
        })
    end

    return userList
end

function mod.core_get_channels(userId)
    local query = [[
        SELECT 
            chat_channels.id, 
            chat_channels.visibility,
            chat_channels.visibility as type, 
            chat_channels.name, 
            chat_channels.description,
            chat_channels.created_by_user_id,
            chat_channels.created_at,
            (SELECT 
                max(id) 
            FROM 
                chat_channel_messages 
            WHERE 
                channel_id = chat_channels.id AND is_deleted = 0
            ) as max_messages,
            chat_channel_members.read_until_message_id as read_max,
            chat_channel_members.is_admin
        FROM chat_channels
        LEFT JOIN chat_channel_members 
            ON chat_channels.id = chat_channel_members.channel_id 
            AND chat_channel_members.user_id = ?
        WHERE chat_channels.visibility = 'public' 
           OR chat_channel_members.user_id = ?
           OR chat_channels.created_by_user_id = ?
        ORDER BY chat_channels.name
    ]]
    local channels, err = potato.db.run_query(query, userId, userId, userId)
    if err then return nil, err end

    local result = {}
    for _, channel in ipairs(channels or {}) do
        local maxMsg = tonumber(channel.max_messages) or 0
        local readMax = tonumber(channel.read_max) or 0
        local unread = 0
        if maxMsg > readMax then
            unread = maxMsg - readMax
        end

        table.insert(result, {
            id = tonumber(channel.id),
            name = channel.name,
            description = channel.description or "",
            visibility = channel.visibility,
            type = channel.visibility,
            created_by_user_id = tonumber(channel.created_by_user_id),
            created_at = channel.created_at,
            max_messages = maxMsg,
            read_max = readMax,
            unread_count = unread,
            is_admin = (channel.is_admin == true or channel.is_admin == 1 or channel.is_admin == "1")
        })
    end

    return result
end

function mod.core_get_ws_token(userId)
    local connId = tostring(userId) .. "_" .. tostring(os.time()) .. "_" .. tostring(math.random(10000))
    local token, err = ws.get_websocket_cap_token(connId, userId)
    if err then return nil, err end
    return { token = token, connId = connId }
end

function mod.broadcast_to_channel(channelId, payload)
    local members, err = potato.db.run_query("SELECT user_id FROM chat_channel_members WHERE channel_id = ?", tonumber(channelId))
    if err or not members then return end

    local userIdSet = {}
    for _, member in ipairs(members) do
        userIdSet[tostring(member.user_id)] = true
    end

    local conns, err2 = potato.cap.execute("xWebsocket", "list_connections", {})
    if err2 or not conns then return end

    local broadcastConnIds = {}
    for _, conn in ipairs(conns) do
        if userIdSet[tostring(conn.user_id)] then
            table.insert(broadcastConnIds, conn.conn_id)
        end
    end

    if #broadcastConnIds > 0 then
        potato.cap.execute("xWebsocket", "send_to_connections", {
            conns = broadcastConnIds,
            message = payload,
        })
    end
end

function mod.load(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local users, err = mod.core_get_users_with_dchan(userId)
    if err then return req.json(500, {error = tostring(err)}) end

    local channels, err2 = mod.core_get_channels(userId)
    if err2 then return req.json(500, {error = tostring(err2)}) end

    local wsInfo, err3 = mod.core_get_ws_token(userId)
    if err3 then return req.json(500, {error = tostring(err3)}) end

    return req.json(200, {
        users = users,
        channels = channels,
        ws_token = wsInfo.token,
        connId = wsInfo.connId,
        current_user_id = userId
    })
end

function mod.list_users(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local users, err = mod.core_get_users_with_dchan(userId)
    if err then return req.json(500, {error = tostring(err)}) end

    return req.json(200, users)
end

function mod.start_direct_chat(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()
    if not body or not body.user_id then
        return req.json(400, { error = "user_id is required" })
    end

    local otherUserId = tonumber(body.user_id)
    if userId == otherUserId then
        return req.json(400, { error = "Cannot create direct chat with self" })
    end

    -- Check if direct chat already exists
    local existing = potato.db.run_query([[
        SELECT c.id FROM chat_channels c
        JOIN chat_channel_members m1 ON c.id = m1.channel_id AND m1.user_id = ?
        JOIN chat_channel_members m2 ON c.id = m2.channel_id AND m2.user_id = ?
        WHERE c.visibility = 'direct'
    ]], userId, otherUserId)

    if existing and #existing > 0 then
        return req.json(200, { channel_id = tonumber(existing[1].id), message = "Direct chat exists" })
    end

    local channel_id, err = potato.db.insert("chat_channels", {
        name = "",
        description = "",
        visibility = "direct",
        created_by_user_id = userId
    })

    if err then
        return req.json(500, { error = tostring(err) })
    end

    potato.db.insert("chat_channel_members", {
        channel_id = channel_id,
        user_id = userId,
        is_admin = true
    })

    potato.db.insert("chat_channel_members", {
        channel_id = channel_id,
        user_id = otherUserId,
        is_admin = true
    })

    return req.json(201, { channel_id = channel_id, message = "Direct chat created" })
end

function mod.list_channels(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local channels, err = mod.core_get_channels(userId)
    if err then
        return req.json(500, { error = tostring(err) })
    end
    return req.json(200, channels or {})
end

function mod.list_direct_channels(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local channels, err = potato.db.run_query([[
        SELECT c.* 
        FROM chat_channels c
        JOIN chat_channel_members m ON c.id = m.channel_id
        WHERE c.visibility = 'direct' AND m.user_id = ?
    ]], userId)
    if err then
        return req.json(500, { error = tostring(err) })
    end
    return req.json(200, channels or {})
end

function mod.create_channel(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()
    if not body or not body.name or body.name == "" then
        return req.json(400, { error = "Name is required" })
    end

    -- Clean channel name
    local chanName = string.gsub(string.lower(body.name), "%s+", "-")

    local channel_id, err = potato.db.insert("chat_channels", {
        name = chanName,
        description = body.description or "",
        visibility = body.visibility or "public",
        created_by_user_id = userId
    })

    if err then
        return req.json(500, { error = tostring(err) })
    end

    potato.db.insert("chat_channel_members", {
        channel_id = channel_id,
        user_id = userId,
        is_admin = true
    })

    return req.json(201, { id = channel_id, name = chanName, message = "Channel created" })
end

function mod.delete_channel(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local member = potato.db.find_one_by_cond("chat_channel_members", {
        channel_id = tonumber(channelId),
        user_id = userId,
        is_admin = true
    })

    if not member then
        return req.json(403, { error = "Forbidden: Only admins can delete channels" })
    end

    local _, err = potato.db.delete_by_id("chat_channels", tonumber(channelId))
    if err then
        return req.json(500, { error = tostring(err) })
    end

    potato.db.delete_by_cond("chat_channel_members", { channel_id = tonumber(channelId) })
    potato.db.delete_by_cond("chat_channel_messages", { channel_id = tonumber(channelId) })

    return req.json(200, { message = "Channel deleted" })
end

function mod.invite_member(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()
    if not body or not body.user_id then
        return req.json(400, { error = "user_id is required" })
    end

    local targetUserId = tonumber(body.user_id)

    -- Check if target is already member
    local existing = potato.db.find_one_by_cond("chat_channel_members", {
        channel_id = tonumber(channelId),
        user_id = targetUserId
    })
    if existing then
        return req.json(200, { message = "User already in channel" })
    end

    local _, err = potato.db.insert("chat_channel_members", {
        channel_id = tonumber(channelId),
        user_id = targetUserId,
        is_admin = false
    })

    if err then
        return req.json(500, { error = tostring(err) })
    end

    return req.json(200, { message = "User invited successfully" })
end

function mod.list_channel_members(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local members, err = potato.db.run_query([[
        SELECT user_id, is_admin, joined_at FROM chat_channel_members WHERE channel_id = ?
    ]], tonumber(channelId))

    if err then
        return req.json(500, { error = tostring(err) })
    end

    local allUsers, _ = potato.cap.execute("xUser", "get_space_users", {})
    if not allUsers or #allUsers == 0 then
        local rawUsers, _ = potato.db.run_query("SELECT id, name, email FROM Users")
        if rawUsers then allUsers = rawUsers end
    end

    local userMap = {}
    for _, u in ipairs(allUsers or {}) do
        userMap[tonumber(u.id)] = u
    end

    local onlineMap = {}
    local conns, _ = potato.cap.execute("xWebsocket", "list_connections", {})
    if conns then
        for _, c in ipairs(conns) do
            if c.user_id then
                onlineMap[tonumber(c.user_id)] = true
            end
        end
    end

    local result = {}
    for _, m in ipairs(members or {}) do
        local uid = tonumber(m.user_id)
        local u = userMap[uid]
        local uName = u and u.name or ("User " .. uid)
        if uName == "" then uName = u and (u.username or u.email) or ("User " .. uid) end

        table.insert(result, {
            user_id = uid,
            name = uName,
            email = u and u.email or "",
            is_admin = (m.is_admin == true or m.is_admin == 1 or m.is_admin == "1"),
            joined_at = m.joined_at,
            is_online = (onlineMap[uid] == true),
            is_self = (uid == userId)
        })
    end

    return req.json(200, result)
end

function mod.leave_channel(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local chan = potato.db.find_one_by_cond("chat_channels", { id = tonumber(channelId) })
    if not chan then
        return req.json(404, { error = "Channel not found" })
    end

    if chan.visibility == "direct" then
        return req.json(400, { error = "Cannot leave direct message" })
    end

    potato.db.run_query("DELETE FROM chat_channel_members WHERE channel_id = ? AND user_id = ?", tonumber(channelId), userId)
    return req.json(200, { message = "Left channel" })
end

function mod.remove_channel_member(ctx, channelId, targetUserId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local adminMember = potato.db.find_one_by_cond("chat_channel_members", {
        channel_id = tonumber(channelId),
        user_id = userId,
        is_admin = true
    })

    if not adminMember then
        return req.json(403, { error = "Only channel admins can remove members" })
    end

    potato.db.run_query("DELETE FROM chat_channel_members WHERE channel_id = ? AND user_id = ?", tonumber(channelId), tonumber(targetUserId))
    return req.json(200, { message = "Member removed" })
end

function mod.mark_channel_read(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()
    local maxId = body and body.message_id
    if not maxId then
        local maxRow, _ = potato.db.run_query("SELECT max(id) as max_id FROM chat_channel_messages WHERE channel_id = ?", tonumber(channelId))
        if maxRow and #maxRow > 0 and maxRow[1].max_id then
            maxId = tonumber(maxRow[1].max_id)
        else
            maxId = 0
        end
    end

    potato.db.run_query([[
        UPDATE chat_channel_members 
        SET read_until_message_id = ? 
        WHERE channel_id = ? AND user_id = ?
    ]], tonumber(maxId), tonumber(channelId), userId)

    return req.json(200, { success = true, read_until_message_id = tonumber(maxId) })
end

function mod.send_typing(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local allUsers, _ = potato.cap.execute("xUser", "get_space_users", {})
    local userName = "Someone"
    for _, u in ipairs(allUsers or {}) do
        if tonumber(u.id) == userId then
            userName = u.name or u.username or userName
            break
        end
    end

    mod.broadcast_to_channel(channelId, {
        type = "user_typing",
        channel_id = tonumber(channelId),
        user_id = userId,
        user_name = userName
    })

    return req.json(200, { success = true })
end

function mod.get_me_all_status(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local status, err = mod.core_get_channels(userId)
    if err then return req.json(500, { error = tostring(err) }) end

    return req.json(200, status or {})
end

function mod.load_messages(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local limit = tonumber(req.default_query("limit", "100"))
    local offset = tonumber(req.default_query("offset", "0"))

    -- Auto-join public channel if not yet a member
    local isMember = potato.db.find_one_by_cond("chat_channel_members", {
        channel_id = tonumber(channelId),
        user_id = userId
    })
    if not isMember then
        local chan = potato.db.find_one_by_cond("chat_channels", { id = tonumber(channelId) })
        if chan and chan.visibility == "public" then
            potato.db.insert("chat_channel_members", {
                channel_id = tonumber(channelId),
                user_id = userId,
                is_admin = false
            })
        end
    end

    local query = [[
        SELECT 
            m.id, m.channel_id, m.from_user_id, m.message, m.created_at, m.updated_at, m.is_edited, m.is_deleted, m.thread_id, m.reply_to_message_id, m.key_id,
            rm.message as reply_message, rm.from_user_id as reply_from_user_id,
            f.id as file_id, f.ftype, f.file_url_or_id, f.file_name, f.file_size,
            r.id as reaction_id, r.user_id as reaction_user_id, r.reaction, r.created_at as reaction_created_at
        FROM 
            (SELECT * FROM chat_channel_messages 
             WHERE channel_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?) m
        LEFT JOIN chat_channel_messages rm ON m.reply_to_message_id = rm.id
        LEFT JOIN chat_channel_files f ON m.id = f.message_id
        LEFT JOIN chat_channel_reactions r ON m.id = r.message_id
        ORDER BY m.created_at DESC
    ]]

    local rows, err = potato.db.run_query(query, tonumber(channelId), limit, offset)
    if err then
        return req.json(500, { error = tostring(err) })
    end

    local message_map = {}
    local messages_list = {}

    for _, row in ipairs(rows or {}) do
        local mid = tonumber(row.id)
        if not message_map[mid] then
            local replyObj = nil
            if row.reply_to_message_id and tonumber(row.reply_to_message_id) > 0 then
                replyObj = {
                    id = tonumber(row.reply_to_message_id),
                    message = row.reply_message or "",
                    from_user_id = tonumber(row.reply_from_user_id)
                }
            end

            local msg = {
                id = mid,
                channel_id = tonumber(row.channel_id),
                from_user_id = tonumber(row.from_user_id),
                message = row.message,
                created_at = row.created_at,
                updated_at = row.updated_at,
                is_edited = (row.is_edited == true or row.is_edited == 1 or row.is_edited == "1"),
                is_deleted = (row.is_deleted == true or row.is_deleted == 1 or row.is_deleted == "1"),
                thread_id = row.thread_id,
                reply_to_message_id = row.reply_to_message_id and tonumber(row.reply_to_message_id) or nil,
                reply_to = replyObj,
                key_id = row.key_id,
                files = {},
                reactions = {}
            }
            message_map[mid] = msg
            table.insert(messages_list, msg)
        end
        
        local msg = message_map[mid]
        
        if row.file_id then
            local fid = tonumber(row.file_id)
            local has_file = false
            for _, f in ipairs(msg.files) do
                if tonumber(f.id) == fid then has_file = true; break end
            end
            if not has_file then
                table.insert(msg.files, {
                    id = fid,
                    ftype = row.ftype,
                    file_url_or_id = row.file_url_or_id,
                    file_name = row.file_name or "",
                    file_size = tonumber(row.file_size) or 0
                })
            end
        end

        if row.reaction_id then
            local rid = tonumber(row.reaction_id)
            local has_reaction = false
            for _, r in ipairs(msg.reactions) do
                if tonumber(r.id) == rid then has_reaction = true; break end
            end
            if not has_reaction then
                table.insert(msg.reactions, {
                    id = rid,
                    user_id = tonumber(row.reaction_user_id),
                    reaction = row.reaction,
                    created_at = row.reaction_created_at
                })
            end
        end
    end

    return req.json(200, messages_list)
end

function mod.send_message(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()
    if not body or (not body.message and (not body.files or #body.files == 0)) then
        return req.json(400, { error = "Message or files required" })
    end

    -- Auto-join channel if public and not a member
    local isMember = potato.db.find_one_by_cond("chat_channel_members", {
        channel_id = tonumber(channelId),
        user_id = userId
    })
    if not isMember then
        local chan = potato.db.find_one_by_cond("chat_channels", { id = tonumber(channelId) })
        if chan and chan.visibility == "public" then
            potato.db.insert("chat_channel_members", {
                channel_id = tonumber(channelId),
                user_id = userId,
                is_admin = false
            })
        end
    end

    local replyId = body.reply_to_message_id and tonumber(body.reply_to_message_id) or nil

    local message_id, err = potato.db.insert("chat_channel_messages", {
        channel_id = tonumber(channelId),
        from_user_id = userId,
        message = body.message or "",
        reply_to_message_id = replyId
    })

    if err then
        return req.json(500, { error = tostring(err) })
    end

    local attachedFiles = {}
    if body.files and type(body.files) == "table" then
        attachedFiles = mod.finish_upload_file(channelId, message_id, userId, body.files)
    end

    local replyObj = nil
    if replyId then
        local replyRow = potato.db.find_one_by_cond("chat_channel_messages", { id = replyId })
        if replyRow then
            replyObj = {
                id = replyId,
                message = replyRow.message,
                from_user_id = tonumber(replyRow.from_user_id)
            }
        end
    end

    local fullMsg = {
        type = "chat_message",
        id = message_id,
        message_id = message_id,
        channel_id = tonumber(channelId),
        from_user_id = userId,
        message = body.message or "",
        reply_to_message_id = replyId,
        reply_to = replyObj,
        created_at = os.date("!%Y-%m-%dT%H:%M:%SZ"),
        files = attachedFiles or {},
        reactions = {},
        is_edited = false,
        is_deleted = false
    }

    mod.broadcast_to_channel(channelId, fullMsg)

    return req.json(201, fullMsg)
end

function mod.toggle_reaction(ctx, channelId, messageId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()
    if not body or not body.reaction then
        return req.json(400, { error = "Reaction emoji required" })
    end

    local emoji = body.reaction
    local mid = tonumber(messageId)

    local existing, err = potato.db.run_query([[
        SELECT id FROM chat_channel_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?
    ]], mid, userId, emoji)

    local action = "added"
    if existing and #existing > 0 then
        potato.db.run_query("DELETE FROM chat_channel_reactions WHERE id = ?", existing[1].id)
        action = "removed"
    else
        potato.db.insert("chat_channel_reactions", {
            message_id = mid,
            user_id = userId,
            reaction = emoji
        })
    end

    local currentReactions, _ = potato.db.run_query([[
        SELECT id, user_id, reaction, created_at FROM chat_channel_reactions WHERE message_id = ?
    ]], mid)

    local reactionList = {}
    for _, r in ipairs(currentReactions or {}) do
        table.insert(reactionList, {
            id = tonumber(r.id),
            user_id = tonumber(r.user_id),
            reaction = r.reaction,
            created_at = r.created_at
        })
    end

    local broadcastPayload = {
        type = "message_reaction",
        channel_id = tonumber(channelId),
        message_id = mid,
        user_id = userId,
        reaction = emoji,
        action = action,
        reactions = reactionList
    }

    mod.broadcast_to_channel(channelId, broadcastPayload)

    return req.json(200, { action = action, reactions = reactionList })
end

function mod.delete_message(ctx, channelId, messageId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local mid = tonumber(messageId)
    local msg = potato.db.find_one_by_cond("chat_channel_messages", { id = mid })
    if not msg then
        return req.json(404, { error = "Message not found" })
    end

    local isAuthor = (tonumber(msg.from_user_id) == userId)
    local isAdminMember = potato.db.find_one_by_cond("chat_channel_members", {
        channel_id = tonumber(channelId),
        user_id = userId,
        is_admin = true
    })

    if not isAuthor and not isAdminMember then
        return req.json(403, { error = "Not authorized to delete this message" })
    end

    potato.db.run_query("UPDATE chat_channel_messages SET is_deleted = 1, message = '' WHERE id = ?", mid)

    mod.broadcast_to_channel(channelId, {
        type = "message_deleted",
        channel_id = tonumber(channelId),
        message_id = mid
    })

    return req.json(200, { success = true })
end

function mod.edit_message(ctx, channelId, messageId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local mid = tonumber(messageId)
    local msg = potato.db.find_one_by_cond("chat_channel_messages", { id = mid })
    if not msg then
        return req.json(404, { error = "Message not found" })
    end

    if tonumber(msg.from_user_id) ~= userId then
        return req.json(403, { error = "Only author can edit message" })
    end

    local body = req.bind_json()
    if not body or not body.message then
        return req.json(400, { error = "Message text is required" })
    end

    potato.db.run_query([[
        UPDATE chat_channel_messages 
        SET message = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    ]], body.message, mid)

    mod.broadcast_to_channel(channelId, {
        type = "message_edited",
        channel_id = tonumber(channelId),
        message_id = mid,
        message = body.message
    })

    return req.json(200, { success = true, id = mid, message = body.message })
end

function mod.get_ws_token(ctx)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local wsInfo, err = mod.core_get_ws_token(userId)
    if err then
        return req.json(500, { error = tostring(err) })
    end

    return req.json(200, { token = wsInfo.token, connId = wsInfo.connId })
end

-- Files support
function mod.sign_file_upload_token(userId, channelId, fileId, fileType, fileName, fileSize)
    return potato.core.sign_advisery_token({
        sub_type = "msg_file_uploaded",
        user_id = userId,
        data = json.encode({
            fileId = fileId,
            channelId = channelId,
            fileType = fileType,
            fileName = fileName or "",
            fileSize = fileSize or 0,
        }),
    })
end

function mod.decode_file_upload_token(userId, channelId, token)
    local result, err = potato.core.parse_advisery_token(token)
    if err then
        print("failed to decode file upload token", err)
        return nil
    end
    
    local fileData = json.decode(result.data)
    if result.user_id ~= userId then
        print("user id mismatch", result.user_id, userId)
        return nil
    end

    if tostring(fileData.channelId) ~= tostring(channelId) then
        print("channel id mismatch", fileData.channelId, channelId)
        return nil
    end

    return fileData
end

function mod.upload_message_file(ctx, channelId)
    local req = ctx.request()
    local userId = utils.get_user_id(req)
    if userId == nil then return end

    local fileType = req.get_query("file_type")
    if not fileType or fileType == "" then fileType = "file" end

    local fileName = req.get_query("file_name")
    if not fileName or fileName == "" then fileName = "file_" .. tostring(os.time()) end

    local sizeStr = req.get_query("file_size")
    local fileSize = 0
    if sizeStr and sizeStr ~= "" then
        fileSize = tonumber(sizeStr) or 0
    end

    local filename = string.format("%d_%d_%s", channelId, os.time(), fileType)     

    local fileId = req.finish_file_upload("", filename)
    if not fileId then
        return req.json(500, { error = "File upload failed" })
    end

    local token, err = mod.sign_file_upload_token(userId, channelId, fileId, fileType, fileName, fileSize)
    if err then
        return req.json(500, { error = tostring(err) })
    end

    return req.json(200, { token = token })
end

function mod.finish_upload_file(channelId, messageId, userId, files)
    if not files or #files == 0 then
        return {}
    end

    local fileIdList = {}
    for _, item in ipairs(files) do
        local fid = nil
        local ftype = "file"
        local fName = ""
        local fSize = 0

        if type(item) == "table" then
            fid = item.file_url_or_id or item.id
            ftype = item.ftype or item.mime or "file"
            fName = item.file_name or item.name or ""
            local sz = item.file_size or item.size
            if sz then fSize = tonumber(sz) or 0 end
        elseif type(item) == "string" then
            if string.sub(item, 1, 4) == "http" or string.sub(item, 1, 4) == "/zz/" or string.sub(item, 1, 5) == "psec_" or string.find(item, "/") then
                fid = item
            else
                local fileData = mod.decode_file_upload_token(userId, channelId, item)
                if fileData then
                    local encId, _ = potato.core.encode_file_id(fileData.fileId)
                    fid = encId
                    ftype = fileData.fileType or "file"
                    fName = fileData.fileName or ""
                    fSize = tonumber(fileData.fileSize) or 0
                else
                    fid = item
                end
            end
        end

        if fid and fid ~= "" then
            local messageFileId, _ = potato.db.insert("chat_channel_files", {
                message_id = messageId,
                file_url_or_id = fid,
                ftype = ftype,
                file_name = fName,
                file_size = fSize
            })

            table.insert(fileIdList, { 
                id = messageFileId or 0, 
                file_url_or_id = fid, 
                ftype = ftype,
                file_name = fName,
                file_size = fSize
            })
        end
    end

    return fileIdList
end

return mod
