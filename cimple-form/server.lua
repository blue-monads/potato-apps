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

    local db = potato.db.run_ddl(schema)
    if db ~= nil then
        req.json(200, {
            message = "Schema applied"
        })
    end

end

function list_forms(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)    
    if userId == nil then return end

    local forms, err = potato.db.find_all_by_cond("forms", {})
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end

    req.json_array(200, forms)
end

function get_form(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local formIdStr, exists = req.get_query("form_id")
    if not exists or formIdStr == nil then
        req.json(400, {
            error = "form_id is required"
        })
        return
    end
    local formId = tonumber(formIdStr)
    if formId == nil then
        req.json(400, {
            error = "form_id must be a number"
        })
        return
    end

    -- Get form
    local form, err = potato.db.find_by_id("forms", formId)
    if err ~= nil then
        req.json(400, {
            error = tostring(err)
        })
        return
    end
    if form == nil then
        req.json(404, {
            error = "Form not found"
        })
        return
    end

    -- Get sections
    local sections, err = potato.db.find_all_by_cond("formSections", {
        form_id = formId
    })
    if err ~= nil then
        req.json(400, {
            error = "Failed to load sections: " .. tostring(err)
        })
        return
    end
    -- Ensure sections is an array
    local sectionsArray = {}
    if sections ~= nil and type(sections) == "table" then
        if #sections > 0 then
            -- It's already an array with elements
            sectionsArray = sections
        else
            -- Check if it has any string keys (making it an object)
            local hasStringKeys = false
            for k, v in pairs(sections) do
                if type(k) == "string" then
                    hasStringKeys = true
                    break
                end
            end
            if hasStringKeys then
                -- It's an object, convert to array by extracting values
                sectionsArray = {}
                for k, v in pairs(sections) do
                    if type(k) == "number" then
                        table.insert(sectionsArray, v)
                    end
                end
            else
                -- Empty table with no string keys - treat as empty array
                sectionsArray = {}
            end
        end
    end

    -- Get fields
    local fields, err = potato.db.find_all_by_cond("formFields", {
        form_id = formId
    })
    if err ~= nil then
        req.json(400, {
            error = "Failed to load fields: " .. tostring(err)
        })
        return
    end
    -- Ensure fields is an array
    local fieldsArray = {}
    if fields ~= nil and type(fields) == "table" then
        if #fields > 0 then
            -- It's already an array with elements
            fieldsArray = fields
        else
            -- Check if it has any string keys (making it an object)
            local hasStringKeys = false
            for k, v in pairs(fields) do
                if type(k) == "string" then
                    hasStringKeys = true
                    break
                end
            end
            if hasStringKeys then
                -- It's an object, convert to array by extracting values
                fieldsArray = {}
                for k, v in pairs(fields) do
                    if type(k) == "number" then
                        table.insert(fieldsArray, v)
                    end
                end
            else
                -- Empty table with no string keys - treat as empty array
                fieldsArray = {}
            end
        end
    end

    req.json(200, {
        form = form,
        sections = sectionsArray,
        fields = fieldsArray
    })
end

function create_form(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body, err = req.bind_json()
    if err ~= nil then
        req.json(400, {
            error = "Invalid JSON: " .. tostring(err)
        })
        return
    end

    if not body then
        req.json(400, {
            error = "Request body is required"
        })
        return
    end

    local dbData = {
        name = body.name or "",
        description = body.description or "",
        pinned_domains = body.pinned_domains or "",
        embed_token = body.embed_token or "",
        status = body.status or "draft"
    }
    -- Omit extrameta - database will use default '{}'

    local id, err = potato.db.insert("forms", dbData)
    if err ~= nil then
        req.json(500, {
            error = "Failed to create form: " .. tostring(err)
        })
        return
    end

    req.json(201, {
        id = id
    })
end

function update_form(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local formIdStr, exists = req.get_query("form_id")
    if not exists or formIdStr == nil then
        req.json(400, {
            error = "form_id is required"
        })
        return
    end
    local formId = tonumber(formIdStr)
    if formId == nil then
        req.json(400, {
            error = "form_id must be a number"
        })
        return
    end

    local body, err = req.bind_json()
    if err ~= nil then
        req.json(400, {
            error = "Invalid JSON: " .. tostring(err)
        })
        return
    end

    if not body then
        req.json(400, {
            error = "Request body is required"
        })
        return
    end

    local dbData = {
        name = body.name or "",
        description = body.description or "",
        pinned_domains = body.pinned_domains or "",
        embed_token = body.embed_token or "",
        status = body.status or "draft"
    }
    -- Omit extrameta - database will use default '{}'

    err = potato.db.update_by_id("forms", formId, dbData)
    if err ~= nil then
        req.json(500, {
            error = "Failed to update form: " .. tostring(err)
        })
        return
    end

    req.json(200, {
        message = "Form updated"
    })
end

function delete_form(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local formIdStr, exists = req.get_query("form_id")
    if not exists or formIdStr == nil then
        req.json(400, {
            error = "form_id is required"
        })
        return
    end
    local formId = tonumber(formIdStr)
    if formId == nil then
        req.json(400, {
            error = "form_id must be a number"
        })
        return
    end

    -- Delete fields first
    local err = potato.db.delete_by_cond("formFields", {
        form_id = formId
    })
    if err ~= nil then
        req.json(500, {
            error = "Failed to delete fields: " .. tostring(err)
        })
        return
    end

    -- Delete sections
    err = potato.db.delete_by_cond("formSections", {
        form_id = formId
    })
    if err ~= nil then
        req.json(500, {
            error = "Failed to delete sections: " .. tostring(err)
        })
        return
    end

    -- Delete form
    err = potato.db.delete_by_id("forms", formId)
    if err ~= nil then
        req.json(500, {
            error = "Failed to delete form: " .. tostring(err)
        })
        return
    end

    req.json(200, {
        message = "Form deleted"
    })
end

function bulk_upsert_sections(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body, err = req.bind_json()
    if err ~= nil then
        req.json(400, {
            error = "Invalid JSON: " .. tostring(err)
        })
        return
    end

    if not body or not body.sections or type(body.sections) ~= "table" then
        req.json(400, {
            error = "sections array is required"
        })
        return
    end

    local results = {}

    for _, sectionData in ipairs(body.sections) do
        -- Remove is_new and is_modified flags
        local isNew = sectionData.is_new == true
        local isModified = sectionData.is_modified == true
        sectionData.is_new = nil
        sectionData.is_modified = nil

        -- Prepare data for database
        local dbData = {
            name = sectionData.name or "",
            section_order = sectionData.section_order or 0,
            form_id = sectionData.form_id or 0,
            layout = sectionData.layout or "horizontal"
        }
        -- Omit extrameta - database will use default '{}'

        if isNew then
            -- Insert new section
            local id, err = potato.db.insert("formSections", dbData)
            if err ~= nil then
                req.json(500, {
                    error = "Failed to insert section: " .. tostring(err)
                })
                return
            end
            table.insert(results, { id = id, action = "inserted" })
        elseif isModified and sectionData.id then
            -- Update existing section
            local err = potato.db.update_by_id("formSections", sectionData.id, dbData)
            if err ~= nil then
                req.json(500, {
                    error = "Failed to update section: " .. tostring(err)
                })
                return
            end
            table.insert(results, { id = sectionData.id, action = "updated" })
        else
            -- Skip unchanged
            table.insert(results, { id = sectionData.id, action = "skipped" })
        end
    end

    req.json(200, {
        results = results
    })
end

function bulk_upsert_fields(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local body, err = req.bind_json()
    if err ~= nil then
        req.json(400, {
            error = "Invalid JSON: " .. tostring(err)
        })
        return
    end

    if not body or not body.fields or type(body.fields) ~= "table" then
        req.json(400, {
            error = "fields array is required"
        })
        return
    end

    local results = {}

    for _, fieldData in ipairs(body.fields) do
        -- Remove is_new and is_modified flags
        local isNew = fieldData.is_new == true
        local isModified = fieldData.is_modified == true
        fieldData.is_new = nil
        fieldData.is_modified = nil

        -- Prepare data for database
        local dbData = {
            name = fieldData.name or "",
            field_type = fieldData.field_type or "",
            default_value = fieldData.default_value or "",
            field_order = fieldData.field_order or 0,
            form_id = fieldData.form_id or 0,
            section_id = fieldData.section_id or 0
        }
        -- Omit field_options and extrameta - database will use defaults
        -- TODO: Add JSON serialization support for these fields

        if isNew then
            -- Insert new field
            local id, err = potato.db.insert("formFields", dbData)
            if err ~= nil then
                req.json(500, {
                    error = "Failed to insert field: " .. tostring(err)
                })
                return
            end
            table.insert(results, { id = id, action = "inserted" })
        elseif isModified and fieldData.id then
            -- Update existing field
            local err = potato.db.update_by_id("formFields", fieldData.id, dbData)
            if err ~= nil then
                req.json(500, {
                    error = "Failed to update field: " .. tostring(err)
                })
                return
            end
            table.insert(results, { id = fieldData.id, action = "updated" })
        else
            -- Skip unchanged
            table.insert(results, { id = fieldData.id, action = "skipped" })
        end
    end

    req.json(200, {
        results = results
    })
end

function delete_section(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local sectionIdStr, exists = req.get_query("section_id")
    if not exists or sectionIdStr == nil then
        req.json(400, {
            error = "section_id is required"
        })
        return
    end
    local sectionId = tonumber(sectionIdStr)
    if sectionId == nil then
        req.json(400, {
            error = "section_id must be a number"
        })
        return
    end

    -- Delete fields in this section first
    local err = potato.db.delete_by_cond("formFields", {
        section_id = sectionId
    })
    if err ~= nil then
        req.json(500, {
            error = "Failed to delete fields: " .. tostring(err)
        })
        return
    end

    -- Delete section
    err = potato.db.delete_by_id("formSections", sectionId)
    if err ~= nil then
        req.json(500, {
            error = "Failed to delete section: " .. tostring(err)
        })
        return
    end

    req.json(200, {
        message = "Section deleted"
    })
end

function delete_field(ctx)
    local req = ctx.request()
    local userId = get_user_id(req)
    if userId == nil then return end

    local fieldIdStr, exists = req.get_query("field_id")
    if not exists or fieldIdStr == nil then
        req.json(400, {
            error = "field_id is required"
        })
        return
    end
    local fieldId = tonumber(fieldIdStr)
    if fieldId == nil then
        req.json(400, {
            error = "field_id must be a number"
        })
        return
    end

    local err = potato.db.delete_by_id("formFields", fieldId)
    if err ~= nil then
        req.json(500, {
            error = "Failed to delete field: " .. tostring(err)
        })
        return
    end

    req.json(200, {
        message = "Field deleted"
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

    if path == "/api/forms" and method == "GET" then
        return list_forms(ctx)
    end

    if path == "/api/form" and method == "GET" then
        return get_form(ctx)
    end

    if path == "/api/form/create" and method == "POST" then
        return create_form(ctx)
    end

    if path == "/api/form/update" and method == "PUT" then
        return update_form(ctx)
    end

    if path == "/api/form/delete" and method == "DELETE" then
        return delete_form(ctx)
    end

    if path == "/api/sections/bulk_upsert" and method == "POST" then
        return bulk_upsert_sections(ctx)
    end

    if path == "/api/fields/bulk_upsert" and method == "POST" then
        return bulk_upsert_fields(ctx)
    end

    if path == "/api/section/delete" and method == "DELETE" then
        return delete_section(ctx)
    end

    if path == "/api/field/delete" and method == "DELETE" then
        return delete_field(ctx)
    end

    req.json(200, {
        message = "Ok"
    })
end