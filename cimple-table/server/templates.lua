local M = {}
local json = require("json")

-- Helper to read template files via package filesystem or direct disk
local function read_template_file(rel_path)
    -- 1. Try reading via potato.core.read_package_file
    if potato and potato.core and potato.core.read_package_file then
        local c, err = potato.core.read_package_file(rel_path)
        if c ~= nil and c ~= "" then
            return c
        end
        -- Also try with templates/ prefix if not already present
        if not string.match(rel_path, "^templates/") then
            local c2, _ = potato.core.read_package_file("templates/" .. rel_path)
            if c2 ~= nil and c2 ~= "" then
                return c2
            end
        end
    end

    -- 2. Try direct filesystem read
    local paths_to_try = {
        rel_path,
        "templates/" .. rel_path,
        "server/templates/" .. rel_path,
        "../templates/" .. rel_path
    }

    for _, p in ipairs(paths_to_try) do
        local f = io.open(p, "r")
        if f then
            local content = f:read("*all")
            f:close()
            if content ~= nil and content ~= "" then
                return content
            end
        end
    end

    return nil
end

-- Cache loaded templates in memory for speed
local template_cache = {}
local index_cache = nil

-- Get the index list of all templates from templates/index.json
function M.get_template_index()
    if index_cache ~= nil then
        return index_cache
    end

    local raw = read_template_file("templates/index.json")
    if raw == nil or raw == "" then
        raw = read_template_file("index.json")
    end

    if raw ~= nil and raw ~= "" then
        local ok, data = pcall(json.decode, raw)
        if ok and type(data) == "table" then
            index_cache = data
            return data
        end
    end

    return {}
end

-- Get a specific template group by id/key from its JSON file (e.g. templates/xyz-data.json)
function M.get_template(key)
    if key == nil or key == "" or key == "blank" then
        return nil
    end

    if template_cache[key] ~= nil then
        return template_cache[key]
    end

    local raw = nil

    -- 1. Try standard pattern: templates/<key>-data.json
    raw = read_template_file("templates/" .. key .. "-data.json")

    -- 2. Try templates/<key>.json
    if raw == nil or raw == "" then
        raw = read_template_file("templates/" .. key .. ".json")
    end

    -- 3. Look up specific filename from index.json
    if raw == nil or raw == "" then
        local index = M.get_template_index()
        for _, item in ipairs(index) do
            if item.id == key or item.name == key then
                local filename = item.file or (item.id .. "-data.json")
                raw = read_template_file("templates/" .. filename)
                if raw == nil or raw == "" then
                    raw = read_template_file(filename)
                end
                break
            end
        end
    end

    if raw ~= nil and raw ~= "" then
        local ok, data = pcall(json.decode, raw)
        if ok and type(data) == "table" then
            template_cache[key] = data
            return data
        end
    end

    return nil
end

-- Allow TABLE_GROUPS[key] access via metatable
M.TABLE_GROUPS = setmetatable({}, {
    __index = function(tbl, key)
        return M.get_template(key)
    end
})

return M
