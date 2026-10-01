local potato = require("potato")
local json = require("json")

local function encode_json(val)
    if val == nil then return "{}" end
    if type(val) == "string" then return val end
    local ok, res = pcall(json.encode, val)
    if ok and res then return res end
    return "{}"
end

local function decode_json(str)
    if not str or str == "" then return {} end
    if type(str) == "table" then return str end
    local ok, res = pcall(json.decode, str)
    if ok and res then return res end
    return {}
end

function get_user_id(req)
    local userId, err = req.get_user_id()
    if err then
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

    print("Migrations completed successfully")
    req.json(200, {message = "Migrations completed successfully"})
end

-- ==================== EVENT TRIGGERS CRUD ====================

function list_triggers(ctx)
    local req = ctx.request()
    local triggers, err = potato.db.find_all_by_cond("EventTriggers", {})
    if err then
        req.json(500, {error = tostring(err)})
        return
    end
    req.json_array(200, triggers or {})
end

function get_trigger(ctx, id)
    local req = ctx.request()
    local trigger, err = potato.db.find_by_id("EventTriggers", id)
    if err or not trigger then
        req.json(404, {error = "Trigger not found"})
        return
    end
    req.json(200, trigger)
end

function get_trigger_graph(ctx, id)
    local req = ctx.request()
    local trigger, err = potato.db.find_by_id("EventTriggers", id)
    if err or not trigger then
        req.json(404, {error = "Trigger not found"})
        return
    end

    local rule_blocks, rbErr = potato.db.find_all_by_cond("RuleBlocks", {triggerId = tonumber(id)})
    local rules, rErr = potato.db.find_all_by_cond("Rules", {triggerId = tonumber(id)})
    local targets, tErr = potato.db.find_all_by_cond("Targets", {triggerId = tonumber(id)})

    local cleanTargets = {}
    if targets then
        for _, tg in ipairs(targets) do
            if tg.targetMeta and type(tg.targetMeta) == "string" then
                tg.targetMeta = decode_json(tg.targetMeta)
            end
            table.insert(cleanTargets, tg)
        end
    end

    req.json(200, {
        trigger = trigger,
        rule_blocks = rule_blocks or {},
        rules = rules or {},
        targets = cleanTargets
    })
end

function save_trigger_graph(ctx, id)
    local req = ctx.request()
    local tId = tonumber(id)
    local body = req.bind_json() or {}

    -- 1. Update Trigger if metadata provided
    if body.trigger then
        local updates = {}
        if body.trigger.name ~= nil then updates.name = body.trigger.name end
        if body.trigger.description ~= nil then updates.description = body.trigger.description end
        potato.db.update_by_id("EventTriggers", tId, updates)
    end

    -- 2. Clear old nodes for this trigger
    potato.db.delete_by_cond("Rules", {triggerId = tId})
    potato.db.delete_by_cond("RuleBlocks", {triggerId = tId})
    potato.db.delete_by_cond("Targets", {triggerId = tId})

    -- 3. Map temporary IDs to newly inserted IDs
    local rbIdMap = {}
    local tgIdMap = {}

    -- Insert RuleBlocks
    if body.rule_blocks then
        for _, rb in ipairs(body.rule_blocks) do
            local oldId = rb.id
            local blockData = {
                triggerId = tId,
                blockType = rb.blockType or "ALL_OF",
                parentRuleBlockId = nil,
                branch = rb.branch or "TRUE",
                delaySeconds = tonumber(rb.delaySeconds) or 0
            }
            local newId, _ = potato.db.insert("RuleBlocks", blockData)
            rbIdMap[oldId] = newId
            rbIdMap[tostring(oldId)] = newId
        end

        -- Update parentRuleBlockId with mapped IDs
        for _, rb in ipairs(body.rule_blocks) do
            local newId = rbIdMap[rb.id]
            if newId and rb.parentRuleBlockId then
                local mappedParentId = rbIdMap[rb.parentRuleBlockId] or rbIdMap[tostring(rb.parentRuleBlockId)] or rb.parentRuleBlockId
                potato.db.update_by_id("RuleBlocks", newId, {parentRuleBlockId = tonumber(mappedParentId)})
            end
        end
    end

    -- Insert Rules
    if body.rules then
        for _, r in ipairs(body.rules) do
            local mappedRbId = rbIdMap[r.ruleBlockId] or rbIdMap[tostring(r.ruleBlockId)] or tonumber(r.ruleBlockId)
            local ruleData = {
                triggerId = tId,
                ruleBlockId = tonumber(mappedRbId) or 0,
                ruleType = r.ruleType or "EQUAL",
                variable = r.variable or "",
                operator = r.operator or "equals",
                value = r.value or "",
                extraData = r.extraData or "",
                ["order"] = tonumber(r["order"]) or 0
            }
            potato.db.insert("Rules", ruleData)
        end
    end

    -- Insert Targets
    if body.targets then
        for _, tg in ipairs(body.targets) do
            local oldId = tg.id
            local metaStr = encode_json(tg.targetMeta)

            local targetData = {
                triggerId = tId,
                linkedBlockId = nil,
                linkedTargetId = nil,
                branch = tg.branch or "TRUE",
                targetType = tg.targetType or "WEBHOOK",
                targetMeta = metaStr
            }
            local newId, err = potato.db.insert("Targets", targetData)
            if err then
                print("Error inserting Target:", err)
            end
            tgIdMap[oldId] = newId
            tgIdMap[tostring(oldId)] = newId
        end

        -- Update linkedBlockId and linkedTargetId
        for _, tg in ipairs(body.targets) do
            local newId = tgIdMap[tg.id]
            if newId then
                local updates = {}
                if tg.linkedBlockId then
                    local mappedRbId = rbIdMap[tg.linkedBlockId] or rbIdMap[tostring(tg.linkedBlockId)] or tg.linkedBlockId
                    updates.linkedBlockId = tonumber(mappedRbId)
                end
                if tg.linkedTargetId then
                    local mappedTgId = tgIdMap[tg.linkedTargetId] or tgIdMap[tostring(tg.linkedTargetId)] or tg.linkedTargetId
                    updates.linkedTargetId = tonumber(mappedTgId)
                end
                if next(updates) ~= nil then
                    potato.db.update_by_id("Targets", newId, updates)
                end
            end
        end
    end

    return get_trigger_graph(ctx, tId)
end

function create_trigger(ctx)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local newTrigger = {
        name = body.name or "New Event Trigger",
        description = body.description or ""
    }

    local id, err = potato.db.insert("EventTriggers", newTrigger)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local created, findErr = potato.db.find_by_id("EventTriggers", id)
    req.json(201, created or {id = id, name = newTrigger.name})
end

function update_trigger(ctx, id)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local updates = {}
    if body.name ~= nil then updates.name = body.name end
    if body.description ~= nil then updates.description = body.description end

    local err = potato.db.update_by_id("EventTriggers", id, updates)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local updated = potato.db.find_by_id("EventTriggers", id)
    req.json(200, updated or {id = id, updated = true})
end

function delete_trigger(ctx, id)
    local req = ctx.request()
    local tId = tonumber(id)

    -- Cascade cleanup for related records
    potato.db.delete_by_cond("Rules", {triggerId = tId})
    potato.db.delete_by_cond("RuleBlocks", {triggerId = tId})
    potato.db.delete_by_cond("Targets", {triggerId = tId})

    local err = potato.db.delete_by_id("EventTriggers", tId)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    req.json(200, {message = "Trigger and associated nodes deleted", id = tId})
end

-- ==================== RULE BLOCKS CRUD ====================

function create_rule_block(ctx)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local block = {
        triggerId = tonumber(body.triggerId) or 0,
        blockType = body.blockType or "ALL_OF",
        parentRuleBlockId = body.parentRuleBlockId and tonumber(body.parentRuleBlockId) or nil,
        branch = body.branch or "TRUE",
        delaySeconds = tonumber(body.delaySeconds) or 0
    }

    local id, err = potato.db.insert("RuleBlocks", block)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local created = potato.db.find_by_id("RuleBlocks", id)
    req.json(201, created or {id = id})
end

function update_rule_block(ctx, id)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local updates = {}
    if body.blockType ~= nil then updates.blockType = body.blockType end
    if body.branch ~= nil then updates.branch = body.branch end
    if body.delaySeconds ~= nil then updates.delaySeconds = tonumber(body.delaySeconds) end
    if body.parentRuleBlockId ~= nil then
        if body.parentRuleBlockId == false or body.parentRuleBlockId == 0 or body.parentRuleBlockId == "" then
            updates.parentRuleBlockId = nil
        else
            updates.parentRuleBlockId = tonumber(body.parentRuleBlockId)
        end
    end
    if body.triggerId ~= nil then updates.triggerId = tonumber(body.triggerId) end

    local err = potato.db.update_by_id("RuleBlocks", id, updates)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local updated = potato.db.find_by_id("RuleBlocks", id)
    req.json(200, updated or {id = id, updated = true})
end

function delete_rule_block(ctx, id)
    local req = ctx.request()
    local rbId = tonumber(id)

    -- Clean up rules inside this block
    potato.db.delete_by_cond("Rules", {ruleBlockId = rbId})

    -- Detach any child rule blocks or targets
    local childBlocks = potato.db.find_all_by_cond("RuleBlocks", {parentRuleBlockId = rbId})
    if childBlocks then
        for _, cb in ipairs(childBlocks) do
            potato.db.update_by_id("RuleBlocks", cb.id, {parentRuleBlockId = nil})
        end
    end

    local linkedTargets = potato.db.find_all_by_cond("Targets", {linkedBlockId = rbId})
    if linkedTargets then
        for _, lt in ipairs(linkedTargets) do
            potato.db.update_by_id("Targets", lt.id, {linkedBlockId = nil})
        end
    end

    local err = potato.db.delete_by_id("RuleBlocks", rbId)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    req.json(200, {message = "RuleBlock deleted", id = rbId})
end

-- ==================== RULES CRUD ====================

function create_rule(ctx)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local rule = {
        triggerId = tonumber(body.triggerId) or 0,
        ruleBlockId = tonumber(body.ruleBlockId) or 0,
        ruleType = body.ruleType or "EQUAL",
        variable = body.variable or "",
        operator = body.operator or "equals",
        value = body.value or "",
        extraData = body.extraData or "",
        ["order"] = tonumber(body.order) or 0
    }

    local id, err = potato.db.insert("Rules", rule)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local created = potato.db.find_by_id("Rules", id)
    req.json(201, created or {id = id})
end

function update_rule(ctx, id)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local updates = {}
    if body.ruleType ~= nil then updates.ruleType = body.ruleType end
    if body.variable ~= nil then updates.variable = body.variable end
    if body.operator ~= nil then updates.operator = body.operator end
    if body.value ~= nil then updates.value = body.value end
    if body.extraData ~= nil then updates.extraData = body.extraData end
    if body.order ~= nil then updates["order"] = tonumber(body.order) end

    local err = potato.db.update_by_id("Rules", id, updates)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local updated = potato.db.find_by_id("Rules", id)
    req.json(200, updated or {id = id, updated = true})
end

function delete_rule(ctx, id)
    local req = ctx.request()
    local rId = tonumber(id)

    local err = potato.db.delete_by_id("Rules", rId)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    req.json(200, {message = "Rule deleted", id = rId})
end

-- ==================== TARGETS CRUD ====================

function create_target(ctx)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local targetMetaStr = encode_json(body.targetMeta)

    local target = {
        triggerId = tonumber(body.triggerId) or 0,
        linkedBlockId = body.linkedBlockId and tonumber(body.linkedBlockId) or nil,
        linkedTargetId = body.linkedTargetId and tonumber(body.linkedTargetId) or nil,
        branch = body.branch or "TRUE",
        targetType = body.targetType or "WEBHOOK",
        ruleBlockId = body.ruleBlockId and tonumber(body.ruleBlockId) or nil,
        targetMeta = targetMetaStr
    }

    local id, err = potato.db.insert("Targets", target)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local created = potato.db.find_by_id("Targets", id)
    req.json(201, created or {id = id})
end

function update_target(ctx, id)
    local req = ctx.request()
    local body = req.bind_json() or {}

    local updates = {}
    if body.targetType ~= nil then updates.targetType = body.targetType end
    if body.branch ~= nil then updates.branch = body.branch end
    if body.triggerId ~= nil then updates.triggerId = tonumber(body.triggerId) end
    if body.linkedBlockId ~= nil then
        if body.linkedBlockId == false or body.linkedBlockId == 0 or body.linkedBlockId == "" then
            updates.linkedBlockId = nil
        else
            updates.linkedBlockId = tonumber(body.linkedBlockId)
        end
    end
    if body.linkedTargetId ~= nil then
        if body.linkedTargetId == false or body.linkedTargetId == 0 or body.linkedTargetId == "" then
            updates.linkedTargetId = nil
        else
            updates.linkedTargetId = tonumber(body.linkedTargetId)
        end
    end
    if body.targetMeta ~= nil then
        updates.targetMeta = encode_json(body.targetMeta)
    end

    local err = potato.db.update_by_id("Targets", id, updates)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    local updated = potato.db.find_by_id("Targets", id)
    req.json(200, updated or {id = id, updated = true})
end

function delete_target(ctx, id)
    local req = ctx.request()
    local tId = tonumber(id)

    -- Detach downstream targets chained to this target
    local chainedTargets = potato.db.find_all_by_cond("Targets", {linkedTargetId = tId})
    if chainedTargets then
        for _, ct in ipairs(chainedTargets) do
            potato.db.update_by_id("Targets", ct.id, {linkedTargetId = nil})
        end
    end

    local err = potato.db.delete_by_id("Targets", tId)
    if err then
        req.json(500, {error = tostring(err)})
        return
    end

    req.json(200, {message = "Target deleted", id = tId})
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

    -- Triggers Collection: /triggers
    if path == "/triggers" and method == "GET" then
        return list_triggers(ctx)
    end

    if path == "/triggers" and method == "POST" then
        return create_trigger(ctx)
    end

    -- Trigger Graph: /triggers/:id/graph
    local trigger_graph_id = string.match(path, "^/triggers/(%d+)/graph$")
    if trigger_graph_id then
        if method == "GET" then
            return get_trigger_graph(ctx, tonumber(trigger_graph_id))
        elseif method == "PUT" or method == "POST" then
            return save_trigger_graph(ctx, tonumber(trigger_graph_id))
        end
    end

    -- Specific Trigger: /triggers/:id
    local trigger_id_str = string.match(path, "^/triggers/(%d+)$")
    if trigger_id_str then
        local t_id = tonumber(trigger_id_str)
        if method == "GET" then
            return get_trigger(ctx, t_id)
        elseif method == "PUT" or method == "PATCH" then
            return update_trigger(ctx, t_id)
        elseif method == "DELETE" then
            return delete_trigger(ctx, t_id)
        end
    end

    -- Rule Blocks: /rule-blocks
    if path == "/rule-blocks" and method == "POST" then
        return create_rule_block(ctx)
    end

    local rb_id_str = string.match(path, "^/rule-blocks/(%d+)$")
    if rb_id_str then
        local rb_id = tonumber(rb_id_str)
        if method == "PUT" or method == "PATCH" then
            return update_rule_block(ctx, rb_id)
        elseif method == "DELETE" then
            return delete_rule_block(ctx, rb_id)
        end
    end

    -- Rules: /rules
    if path == "/rules" and method == "POST" then
        return create_rule(ctx)
    end

    local r_id_str = string.match(path, "^/rules/(%d+)$")
    if r_id_str then
        local r_id = tonumber(r_id_str)
        if method == "PUT" or method == "PATCH" then
            return update_rule(ctx, r_id)
        elseif method == "DELETE" then
            return delete_rule(ctx, r_id)
        end
    end

    -- Targets: /targets
    if path == "/targets" and method == "POST" then
        return create_target(ctx)
    end

    local target_id_str = string.match(path, "^/targets/(%d+)$")
    if target_id_str then
        local target_id = tonumber(target_id_str)
        if method == "PUT" or method == "PATCH" then
            return update_target(ctx, target_id)
        elseif method == "DELETE" then
            return delete_target(ctx, target_id)
        end
    end

    req.json(404, {
        error = "Not Found",
        path = path,
        method = method
    })
end