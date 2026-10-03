-- server/tests/test_taxes.lua
-- Tests for Tax Rates CRUD

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [4/9] Testing Tax Rates ===")

    local created_tax_id = nil

    -- 1. List Taxes
    runner:test("GET /taxes returns tax rates list", function()
        local res, err = root.get(H.api_path(ctx, "/taxes"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of taxes")
    end)

    -- 2. Create Tax Rate
    runner:test("POST /taxes creates a new tax rate", function()
        local res, err = root.post(H.api_path(ctx, "/taxes"), {
            payload = {
                name = "State Sales Tax (8.25%)",
                rate = 8.25,
                ttype = "sales",
                info = "Standard state sales tax",
                ["strict"] = 0
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected non-zero tax ID")
        H.assert_eq(data.name, "State Sales Tax (8.25%)")
        H.assert_eq(tonumber(data.rate), 8.25)
        created_tax_id = data.id
    end)

    -- 3. Update Tax Rate
    runner:test("PUT /taxes/:id updates tax rate", function()
        assert(created_tax_id ~= nil, "created_tax_id must exist")
        local res, err = root.put(H.api_path(ctx, "/taxes/" .. created_tax_id), {
            payload = {
                name = "State Sales Tax (8.5%)",
                rate = 8.5
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.name, "State Sales Tax (8.5%)")
        H.assert_eq(tonumber(data.rate), 8.5)
    end)

    -- 4. Delete Tax Rate
    runner:test("DELETE /taxes/:id soft deletes tax rate", function()
        assert(created_tax_id ~= nil, "created_tax_id must exist")
        local res, err = root.delete(H.api_path(ctx, "/taxes/" .. created_tax_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        -- Verify it is not in the active tax list
        local list_res, lerr = root.get(H.api_path(ctx, "/taxes"))
        assert(lerr == nil, "List failed: " .. tostring(lerr))
        local data = H.get_json(list_res)
        local items = data.items or data
        for _, tax in ipairs(items) do
            assert(tax.id ~= created_tax_id, "Deleted tax should not be in active list")
        end
    end)

    runner:summary("Tax Rates")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
