
import {
    isObject, isArray, isString,
    _LogRequest, _CommandResult,
    _ConfigResponse, isValidConfigResponse,
    _ToolsResponse, isValidToolsResponse,
    _OaiApi_v1ChatCompletion_Tool,
    _ToolCallRequest, _AgentToolResult, isValidAgentToolResult,
} from "../../shared/shared.ts";

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

import { handleCommand } from "./commands.ts";

// this is set in init() -function.
let config: _ConfigResponse;

// this is set in updateTools() -function.
let currentTools: _ToolsResponse;

const completions_API_path = "/v1/chat/completions";

// if any of these are set, it means handleSubmit() call is in progress.
let stopButtonClickedDuringPOST = false;
let cancelButtonClickedDuringPOST = false;
let aborter: AbortController|null = null;

export function getLlamaUrl(): string { return config.llama_api_url + completions_API_path; }

export const completedMessages: Array<_UI_Message> = new Array<_UI_Message>();
export const pendingMessages: Array<_UI_Message> = new Array<_UI_Message>();

const isVisible_CLASS = "is-visible";
export const isActiveMessage_CLASS = "is-active-message";
export const isTruncatedOrError_CLASS = "is-truncated-or-error";
export const activeMessageSelector = "." + isActiveMessage_CLASS;

await init(); // now initialize the UI.
await updateTools(false);
clearEverything();

//////////////////////////////////////////////////////////////////////////////////////////////

async function init(): Promise<void> {
    if ( config != null ) {
        throw new Error("multiple calls to init() function!");
    }
    
    let el_form = $("idform");
    if ( el_form == null ) {
        throw new Error("el_form not found!");
    }
    
    // handle the form submission in javascript.
    el_form.addEventListener("submit", (event) => {
        event.preventDefault();
        handleSubmit();
    });
    
    // carry out the initial "/config" request.
    try {
        const url = "/config";
        const response: Response = await fetch(url, {
            method: 'GET',
        });
        
        if ( response.ok === false ) {
            console.error("GET " + url + " failed!");
        } else if ( response.status >= 400 ) {
            console.error("GET " + url + " failed: " + response.status + " - " + response.statusText);
        } else {
            console.log("response.status = " + response.status);
            const obj: object = await response.json();
            if ( isValidConfigResponse(obj) ) {
                config = obj;
                console.log("config initialized:", config);
            } else {
                console.error("response not valid: " + url);
                // @ts-ignore : serious error => cannot continue any operation.
                config = null;
            }
        }
    } catch ( e: any ) {
        console.error("Error during fetch:", e);
        // @ts-ignore : serious error => cannot continue any operation.
        config = null;
    }
}

export async function updateTools(updateUI: boolean): Promise<void> {
    try {
        const url = "/tools";
        const response: Response = await fetch(url, {
            method: 'GET',
        });
        
        if ( response.ok === false ) {
            console.error("GET " + url + " failed!");
        } else if ( response.status >= 400 ) {
            console.error("GET " + url + " failed: " + response.status + " - " + response.statusText);
        } else {
            console.log("response.status = " + response.status);
            const obj: object = await response.json();
            if ( isValidToolsResponse(obj) ) {
                currentTools = obj;
                console.log("tools updated.");
                if ( updateUI ) {
                    // refresh the UI.
                    resetMessagesUI();
                }
            } else {
                console.error("response not valid: " + url);
                // @ts-ignore : serious error => cannot continue any operation.
                config = tools = null;
            }
        }
    } catch ( e: any ) {
        console.error("Error during fetch:", e);
        // @ts-ignore : serious error => cannot continue any operation.
        config = tools = null;
    }
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
        timings2: null,
        t_prompt_n: -1, // initialized to -1, final value from timings.
        t_predicted_n: -1, // initialized to -1, final value from timings.
        errorMessages: null,
        stopped: false,
        tool_call_info1: undefined,
        tool_call_info2: undefined,
    });
    
    // refresh the UI.
    resetMessagesUI();
}

export function resetMessagesUI() {
    let el_messages = $("idmessages") as HTMLDivElement; // assume div element type.
    if ( el_messages == null ) {
        throw new Error("el_messages not found!");
    }
    
    const indent = "    ";
    
    let content = "";
    content += config.ui_long_name + " v" + config.ai_agent_version + "\n";
    content += indent + "working-dir: " + config.current_working_directory + "\n";
    content += indent + "server:      " + config.llama_api_url + "\n";
    content += indent + "temperature: " + config.llama_temperature + "\n";
    
    // initialize the messages-UI.
    let html = "";
    html += '<pre class="header">';
    html += content.trim() + "</pre>";
    el_messages.innerHTML = html;
    
    // add all completed messages to UI.
    for ( const message of completedMessages ) {
        addToMessagesUI(message);
    }
}

function addToMessagesUI(message: _UI_Message, continueUpdatesToActiveMessage: boolean = false) {
    let el_messages = $("idmessages") as HTMLDivElement; // assume div element type.
    if ( el_messages == null ) {
        throw new Error("el_messages not found!");
    }
    
    // INITIALIZE message formatting as HTML:
    //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // also see: appendContentsToActiveMessage() and refreshActiveMessage().
    
    let content = message.content;
    if ( message.errorMessages != null ) {
        if ( content !== "" && content.endsWith("\n") === false ) content += "\n";
        content += message.errorMessages;
    }
    
    // using a PRE-element is fine otherwise, but XML-like formatting fails.
    // => need to replace "<" and ">" -characters to "&lt;" and "&gt;" in the content.
    content = content.replace(/</g, "&lt;"); // fix XML and similar formats...
    content = content.replace(/>/g, "&gt;"); // fix XML and similar formats...
    
    let classes: string = message.role;
    if ( message.stopped ) classes += " " + isTruncatedOrError_CLASS;
    if ( continueUpdatesToActiveMessage ) classes += " " + isActiveMessage_CLASS;
    
    let html = "";
    html += '<pre class="' + classes + '">';
    // the info-line.
    // => NOTICE: later we may print additional request statistics to infoLine.
    // => see function: refreshActiveMessage() where message formatting may be updated.
    html += "role: " + message.role + "\n";
    // actual message contents.
    html += content + "</pre>";
    el_messages.innerHTML += html;
}

function addToPendingMessages(role: Role, content: string, continueUpdatesToActiveMessage: boolean = false) {
    // first add to messages cache.
    let message: _UI_Message = {
        role: role,
        content: content,
        tool_calls: undefined,
        tool_call_id: undefined,
        timings2: null,
        t_prompt_n: -1, // initialized to -1, final value from timings.
        t_predicted_n: -1, // initialized to -1, final value from timings.
        errorMessages: null,
        stopped: false,
        tool_call_info1: undefined,
        tool_call_info2: undefined,
    };
    pendingMessages.push(message);
    
    // then add to UI.
    addToMessagesUI(message, continueUpdatesToActiveMessage);
}

// FOR DOCUMENTATION ABOUT TOOLS-RELATED MESSAGING SEE:
// https://gist.github.com/philipp-meier/678a4679d0895276f270fac4c046ad14 

async function handleSubmit() {
    // check that no concurrent posts can be done.
    // => if a post is already in progress, the "aborter" object is set.
    if ( aborter != null ) {
        console.error("POST already in progress!");
        return;
    }
    
    let el_input = $("idinput") as HTMLTextAreaElement; // assume textarea element type.
    if ( el_input == null ) {
        throw new Error("el_input not found!");
    }
    
    let prompt = el_input.value.trim();
    if ( prompt == "" ) {
        console.log("handleSubmit :: got an empty input.");
        return; // ei aihetta toimenpiteisiin.
    }
    
    let el_stop = $("idstop") as HTMLButtonElement; // assume button element type.
    if ( el_stop == null ) {
        throw new Error("el_stop not found!");
    }
    let el_cancel = $("idcancel") as HTMLButtonElement; // assume button element type.
    if ( el_cancel == null ) {
        throw new Error("el_cancel not found!");
    }
    
    // process the commands BEFORE clearing the textarea input.
    // => leave the text input intact if the command is unrecognized or fails otherwise.
    // => then the user has a chance to fix the command, instead of writing it all again.
    
    // check if this is a command (which always starts with a slash character).
    if ( prompt.startsWith("/") ) {
        let cr: _CommandResult;
        try {
            cr = await handleCommand(prompt);
        } catch ( e: any ) {
            console.error("ERROR: command handler failed:", e);
            el_input.value = ""; // clear the prompt now.
            return;
        }
        
        if ( cr.output == null ) {
            console.log("skip command UI update (used for /clear at least).");
            el_input.value = ""; // clear the prompt now.
            return;
        }
        
        if ( cr.success ) {
            el_input.value = ""; // clear the prompt now.
        } else {
            console.log("command unrecognized or failed => keep the text input.");
        }
        
        prompt = "";
        if ( cr.input != null ) prompt += cr.input + "\n";
        prompt += cr.output;
        
        // the next thing is like an addToPendingMessages() call, but we add to completedMessages instead.
        //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        
        // first add to messages cache.
        let message: _UI_Message = {
            role: Role.Command,
            content: prompt,
            tool_calls: undefined,
            tool_call_id: undefined,
            timings2: null,
            t_prompt_n: -1, // initialized to -1, final value from timings.
            t_predicted_n: -1, // initialized to -1, final value from timings.
            errorMessages: null,
            stopped: false,
            tool_call_info1: undefined,
            tool_call_info2: undefined,
        };
        completedMessages.push(message);
        
        // then add to UI.
        addToMessagesUI(message);
        
        if ( cr.success === false ) {
            console.error("command failed:", cr.output);
        }
        
        // command processing ready.
        return; // no futher actions!
    }
    
    el_input.value = ""; // clear the prompt now.
    
    // pendingMessages should be EMPTY now.
    // => add the "user"-role message now into pendingMessages.
    // => the "assistant"-role message will be added in handlePost_XX call.
    addToPendingMessages(Role.User, prompt);
    
    // show the cancel- and stop-buttons now.
    
    if ( el_cancel.classList.contains(isVisible_CLASS) === false ) {
        el_cancel.classList.add(isVisible_CLASS);
    } else {
        console.error("CANCEL-button is already visible!");
    }
    
    if ( config.use_streaming ) {
        // the stop-button is used in streaming-mode only.
        if ( el_stop.classList.contains(isVisible_CLASS) === false ) {
            el_stop.classList.add(isVisible_CLASS);
        } else {
            console.error("STOP-button is already visible!");
        }
    }
    
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
        
        
        
        const timings: string|null = resp.timings1;
        const t_prompt_n: number = resp.t_prompt_n;
        const t_predicted_n: number = resp.t_predicted_n;
        
        let isNormalResponse = true;
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
            
            activeMessage.timings2 = timings;
            activeMessage.t_prompt_n = t_prompt_n;
            activeMessage.t_predicted_n = t_predicted_n;
            
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
                
                activeMessage.timings2 = timings;
                activeMessage.t_prompt_n = t_prompt_n;
                activeMessage.t_predicted_n = t_predicted_n;
                
                activeMessage.errorMessages = errorMessage;
                activeMessage.stopped = true;
                
                refreshActiveMessage();
                
                // in HTML find the element with "is-active-message" class, then:
                //    1) unset the "is-active-message" class.
                //    2) set the "is-truncated-message" class.
                let el_pre = document.querySelector(activeMessageSelector);
                if ( el_pre != null ) {
console.log("REMOVING activeMessage class: line459 case1b");
                    el_pre.classList.remove(isActiveMessage_CLASS);
                    el_pre.classList.add(isTruncatedOrError_CLASS);
                } else {
console.error("ERR: activeMessage not found: line463 case1b");
                }
                
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
                
                // now, AFTER calling refreshActiveMessage(),
                // in HTML find the element with "is-active-message" class,
                // and unset the "is-active-message" class.
                // => we will soon add new messages related to tool-call(s).
                let el_pre = document.querySelector(activeMessageSelector);
                if ( el_pre != null ) {
console.log("REMOVING activeMessage class: line531 case3a");
                    el_pre.classList.remove(isActiveMessage_CLASS);
                } else {
// TODO do we arrive here if stop/cancel -button was pressed?!?
console.error("ERR: activeMessage not found: line535 case3a", stopButtonClickedDuringPOST, cancelButtonClickedDuringPOST);
                }
                
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
                    
                    let toolCallSuccessful = false;
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
                        activeMessage.tool_call_info1 = desc;
                        // NOTICE activeMessage.tool_call_info2 remains unchanged (just preparing the call now).
                        refreshActiveMessage();
                        
                        
                        
                        const url = "/toolcall";
                        try {
                            const response: Response = await fetch(url, {
                                method: 'POST',
                                body: JSON.stringify(postData),
                                headers: {'Content-Type': 'application/json'},
                            });
                            if ( response.ok === false ) {
                                console.error("POST " + url + " failed!");
                                content = config.ui_const_err + ERROR_RESPONSE;
                                desc += config.ui_const_err + "tool-call failed: server response status: " + response.status + ".";
                            } else if ( response.status >= 400 ) {
                                console.error("POST " + url + " failed: " + response.status + " - " + response.statusText);
                                content = config.ui_const_err + ERROR_RESPONSE;
                                desc += config.ui_const_err + "tool-call failed: server response status: " + response.status + ".";
                            } else {
                                //console.log("TC response.status = " + response.status);
                                const obj: object = await response.json();
                                
                                console.log("TC RESPONSE:", obj);
                                
                                if ( isValidAgentToolResult(obj) ) {
                                    const resp: _AgentToolResult = obj;
                                    if ( resp.success ) {
                                        // @ts-ignore : when success is true, result is a string (see isValidAgentToolResult()).
                                        content = resp.result;
                                        desc += config.ui_const_ok + resp.ui_desc;
                                        toolCallSuccessful = true;
                                    } else {
                                        console.error("ERROR: tool_call: ", resp.error);
                                        content = config.ui_const_err + resp.error;
                                        desc += config.ui_const_err + resp.ui_desc;
                                    }
                                } else {
                                    console.error("POST " + url + " response not valid!");
                                    content = config.ui_const_err + ERROR_RESPONSE;
                                    desc += config.ui_const_err + "tool-call failed: server response not valid.";
                                }
                            }
                        } catch ( e: any ) {
                            console.error("Error during " + url + " fetch:", e);
                            content = config.ui_const_err + ERROR_RESPONSE;
                            desc += config.ui_const_err + "tool-call failed: request to server failed."
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
                    activeMessage.tool_call_info1 = desc;
                    activeMessage.tool_call_info2 = toolCallSuccessful;
                    refreshActiveMessage();
                    
                    
                    
                    // now, AFTER calling refreshActiveMessage(),
                    // in HTML find the element with "is-active-message" class,
                    // and unset the "is-active-message" class.
                    // => this tool-call related message is complete and we will soon add new messages.
                    let el_pre = document.querySelector(activeMessageSelector);
                    if ( el_pre != null ) {
console.log("REMOVING activeMessage class: line663 case3b");
                        el_pre.classList.remove(isActiveMessage_CLASS);
                    } else {
// TODO do we arrive here if stop/cancel -button was pressed?!?
console.error("ERR: activeMessage not found: line667 case3b", stopButtonClickedDuringPOST, cancelButtonClickedDuringPOST);
                    }
                    
                    
                    
                } // end of tool-calling-loop-2.
            }
        }
        
        
        
        // if we did NOT do any tool-calling, then
        // in HTML find the element with "is-active-message" class,
        // and unset the "is-active-message" class.
        // => because the message is now final and up-to-date.
        // => we are not calling refreshActiveMessage() anymore.
        
        if ( isToolCall === false ) {
            let el_pre = document.querySelector(activeMessageSelector);
            if ( el_pre != null ) {
console.log("REMOVING activeMessage class: line687 case2");
                el_pre.classList.remove(isActiveMessage_CLASS);
            } else {
// TODO do we arrive here if stop/cancel -button was pressed?!?
console.error("ERR: activeMessage not found: line691 case2", stopButtonClickedDuringPOST, cancelButtonClickedDuringPOST);
            }
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
    
    // hide the cancel- and stop-buttons now.
    
    if ( el_cancel.classList.contains(isVisible_CLASS) ) {
        el_cancel.classList.remove(isVisible_CLASS);
    } else {
        console.error("CANCEL-button is not visible!");
    }
    
    if ( config.use_streaming ) {
        // the stop-button is used in streaming-mode only.
        if ( el_stop.classList.contains(isVisible_CLASS) ) {
            el_stop.classList.remove(isVisible_CLASS);
        } else {
            console.error("STOP-button is not visible!");
        }
    }
    
    stopButtonClickedDuringPOST = false;
    cancelButtonClickedDuringPOST = false;
    aborter = null;
    
    // final common tasks (whether in streaming-mode or not):
    // => move all messages pending => completed array in messages cache.
    // => UI update not needed.
    
    for ( const message of pendingMessages ) completedMessages.push(message);
    pendingMessages.length = 0;
}

function onStopButtonClicked() {
    console.log("    ----    STOP BUTTON CLICKED    ----");
    if ( aborter != null ) {
        console.error("STOP-button clicked.");
        stopButtonClickedDuringPOST = true;
        aborter.abort();
    } else {
        console.error("STOP-button clicked while aborter is null!");
    }
}

function onCancelButtonClicked() {
    console.log("    ----    CANCEL BUTTON CLICKED    ----");
    if ( aborter != null ) {
        console.error("CANCEL-button clicked.");
        cancelButtonClickedDuringPOST = true;
        aborter.abort();
    } else {
        console.error("CANCEL-button clicked while aborter is null!");
    }
}

export async function appendContentsToActiveMessage(newMessageContent: string) {
    // now we need to update the given content to:
    //    1) pendingMessages information (always the LAST record in the array).
    //    2) UI information (see activeMessageSelector).
    
    const _lastItemIndex = pendingMessages.length - 1;
    const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
    
    activeMessage.content += newMessageContent;
    
    // UPDATE message formatting as HTML:
    //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // also see: addToMessagesUI() and refreshActiveMessage().
    
    let role = activeMessage.role;
    let content = activeMessage.content; // ASSUME not in error/truncated state.
    
    // using a PRE-element is fine otherwise, but XML-like formatting fails.
    // => need to replace "<" and ">" -characters to "&lt;" and "&gt;" in the content.
    content = content.replace(/</g, "&lt;"); // fix XML and similar formats...
    content = content.replace(/>/g, "&gt;"); // fix XML and similar formats...
    
    const infoLine = "role: " + role + "\n";
    // => NOTICE: later we may print additional request statistics to infoLine.
    // => see function: refreshActiveMessage() where message formatting may be updated.
    const updatedMessageContent = infoLine + content;
    
    let el_pre = document.querySelector(activeMessageSelector);
    if ( el_pre != null ) {
        el_pre.innerHTML = updatedMessageContent;
    } else {
        console.error("appendContentsToActiveMessage : element not found.");
    }
}

export async function refreshActiveMessage() {
    // this like appendContentsToActiveMessage() EXCEPT that
    // here we update more fields (from message object) than just content.
    
    const _lastItemIndex = pendingMessages.length - 1;
    const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
    
    // FINALIZE message formatting as HTML:
    //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // also see: addToMessagesUI() and appendContentsToActiveMessage().
    
    let role: string = activeMessage.role.toString();
    if ( activeMessage.timings2 != null ) {
        // print additional request statistics to infoLine.
        role += "    " + activeMessage.timings2;
    }
    
    let content: string = activeMessage.content;
    if ( activeMessage.errorMessages != null ) {
        if ( content !== "" && content.endsWith("\n") === false ) content += "\n";
        content += activeMessage.errorMessages;
    }
    
    // if this is a tool-call message, show a different visible content.
    // => show prepared tool_call_info content, instead of raw tool-call data content.
    if ( role === Role.Tool ) content = activeMessage.tool_call_info1 ?? "<unset>";
    
    // using a PRE-element is fine otherwise, but XML-like formatting fails.
    // => need to replace "<" and ">" -characters to "&lt;" and "&gt;" in the content.
    content = content.replace(/</g, "&lt;"); // fix XML and similar formats...
    content = content.replace(/>/g, "&gt;"); // fix XML and similar formats...
    
    const infoLine = "role: " + role + "\n";
    const updatedMessageContent = infoLine + content;
    
    let el_pre = document.querySelector(activeMessageSelector);
    if ( el_pre != null ) {
        el_pre.innerHTML = updatedMessageContent;
        // make sure that the role class is correctly set.
        // => need to check "assistant" => "tool" update only.
        if ( role == Role.Tool ) {
            if ( el_pre.classList.contains(Role.Assistant) ) {
                el_pre.classList.add(Role.Tool);
                el_pre.classList.remove(Role.Assistant);
            }
        }
    } else {
        console.error("refreshActiveMessage : element not found.");
    }
}

export async function postLogEvent(msg: string) {
    const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
    const postData: _LogRequest = {
        msg: "[" + ts + "]: " + msg.trim(),
    };
    try {
        const response: Response = await fetch("/log", {
            method: 'POST',
            body: JSON.stringify(postData),
            headers: {'Content-Type': 'application/json'},
        });
        if ( response.ok === false ) {
            console.error("POST /log failed!");
        } else if ( response.status >= 400 ) {
            console.error("POST /log failed: " + response.status + " - " + response.statusText);
        } else {
            console.log("LOG response.status = " + response.status);
        }
    } catch ( e: any ) {
        console.error("Error during LOG fetch:", e);
    }
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

// look up element by an id.
function $(id: string): Element|null {
    // TODO also see: document.querySelector()...
    return document.getElementById(id);
}

//////////////////////////////////////////////////////////////////////////////////////////////

// declare extra properties for the global window -object:
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
declare global {
    interface Window {
        onStopButtonClicked(): any;
        onCancelButtonClicked(): any;
    }
}

// setup the global handlers which can be called from HTML:
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
window.onStopButtonClicked = onStopButtonClicked;
window.onCancelButtonClicked = onCancelButtonClicked;

