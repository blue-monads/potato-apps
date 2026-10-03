local handlers = require("./handlers")

function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method = ctx.param("method")

    if path == "/setup" and method == "POST" then
        return handlers.run_migrations(ctx)
    end

    if path == "/load" and method == "GET" then
        return handlers.load(ctx)
    end

    if path == "/user" and method == "GET" then
        return handlers.list_users(ctx)
    end

    if path == "/ws_token" and method == "GET" then
        return handlers.get_ws_token(ctx)
    end

    if path == "/me/all_status" and method == "GET" then
        return  handlers.get_me_all_status(ctx)
    end

    if path == "/channel_direct" and method == "GET" then
        return handlers.list_direct_channels(ctx)
    end

    if path == "/start_direct_chat" and method == "POST" then
        return handlers.start_direct_chat(ctx)
    end

    if path == "/channel" then
        if method == "GET" then
            return handlers.list_channels(ctx)
        elseif method == "POST" then
            return handlers.create_channel(ctx)
        end
    end

    local channelId = string.match(path, "^/channel/(%d+)$")
    if channelId and method == "DELETE" then
        return handlers.delete_channel(ctx, channelId)
    end

    local membersChannelId = string.match(path, "^/channel/(%d+)/members$")
    if membersChannelId and method == "GET" then
        return handlers.list_channel_members(ctx, membersChannelId)
    end

    local leaveChannelId = string.match(path, "^/channel/(%d+)/leave$")
    if leaveChannelId and method == "POST" then
        return handlers.leave_channel(ctx, leaveChannelId)
    end

    local cId, removeUserId = string.match(path, "^/channel/(%d+)/member/(%d+)$")
    if cId and removeUserId and method == "DELETE" then
        return handlers.remove_channel_member(ctx, cId, removeUserId)
    end

    local readChanId = string.match(path, "^/channel/(%d+)/read$")
    if readChanId and method == "POST" then
        return handlers.mark_channel_read(ctx, readChanId)
    end

    local typingChanId = string.match(path, "^/channel/(%d+)/typing$")
    if typingChanId and method == "POST" then
        return handlers.send_typing(ctx, typingChanId)
    end

    local inviteChannelId = string.match(path, "^/channel/(%d+)/invite$")
    if inviteChannelId and method == "POST" then
        return handlers.invite_member(ctx, inviteChannelId)
    end

    local loadChannelId = string.match(path, "^/channel/(%d+)/load$")
    if loadChannelId and method == "GET" then
        return handlers.load_messages(ctx, loadChannelId)
    end

    local rChanId, rMsgId = string.match(path, "^/channel/(%d+)/message/(%d+)/reaction$")
    if rChanId and rMsgId and method == "POST" then
        return handlers.toggle_reaction(ctx, rChanId, rMsgId)
    end

    local dChanId, dMsgId = string.match(path, "^/channel/(%d+)/message/(%d+)$")
    if dChanId and dMsgId then
        if method == "DELETE" then
            return handlers.delete_message(ctx, dChanId, dMsgId)
        elseif method == "PUT" then
            return handlers.edit_message(ctx, dChanId, dMsgId)
        end
    end

    local msgChannelId = string.match(path, "^/channel/(%d+)/message$")
    if msgChannelId and method == "POST" then
        return handlers.send_message(ctx, msgChannelId)
    end

    local uploadChannelId = string.match(path, "^/channel/(%d+)/upload$")
    if uploadChannelId and method == "POST" then
        return handlers.upload_message_file(ctx, uploadChannelId)
    end



    req.json(404, {
        message = "Not Found"
    })
end


function on_capability(ctx)
    print("on_capability/1")
    local action = ctx.param("action")
    print("action", action)
    if action == "on_websocket_connect" then
        print("@on_websocket_connect/start")
        
        local conn_id = ctx.param("conn_id")
        local user_id = tonumber(ctx.param("user_id"))

        print("@on_websocket_connect params:", "user_id=", user_id, "conn_id=", conn_id)

        print("@before_finish_upgrade", conn_id)
        ctx.execute("finish_upgrade", {})
        print("@after_finish_upgrade")

    elseif action == "on_websocket_message" then
        print("on_websocket_message")
    elseif action == "on_websocket_disconnect" then
        print("on_websocket_disconnect")
        local conn_id = ctx.param("conn_id")
    
    else
        error("not implemented")
    end
end