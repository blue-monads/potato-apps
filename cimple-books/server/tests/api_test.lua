-- server/tests/api_test.lua
-- Master Test Suite Runner for Cimple Books API
-- Runs all test suites against a running Potatoverse development server.
-- Usage:
--   potatoverse dev tests server/tests/api_test.lua
--   potatoverse dev run-and-tests server/tests/api_test.lua

local test_init_and_settings   = dofile("server/tests/test_init_and_settings.lua")
local test_accounts            = dofile("server/tests/test_accounts.lua")
local test_contacts_categories = dofile("server/tests/test_contacts_and_categories.lua")
local test_taxes               = dofile("server/tests/test_taxes.lua")
local test_products            = dofile("server/tests/test_products_and_variants.lua")
local test_stockin             = dofile("server/tests/test_stockin.lua")
local test_sales               = dofile("server/tests/test_sales.lua")
local test_transactions        = dofile("server/tests/test_transactions.lua")
local test_reports             = dofile("server/tests/test_reports.lua")

function on_test_run(ctx)
    print("\n========================================================")
    print("      CIMPLE BOOKS - COMPREHENSIVE API TEST SUITE      ")
    print("========================================================")
    print("Server URL:    " .. tostring(ctx.server_url))
    print("Space Key:     " .. tostring(ctx.namespace_key))
    print("Space ID:      " .. tostring(ctx.space_id))
    print("Start Time:    " .. os.date("%Y-%m-%d %H:%M:%S"))
    print("--------------------------------------------------------")

    local suites = {
        { name = "Init & Settings",        module = test_init_and_settings },
        { name = "Accounts",               module = test_accounts },
        { name = "Contacts & Categories",  module = test_contacts_categories },
        { name = "Tax Rates",              module = test_taxes },
        { name = "Products & Variants",    module = test_products },
        { name = "Stock In / Purchases",   module = test_stockin },
        { name = "Sales Orders",           module = test_sales },
        { name = "Journal Transactions",   module = test_transactions },
        { name = "Financial Reports",      module = test_reports }
    }

    local suite_errors = {}
    local passed_suites = 0

    for i, s in ipairs(suites) do
        local ok, err = pcall(function()
            s.module.run(ctx)
        end)

        if ok then
            passed_suites = passed_suites + 1
        else
            table.insert(suite_errors, { index = i, name = s.name, err = err })
            print(string.format("❌ [%s] Suite failed: %s", s.name, tostring(err)))
        end
    end

    print("\n========================================================")
    print("                    TEST SUITE SUMMARY                  ")
    print("========================================================")
    print(string.format("Suites Passed: %d / %d", passed_suites, #suites))

    if #suite_errors > 0 then
        print("\nFailed Suites:")
        for _, failure in ipairs(suite_errors) do
            print(string.format("  [%d] %s: %s", failure.index, failure.name, tostring(failure.err)))
        end
        error(string.format("Test execution finished with %d failed suite(s)", #suite_errors))
    else
        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")
        print("========================================================\n")
    end
end
