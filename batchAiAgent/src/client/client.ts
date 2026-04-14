
import {
    AI_AGENT_NAME, AI_AGENT_VERSION, LONG_NAME, 
    LLAMA_API_URL, LLAMA_TEMPERATURE,
    USE_STREAMING,
    PROJECT_README_FILENAME,
} from "../config.ts";

import {
    isObject, isArray, isString,
    _LogRequest, _CommandResult,
    _ConfigResponse, _ConfigPathInfo, isValidConfigResponse,
    _ToolsResponse, isValidToolsResponse,
    _OaiApi_v1ChatCompletion_Tool,
    _ToolCallRequest, _AgentToolResult, isValidAgentToolResult,
} from "../shared/shared.ts";

import {
    Role, ToolChoice,
    _ChatPostResponse,
    _UI_Message, createCopy,
    _OaiApi_v1ChatCompletionRequest,
    _OaiApi_v1ChatCompletionRequest_MessageParam,
    _OaiApi_v1ChatCompletionResponse_ToolCall, deepCopy,
} from "./completion.ts";

import { handlePost_buffered } from "./completion1.ts";
import { handlePost_streaming } from "./completion2.ts";

import { getSystemPrompt } from "../server/prompt.ts";
import { allTools, getActiveTools, handleToolPermissions } from "../server/tools.ts";
import { toolCallHandler } from "../server/server.ts";

// this is set in init() -function.
let config: _ConfigResponse;

// this is set in init() -function and updated in updateTools() -function.
let currentTools: _ToolsResponse;

const completions_API_path = "/v1/chat/completions";

// if any of these are set, it means handleSubmit() call is in progress.
let stopButtonClickedDuringPOST = false;
let cancelButtonClickedDuringPOST = false;
let aborter: AbortController|null = null;

export function getLlamaUrl(): string { return config.llama_api_url + completions_API_path; }

export const completedMessages: Array<_UI_Message> = new Array<_UI_Message>();
export const pendingMessages: Array<_UI_Message> = new Array<_UI_Message>();

const piResult: _PathInfoResult = await setupPathInfo();

const path_info = piResult.path_info;
const working_directory = piResult.working_directory;

//////////////////////////////////////////////////////////////////////////////////////////////

export async function init(): Promise<void> {
    config = {
        ai_agent_name: AI_AGENT_NAME,
        ai_agent_version: AI_AGENT_VERSION,
        ui_long_name: LONG_NAME,
        ui_const_ok: "OK: ",
        ui_const_err: "ERROR: ",
        llama_api_url: LLAMA_API_URL,
        llama_temperature: LLAMA_TEMPERATURE,
        use_streaming: USE_STREAMING,
        path_info: path_info,
        current_working_directory: working_directory,
    };
    
    const all_tool_names = new Array<string>();
    const active_tools = new Array<_OaiApi_v1ChatCompletion_Tool>();
    for ( const tool of allTools ) {
        all_tool_names.push(tool.getName());
        if ( tool.isAllowed ) {
            active_tools.push(tool.getData());
        }
    }
    
    const prompt = await getSystemPrompt(path_info);
    
    currentTools = {
        active_tools: active_tools,
        all_tool_names: all_tool_names,
        system_prompt: prompt,
    };
}

export async function updateTools() {
    // we need this function for updates after changes in tool-permissions.
    // => in chatAiAgent the same thing happens in "system.ts" toolsHandler() function.
    currentTools.active_tools.length = 0;
    for ( const tool of allTools ) {
        if ( tool.isAllowed ) {
            currentTools.active_tools.push(tool.getData());
        }
    }
    currentTools.system_prompt = await getSystemPrompt(path_info);
}

export function clearEverything() {
    // initialize or clear ALL messages.
    completedMessages.length = 0;
    pendingMessages.length = 0;
    
    // add the system-prompt into completed messages.
    completedMessages.push({
        role: Role.System,
        content: currentTools.system_prompt,
        tool_calls: undefined,
        tool_call_id: undefined,
        timings: null,
        errorMessages: null,
        stopped: false,
        tool_call_info: "",
    });
    
    // refresh the UI.
    resetMessagesUI();
}

export function resetMessagesUI() {
    // skip the UI-related part here.
    
    // add all completed messages to UI.
    for ( const message of completedMessages ) {
        addToMessagesUI(message);
    }
}

function addToMessagesUI(message: _UI_Message, continueUpdatesToActiveMessage: boolean = false) {
    // skip the UI-related part here.
}

function addToPendingMessages(role: Role, content: string, continueUpdatesToActiveMessage: boolean = false) {
    // first add to messages cache.
    let message: _UI_Message = {
        role: role,
        content: content,
        tool_calls: undefined,
        tool_call_id: undefined,
        timings: null,
        errorMessages: null,
        stopped: false,
        tool_call_info: "",
    };
    pendingMessages.push(message);
    
    // skip the UI-related part here.
}

// FOR DOCUMENTATION ABOUT TOOLS-RELATED MESSAGING SEE:
// https://gist.github.com/philipp-meier/678a4679d0895276f270fac4c046ad14 

export async function handleSubmit(prompt: string) {
    // check that no concurrent posts can be done.
    // => if a post is already in progress, the "aborter" object is set.
    if ( aborter != null ) {
        console.error("POST already in progress!");
        return;
    }
    
    // skip the UI-related part here.
    
    // process the commands BEFORE clearing the textarea input.
    // => leave the text input intact if the command is unrecognized or fails otherwise.
    // => then the user has a chance to fix the command, instead of writing it all again.
    
    // skip the UI-related part here.
    
    // pendingMessages should be EMPTY now.
    // => add the "user"-role message now into pendingMessages.
    // => the "assistant"-role message will be added in handlePost_XX call.
    addToPendingMessages(Role.User, prompt);
    
    // skip the UI-related part here.
    
    // NOTE: using pendingToolCalls -array as a QUEUE here.
    // https://dev.to/glebirovich/typescript-data-structures-stack-and-queue-hld 
    const pendingToolCalls = Array<_OaiApi_v1ChatCompletionResponse_ToolCall>();
    
    // begin tool-calling-loop-1.
    // => repeat until we get a "stop" response (or equivalent) in "finish_reason".
    
    while ( true ) { // start of tool-calling-loop-1.
        let allMessages = new Array<_OaiApi_v1ChatCompletionRequest_MessageParam>();
        
        for ( const message of completedMessages ) {
            if ( message.role == Role.Command ) continue;
            allMessages.push(createCopy(message));
        }
        
        for ( const message of pendingMessages ) {
            if ( message.role == Role.Command ) continue;
            allMessages.push(createCopy(message));
        }
        
        // figure out the message type, which we need to handle next.
        // => if there is anything in pendingToolCalls, use it as a queue and send next tool call result.
        // => otherwise send a normal chat request. ALSO after tool calls, send one normal chat request.
        
        const postData: _OaiApi_v1ChatCompletionRequest = {
            cache_prompt: false, // TODO miten tämä vaikuttaa?!? olisko parempi olla FALSE? vrt "store".
            messages: allMessages,
            temperature: config.llama_temperature,
            store: false,
            stream: config.use_streaming,
            tools: undefined,
            tool_choice: undefined,
// TODO: blocking parallel_tool_calls use here because THIS IS AN UNTESTED FEATURE.
            parallel_tool_calls: false,
        };
        
        if ( currentTools.active_tools.length > 0 ) {
            postData.tools = currentTools.active_tools;
            postData.tool_choice = ToolChoice.Auto;
        }
        
        // a tricky thing here is that:
        // => for UI usability and logic, we need to create and show up a message now.
        // => BUT, at this stage, we don't know whether it should be in "assistant" or "tool" role.
        // => we only know the role after the LLM has responded us a "finish_reason" value.
        // THEREFORE we add a new message using "assistant" role, and later change it to "tool" role if needed.
        
        addToPendingMessages(Role.Assistant, "", true);
        
        //postLogEvent("post_2_llama: " + JSON.stringify(postData, null, 4));
        
        let resp: _ChatPostResponse;
        aborter = new AbortController();
        if ( config.use_streaming ) {
            resp = await handlePost_streaming(postData, aborter);
        } else {
            resp = await handlePost_buffered(postData, aborter);
        }
        
        
        
        let isNormalResponse = true;
        let timings: string|null = resp.timings;
        let errorMessage: string|null = resp.errorMessage;
        
        if ( stopButtonClickedDuringPOST ) isNormalResponse = false;
        if ( cancelButtonClickedDuringPOST ) isNormalResponse = false;
        if ( errorMessage != null ) isNormalResponse = false;
        if ( resp.tokenLimitReached ) {
            isNormalResponse = false;
            if ( errorMessage == null ) errorMessage = ""; else errorMessage += "\n";
            errorMessage += "NOTICE: TOKEN LIMIT REACHED in response!";
        }
        
        // usually we need to update only if timings-information was obtained.
        if ( isNormalResponse && timings != null ) {
            // find the LAST message in pendingMessages -array.
            // => then just update the timings -record of the message.
            const _lastItemIndex = pendingMessages.length - 1;
            const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
            activeMessage.timings = timings;
            refreshActiveMessage();
        }
        
        // OTHERWISE update all fields if stop/error occurred.
        else if ( isNormalResponse === false ) {
            // there was an error, or response was truncated, etc.
            // => now cleanup the message-arrays and UI state:
            //    1) pendingMessages must be processed so that is becomes empty.
            //    2) then (if needed) UI must be updated to show the final state.
            
            // if there was en error, OR if the STOP -button was pressed:
            // => move contents of pendingMessages to completedMessages.
            // => WITH ADDING records that error/truncation did happen.
            if ( errorMessage != null || stopButtonClickedDuringPOST ) {
                // find the LAST message in pendingMessages -array.
                // => then update timings + errorMessages AND set stopped -flag.
                const _lastItemIndex = pendingMessages.length - 1;
                const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
                activeMessage.timings = timings;
                activeMessage.errorMessages = errorMessage;
                activeMessage.stopped = true;
                refreshActiveMessage();
                
                // skip the UI-related part here.
                
                // FINALLY move messages pending => completed as usually.
                for ( const message of pendingMessages ) completedMessages.push(message);
                pendingMessages.length = 0;
            }
            
            // OTHERWISE if CANCEL -button was pressed, we discard everything in pendingMessages and redraw UI.
            // => this effectively makes the whole request to disappear, both from messages-cache and from UI.
            else if ( cancelButtonClickedDuringPOST ) {
                pendingMessages.length = 0;
                resetMessagesUI();
            }
            
            // OTHERWISE we should have covered all possible cases already.
            else {
                console.error("should never happen!!!");
            }
        }
        
        
        
        for ( const tc of resp.newToolCalls ) {
            pendingToolCalls.push(tc);
        }
        
        // if the response(s) contained tool-calls, those are collected to a queue for later processing.
        // => if there is anything in queue, then FOR EACH tool-call request, carry out the operation and set response.
        
        // TODO see the setting: _OaiApi_v1ChatCompletionRequest.parallel_tool_calls?!?
        // TODO see llama.cpp GET /props response field: "supports_parallel_tool_calls": true/false?!?
        
        let isToolCall: boolean = false;
        
        let content = ""; // content generated as response (LLM output).
        
        if ( currentTools.active_tools.length > 0 ) {
            if ( pendingToolCalls.length > 0 ) {
                isToolCall = true;
                
                // now we must set/update the tool_call field of the active message.
                
                const _lastItemIndex = pendingMessages.length - 1;
                const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
                
                // if any response to "assistant" role message has been generated, make sure it's not lost.
                if ( activeMessage.role == Role.Assistant && activeMessage.content.trim() !== "" ) {
                    // keep the response content, if any of it has been generated.
                    content = activeMessage.content;
                }
                
                // update the content.
                activeMessage.content = content;
                
                // update the tool_calls field.
                activeMessage.tool_calls = deepCopy(pendingToolCalls);
                
                // update the UI.
                refreshActiveMessage();
                
                // skip the UI-related part here.
                
                // begin tool-calling-loop-2.
                // => repeat until all pending tool-calls are processed.
                // => each tool-call will yield a new role=tool _UI_Message of it's own.
                
                // content should be cleared now always, because:
                //    1) relevant content (if any) is already saved to activeMessage.
                //    2) we are about to start tool-calls handling, where content should be empty.
                content = "";
                
                while ( pendingToolCalls.length > 0 ) { // start of tool-calling-loop-2.
                    // @ts-ignore : assume that result is a real value based on array size check.
                    const tc: _OaiApi_v1ChatCompletionResponse_ToolCall = pendingToolCalls.shift();
                    
                    addToPendingMessages(Role.Tool, "", true);
                    
                    
                    
                    // the tool call is executed here!!
                    //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                    
                    const ERROR_RESPONSE = "tool-call failed"; // simple response for AI telling operation failed.
                    
                    let desc = "";
                    let tool_call_id = tc.id;
                    if ( tool_call_id == null ) {
                        console.log("ERROR: tool_call_id is null!");
                        tool_call_id = ""; // should never happen...
                    }
                    
                    let func_name = tc.function.name;
                    if ( func_name == null || func_name.trim() === "" ) {
                        console.error("ERROR: tool_call: function name missing:", func_name);
                        content = "ERROR: " + ERROR_RESPONSE;
                        desc = "tool-call failed: function name missing."
                    } else {
                        const postData: _ToolCallRequest = {
                            name: func_name,
                            arguments: tc.function.arguments,
                        };
                        
                        console.log("TC REQUEST:", postData);
                        
                        // generate "desc" first line, describing the function call.
                        desc = "function: ";
                        desc += func_name;
                        // TODO how to present briefly the call parameters?!?
                        desc += " (call_id: " + tool_call_id + ")\n";
                        
                        
                        
                        // now prepare refreshActiveMessage() call to show "desc" contents.
                        const _lastItemIndex = pendingMessages.length - 1;
                        const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
                        //activeMessage.role = Role.Tool; // NOTICE this is NOT CHANGING, is "tool" already.
                        activeMessage.content = content; // this is always empty at this stage (tool-call being prepared).
                        activeMessage.tool_call_id = tool_call_id;
                        activeMessage.tool_call_info = desc;
                        refreshActiveMessage();
                        
                        
                        
                        try {
                            const resp: _AgentToolResult = await toolCallHandler(postData);
                            if ( resp.success ) {
                                // @ts-ignore : when success is true, result is a string (see isValidAgentToolResult()).
                                content = resp.result;
                                desc += config.ui_const_ok + resp.ui_desc;
                            } else {
                                console.error("ERROR: tool_call: ", resp.error);
                                content = config.ui_const_err + resp.error;
                                desc += config.ui_const_err + resp.ui_desc;
                            }
                        } catch ( e: any ) {
                            console.error("Error during tool-call:", e);
                            content = config.ui_const_err + ERROR_RESPONSE;
                            desc += config.ui_const_err + "tool-call failed: exception.";
                        }
                    }
                    
                    
                    
                    // now prepare refreshActiveMessage() call to:
                    //    1) store the tool-call response to messages cache.
                    //    2) show "desc" updated contents.
                    const _lastItemIndex = pendingMessages.length - 1;
                    const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
                    //activeMessage.role = Role.Tool; // NOTICE this is NOT CHANGING, is "tool" already.
                    activeMessage.content = content; // set content => this will end up to AI use.
                    activeMessage.tool_call_id = tool_call_id; // field stays unset if errors?!?
                    activeMessage.tool_call_info = desc;
                    refreshActiveMessage();
                    
                    
                    
                    // skip the UI-related part here.
                    
                    
                    
                } // end of tool-calling-loop-2.
            }
        }
        
        
        
        // if we did NOT do any tool-calling, then
        // in HTML find the element with "is-active-message" class,
        // and unset the "is-active-message" class.
        // => because the message is now final and up-to-date.
        // => we are not calling refreshActiveMessage() anymore.
        
        if ( isToolCall === false ) {
            // skip the UI-related part here.
        }
        
        // figure out whether we still need to continue in tool-calling-loop.
        //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        console.log("tool-calling-loop STOP check:", pendingToolCalls.length, isToolCall);
        let ready = true;
        if ( isToolCall ) {
            console.log("  =>  CONTINUE in tool-calling-loop because previous message was a tool-call.");
            ready = false; // still need to handle the latest tool-call result(s).
        }
        if ( ready ) break;
        
    } // end of tool-calling-loop-1.
    
    // skip the UI-related part here.
    
    stopButtonClickedDuringPOST = false;
    cancelButtonClickedDuringPOST = false;
    aborter = null;
    
    // final common tasks (whether in streaming-mode or not):
    // => move all messages pending => completed array in messages cache.
    // => UI update not needed.
    
    for ( const message of pendingMessages ) completedMessages.push(message);
    pendingMessages.length = 0;
}

export async function appendContentsToActiveMessage(newMessageContent: string) {
    // now we need to update the given content to:
    //    1) pendingMessages information (always the LAST record in the array).
    //    2) UI information (see activeMessageSelector).
    
    const _lastItemIndex = pendingMessages.length - 1;
    const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
    
    activeMessage.content += newMessageContent;
    
    // skip the UI-related part here.
}

async function refreshActiveMessage() {
    // skip the UI-related part here.
}

export async function postLogEvent(msg: string) {
    // TODO should there be a logging interface, so that different types of logging could be done?
    console.log(msg);
}

//////////////////////////////////////////////////////////////////////////////////////////////

export interface _ToolInfo {
    name: string;
    allowed: boolean;
}

export function getToolNamesAndPermissions(): Array<_ToolInfo> {
    const info = new Array<_ToolInfo>();
    for ( const toolName of currentTools.all_tool_names ) {
        let allowed = false;
        for ( const active of currentTools.active_tools ) {
            if ( active.function.name !== toolName ) continue;
            allowed = true;
            break;
        }
        const item: _ToolInfo = {
            name: toolName,
            allowed: allowed,
        };
        info.push(item);
    }
    return info;
}

//////////////////////////////////////////////////////////////////////////////////////////////

interface _PathInfoResult {
    path_info: _ConfigPathInfo|null,
    working_directory: string,
};

async function setupPathInfo(): Promise<_PathInfoResult> {
    const working_directory: string = Deno.cwd();
    let pathInfo: _ConfigPathInfo|null = null;
    
    // TODO not complete.
    // => check if paths have been set using commandline arguments.
    // => if not then set the current working directory only.
    // see parseArgs() at chatAiAgent/server/src/server.ts
    
    /* try something like this?!?
    const OPT_RD_1 = "-rd";
    const OPT_RD_2 = "--root-dir";
    
    const OPT_SD_1 = "-sd";
    const OPT_SD_2 = "--sub-dir";
    
    const ERR_BAD_OPTIONS = "ERROR: conflicting options detected.";
    
    let rootDir: string|null = null;
    let subDir: string|null = null;
    
    let prev: string = "";
    for ( let i = 0; i < Deno.args.length; i++ ) {
        let arg = Deno.args[i];
        //console.log("    arg " + i + " : " + Deno.args[i]);
        
        let isOK = false;
        
        // check if the previous option was about root-dir.
        if ( prev === OPT_RD_1 ) {
            rootDir = arg;
            prev = arg = ""; // CLEAR BOTH NOW.
            isOK = true;
        }
        if ( arg === OPT_RD_1 || arg === OPT_RD_2 ) {
            prev = OPT_RD_1;
            isOK = true;
        }
        
        // check if the previous option was about sub-dir.
        if ( prev === OPT_SD_1 ) {
            subDir = arg;
            prev = arg = ""; // CLEAR BOTH NOW.
            isOK = true;
        }
        if ( arg === OPT_SD_1 || arg === OPT_SD_2 ) {
            prev = OPT_SD_1;
            isOK = true;
        }
    }
    
    if ( rootDir != null ) {
        if ( rootDir.endsWith("/") === false ) rootDir += "/";
        
        if ( subDir == null ) {
            subDir = "";
        } else {
            if ( subDir.endsWith("/") === false ) subDir += "/";
        }
        
        // make sure that:
        //    1) the assigned root/subdir(s) are real, and
        //    2) consistent with current working directory.
        
        let realPath: string;
        let isDir: boolean;
        try {
            realPath = await Deno.realPath(rootDir + subDir);
            isDir = await isDirectory(realPath);
        } catch ( error: any ) {
            realPath = "";
            isDir = false;
        }
        if ( isDir === false ) {
            console.error("ERROR: no such directory:", rootDir + subDir);
            Deno.exit(1);
        }
        
        if ( working_directory !== realPath ) {
            console.error("ERROR: current directory differs from:", rootDir + subDir);
            Deno.exit(1);
        }
        
        pathInfo = {
            project_root_directory: rootDir, // always ends with a directory-separator.
            working_subdirectory: subDir, // is either empty, or ends with a directory-separator.
        };
    } */
    
    const piResult: _PathInfoResult = {
        path_info: pathInfo,
        working_directory: working_directory,
    };
    return piResult;
}

// https://docs.deno.com/examples/checking_directory_existence/ 
async function isDirectory(path: string): Promise<boolean> {
    try {
        const fileInfo = await Deno.lstat(path);
        if ( fileInfo.isSymlink ) return false; // ignore symlinks!
        return fileInfo.isDirectory;
    } catch ( error: any ) {
        // the "not-found" case should be already covered by Deno.realPath().
        if ( error instanceof Deno.errors.NotFound === false ) {
            throw error;
        }
        return false;
    }
}

