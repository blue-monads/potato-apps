-- server/tests/test_accounts.lua
-- Tests for Chart of Accounts (CRUD and filtering)

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [2/9] Testing Accounts (Chart of Accounts) ===")

    local created_account_id = nil

    -- 1. List accounts
    runner:test("GET /accounts returns account list", function()
        local res, err = root.get(H.api_path(ctx, "/accounts"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of accounts")
        assert(#data >= 1, "Expected at least one seeded account")
    end)

    -- 2. Create account (Asset)
    runner:test("POST /accounts creates a new Asset account", function()
        local res, err = root.post(H.api_path(ctx, "/accounts"), {
            payload = {
                name = "Test Petty Cash Account",
                acc_type = "assets",
                info = "Testing asset account creation",
                parent_id = 0,
                contact_id = 0
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected non-zero account ID")
        H.assert_eq(data.name, "Test Petty Cash Account")
        H.assert_eq(data.acc_type, "assets")
        created_account_id = data.id
    end)

    -- 3. Filter accounts by acc_type
    runner:test("GET /accounts?type=assets filters only asset accounts", function()
        local res, err = root.get(H.api_path(ctx, "/accounts?type=assets"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        local items = data.items or data
        assert(type(items) == "table", "Expected items table")
        assert(#items >= 1, "Expected asset accounts found")
        for _, acc in ipairs(items) do
            H.assert_eq(acc.acc_type, "assets", "Filtered account type mismatch")
        end
    end)

    -- 4. Update account
    runner:test("PUT /accounts/:id updates account fields", function()
        assert(created_account_id ~= nil, "created_account_id must exist")
        local res, err = root.put(H.api_path(ctx, "/accounts/" .. created_account_id), {
            payload = {
                name = "Updated Petty Cash Account",
                info = "Updated description for account"
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.name, "Updated Petty Cash Account")
        H.assert_eq(data.info, "Updated description for account")
    end)

    -- 5. Delete account (Soft delete)
    runner:test("DELETE /accounts/:id soft deletes account", function()
        assert(created_account_id ~= nil, "created_account_id must exist")
        local res, err = root.delete(H.api_path(ctx, "/accounts/" .. created_account_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        -- Verify it does not appear in active account list
        local list_res, lerr = root.get(H.api_path(ctx, "/accounts"))
        assert(lerr == nil, "List failed: " .. tostring(lerr))
        local data = H.get_json(list_res)
        local items = data.items or data
        for _, acc in ipairs(items) do
            assert(acc.id ~= created_account_id, "Deleted account should not be in active list")
        end
    end)

    runner:summary("Accounts")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
