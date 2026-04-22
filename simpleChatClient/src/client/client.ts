
import {
    LLAMA_API_URL,
    LLAMA_TEMPERATURE,
    LLAMA_REASONING_EFFORT,
    USE_STREAMING,
} from "../config.ts";

import {
    isObject, isArray, isString,
    ReasoningEffort, ReasoningFormat,
} from "../shared/shared.ts";

import {
    Role,
    _ChatPostResponse,
    _UI_Message, createCopy,
    _OaiApi_v1ChatCompletionRequest,
    _OaiApi_v1ChatCompletionRequest_MessageParam,
} from "./completion.ts";

import { handlePost_buffered } from "./completion1.ts";
import { handlePost_streaming } from "./completion2.ts";

const completions_API_path = "/v1/chat/completions";

// if any of these are set, it means handleSubmit() call is in progress.
let stopButtonClickedDuringPOST = false;
let cancelButtonClickedDuringPOST = false;
let aborter: AbortController|null = null;

export function getLlamaUrl(): string { return LLAMA_API_URL + completions_API_path; }

export const completedMessages: Array<_UI_Message> = new Array<_UI_Message>();
export const pendingMessages: Array<_UI_Message> = new Array<_UI_Message>();

const isVisible_CLASS = "is-visible";
export const isActiveMessage_CLASS = "is-active-message";
export const isTruncatedOrError_CLASS = "is-truncated-or-error";
export const activeMessageSelector = "." + isActiveMessage_CLASS;

init(); // now initialize the UI.
clearEverything();

//////////////////////////////////////////////////////////////////////////////////////////////

function init(): void {
    let el_form = $("idform");
    if ( el_form == null ) {
        throw new Error("el_form not found!");
    }
    
    // handle the form submission in javascript.
    el_form.addEventListener("submit", (event) => {
        event.preventDefault();
        handleSubmit();
    });
}

export function clearEverything() {
    // initialize or clear ALL messages.
    completedMessages.length = 0;
    pendingMessages.length = 0;
    
    let reasoning = "";
    if ( LLAMA_REASONING_EFFORT !== ReasoningEffort.None ) {
        
        // 20260421 about reasoning:
        // (not sure about others but at least) Ministral-3 needs certain prompt content to enable reasoning.
        // https://huggingface.co/mistralai/Ministral-3-14B-Reasoning-2512/discussions/1 
        // => TODO model settings unknown currently => can't detect Ministral-3 here.
        
        reasoning += "# HOW YOU SHOULD THINK AND ANSWER:\n\n";
        reasoning += "First draft your thinking process (inner monologue) until you arrive at a response.\n";
        reasoning += "Format your response using Markdown, and use LaTeX for any mathematical equations.\n";
        reasoning += "Write both your thoughts and the response in the same language as the input.\n\n";
        reasoning += "Your thinking process must follow the template below:\n";
        reasoning += "[THINK]\n";
        reasoning += "Your thoughts or/and draft, like working through an exercise on scratch paper.\n";
        reasoning += "Be as casual and as long as you want until you are confident to generate the response to the user.\n";
        reasoning += "[/THINK]\n";
        reasoning += "Here, provide a self-contained response.\n";
        
        // https://huggingface.co/mistralai/Ministral-3-8B-Reasoning-2512/discussions/5 
        reasoning += "It is imperative to close the [THINK] tag with a [/THINK] closing tag once you are ready to present the answer to the user.\n";
        
        reasoning += "\n";
    }
    
    let content: string = "";
    content += "You are a helpful assistant.\n\n";
    content += reasoning;
    
    // add the system-prompt into completed messages.
    completedMessages.push({
        role: Role.System,
        reasoning_content: undefined,
        content: content,
        timings2: null,
        t_prompt_n: -1, // initialized to -1, final value from timings.
        t_predicted_n: -1, // initialized to -1, final value from timings.
        errorMessages: null,
        stopped: false,
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
    content += "Simple llama.cpp chat client" + "\n";
    content += indent + "server:      " + LLAMA_API_URL + "\n";
    content += indent + "temperature: " + LLAMA_TEMPERATURE + "\n";
    
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
    
    const infoLine = "role: " + message.role + "\n";
    // => NOTICE: later we may print additional request statistics to infoLine.
    // => see function: refreshActiveMessage() where message formatting may be updated.
    
    let reasoning = "";
    if ( message.reasoning_content != null ) {
        reasoning += "<i>[THINK]\n"; // show the reasoning in italic style.
        reasoning += message.reasoning_content + "\n";
        reasoning += "[/THINK]</i>\n";
    }
    
    let classes: string = message.role;
    if ( message.stopped ) classes += " " + isTruncatedOrError_CLASS;
    if ( continueUpdatesToActiveMessage ) classes += " " + isActiveMessage_CLASS;
    
    const updatedMessageContent = infoLine + reasoning + content;
    
    let html = "";
    html += '<pre class="' + classes + '">';
    html += updatedMessageContent;
    html += "</pre>";
    
    el_messages.innerHTML += html;
}

function addToPendingMessages(role: Role, content: string, continueUpdatesToActiveMessage: boolean = false) {
    // first add to messages cache.
    let message: _UI_Message = {
        role: role,
        reasoning_content: undefined,
        content: content,
        timings2: null,
        t_prompt_n: -1, // initialized to -1, final value from timings.
        t_predicted_n: -1, // initialized to -1, final value from timings.
        errorMessages: null,
        stopped: false,
    };
    pendingMessages.push(message);
    
    // then add to UI.
    addToMessagesUI(message, continueUpdatesToActiveMessage);
}

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
    
    if ( USE_STREAMING ) {
        // the stop-button is used in streaming-mode only.
        if ( el_stop.classList.contains(isVisible_CLASS) === false ) {
            el_stop.classList.add(isVisible_CLASS);
        } else {
            console.error("STOP-button is already visible!");
        }
    }
    
    { // start of block-1.
        let allMessages = new Array<_OaiApi_v1ChatCompletionRequest_MessageParam>();
        
        for ( const message of completedMessages ) {
            allMessages.push(createCopy(message));
        }
        
        for ( const message of pendingMessages ) {
            allMessages.push(createCopy(message));
        }
        
        let re: ReasoningEffort|undefined = undefined;
        let rf: ReasoningFormat|undefined = undefined;
        if ( LLAMA_REASONING_EFFORT !== ReasoningEffort.None ) {
            re = LLAMA_REASONING_EFFORT;
            rf = ReasoningFormat.DeepSeek; // use a separate field for reasoning content.
        }
        
        const postData: _OaiApi_v1ChatCompletionRequest = {
            messages: allMessages,
            
            // TODO model setting?!?
            temperature: LLAMA_TEMPERATURE,
            reasoning_effort: re,
            reasoning_format: rf,
            
            stream: USE_STREAMING,
            
            cache_prompt: false, // TODO how affects really?!?
            store: false, // TODO how affects really?!?
        };
        
        addToPendingMessages(Role.Assistant, "", true);
        
        //console.log("post_2_llama:", postData)
        
        let resp: _ChatPostResponse;
        aborter = new AbortController();
        if ( USE_STREAMING ) {
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
        
        
        
        let content = ""; // content generated as response (LLM output).
        
        // if we did NOT do any tool-calling, then
        // in HTML find the element with "is-active-message" class,
        // and unset the "is-active-message" class.
        // => because the message is now final and up-to-date.
        // => we are not calling refreshActiveMessage() anymore.
        
        { // start of block-2.
            let el_pre = document.querySelector(activeMessageSelector);
            if ( el_pre != null ) {
console.log("REMOVING activeMessage class: line687 case2");
                el_pre.classList.remove(isActiveMessage_CLASS);
            } else {
// TODO do we arrive here if stop/cancel -button was pressed?!?
console.error("ERR: activeMessage not found: line691 case2", stopButtonClickedDuringPOST, cancelButtonClickedDuringPOST);
            }
        } // end of block-2.
        
    } // end of block-1.
    
    // hide the cancel- and stop-buttons now.
    
    if ( el_cancel.classList.contains(isVisible_CLASS) ) {
        el_cancel.classList.remove(isVisible_CLASS);
    } else {
        console.error("CANCEL-button is not visible!");
    }
    
    if ( USE_STREAMING ) {
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

export async function appendContentsToActiveMessage(newMessageContent: string, newReasoningContent: string) {
    // now we need to update the given content to:
    //    1) pendingMessages information (always the LAST record in the array).
    //    2) UI information (see activeMessageSelector).
    
    const _lastItemIndex = pendingMessages.length - 1;
    const activeMessage: _UI_Message = pendingMessages[_lastItemIndex];
    
    activeMessage.content += newMessageContent;
    
    if ( newReasoningContent !== "" ) {
        if ( activeMessage.reasoning_content == null ) activeMessage.reasoning_content = "";
        activeMessage.reasoning_content += newReasoningContent;
    }
    
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
    
    let reasoning = "";
    if ( activeMessage.reasoning_content != null ) {
        reasoning += "<i>[THINK]\n"; // show the reasoning in italic style.
        reasoning += activeMessage.reasoning_content + "\n";
        reasoning += "[/THINK]</i>\n";
    }
    
    const updatedMessageContent = infoLine + reasoning + content;
    
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
    
// NOTE! at this stage, if this is a tool-call, the message visible contents is changed.
    
    // using a PRE-element is fine otherwise, but XML-like formatting fails.
    // => need to replace "<" and ">" -characters to "&lt;" and "&gt;" in the content.
    content = content.replace(/</g, "&lt;"); // fix XML and similar formats...
    content = content.replace(/>/g, "&gt;"); // fix XML and similar formats...
    
    const infoLine = "role: " + role + "\n";
    // => NOTICE: later we may print additional request statistics to infoLine.
    // => see function: refreshActiveMessage() where message formatting may be updated.
    
    let reasoning = "";
    if ( activeMessage.reasoning_content != null ) {
        reasoning += "<i>[THINK]\n"; // show the reasoning in italic style.
        reasoning += activeMessage.reasoning_content + "\n";
        reasoning += "[/THINK]</i>\n";
    }
    
    const updatedMessageContent = infoLine + reasoning + content;
    
    let el_pre = document.querySelector(activeMessageSelector);
    if ( el_pre != null ) {
        el_pre.innerHTML = updatedMessageContent;
// NOTE! at this stage, if this is a tool-call, message role is changed: Assistant => Tool.
    } else {
        console.error("refreshActiveMessage : element not found.");
    }
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

