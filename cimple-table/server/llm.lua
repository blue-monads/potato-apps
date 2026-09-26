local potato = require("potato")
local phttp = require("phttp")
local json = require("json")

---@class ChatMessage
---@field content string?
---@field role "assistant" | "user" | "system" | "tool" | string
---@field tool_calls table[]?
---@field tool_call_id string?
---@field name string?

---@class ChatChoice
---@field finish_reason string
---@field index integer
---@field message ChatMessage

---@class UsageStats
---@field completion_tokens integer
---@field prompt_tokens integer
---@field total_tokens integer

---@class ChatCompletionResponse
---@field id string
---@field object "chat.completion" | string
---@field created integer
---@field model string
---@field system_fingerprint string?
---@field choices ChatChoice[]
---@field usage UsageStats?

---@class LLMToolCall
---@field id string
---@field name string
---@field arguments table|string
---@field result any
---@field error string?

---@class LLMToolCallOptions
---@field model_options table? Options passed to core_llm_chat (model, site_url, etc.)
---@field tools table Tool definitions (array of tools or map of name -> def)
---@field func_ctx table? Context passed as first argument to tool handlers
---@field handlers table<string, function>? Optional explicit handler functions map
---@field max_steps integer? Maximum loop iterations (default 10)

---@class LLMToolCallResult
---@field llm_response ChatCompletionResponse
---@field tool_calls LLMToolCall[]

-- OpenRouter API configuration
local OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
local DEFAULT_MODEL = "openai/gpt-4o-mini"

local function get_openrouter_api_key()
    local api_key = potato.core.get_env("OPENROUTER_API_KEY")
    if not api_key or api_key == "" then
        api_key = potato.core.get_env("OPENROUTER_KEY")
    end
    return api_key
end

--- Sends a chat completion request to OpenRouter using Potatoverse bindings.
--- @param messages table Array of message tables.
--- @param opts table? Options table: {model: string?, site_url: string?, site_title: string?, tools: table?, tool_choice: any?}
--- @return ChatCompletionResponse|nil response Response object on success, nil on failure.
--- @return nil|string error Error string on failure.
function core_llm_chat(messages, opts)
    opts = opts or {}

    local api_key = get_openrouter_api_key()
    if not api_key or api_key == "" then
        return nil, "Missing OpenRouter API key. Set OPENROUTER_API_KEY in package environment."
    end

    local model = opts.model or DEFAULT_MODEL
    local site_url = opts.site_url or "https://github.com/blue-monads/potatoverse"
    local site_title = opts.site_title or "Potatoverse"

    local formatted_messages = messages
    if not formatted_messages or #formatted_messages == 0 then
        formatted_messages = {
            { role = "user", content = "Hello world! Respond with a brief greeting." }
        }
    end

    local payload = {
        model = model,
        messages = formatted_messages
    }

    if opts.tools and #opts.tools > 0 then
        payload.tools = opts.tools
    end
    if opts.tool_choice then
        payload.tool_choice = opts.tool_choice
    end
    if opts.temperature ~= nil then
        payload.temperature = opts.temperature
    end
    if opts.max_tokens ~= nil then
        payload.max_tokens = opts.max_tokens
    end

    local req_body = json.encode(payload)

    local res, err = phttp.post(OPENROUTER_URL, {
        headers = {
            ["Authorization"] = "Bearer " .. api_key,
            ["Content-Type"] = "application/json",
            ["HTTP-Referer"] = site_url,
            ["X-OpenRouter-Title"] = site_title
        },
        body = req_body,
        timeout = 60
    })

    if err then
        return nil, "HTTP request failed: " .. tostring(err)
    end

    if not res then
        return nil, "No response received from HTTP request"
    end

    if res.status_code ~= 200 then
        return nil, "OpenRouter API error (HTTP " .. tostring(res.status_code) .. "): " .. tostring(res.body)
    end

    local decoded, parse_err = json.decode(res.body)
    if not decoded then
        return nil, "Failed to parse JSON response: " .. tostring(parse_err)
    end

    return decoded, nil
end

--- Simple text-in text-out chat completion.
--- @param messages table Array of message tables.
--- @param opts table? Model and request options.
--- @return string|nil content Response message content on success.
--- @return string|nil error Error message on failure.
function llm_chat(messages, opts)
    local response, err = core_llm_chat(messages, opts)
    if err then
        return nil, err
    end

    if not response or not response.choices or #response.choices == 0 then
        return nil, "No response choices received from OpenRouter API"
    end

    local first_choice = response.choices[1]
    if not first_choice.message then
        return nil, "No message in response choice"
    end

    return first_choice.message.content, nil
end

--- Runs an LLM tool call loop, executing tools and gathering all intermediate calls.
--- @param messages table Array of message tables.
--- @param opts LLMToolCallOptions
--- @return LLMToolCallResult|nil result Result object on success.
--- @return nil|string error Error message on failure.
function llm_chat_with_tools(messages, opts)
    opts = opts or {}
    local model_options = opts.model_options or {}

    -- 1. Normalize tools and collect handlers
    local api_tools = {}
    local tool_handlers = {}

    if opts.tools then
        local is_array = (#opts.tools > 0)
        if is_array then
            for _, t in ipairs(opts.tools) do
                local name = nil
                local handler = t.handler or t.func or t.fn or t.execute

                if t.type == "function" and t["function"] then
                    name = t["function"].name
                    table.insert(api_tools, t)
                else
                    name = t.name
                    table.insert(api_tools, {
                        type = "function",
                        ["function"] = {
                            name = t.name,
                            description = t.description or "",
                            parameters = t.parameters or { type = "object", properties = {} }
                        }
                    })
                end

                if name then
                    tool_handlers[name] = handler or (opts.handlers and opts.handlers[name]) or _G[name]
                end
            end
        else
            for name, t in pairs(opts.tools) do
                local handler = nil
                local desc = ""
                local params = { type = "object", properties = {} }

                if type(t) == "function" then
                    handler = t
                elseif type(t) == "table" then
                    handler = t.handler or t.func or t.fn or t.execute
                    desc = t.description or ""
                    params = t.parameters or params
                end

                table.insert(api_tools, {
                    type = "function",
                    ["function"] = {
                        name = name,
                        description = desc,
                        parameters = params
                    }
                })

                tool_handlers[name] = handler or (opts.handlers and opts.handlers[name]) or _G[name]
            end
        end
    end

    -- 2. Build model options including tools
    local chat_opts = {}
    for k, v in pairs(model_options) do
        chat_opts[k] = v
    end
    if #api_tools > 0 then
        chat_opts.tools = api_tools
    end

    -- 3. Clone conversation messages
    local conversation_messages = {}
    if messages then
        for _, msg in ipairs(messages) do
            table.insert(conversation_messages, msg)
        end
    end

    local all_tool_calls = {}
    local last_response = nil
    local max_steps = opts.max_steps or 10

    -- 4. Tool call loop
    for step = 1, max_steps do
        local response, err = core_llm_chat(conversation_messages, chat_opts)
        if err then
            local partial_result = {
                llm_response = last_response,
                tool_calls = all_tool_calls
            }
            return partial_result, err
        end

        last_response = response

        local choice = response.choices and response.choices[1]
        if not choice or not choice.message then
            local partial_result = {
                llm_response = last_response,
                tool_calls = all_tool_calls
            }
            return partial_result, "Invalid response: missing choice or message"
        end

        local assistant_message = choice.message
        table.insert(conversation_messages, assistant_message)

        local tool_calls = assistant_message.tool_calls
        if not tool_calls or #tool_calls == 0 then
            -- Finished: model produced final response with no further tool calls
            return {
                llm_response = last_response,
                tool_calls = all_tool_calls
            }, nil
        end

        -- 5. Execute each tool call
        for _, tc in ipairs(tool_calls) do
            local fn = tc["function"] or {}
            local tool_name = fn.name
            local args_str = fn.arguments or "{}"

            local args = {}
            if type(args_str) == "string" and args_str ~= "" then
                local decoded, decode_err = json.decode(args_str)
                if decode_err then
                    args = args_str
                else
                    args = decoded
                end
            elseif type(args_str) == "table" then
                args = args_str
            end

            local handler = tool_handlers[tool_name] or (opts.handlers and opts.handlers[tool_name]) or _G[tool_name]

            local tool_record = {
                id = tc.id,
                name = tool_name,
                arguments = args,
                result = nil,
                error = nil
            }

            local tool_output_str = nil
            if not handler then
                local err_msg = "Tool handler not found for: " .. tostring(tool_name)
                tool_record.error = err_msg
                tool_output_str = json.encode({ error = err_msg })
            else
                local ok, res = pcall(handler, opts.func_ctx, args)
                if not ok then
                    local err_msg = "Tool execution error in " .. tostring(tool_name) .. ": " .. tostring(res)
                    tool_record.error = err_msg
                    tool_output_str = json.encode({ error = err_msg })
                else
                    tool_record.result = res
                    if type(res) == "table" then
                        tool_output_str = json.encode(res)
                    elseif res == nil then
                        tool_output_str = "{}"
                    else
                        tool_output_str = tostring(res)
                    end
                end
            end

            table.insert(all_tool_calls, tool_record)

            -- 6. Append tool result message back to the conversation
            table.insert(conversation_messages, {
                role = "tool",
                tool_call_id = tc.id,
                name = tool_name,
                content = tool_output_str
            })
        end
    end

    -- Reached maximum steps
    return {
        llm_response = last_response,
        tool_calls = all_tool_calls
    }, "Exceeded maximum tool call steps (" .. tostring(max_steps) .. ")"
end

return {
    core_llm_chat = core_llm_chat,
    llm_chat = llm_chat,
    llm_chat_with_tools = llm_chat_with_tools
}