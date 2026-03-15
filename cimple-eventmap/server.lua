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


function run_schema_sql(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)

    if userId == nil then return end

    local tables = potato.db.list_tables()
    if tables ~= nil and #tables > 0 then
        req.json(200, {
            message = "Tables already exist"
        })
        return
    end
    
    local schema, err = potato.core.read_package_file("schema.sql")
    if err ~= nil then
        req.json(500, {
            message = "Failed to read schema.sql: " .. err
        })
        return
    end

    local result, ddlerr = potato.db.run_ddl(schema)
    if ddlerr ~= nil then
        req.json(500, {
            message = "Failed to apply schema: " .. tostring(ddlerr)
        })
        return
    end

    req.json(200, {
        message = "Schema applied"
    })
end

-- WebSocket token endpoint
function get_ws_token(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local browser_id = os.time()
    local conn_id = "browser:" .. tostring(browser_id)

    local easyws_cap_token, err = potato.cap.sign_token("easy-ws", {
        user_id = userId,
        resource_id = conn_id
    })

    if err ~= nil then
        req.json(500, {
            error = "Failed to generate easyws cap token: " .. tostring(err)
        })
        return
    end

    req.json(200, {
        easyws_cap_token = easyws_cap_token,
        conn_id = conn_id
    })
end

-- Events API
function list_events(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local events, err = potato.db.find_all_by_cond("Events", {})
    if err ~= nil then
        req.json(500, {
            error = "Failed to list events: " .. tostring(err)
        })
        return
    end

    -- Ensure we always return an array, even if events is nil
    if events == nil then
        events = {}
    end
    -- Use json_array to ensure proper array serialization
    req.json_array(200, events)
end

function get_event(ctx, event_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local event, err = potato.db.find_by_id("Events", event_id)
    if err ~= nil then
        req.json(404, {
            error = "Event not found: " .. tostring(err)
        })
        return
    end

    req.json(200, event)
end

function create_event(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()

    local event = {
        title = body.title or "",
        info = body.info or "",
        event_type_id = body.event_type_id or nil,
        event_data = body.event_data or "{}",
        lat = body.lat or 0,
        lng = body.lng or 0,
        event_start = body.event_start or nil,
        event_end = body.event_end or nil
    }

    local id, insertErr = potato.db.insert("Events", event)
    if insertErr ~= nil then
        req.json(500, {
            error = "Failed to create event: " .. tostring(insertErr)
        })
        return
    end

    local createdEvent, fetchErr = potato.db.find_by_id("Events", id)
    if fetchErr ~= nil then
        req.json(500, {
            error = "Failed to fetch created event: " .. tostring(fetchErr)
        })
        return
    end

    -- Broadcast event creation via WebSocket
    local broadcastParams = {
        type = "event_created",
        data = createdEvent
    }
    local _, broadcastErr = potato.cap.execute("easy-ws", "broadcast", broadcastParams)
    if broadcastErr ~= nil then
        -- Log error but don't fail the request
        print("Warning: Failed to broadcast event creation: " .. tostring(broadcastErr))
    end

    -- Publish event creation event to event hub
    local eventOpts = {
        name = "event_added",
        payload = {
            event_id = createdEvent.id,
            event_type_id = createdEvent.event_type_id
        }
    }
    local _, publishErr = potato.core.publish_event(eventOpts)
    if publishErr ~= nil then
        -- Log error but don't fail the request
        print("Warning: Failed to publish event_added event: " .. tostring(publishErr))
    end

    req.json(201, createdEvent)
end

-- EventTypes API
function list_event_types(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local eventTypes, err = potato.db.find_all_by_cond("EventTypes", {})
    if err ~= nil then
        req.json(500, {
            error = "Failed to list event types: " .. tostring(err)
        })
        return
    end

    if eventTypes == nil then
        eventTypes = {}
    end
    
    req.json_array(200, eventTypes)
end

function get_event_type(ctx, event_type_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local eventType, err = potato.db.find_by_id("EventTypes", event_type_id)
    if err ~= nil then
        req.json(404, {
            error = "Event type not found: " .. tostring(err)
        })
        return
    end

    req.json(200, eventType)
end

function create_event_type(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()

    local eventType = {
        name = body.name or "",
        event_type = body.event_type or "e",
        icon = body.icon or "",
        color = body.color or ""
    }

    local id, insertErr = potato.db.insert("EventTypes", eventType)
    if insertErr ~= nil then
        req.json(500, {
            error = "Failed to create event type: " .. tostring(insertErr)
        })
        return
    end

    local createdEventType, fetchErr = potato.db.find_by_id("EventTypes", id)
    if fetchErr ~= nil then
        req.json(500, {
            error = "Failed to fetch created event type: " .. tostring(fetchErr)
        })
        return
    end

    -- Broadcast event type creation via WebSocket
    local broadcastParams = {
        type = "event_type_created",
        data = createdEventType
    }
    local _, broadcastErr = potato.cap.execute("easy-ws", "broadcast", broadcastParams)
    if broadcastErr ~= nil then
        -- Log error but don't fail the request
        print("Warning: Failed to broadcast event type creation: " .. tostring(broadcastErr))
    end

    -- Publish event type creation event to event hub
    local eventOpts = {
        name = "event_type_added",
        payload = {
            event_type_id = createdEventType.id
        }
    }
    local _, publishErr = potato.core.publish_event(eventOpts)
    if publishErr ~= nil then
        -- Log error but don't fail the request
        print("Warning: Failed to publish event_type_added event: " .. tostring(publishErr))
    end

    req.json(201, createdEventType)
end

function update_event_type(ctx, event_type_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()

    -- Get existing event type
    local existingEventType, err = potato.db.find_by_id("EventTypes", event_type_id)
    if err ~= nil then
        req.json(404, {
            error = "Event type not found: " .. tostring(err)
        })
        return
    end

    -- Update fields if provided
    if body.name ~= nil then
        existingEventType.name = body.name
    end
    if body.event_type ~= nil then
        existingEventType.event_type = body.event_type
    end
    if body.icon ~= nil then
        existingEventType.icon = body.icon
    end
    if body.color ~= nil then
        existingEventType.color = body.color
    end

    -- Update event type in database
    local updateErr = potato.db.update_by_id("EventTypes", event_type_id, existingEventType)
    if updateErr ~= nil then
        req.json(500, {
            error = "Failed to update event type: " .. tostring(updateErr)
        })
        return
    end

    -- Get updated event type
    local updatedEventType, fetchErr = potato.db.find_by_id("EventTypes", event_type_id)
    if fetchErr ~= nil then
        req.json(500, {
            error = "Failed to fetch updated event type: " .. tostring(fetchErr)
        })
        return
    end

    -- Broadcast event type update via WebSocket
    local broadcastParams = {
        type = "event_type_updated",
        data = updatedEventType
    }
    local _, broadcastErr = potato.cap.execute("easy-ws", "broadcast", broadcastParams)
    if broadcastErr ~= nil then
        print("Warning: Failed to broadcast event type update: " .. tostring(broadcastErr))
    end

    -- Publish event type update event to event hub
    local eventOpts = {
        name = "event_type_updated",
        payload = {
            event_type_id = updatedEventType.id
        }
    }
    local _, publishErr = potato.core.publish_event(eventOpts)
    if publishErr ~= nil then
        print("Warning: Failed to publish event_type_updated event: " .. tostring(publishErr))
    end

    req.json(200, updatedEventType)
end

function delete_event_type(ctx, event_type_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    -- Check if event type exists
    local existingEventType, err = potato.db.find_by_id("EventTypes", event_type_id)
    if err ~= nil then
        req.json(404, {
            error = "Event type not found: " .. tostring(err)
        })
        return
    end

    -- Delete event type
    local deleteErr = potato.db.delete_by_id("EventTypes", event_type_id)
    if deleteErr ~= nil then
        req.json(500, {
            error = "Failed to delete event type: " .. tostring(deleteErr)
        })
        return
    end

    -- Broadcast event type deletion via WebSocket
    local broadcastParams = {
        type = "event_type_deleted",
        data = {
            event_type_id = event_type_id
        }
    }
    local _, broadcastErr = potato.cap.execute("easy-ws", "broadcast", broadcastParams)
    if broadcastErr ~= nil then
        print("Warning: Failed to broadcast event type deletion: " .. tostring(broadcastErr))
    end

    -- Publish event type deletion event to event hub
    local eventOpts = {
        name = "event_type_deleted",
        payload = {
            event_type_id = event_type_id
        }
    }
    local _, publishErr = potato.core.publish_event(eventOpts)
    if publishErr ~= nil then
        print("Warning: Failed to publish event_type_deleted event: " .. tostring(publishErr))
    end

    req.json(200, {
        message = "Event type deleted"
    })
end

function on_http(ctx)
    local req = ctx.request()
    local path = ctx.param("subpath")
    local method = ctx.param("method")

    print("on_http - path:", path, "method:", method)

    if path == "/run_schema_sql" and method == "POST" then
        return run_schema_sql(ctx)
    end

    local userId = get_user_id(req)
    if userId == nil then return end

    -- WebSocket capability token endpoint
    if path == "/get-ws-token" and method == "GET" then
        return get_ws_token(ctx)
    end

    -- Events routes
    if path == "/events" and method == "GET" then
        return list_events(ctx)
    end

    if path == "/events" and method == "POST" then
        return create_event(ctx)
    end

    local event_id_match = string.match(path, "^/events/(%d+)$")
    if event_id_match then
        local event_id = tonumber(event_id_match)
        if event_id ~= nil and method == "GET" then
            return get_event(ctx, event_id)
        end
    end

    -- EventTypes routes
    if path == "/event-types" and method == "GET" then
        return list_event_types(ctx)
    end

    if path == "/event-types" and method == "POST" then
        return create_event_type(ctx)
    end

    local event_type_id_match = string.match(path, "^/event-types/(%d+)$")
    if event_type_id_match then
        local event_type_id = tonumber(event_type_id_match)
        if event_type_id ~= nil then
            if method == "GET" then
                return get_event_type(ctx, event_type_id)
            elseif method == "PUT" then
                return update_event_type(ctx, event_type_id)
            elseif method == "DELETE" then
                return delete_event_type(ctx, event_type_id)
            end
        end
    end

    -- Features routes
    if path == "/features" and method == "GET" then
        return list_features(ctx)
    end

    if path == "/features" and method == "POST" then
        return create_feature(ctx)
    end

    local feature_id_match = string.match(path, "^/features/(%d+)$")
    if feature_id_match then
        local feature_id = tonumber(feature_id_match)
        if feature_id ~= nil then
            if method == "GET" then
                return get_feature(ctx, feature_id)
            elseif method == "PUT" then
                return update_feature(ctx, feature_id)
            elseif method == "DELETE" then
                return delete_feature(ctx, feature_id)
            end
        end
    end

    req.json(200, {
        message = "Ok"
    })
end

-- Features API
function list_features(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local features, err = potato.db.find_all_by_cond("Features", {})
    if err ~= nil then
        req.json(500, {
            error = "Failed to list features: " .. tostring(err)
        })
        return
    end

    if features == nil then
        features = {}
    end
    
    -- Parse geometry_data for each feature
    for i, feature in ipairs(features) do
        if feature.geometry_data ~= nil and feature.geometry_data ~= "" and feature.geometry_data ~= "{}" then
            local geometry, parseErr = require("json").decode(feature.geometry_data)
            if parseErr == nil then
                feature.geometry = geometry
            end
        end
    end
    
    req.json_array(200, features)
end

function get_feature(ctx, feature_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local feature, err = potato.db.find_by_id("Features", feature_id)
    if err ~= nil then
        req.json(404, {
            error = "Feature not found: " .. tostring(err)
        })
        return
    end

    -- Parse geometry_data for response
    if feature.geometry_data ~= nil and feature.geometry_data ~= "" and feature.geometry_data ~= "{}" then
        local geometry, parseErr = require("json").decode(feature.geometry_data)
        if parseErr == nil then
            feature.geometry = geometry
        end
    end

    req.json(200, feature)
end

-- Helper function to convert geometry to geopoly format
-- Geopoly format: array of [x, y] coordinate pairs
function geometry_to_geopoly(geometry, feature_type)
    if geometry == nil then
        return nil
    end

    local geopoly_coords = {}
    
    if feature_type == "point" then
        -- For points, create a small bounding box (0.0001 degree ~= 11 meters)
        local lat = geometry[1]
        local lng = geometry[2]
        local offset = 0.0001
        geopoly_coords = {
            {lng - offset, lat - offset},
            {lng + offset, lat - offset},
            {lng + offset, lat + offset},
            {lng - offset, lat + offset}
        }
    elseif feature_type == "line" then
        -- For lines, use the points directly (geopoly needs closed polygon, so we'll close it)
        for i, point in ipairs(geometry) do
            table.insert(geopoly_coords, {point[2], point[1]}) -- geopoly uses [lng, lat]
        end
        -- Close the polygon by adding first point at the end
        if #geopoly_coords > 0 then
            table.insert(geopoly_coords, geopoly_coords[1])
        end
    elseif feature_type == "area" then
        -- For areas, use the polygon points
        for i, point in ipairs(geometry) do
            table.insert(geopoly_coords, {point[2], point[1]}) -- geopoly uses [lng, lat]
        end
        -- Ensure it's closed
        if #geopoly_coords > 0 and (geopoly_coords[1][1] ~= geopoly_coords[#geopoly_coords][1] or 
            geopoly_coords[1][2] ~= geopoly_coords[#geopoly_coords][2]) then
            table.insert(geopoly_coords, geopoly_coords[1])
        end
    end

    if #geopoly_coords < 3 then
        return nil -- Need at least 3 points for a polygon
    end

    return geopoly_coords
end

function create_feature(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()

    -- Convert geometry to JSON string for storage
    local geometryJson = "{}"
    if body.geometry ~= nil then
        geometryJson = require("json").encode(body.geometry)
    end

    local feature = {
        name = body.name or "",
        description = body.description or "",
        color = body.color or "#3B82F6",
        feature_type = body.feature_type or "point",
        geometry_data = geometryJson
    }

    local id, insertErr = potato.db.insert("Features", feature)
    if insertErr ~= nil then
        req.json(500, {
            error = "Failed to create feature: " .. tostring(insertErr)
        })
        return
    end

    -- Insert into geopoly table for spatial queries
    if body.geometry ~= nil then
        local geopoly_coords = geometry_to_geopoly(body.geometry, body.feature_type or "point")
        if geopoly_coords ~= nil then
            -- Convert to geopoly JSON format: [[x1,y1], [x2,y2], ...]
            local geopoly_json = require("json").encode(geopoly_coords)
            
            -- Insert into FeatureLocations geopoly table using parameterized query
            -- Geopoly _shape column expects JSON array of coordinate pairs
            local geopoly_insert = "INSERT INTO FeatureLocations(feature_id, _shape) VALUES (?, ?)"
            local _, geopolyErr = potato.db.run_query(geopoly_insert, id, geopoly_json)
            if geopolyErr ~= nil then
                -- Log error but don't fail the feature creation
                print("Warning: Failed to insert into geopoly table: " .. tostring(geopolyErr))
            end
        end
    end

    local createdFeature, fetchErr = potato.db.find_by_id("Features", id)
    if fetchErr ~= nil then
        req.json(500, {
            error = "Failed to fetch created feature: " .. tostring(fetchErr)
        })
        return
    end

    -- Parse geometry_data back to table for response
    if createdFeature.geometry_data ~= nil and createdFeature.geometry_data ~= "" and createdFeature.geometry_data ~= "{}" then
        local geometry, parseErr = require("json").decode(createdFeature.geometry_data)
        if parseErr == nil then
            createdFeature.geometry = geometry
        end
    end

    -- Broadcast feature creation via WebSocket
    local broadcastParams = {
        type = "feature_created",
        data = createdFeature
    }
    local _, broadcastErr = potato.cap.execute("easy-ws", "broadcast", broadcastParams)
    if broadcastErr ~= nil then
        -- Log error but don't fail the request
        print("Warning: Failed to broadcast feature creation: " .. tostring(broadcastErr))
    end

    -- Publish feature creation event to event hub
    local eventOpts = {
        name = "feature_created",
        payload = {
            feature_id = createdFeature.id
        }
    }
    local _, publishErr = potato.core.publish_event(eventOpts)
    if publishErr ~= nil then
        -- Log error but don't fail the request
        print("Warning: Failed to publish feature_created event: " .. tostring(publishErr))
    end

    req.json(201, createdFeature)
end

function update_feature(ctx, feature_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body = req.bind_json()

    -- Get existing feature
    local existingFeature, err = potato.db.find_by_id("Features", feature_id)
    if err ~= nil then
        req.json(404, {
            error = "Feature not found: " .. tostring(err)
        })
        return
    end

    -- Update fields if provided
    if body.name ~= nil then
        existingFeature.name = body.name
    end
    if body.description ~= nil then
        existingFeature.description = body.description
    end
    if body.color ~= nil then
        existingFeature.color = body.color
    end
    if body.feature_type ~= nil then
        existingFeature.feature_type = body.feature_type
    end
    if body.geometry ~= nil then
        existingFeature.geometry_data = require("json").encode(body.geometry)
    end

    -- Update feature in database
    local updateErr = potato.db.update_by_id("Features", feature_id, existingFeature)
    if updateErr ~= nil then
        req.json(500, {
            error = "Failed to update feature: " .. tostring(updateErr)
        })
        return
    end

    -- Update geopoly table if geometry changed
    if body.geometry ~= nil then
        -- Delete existing geopoly entry
        local delete_geopoly = "DELETE FROM FeatureLocations WHERE feature_id = ?"
        potato.db.run_query(delete_geopoly, feature_id)
        
        -- Insert new geopoly entry
        local geopoly_coords = geometry_to_geopoly(body.geometry, body.feature_type or existingFeature.feature_type or "point")
        if geopoly_coords ~= nil then
            local geopoly_json = require("json").encode(geopoly_coords)
            local geopoly_insert = "INSERT INTO FeatureLocations(feature_id, _shape) VALUES (?, ?)"
            local _, geopolyErr = potato.db.run_query(geopoly_insert, feature_id, geopoly_json)
            if geopolyErr ~= nil then
                print("Warning: Failed to insert into geopoly table: " .. tostring(geopolyErr))
            end
        end
    end

    -- Get updated feature
    local updatedFeature, fetchErr = potato.db.find_by_id("Features", feature_id)
    if fetchErr ~= nil then
        req.json(500, {
            error = "Failed to fetch updated feature: " .. tostring(fetchErr)
        })
        return
    end

    -- Parse geometry_data back to table for response
    if updatedFeature.geometry_data ~= nil and updatedFeature.geometry_data ~= "" and updatedFeature.geometry_data ~= "{}" then
        local geometry, parseErr = require("json").decode(updatedFeature.geometry_data)
        if parseErr == nil then
            updatedFeature.geometry = geometry
        end
    end

    -- Broadcast feature update via WebSocket
    local broadcastParams = {
        type = "feature_updated",
        data = updatedFeature
    }
    local _, broadcastErr = potato.cap.execute("easy-ws", "broadcast", broadcastParams)
    if broadcastErr ~= nil then
        print("Warning: Failed to broadcast feature update: " .. tostring(broadcastErr))
    end

    -- Publish feature update event to event hub
    local eventOpts = {
        name = "feature_updated",
        payload = {
            feature_id = updatedFeature.id
        }
    }
    local _, publishErr = potato.core.publish_event(eventOpts)
    if publishErr ~= nil then
        print("Warning: Failed to publish feature_updated event: " .. tostring(publishErr))
    end

    req.json(200, updatedFeature)
end

function delete_feature(ctx, feature_id)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    -- Delete from geopoly table first
    local delete_geopoly = "DELETE FROM FeatureLocations WHERE feature_id = ?"
    potato.db.run_query(delete_geopoly, feature_id)

    -- Delete from Features table
    local err = potato.db.delete_by_id("Features", feature_id)
    if err ~= nil then
        req.json(500, {
            error = "Failed to delete feature: " .. tostring(err)
        })
        return
    end

    -- Broadcast feature deletion via WebSocket
    local broadcastParams = {
        type = "feature_deleted",
        data = {
            feature_id = feature_id
        }
    }
    local _, broadcastErr = potato.cap.execute("easy-ws", "broadcast", broadcastParams)
    if broadcastErr ~= nil then
        print("Warning: Failed to broadcast feature deletion: " .. tostring(broadcastErr))
    end

    -- Publish feature deletion event to event hub
    local eventOpts = {
        name = "feature_deleted",
        payload = {
            feature_id = feature_id
        }
    }
    local _, publishErr = potato.core.publish_event(eventOpts)
    if publishErr ~= nil then
        print("Warning: Failed to publish feature_deleted event: " .. tostring(publishErr))
    end

    req.json(200, {
        message = "Feature deleted"
    })
end
