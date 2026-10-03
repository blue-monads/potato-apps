-- server/tests/test_products_and_variants.lua
-- Tests for Products, Variants, Accounting Restrictions, and Inventory Adjustments

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [5/9] Testing Products & Variants ===")

    local core_accs = H.ensure_core_accounts(ctx)
    local revenue_account_id = core_accs["Sales Revenue"]
    local expense_account_id = core_accs["Cost of Goods Sold"]

    assert(revenue_account_id ~= nil, "Revenue account must exist")
    assert(expense_account_id ~= nil, "Expense account must exist")

    local created_product_id = nil
    local created_variant_id = nil

    -- 1. List Products
    runner:test("GET /products returns products list", function()
        local res, err = root.get(H.api_path(ctx, "/products"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of products")
    end)

    -- 2. Validate Product Account Restrictions: Reject invalid Sales Account type
    runner:test("POST /products rejects non-revenue sales_account_id with HTTP 400", function()
        local res, err = root.post(H.api_path(ctx, "/products"), {
            payload = {
                name = "Invalid Account Product",
                sales_account_id = expense_account_id, -- Invalid: must be revenue!
                sales_price = 50,
                track_inventory = true
            }
        })
        assert(err == nil, "Request error: " .. tostring(err))
        H.assert_status(res, 400, "Expected failure when sales account is an expense account")
    end)

    -- 3. Create Valid Tracked Product
    runner:test("POST /products creates product with valid accounting accounts", function()
        local res, err = root.post(H.api_path(ctx, "/products"), {
            payload = {
                name = "Super Pro Widget",
                info = "Tracked test inventory product",
                sales_price = 150.00,
                purchase_price = 90.00,
                track_inventory = true,
                stock_count = 20,
                sales_account_id = revenue_account_id,
                purchase_account_id = expense_account_id
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected product ID")
        H.assert_eq(data.name, "Super Pro Widget")
        H.assert_eq(tonumber(data.sales_price), 150.00)
        H.assert_eq(tonumber(data.stock_count), 20)
        created_product_id = data.id
    end)

    -- 4. Get Product Details by ID
    runner:test("GET /products/:id returns product details", function()
        assert(created_product_id ~= nil, "created_product_id must exist")
        local res, err = root.get(H.api_path(ctx, "/products/" .. created_product_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.id, created_product_id)
        H.assert_eq(data.name, "Super Pro Widget")
    end)

    -- 5. Update Product
    runner:test("PUT /products/:id updates product details", function()
        assert(created_product_id ~= nil, "created_product_id must exist")
        local res, err = root.put(H.api_path(ctx, "/products/" .. created_product_id), {
            payload = {
                name = "Super Pro Widget v2",
                sales_price = 175.00
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.name, "Super Pro Widget v2")
        H.assert_eq(tonumber(data.sales_price), 175.00)
    end)

    -- 6. Create Product Variant
    runner:test("POST /products/:id/variants creates a new variant", function()
        assert(created_product_id ~= nil, "created_product_id must exist")
        local res, err = root.post(H.api_path(ctx, "/products/" .. created_product_id .. "/variants"), {
            payload = {
                name = "Midnight Black (XL)",
                description = "Extra large black edition",
                sales_price = 185.00,
                stock_count = 5
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected variant ID")
        H.assert_eq(data.name, "Midnight Black (XL)")
        H.assert_eq(tonumber(data.sales_price), 185.00)
        created_variant_id = data.id
    end)

    -- 7. List Product Variants
    runner:test("GET /products/:id/variants lists variants of product", function()
        assert(created_product_id ~= nil, "created_product_id must exist")
        local res, err = root.get(H.api_path(ctx, "/products/" .. created_product_id .. "/variants"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected list of variants")
        assert(#data >= 1, "Expected at least one variant")
    end)

    -- 8. Get Variant by ID
    runner:test("GET /variants/:id retrieves variant details", function()
        assert(created_variant_id ~= nil, "created_variant_id must exist")
        local res, err = root.get(H.api_path(ctx, "/variants/" .. created_variant_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.id, created_variant_id)
        H.assert_eq(data.name, "Midnight Black (XL)")
    end)

    -- 9. Update Variant
    runner:test("PUT /variants/:id updates variant details", function()
        assert(created_variant_id ~= nil, "created_variant_id must exist")
        local res, err = root.put(H.api_path(ctx, "/variants/" .. created_variant_id), {
            payload = {
                name = "Midnight Black (XL) - Updated",
                sales_price = 190.00
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.name, "Midnight Black (XL) - Updated")
        H.assert_eq(tonumber(data.sales_price), 190.00)
    end)

    -- 10. Adjust Product Stock
    runner:test("POST /products/:id/adjust-stock adjusts product stock level", function()
        assert(created_product_id ~= nil, "created_product_id must exist")
        local res, err = root.post(H.api_path(ctx, "/products/" .. created_product_id .. "/adjust-stock"), {
            payload = {
                delta = 10
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.stock_count ~= nil, "Expected updated stock_count")
    end)

    -- 11. Sync All Stock Counts
    runner:test("POST /products/sync-stock synchronizes inventory counts", function()
        local res, err = root.post(H.api_path(ctx, "/products/sync-stock"), {
            payload = {}
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)
    end)

    -- 12. Delete Variant and Product
    runner:test("DELETE /variants/:id and DELETE /products/:id clean up test items", function()
        if created_variant_id ~= nil then
            local v_res, _ = root.delete(H.api_path(ctx, "/variants/" .. created_variant_id))
            H.assert_status(v_res, 200)
        end

        if created_product_id ~= nil then
            local p_res, _ = root.delete(H.api_path(ctx, "/products/" .. created_product_id))
            H.assert_status(p_res, 200)

            local check_res, _ = root.get(H.api_path(ctx, "/products/" .. created_product_id))
            H.assert_status(check_res, 404)
        end
    end)

    runner:summary("Products & Variants")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
