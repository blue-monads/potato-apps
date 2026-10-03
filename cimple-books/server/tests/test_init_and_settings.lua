-- server/tests/test_init_and_settings.lua
-- Tests for initialization and app settings endpoints

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [1/9] Testing System Init & App Settings ===")

    -- 1. Check Init Status
    runner:test("GET /init_status returns system initialization state", function()
        local res, err = root.get(H.api_path(ctx, "/init_status"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.initialized ~= nil, "Expected 'initialized' field in response")
        assert(data.message ~= nil, "Expected 'message' field in response")
    end)

    -- 2. Get Settings
    local original_symbol = "$"
    runner:test("GET /settings returns configuration table", function()
        local res, err = root.get(H.api_path(ctx, "/settings"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected settings to be a table")
        assert(data.currency_symbol ~= nil, "Expected currency_symbol")
        original_symbol = data.currency_symbol
    end)

    -- 3. Update Settings and Revert
    runner:test("PUT /settings updates currency symbol and persists changes", function()
        local test_symbol = "€"
        local put_res, perr = root.put(H.api_path(ctx, "/settings"), {
            payload = {
                currency_symbol = test_symbol
            }
        })
        assert(perr == nil, "PUT /settings failed: " .. tostring(perr))
        H.assert_status(put_res, 200)

        local get_res, gerr = root.get(H.api_path(ctx, "/settings"))
        assert(gerr == nil, "GET /settings failed: " .. tostring(gerr))
        local updated_data = H.get_json(get_res)
        H.assert_eq(updated_data.currency_symbol, test_symbol, "Currency symbol was not updated")

        -- Revert back to original symbol
        root.put(H.api_path(ctx, "/settings"), {
            payload = {
                currency_symbol = original_symbol
            }
        })
    end)

    runner:summary("Init & Settings")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
