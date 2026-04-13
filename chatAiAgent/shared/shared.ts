
export interface _HashMap<T> {
    [key: string]: T; // "index signature" telling that keys are strings always.
}

// utils for datatype detection/verification.

export function isObject(obj: unknown): boolean {
    return (
        obj != null &&
        typeof obj === "object" &&
        Array.isArray(obj) === false
    );
}

export function isArray(obj: unknown): boolean {
    return (
        obj != null &&
        typeof obj === "object" &&
        Array.isArray(obj) === true
    );
}

export function isString(obj: unknown): boolean {
    return typeof obj === "string";
}

export function isNumber(obj: unknown): boolean {
    return typeof obj === "number";
}

export function isBoolean(obj: unknown): boolean {
    return typeof obj === "boolean";
}

//////////////////////////////////////////////////////////////////////////////////////////////

// app-local-server messaging:
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

export interface _LogRequest {
    msg: string,
}

export interface _LogResponse {
    success: boolean,
}

// at startup the client makes a GET request to "/config" path,
// and receives a _ConfigResponse containing configuration data.

export interface _ConfigResponse {
    ai_agent_name: string;
    ai_agent_version: string;
    
    ui_long_name: string;
    
    ui_const_ok: string;
    ui_const_err: string;
    
    llama_api_url: string;
    llama_temperature: number;
    use_streaming: boolean;
    
    path_info: _ConfigPathInfo|null;
    current_working_directory: string; // for user only, not to AI-model.
}

export interface _ConfigPathInfo {
    project_root_directory: string; // always ends with a directory-separator.
    working_subdirectory: string; // is either empty, or ends with a directory-separator.
}

export function isValidConfigResponse(obj: unknown): obj is _ConfigResponse {
    if ( isObject(obj) === false ) return false;
    const obj2 = obj as _ConfigResponse;
    if ( isString(obj2.ai_agent_name) === false ) return false;
    if ( isString(obj2.ai_agent_version) === false ) return false;
    if ( isString(obj2.ui_long_name) === false ) return false;
    if ( isString(obj2.ui_const_ok) === false ) return false;
    if ( isString(obj2.ui_const_err) === false ) return false;
    
    // TODO...
    // not checking all of the fields.
    
    return true;
}

// at startup, and later if tools-related settings are changed, the client makes
// GET or POST request to "/tools" path, and receives a _ToolsResponse containing
// tools- and system-prompt data.

export interface _ToolsResponse {
    active_tools: Array<_OaiApi_v1ChatCompletion_Tool>;
    all_tool_names: Array<string>; // client needs to know all tool names.
    system_prompt: string;
}

export function isValidToolsResponse(obj: unknown): obj is _ToolsResponse {
    if ( isObject(obj) === false ) return false;
    const obj2 = obj as _ToolsResponse;
    if ( isArray(obj2.active_tools) === false ) return false;
    if ( isArray(obj2.all_tool_names) === false ) return false;
    if ( isString(obj2.system_prompt) === false ) return false;
    
    // TODO...
    // not checking all of the fields.
    
    return true;
}

// active tools are changed using commands: /tools-allow and /tools-deny.
// => _ToolsPostRequest contain either of allow/deny settings defined (but NOT both of them).
// => _ToolsPostRequest is sent as "POST /tools", response is _ToolsResponse.

export interface _ToolsPostRequest {
    tools_allow: Array<string>|undefined;
    tools_deny: Array<string>|undefined;
}

export interface _ToolsPostResponse {
    success: boolean;
    num_permissions_changed: number;
    warnings: Array<string>;
}

export function isValidToolsPostResponse(obj: unknown): obj is _ToolsPostResponse {
    if ( isObject(obj) === false ) return false;
    const obj2 = obj as _ToolsPostResponse;
    if ( isBoolean(obj2.success) === false ) return false;
    if ( isNumber(obj2.num_permissions_changed) === false ) return false;
    if ( isArray(obj2.warnings) === false ) return false;
    
    // TODO...
    // not checking all of the fields.
    
    return true;
}

//////////////////////////////////////////////////////////////////////////////////////////////

// command definitions:
//^^^^^^^^^^^^^^^^^^^^^^

export interface _Command {
    getName(): string;
    getDesc(): string;
    execute(params: Array<string>): Promise<_CommandResult>; // async!
}

export interface _CommandResult {
    success: boolean;
    input: string|undefined; // parsed command string with parameters, or undefined if parse error.
    output: string|undefined; // command output, or error message. if undefined the UI update is skipped (used for /clear).
}

//////////////////////////////////////////////////////////////////////////////////////////////

// app-local tool definitions:
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

export interface _AgentTool {
    getName(): string;
    getDesc(): string;
    isAllowed: boolean;
    getData(): _OaiApi_v1ChatCompletion_Tool;
    execute(params: _HashMap<any>): Promise<_AgentToolResult>; // async!
}

export interface _AgentToolResult {
    success: boolean;
    result: string|undefined;
    error: string|undefined;
    ui_desc: string;
}

export function isValidAgentToolResult(obj: unknown): obj is _AgentToolResult {
    if ( isObject(obj) === false ) return false;
    const obj2 = obj as _AgentToolResult;
    if ( isBoolean(obj2.success) === false ) return false;
    const success: boolean = obj2.success;
    if ( isString(obj2.result) !== success ) return false;
    if ( isString(obj2.error) === success ) return false;
    if ( isString(obj2.ui_desc) === false ) return false;
    return true;
}

// tool-calling definitions:
//^^^^^^^^^^^^^^^^^^^^^^^^^^^
// => client posts _ToolCallRequest to server "/toolcall" path.
// => server then sends _AgentToolResult back as a response.

export interface _ToolCallRequest {
    name: string,
    arguments: string,
}

//////////////////////////////////////////////////////////////////////////////////////////////

// tools-related messaging to llama.cpp server (or equivalent):
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// these are in "shared" because there are 2 separate uses for these:
//    1) in server/tools these are used for tool descriptions/specifications.
//    2) when communicating with the remote AI-server these are used for messaging.

export enum ToolType {
    Function = "function",
}

export interface _OaiApi_v1ChatCompletion_Tool {
    type: ToolType;
    function: _OaiApi_v1ChatCompletion_Tool_FunctionDefinition;
};

// https://developers.openai.com/api/docs/guides/function-calling 
// https://developers.openai.com/api/docs/guides/function-calling?strict-mode=disabled#strict-mode 
// https://developers.openai.com/api/docs/guides/function-calling?strict-mode=enabled#strict-mode 
// https://developers.openai.com/api/docs/guides/structured-outputs?context=with_parse#supported-schemas 

export interface _OaiApi_v1ChatCompletion_Tool_FunctionDefinition {
    name: string;
    description: string;
    parameters: _OaiApi_v1ChatCompletion_Tool_FunctionDef_Params;
    strict: boolean|undefined;
};

export interface _OaiApi_v1ChatCompletion_Tool_FunctionDef_Params {
    type: string;
    properties: _HashMap<_OaiApi_v1ChatCompletion_Tool_FunctionDef_ParamProps>;
    required: Array<string>;
    additionalProperties: boolean|undefined;
};

export interface _OaiApi_v1ChatCompletion_Tool_FunctionDef_ParamProps {
    type: string;
    description: string;
};

