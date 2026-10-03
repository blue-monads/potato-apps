
local mod = {}

function mod.get_user_id(req)
    local userId, err = req.get_user_id()
    if err then
        req.json(401, {
            error = "Unauthorized"
        })
        return nil
    end
    return userId
end

return mod
