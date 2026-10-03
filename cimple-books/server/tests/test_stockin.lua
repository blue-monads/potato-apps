-- server/tests/test_stockin.lua
-- Tests for Stock In / Purchasing lifecycle, inventory adjustments, and automated accounting

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [6/9] Testing Stock In (Purchases & Replenishment) ===")

    -- Ensure core accounting accounts and defaults
    local core_accs = H.ensure_core_accounts(ctx)
    local expense_account_id = core_accs["Cost of Goods Sold"]
    assert(expense_account_id ~= nil, "Expense account required")

    -- Setup: Create supplier contact
    local supp_res, _ = root.post(H.api_path(ctx, "/contacts"), {
        payload = {
            name = "StockIn Test Vendor",
            relation_type = "supplier"
        }
    })
    local vendor = H.get_json(supp_res)
    local vendor_id = vendor.id

    -- Setup: Create tracked product with initial stock = 10
    local prod_res, _ = root.post(H.api_path(ctx, "/products"), {
        payload = {
            name = "StockIn Test Product",
            sales_price = 100.00,
            purchase_price = 50.00,
            track_inventory = true,
            stock_count = 10,
            purchase_account_id = expense_account_id
        }
    })
    local prod = H.get_json(prod_res)
    local product_id = prod.id

    local stockin_id = nil

    -- 1. List StockIn entries
    runner:test("GET /stockin returns stock intake list", function()
        local res, err = root.get(H.api_path(ctx, "/stockin"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of stockin records")
    end)

    -- 2. Create Draft StockIn
    runner:test("POST /stockin creates draft intake with line items", function()
        local res, err = root.post(H.api_path(ctx, "/stockin"), {
            payload = {
                vendor_contact_id = vendor_id,
                reference_id = "PO-TEST-001",
                info = "Purchase order for 5 test units",
                stockin_status = "draft",
                payment_status = "unpaid",
                lines = {
                    {
                        product_id = product_id,
                        qty = 5,
                        unit_cost = 50.00,
                        sub_total = 250.00
                    }
                }
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected stockin ID")
        H.assert_eq(data.stockin_status, "draft")
        H.assert_eq(data.payment_status, "unpaid")
        stockin_id = data.id

        -- Stock level should remain unchanged in draft state
        local p_chk, _ = root.get(H.api_path(ctx, "/products/" .. product_id))
        local p_data = H.get_json(p_chk)
        H.assert_eq(tonumber(p_data.stock_count), 10, "Draft stockin should not affect stock count yet")
    end)

    -- 3. Get StockIn by ID
    runner:test("GET /stockin/:id retrieves intake and attached lines", function()
        assert(stockin_id ~= nil, "stockin_id must exist")
        local res, err = root.get(H.api_path(ctx, "/stockin/" .. stockin_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.id, stockin_id)
        assert(data.lines ~= nil and #data.lines >= 1, "Expected lines array")
        H.assert_eq(tonumber(data.lines[1].qty), 5)
    end)

    -- 4. Confirm StockIn (Increases Stock & Posts Journal Entry)
    runner:test("POST /stockin/:id/confirm increases inventory stock count", function()
        assert(stockin_id ~= nil, "stockin_id must exist")
        local res, err = root.post(H.api_path(ctx, "/stockin/" .. stockin_id .. "/confirm"), {
            payload = {}
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.stockin_status, "confirmed")

        -- Verify product stock increased by 5 (10 + 5 = 15)
        local p_chk, _ = root.get(H.api_path(ctx, "/products/" .. product_id))
        local p_data = H.get_json(p_chk)
        H.assert_eq(tonumber(p_data.stock_count), 15, "Stock count must increment by 5 upon confirmation")
    end)

    -- 5. Register Payment
    runner:test("POST /stockin/:id/register-payment updates payment status to paid", function()
        assert(stockin_id ~= nil, "stockin_id must exist")
        local res, err = root.post(H.api_path(ctx, "/stockin/" .. stockin_id .. "/register-payment"), {
            payload = {}
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.payment_status, "paid")
    end)

    -- 6. Cancel StockIn (Reverses Inventory & Journal Entry)
    runner:test("POST /stockin/:id/cancel restores stock count and marks cancelled", function()
        assert(stockin_id ~= nil, "stockin_id must exist")
        local res, err = root.post(H.api_path(ctx, "/stockin/" .. stockin_id .. "/cancel"), {
            payload = {}
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.stockin_status, "cancelled")

        -- Verify product stock was decremented back (15 - 5 = 10)
        local p_chk, _ = root.get(H.api_path(ctx, "/products/" .. product_id))
        local p_data = H.get_json(p_chk)
        H.assert_eq(tonumber(p_data.stock_count), 10, "Stock count must revert back to 10 after cancellation")
    end)

    -- Teardown
    root.delete(H.api_path(ctx, "/products/" .. product_id))
    root.delete(H.api_path(ctx, "/contacts/" .. vendor_id))

    runner:summary("Stock In")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
