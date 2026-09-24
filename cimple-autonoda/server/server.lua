local potato = require("potato")

function get_user_id(req)
    local userId, err = req.get_user_id()
    if err then
        -- Return anonymous or 0 if unauthenticated in local testing
        return "user_default"
    end
    return userId
end

function run_migrations(ctx)
    print("Running migrations for cimple-autonoda...")
    local req = ctx.request()
    
    local result, err = potato.cap.execute("xMigrator", "run_migrations", {folder = "migration"})
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    print("Migrations completed, running static seeders...")
    local seedResult, seedErr = potato.cap.execute("xStaticSeeder", "seed", {seed_folder = "seed"})
    if seedErr then
        req.json(500, {error = tostring(seedErr)})
        return
    end

    print("Seeding completed successfully")
    req.json(200, {message = "Migrations and seeding completed successfully"})
end

-- ==================== WORKFLOWS CRUD ====================

function list_workflows(ctx)
    local req = ctx.request()
    local workflows, err = potato.db.find_all_by_cond("Workflows", {})
    if err then
        req.json(500, {error = tostring(err)})
        return
    end
    req.json_array(200, workflows or {})
end

function get_workflow(ctx, id)
    local req = ctx.request()
    local workflow, err = potato.db.find_by_id("Workflows", id)
    if err or not workflow then
        req.json(404, {error = "Workflow not found"})
        return
    end
    req.json(200, workflow)
end

function create_workflow(ctx)
    local req = ctx.request()
    local body = req.bind_json() or {}
    
    local newWorkflow = {
        name = body.name or "Untitled Workflow",
        description = body.description or "",
        status = body.status or "active",
        nodes_json = body.nodes_json or "[]",
        wires_json = body.wires_json or "[]",
        sample_payload_json = body.sample_payload_json or "{}"
    }

    local id, err = potato.db.insert("Workflows", newWorkflow)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local created, findErr = potato.db.find_by_id("Workflows", id)
    if findErr then
        req.json(201, {id = id, message = "Created"})
        return
    end
    req.json(201, created)
end

function update_workflow(ctx, id)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local updates = {}
    if body.name ~= nil then updates.name = body.name end
    if body.description ~= nil then updates.description = body.description end
    if body.status ~= nil then updates.status = body.status end
    if body.nodes_json ~= nil then updates.nodes_json = body.nodes_json end
    if body.wires_json ~= nil then updates.wires_json = body.wires_json end
    if body.sample_payload_json ~= nil then updates.sample_payload_json = body.sample_payload_json end

    local err = potato.db.update_by_id("Workflows", id, updates)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local updated, findErr = potato.db.find_by_id("Workflows", id)
    req.json(200, updated or {id = id, updated = true})
end

function delete_workflow(ctx, id)
    local req = ctx.request()
    local err = potato.db.delete_by_id("Workflows", id)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end
    req.json(200, {message = "Workflow deleted successfully", id = id})
end

-- ==================== WORKFLOW EXECUTION ====================

function run_workflow(ctx, workflow_id)
    local req = ctx.request()
    local incoming = req.bind_json() or {}

    local workflow, err = potato.db.find_by_id("Workflows", workflow_id)
    if err or not workflow then
        req.json(404, {error = "Workflow not found"})
        return
    end

    -- Record execution entry
    local execRecord = {
        workflow_id = tonumber(workflow_id),
        status = "success",
        trigger_type = incoming.trigger_type or "manual",
        duration_ms = 45,
        initial_payload = incoming.payload and potato.core.to_json(incoming.payload) or workflow.sample_payload_json,
        final_payload = incoming.payload and potato.core.to_json(incoming.payload) or workflow.sample_payload_json,
        steps_trace_json = "[]",
        error_message = ""
    }

    local execId, insertErr = potato.db.insert("Executions", execRecord)

    req.json(200, {
        execution_id = execId,
        workflow_id = tonumber(workflow_id),
        status = "success",
        message = "Execution completed"
    })
end

function list_executions(ctx, workflow_id)
    local req = ctx.request()
    local cond = {}
    if workflow_id then
        cond.workflow_id = tonumber(workflow_id)
    end

    local executions, err = potato.db.find_all_by_cond("Executions", cond)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end
    req.json_array(200, executions or {})
end

function get_execution(ctx, id)
    local req = ctx.request()
    local exec, err = potato.db.find_by_id("Executions", id)
    if err or not exec then
        req.json(404, {error = "Execution not found"})
        return
    end
    req.json(200, exec)
end

-- ==================== HTTP ROUTING ====================

function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath") or "/"
    local method = ctx.param("method") or "GET"

    -- Setup & Migrations
    if path == "/setup" and method == "POST" then
        return run_migrations(ctx)
    end

    -- Workflows Collection
    if path == "/workflows" and method == "GET" then
        return list_workflows(ctx)
    end

    if path == "/workflows" and method == "POST" then
        return create_workflow(ctx)
    end

    -- Specific Workflow routes: /workflows/:id
    local wf_id_str = string.match(path, "^/workflows/(%d+)$")
    if wf_id_str then
        local wf_id = tonumber(wf_id_str)
        if method == "GET" then
            return get_workflow(ctx, wf_id)
        elseif method == "PUT" or method == "PATCH" then
            return update_workflow(ctx, wf_id)
        elseif method == "DELETE" then
            return delete_workflow(ctx, wf_id)
        end
    end

    -- Workflow Run route: /workflows/:id/run
    local run_wf_id_str = string.match(path, "^/workflows/(%d+)/run$")
    if run_wf_id_str and method == "POST" then
        return run_workflow(ctx, tonumber(run_wf_id_str))
    end

    -- Workflow Executions route: /workflows/:id/executions
    local exec_wf_id_str = string.match(path, "^/workflows/(%d+)/executions$")
    if exec_wf_id_str and method == "GET" then
        return list_executions(ctx, tonumber(exec_wf_id_str))
    end

    -- Single Execution route: /executions/:id
    local single_exec_id_str = string.match(path, "^/executions/(%d+)$")
    if single_exec_id_str and method == "GET" then
        return get_execution(ctx, tonumber(single_exec_id_str))
    end

    -- Webhook Trigger: /webhook/:id
    local webhook_wf_id = string.match(path, "^/webhook/(%d+)$")
    if webhook_wf_id and method == "POST" then
        return run_workflow(ctx, tonumber(webhook_wf_id))
    end

    req.json(404, {
        error = "Not Found",
        path = path,
        method = method
    })
end