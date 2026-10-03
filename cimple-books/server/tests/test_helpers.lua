-- server/tests/test_helpers.lua
-- Common helpers and assertions for Cimple Books API tests

local M = {}

-- Construct the space API endpoint path
function M.api_path(ctx, path)
    if string.sub(path, 1, 1) ~= "/" then
        path = "/" .. path
    end
    return "/zz/api/space/" .. ctx.namespace_key .. path
end

-- Assert equality with informative error message
function M.assert_eq(actual, expected, msg)
    local err_msg = msg or ("Expected " .. tostring(expected) .. ", but got " .. tostring(actual))
    assert(actual == expected, err_msg)
end

-- Assert non-nil value
function M.assert_not_nil(val, msg)
    local err_msg = msg or "Expected value to not be nil"
    assert(val ~= nil, err_msg)
end

-- Assert HTTP status code
function M.assert_status(res, expected_status, msg)
    M.assert_not_nil(res, "HTTP response is nil")
    local prefix = msg and (msg .. ": ") or ""
    local actual = res.status_code
    if type(expected_status) == "table" then
        local found = false
        for _, s in ipairs(expected_status) do
            if actual == s then
                found = true
                break
            end
        end
        assert(found, prefix .. "Expected status in {" .. table.concat(expected_status, ", ") .. "}, got " .. tostring(actual) .. " (body: " .. tostring(res.body) .. ")")
    else
        assert(actual == expected_status, prefix .. "Expected status " .. tostring(expected_status) .. ", got " .. tostring(actual) .. " (body: " .. tostring(res.body) .. ")")
    end
end

-- Safely decode and assert JSON response body
function M.get_json(res)
    M.assert_not_nil(res, "Response is nil")
    local data, err = res.json()
    assert(err == nil, "Failed to decode JSON: " .. tostring(err) .. " (body: " .. tostring(res.body) .. ")")
    return data
end

-- Ensure standard core accounts exist and system settings are configured
function M.ensure_core_accounts(ctx)
    local root = ctx.root_space()
    local res, err = root.get(M.api_path(ctx, "/accounts"))
    local data = M.get_json(res)
    local items = data.items or data

    local accounts_by_name = {}
    for _, acc in ipairs(items) do
        accounts_by_name[acc.name] = acc
    end

    local needed = {
        { name = "Cash on Hand", acc_type = "assets", info = "Petty cash and bank" },
        { name = "Accounts Receivable", acc_type = "assets", info = "Customer receivables" },
        { name = "Inventory Asset", acc_type = "assets", info = "Inventory stock" },
        { name = "Accounts Payable", acc_type = "liabilities", info = "Supplier payables" },
        { name = "Sales Tax Payable", acc_type = "liabilities", info = "Sales tax payable" },
        { name = "Sales Revenue", acc_type = "revenue", info = "Product sales revenue" },
        { name = "Cost of Goods Sold", acc_type = "expenses", info = "Purchases and COGS" },
        { name = "Scrapped Goods Expense", acc_type = "expenses", info = "Scrap & inventory loss" }
    }

    local result = {}
    for _, n in ipairs(needed) do
        local acc = accounts_by_name[n.name]
        if not acc or acc.is_deleted == true or acc.is_deleted == 1 then
            local c_res, _ = root.post(M.api_path(ctx, "/accounts"), {
                payload = {
                    name = n.name,
                    acc_type = n.acc_type,
                    info = n.info
                }
            })
            local c_data = M.get_json(c_res)
            result[n.name] = c_data.id
        else
            result[n.name] = acc.id
        end
    end

    -- Update settings defaults so stockin & sales automatic postings use these IDs
    root.put(M.api_path(ctx, "/settings"), {
        payload = {
            currency_symbol = "$",
            default_sales_account_id = result["Sales Revenue"],
            default_purchase_account_id = result["Cost of Goods Sold"],
            default_receivable_account_id = result["Accounts Receivable"],
            default_payable_account_id = result["Accounts Payable"],
            default_payment_account_id = result["Cash on Hand"],
            default_tax_account_id = result["Sales Tax Payable"]
        }
    })

    return result
end

-- Lightweight test runner to execute individual test cases
function M.create_runner()
    local runner = {
        total = 0,
        passed = 0,
        failed = 0,
        errors = {}
    }

    function runner:test(name, fn)
        self.total = self.total + 1
        io.write("  • " .. name .. " ... ")
        local ok, err = pcall(fn)
        if ok then
            self.passed = self.passed + 1
            print("OK")
        else
            self.failed = self.failed + 1
            print("FAILED")
            print("    Error: " .. tostring(err))
            table.insert(self.errors, { name = name, err = err })
        end
    end

    function runner:summary(suite_name)
        print(string.format("[%s] Results: %d/%d passed (%d failed)", 
            suite_name or "Suite", self.passed, self.total, self.failed))
        if self.failed > 0 then
            error(string.format("Suite %s failed with %d error(s)", suite_name or "", self.failed))
        end
    end

    return runner
end

return M
