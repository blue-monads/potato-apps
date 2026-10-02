local potato = require("potato")

function get_user_id(req)
    local userId, err = req.get_user_id()
    if err then
        req.json(401, {
            error = "Unauthorized"
        })
        return nil
    end
    return userId
end

function list_authors(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local authors, err = potato.db.find_all_by_cond("Authors", {})
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    req.json(200, authors)
    
end

function run_migrations(ctx)

    print("Running migrations...")


    local req = ctx.request()
    local result, err = potato.cap.execute("xMigrator", "run_migrations", {folder = "migration"})
    
    if err then
        req.json(500, {error = tostring(err)})
        return
    end


    print("Migrations completed, running seeders...")

    -- Run seeders after migrations
    local seedResult, seedErr = potato.cap.execute("xStaticSeeder", "seed", {seed_folder = "seed"})
    
    if seedErr then
        req.json(500, {error = tostring(seedErr)})
        return
    end

    print("Seeding completed")
    
    req.json(200, {message = "Migrations and seeding completed"})
end

function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method = ctx.param("method")


    if path == "/author" and method == "GET" then
        return list_authors(ctx)
    end

    if path == "/setup" and method == "POST" then
        return run_migrations(ctx)
    end

    req.json(404, {
        message = "Not Found"
    })
end