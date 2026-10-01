local M = {}
local json = require("json")
local potato = require("potato")

-- Helper to read template files strictly via potato.core.read_package_file
local function read_template_file(rel_path)
    local fpath = rel_path
    if not string.match(fpath, "^templates/") then
        fpath = "templates/" .. fpath
    end

    local content, err = potato.core.read_package_file(fpath)
    if err ~= nil or content == nil or content == "" then
        error("Failed to read template file '" .. fpath .. "' via potato.core.read_package_file: " .. tostring(err))
    end
    return content
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
    local ok, data = pcall(json.decode, raw)
    if not ok or type(data) ~= "table" then
        error("Failed to parse templates/index.json: " .. tostring(data))
    end

    index_cache = data
    return data
end

-- Get a specific template group by id/key from its JSON file (e.g. templates/xyz-data.json)
function M.get_template(key)
    if key == nil or key == "" or key == "blank" then
        return nil
    end

    if template_cache[key] ~= nil then
        return template_cache[key]
    end

    local filename = key .. "-data.json"
    local ok_idx, index = pcall(M.get_template_index)
    if ok_idx and type(index) == "table" then
        for _, item in ipairs(index) do
            if item.id == key or item.name == key then
                if item.file then
                    filename = item.file
                end
                break
            end
        end
    end

    local raw = read_template_file("templates/" .. filename)
    local ok, data = pcall(json.decode, raw)
    if not ok or type(data) ~= "table" then
        error("Failed to parse template '" .. key .. "' (" .. filename .. "): " .. tostring(data))
    end

    template_cache[key] = data
    return data
end

-- Allow TABLE_GROUPS[key] access via metatable
M.TABLE_GROUPS = setmetatable({}, {
    __index = function(tbl, key)
        return M.get_template(key)
    end
})

return M
