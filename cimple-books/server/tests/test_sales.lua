-- server/tests/test_sales.lua
-- Tests for Sales orders, invoicing, payments, cancellations, and product scrap flows

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [7/9] Testing Sales Orders & Scrapped Goods ===")

    -- Ensure core accounting accounts and defaults
    local core_accs = H.ensure_core_accounts(ctx)
    local revenue_account_id = core_accs["Sales Revenue"]
    assert(revenue_account_id ~= nil, "Revenue account required")

    -- Setup: Create customer contact
    local cust_res, _ = root.post(H.api_path(ctx, "/contacts"), {
        payload = {
            name = "Test Retail Customer",
            relation_type = "customer",
            primary_email = "retail@test.org"
        }
    })
    local cust = H.get_json(cust_res)
    local customer_id = cust.id

    -- Setup: Create tracked product with stock = 20
    local prod_res, _ = root.post(H.api_path(ctx, "/products"), {
        payload = {
            name = "Sales Test Gadget",
            sales_price = 120.00,
            purchase_price = 70.00,
            track_inventory = true,
            stock_count = 20,
            sales_account_id = revenue_account_id
        }
    })
    local prod = H.get_json(prod_res)
    local product_id = prod.id

    local sale_id = nil

    -- 1. List Sales
    runner:test("GET /sales returns sales list", function()
        local res, err = root.get(H.api_path(ctx, "/sales"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of sales")
    end)

    -- 2. Reject Direct Creation of Scrapped Sale
    runner:test("POST /sales rejects direct 'scrapped' sales_status with HTTP 400", function()
        local res, err = root.post(H.api_path(ctx, "/sales"), {
            payload = {
                title = "Invalid Scrap Order",
                sales_status = "scrapped",
                lines = {
                    { product_id = product_id, qty = 1, unit_price = 100 }
                }
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 400, "Direct creation with sales_status=scrapped should be blocked")
    end)

    -- 3. Create Draft Sale
    runner:test("POST /sales creates draft customer order with lines", function()
        local res, err = root.post(H.api_path(ctx, "/sales"), {
            payload = {
                title = "SO-TEST-1001",
                client_contact_id = customer_id,
                sales_status = "draft",
                payment_status = "unpaid",
                lines = {
                    {
                        product_id = product_id,
                        qty = 3,
                        unit_price = 120.00,
                        sub_total = 360.00,
                        tax_amount = 0,
                        discount_amount = 0,
                        total = 360.00
                    }
                }
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected sale ID")
        H.assert_eq(data.sales_status, "draft")
        H.assert_eq(data.payment_status, "unpaid")
        sale_id = data.id

        -- Stock should not be decremented for draft sale
        local p_chk, _ = root.get(H.api_path(ctx, "/products/" .. product_id))
        local p_data = H.get_json(p_chk)
        H.assert_eq(tonumber(p_data.stock_count), 20, "Draft sale should not decrement stock count")
    end)

    -- 4. Get Sale by ID
    runner:test("GET /sales/:id retrieves sale details and items", function()
        assert(sale_id ~= nil, "sale_id must exist")
        local res, err = root.get(H.api_path(ctx, "/sales/" .. sale_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.id, sale_id)
        assert(data.lines ~= nil and #data.lines >= 1, "Expected lines array")
        H.assert_eq(tonumber(data.lines[1].qty), 3)
    end)

    -- 5. Confirm Sale (Decrements Stock & Posts Journal Entry)
    runner:test("POST /sales/:id/confirm decrements inventory stock count", function()
        assert(sale_id ~= nil, "sale_id must exist")
        local res, err = root.post(H.api_path(ctx, "/sales/" .. sale_id .. "/confirm"), {
            payload = {}
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.sales_status, "confirmed")

        -- Verify product stock decremented by 3 (20 - 3 = 17)
        local p_chk, _ = root.get(H.api_path(ctx, "/products/" .. product_id))
        local p_data = H.get_json(p_chk)
        H.assert_eq(tonumber(p_data.stock_count), 17, "Confirmed sale must decrement stock count by 3")
    end)

    -- 6. Register Payment
    runner:test("POST /sales/:id/register-payment marks sale paid", function()
        assert(sale_id ~= nil, "sale_id must exist")
        local res, err = root.post(H.api_path(ctx, "/sales/" .. sale_id .. "/register-payment"), {
            payload = {}
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.payment_status, "paid")
    end)

    -- 7. Cancel Sale (Restores Stock & Reverses Transactions)
    runner:test("POST /sales/:id/cancel restores stock count and marks cancelled", function()
        assert(sale_id ~= nil, "sale_id must exist")
        local res, err = root.post(H.api_path(ctx, "/sales/" .. sale_id .. "/cancel"), {
            payload = {}
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.sales_status, "cancelled")

        -- Verify stock restored back to 20 (17 + 3 = 20)
        local p_chk, _ = root.get(H.api_path(ctx, "/products/" .. product_id))
        local p_data = H.get_json(p_chk)
        H.assert_eq(tonumber(p_data.stock_count), 20, "Cancelled sale must restore stock count to 20")
    end)

    -- 8. Scrap Product Flow
    runner:test("POST /products/:id/scrap creates scrapped sale and decrements stock", function()
        local res, err = root.post(H.api_path(ctx, "/products/" .. product_id .. "/scrap"), {
            payload = {
                qty = 2,
                reason = "Damaged during warehouse transit"
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        local scrap_sale_id = (data.sale and data.sale.id) or data.sale_id
        assert(scrap_sale_id ~= nil and scrap_sale_id > 0, "Expected generated scrap sale ID")

        -- Verify stock decreased by 2 (20 - 2 = 18)
        local p_chk, _ = root.get(H.api_path(ctx, "/products/" .. product_id))
        local p_data = H.get_json(p_chk)
        H.assert_eq(tonumber(p_data.stock_count), 18, "Scrapping 2 units must reduce stock count to 18")

        -- Clean up scrap sale
        if scrap_sale_id then
            root.delete(H.api_path(ctx, "/sales/" .. scrap_sale_id))
        end
    end)

    -- Teardown
    root.delete(H.api_path(ctx, "/products/" .. product_id))
    root.delete(H.api_path(ctx, "/contacts/" .. customer_id))

    runner:summary("Sales Orders")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
