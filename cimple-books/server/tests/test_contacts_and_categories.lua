-- server/tests/test_contacts_and_categories.lua
-- Tests for Categories and Contacts CRUD and filtering

local H = dofile("server/tests/test_helpers.lua")

local M = {}

function M.run(ctx)
    local root = ctx.root_space()
    local runner = H.create_runner()

    print("\n=== [3/9] Testing Categories & Contacts ===")

    local created_cat_id = nil
    local created_contact_id = nil

    -- 1. List Categories
    runner:test("GET /categories returns categories list", function()
        local res, err = root.get(H.api_path(ctx, "/categories"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of categories")
    end)

    -- 2. Create Category
    runner:test("POST /categories creates new product category", function()
        local res, err = root.post(H.api_path(ctx, "/categories"), {
            payload = {
                name = "Test Electronics Category",
                info = "Testing product categories",
                product_class = "physical_item"
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected non-zero category ID")
        H.assert_eq(data.name, "Test Electronics Category")
        created_cat_id = data.id
    end)

    -- 3. Update Category
    runner:test("PUT /categories/:id updates category", function()
        assert(created_cat_id ~= nil, "created_cat_id must exist")
        local res, err = root.put(H.api_path(ctx, "/categories/" .. created_cat_id), {
            payload = {
                name = "Updated Electronics Category",
                info = "Updated category info"
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.name, "Updated Electronics Category")
    end)

    -- 4. Delete Category
    runner:test("DELETE /categories/:id deletes category", function()
        assert(created_cat_id ~= nil, "created_cat_id must exist")
        local res, err = root.delete(H.api_path(ctx, "/categories/" .. created_cat_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)
    end)

    -- 5. List Contacts
    runner:test("GET /contacts returns contact list", function()
        local res, err = root.get(H.api_path(ctx, "/contacts"))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(type(data) == "table", "Expected table of contacts")
    end)

    -- 6. Create Contact (Supplier)
    runner:test("POST /contacts creates a new supplier contact", function()
        local res, err = root.post(H.api_path(ctx, "/contacts"), {
            payload = {
                name = "Acme Supplies Ltd",
                contact_type = "company",
                relation_type = "supplier",
                primary_email = "orders@acmesupplies.test",
                primary_phone = "+1 555-0199",
                primary_address = "123 Industrial Way, Sector 4",
                info = "Preferred hardware supplier"
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        assert(data.id ~= nil and data.id > 0, "Expected non-zero contact ID")
        H.assert_eq(data.name, "Acme Supplies Ltd")
        H.assert_eq(data.relation_type, "supplier")
        created_contact_id = data.id
    end)

    -- 7. Get Contact by ID
    runner:test("GET /contacts/:id retrieves single contact", function()
        assert(created_contact_id ~= nil, "created_contact_id must exist")
        local res, err = root.get(H.api_path(ctx, "/contacts/" .. created_contact_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.id, created_contact_id)
        H.assert_eq(data.name, "Acme Supplies Ltd")
    end)

    -- 8. Update Contact
    runner:test("PUT /contacts/:id updates contact details", function()
        assert(created_contact_id ~= nil, "created_contact_id must exist")
        local res, err = root.put(H.api_path(ctx, "/contacts/" .. created_contact_id), {
            payload = {
                name = "Acme Global Supplies Ltd",
                primary_phone = "+1 555-0200"
            }
        })
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        local data = H.get_json(res)
        H.assert_eq(data.name, "Acme Global Supplies Ltd")
        H.assert_eq(data.primary_phone, "+1 555-0200")
    end)

    -- 9. Delete Contact
    runner:test("DELETE /contacts/:id deletes contact", function()
        assert(created_contact_id ~= nil, "created_contact_id must exist")
        local res, err = root.delete(H.api_path(ctx, "/contacts/" .. created_contact_id))
        assert(err == nil, "Request failed: " .. tostring(err))
        H.assert_status(res, 200)

        -- Verification: fetching deleted contact should return 404
        local get_res, _ = root.get(H.api_path(ctx, "/contacts/" .. created_contact_id))
        H.assert_status(get_res, 404)
    end)

    runner:summary("Categories & Contacts")
end

-- Allow standalone execution
function on_test_run(ctx)
    M.run(ctx)
end

return M
