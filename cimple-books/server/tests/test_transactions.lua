-- server/tests/test_transactions.lua
-- Tests for Transactions journal, CRUD, and the fundamental double-entry invariant (Debits == Credits)

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [8/9] Testing Transactions (Double-Entry Invariant) ===")

    -- Ensure core accounting accounts and defaults
    local core_accs = H.ensure_core_accounts(ctx)
    local debit_account_id = core_accs["Cost of Goods Sold"]
    local credit_account_id = core_accs["Cash on Hand"]

    assert(debit_account_id ~= nil, "Expense account required for transaction tests")
    assert(credit_account_id ~= nil, "Asset account required for transaction tests")

    local created_txn_id = nil

    -- 1. List Transactions
    runner:test("GET /transactions returns journal transaction entries", function()
        local res, err = root.get(H.api_path(ctx, "/transactions"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of transactions")
    end)

    -- 2. Reject Unbalanced Transaction
    runner:test("POST /transactions rejects unbalanced transaction with HTTP 400", function()
        local res, err = root.post(H.api_path(ctx, "/transactions"), {
            payload = {
                title = "Unbalanced Journal Entry",
                txn_type = "normal",
                is_editable = true,
                lines = {
                    {
                        account_id = debit_account_id,
                        debit_amount = 200.00,
                        credit_amount = 0
                    },
                    {
                        account_id = credit_account_id,
                        debit_amount = 0,
                        credit_amount = 150.00 -- Unbalanced: 200 != 150!
                    }
                }
            }
        })
        assert(err == nil, "Request error: " .. tostring(err))
        H.assert_status(res, 400, "Double-entry violation must be rejected")
    end)

    -- 3. Create Balanced Transaction
    runner:test("POST /transactions accepts balanced transaction (sum(debit) == sum(credit))", function()
        local res, err = root.post(H.api_path(ctx, "/transactions"), {
            payload = {
                title = "Balanced Office Supplies Purchase",
                notes = "Manual journal entry test",
                txn_type = "normal",
                is_editable = true,
                lines = {
                    {
                        account_id = debit_account_id,
                        debit_amount = 75.50,
                        credit_amount = 0
                    },
                    {
                        account_id = credit_account_id,
                        debit_amount = 0,
                        credit_amount = 75.50
                    }
                }
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected transaction ID")
        H.assert_eq(data.title, "Balanced Office Supplies Purchase")
        assert(data.lines ~= nil and #data.lines == 2, "Expected 2 journal lines")
        created_txn_id = data.id
    end)

    -- 4. Update Transaction
    runner:test("PUT /transactions/:id updates transaction notes", function()
        assert(created_txn_id ~= nil, "created_txn_id must exist")
        local res, err = root.put(H.api_path(ctx, "/transactions/" .. created_txn_id), {
            payload = {
                notes = "Updated notes for manual journal entry"
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.notes, "Updated notes for manual journal entry")
    end)

    -- 5. Delete Transaction
    runner:test("DELETE /transactions/:id soft deletes editable transaction", function()
        assert(created_txn_id ~= nil, "created_txn_id must exist")
        local res, err = root.delete(H.api_path(ctx, "/transactions/" .. created_txn_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)
    end)

    runner:summary("Transactions")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
