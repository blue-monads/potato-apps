-- server/tests/test_reports.lua
-- Tests for Financial Reports (P&L, Balance Sheet, Cash Flow, Trial Balance, Ledger, Receivables, Payables, etc.)

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [9/9] Testing Financial Reports ===")

    local reports = {
        { name = "Profit & Loss", endpoint = "/reports/profit-loss" },
        { name = "Balance Sheet", endpoint = "/reports/balance-sheet" },
        { name = "Cash Flow", endpoint = "/reports/cash-flow" },
        { name = "Trial Balance", endpoint = "/reports/trial-balance" },
        { name = "General Ledger", endpoint = "/reports/general-ledger" },
        { name = "Accounts Receivable", endpoint = "/reports/accounts-receivable" },
        { name = "Accounts Payable", endpoint = "/reports/accounts-payable" },
        { name = "Sales Report", endpoint = "/reports/sales" },
        { name = "Expenses Report", endpoint = "/reports/expenses" },
        { name = "Tax Summary Report", endpoint = "/reports/tax" }
    }

    for _, rep in ipairs(reports) do
        runner:test("GET " .. rep.endpoint .. " generates " .. rep.name, function()
            local res, err = root.get(H.api_path(ctx, rep.endpoint))
            assert(err == nil, "Request failed: " .. tostring(err))
            H.assert_status(res, 200)

            local data = H.get_json(res)
            assert(type(data) == "table", "Expected table response for " .. rep.name)
        end)
    end

    runner:summary("Financial Reports")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
