local potato = require("potato")

local mod = {}

function mod.get_websocket_cap_token(connId, userId)
    return potato.cap.sign_token("xWebsocket", {
        user_id = userId,
        resource_id = connId,
    })
end


return mod