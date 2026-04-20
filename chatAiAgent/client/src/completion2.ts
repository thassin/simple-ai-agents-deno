
import {
    getLlamaUrl,
    appendContentsToActiveMessage,
    postLogEvent,
} from "./client.ts";

import {
    FinishReason, ToolType,
    _ChatPostResponse,
    _UI_Message,
    _OaiApi_v1ChatCompletionRequest,
    _OaiApi_v1ChatCompletionResponse,
    _OaiApi_v1ChatCompletionResponse_ToolCall,
    isValidStreamResponse,
    _OaiApi_v1ChatCompletionStreamResponse,
    _OaiApi_v1ChatCompletionStreamResponse_Choice,
} from "./completion.ts";

export async function handlePost_streaming(postData: _OaiApi_v1ChatCompletionRequest, aborter: AbortController): Promise<_ChatPostResponse> {
    console.log("send STREAMING request to AI-server...");
    
    const llama_url = getLlamaUrl();
    
    // TODO it would be good to have an indication to user if server is not responding at all BUT how?
    //const connectionTimeout_ms = 10000; // TODO what we get here is time-to-first-token delay instead of connection delay.
    //const ERR_TIMEOUT = "ERROR: Connection timeout!";
    
    const toolCalls = new Array<_OaiApi_v1ChatCompletionResponse_ToolCall>();
    
    let tokenLimitReached: boolean = false;
    let errorMessage: string|null = null;
    
    let timings: string|null = null;
    let t_prompt_n: number = -1; // initialized to -1, final value from timings.
    let t_predicted_n: number = -1; // initialized to -1, final value from timings.
    
    try {
        // abort if connection is not about to start, but without limiting connection length.
        //const timeout_id = setTimeout(() => { errorMessage = ERR_TIMEOUT; aborter.abort(); }, connectionTimeout_ms);
        //const time1 = performance.now();
        
        const response: Response = await fetch(llama_url, {
            method: 'POST',
            body: JSON.stringify(postData),
            headers: {'Content-Type': 'text/event_stream'},
            signal: aborter.signal,
        });
        
        //const time2 = performance.now();
        //console.log("delay to response was: " + 0.001 * (time2 - time1) + " seconds.");
        
        // if we got this far, the connection has been started => clear the timeout now.
        //clearTimeout(timeout_id);
        
        // TODO some typescript issues here? anyway the javascript works OK.
        // @ts-ignore : TS2504 must have a '[Symbol.asyncIterator]()' method that returns an async iterator.
        for await ( const chunk of response.body ) {
            if ( aborter.signal.aborted ) throw aborter.signal.reason;
            
            const txt = new TextDecoder("utf-8").decode(chunk);
            
            // txt should always start with "data:" -identifier.
            // => NOTE: a single chunk may contain multiple "data:" -sections.
            // => apparently the "data:" -sections are always on separate lines (OK to split using "\n" -character).
            // the end mark is: "data: [DONE]" but otherwise data content should be JSON formatted.
            
            const lines = txt.split("\n");
            //console.log("    ----    LINECOUNT = " + lines.length);
            
            let newMessageContent = "";
            let newReasoningContent = "";
            
            for ( const nextline of lines ) {
                let line = nextline.trim();
                if ( line === "" ) continue; // just skip if empty...
                
                //postLogEvent("postS RAWLINE: " + line);
                
                // expect each line should start with a "data:" identifier.
                if ( line.startsWith("data:") ) {
                    // remove the "data:" identifier.
                    line = line.substring(5).trim();
                    
                    //console.log(line);
                    
                    if ( line === "[DONE]" ) {
                        // ok, it seems we have now completed the request processing.
                        // => nothing to do here, the stream will end and then the loop then ends as well.
                        continue;
                    }
                    
                    // expect line is a JSON stream response.
                    
                    let obj: any = JSON.parse(line);
                    
                    //postLogEvent("postS JSON: " + JSON.stringify(obj, null, 4));
                    
                    //console.log(obj);
//if ( line.includes("timings") ) console.log("FOUND timings:",line);
                    
                    if ( isValidStreamResponse(obj) ) {
                        const resp: _OaiApi_v1ChatCompletionStreamResponse = obj;
                        if ( resp.choices.length > 0 ) {
                            const c: _OaiApi_v1ChatCompletionStreamResponse_Choice = resp.choices[0];
                            
// TODO the field c.index is the index of resp.choices -array?
// => here we just pick first choice always so that c.index === 0 always.
if ( c.index !== 0 ) console.error("found SPECIAL c.index:", c); // never happens?!?
                            
                            const reason = c.finish_reason;
                            
                            if ( reason == null ) {
                                // text generation OR tool-call generation continues.
                                let content = c.delta.content;
                                if ( content != null ) {
                                    newMessageContent += content;
                                }
                                let reasoningContent = c.delta.reasoning_content;
                                if ( reasoningContent != null ) {
                                    newReasoningContent += reasoningContent;
                                }
                                let tool_calls = c.delta.tool_calls;
                                if ( tool_calls != null ) {
                                    for ( const tcItem of tool_calls ) {
                                        // this is about:
                                        //    1) tool-call-init : create a new tool-call object.
                                        //    2) tool-call-update : append content to existing tool-call object.
                                        if ( tcItem.index == null ) throw new Error("should never happen line121");
                                        const isNewCall = ( tcItem.index >= toolCalls.length );
                                        if ( isNewCall ) {
                                            // add a new call-object to "toolCalls".
                                            let err: string|null = null;
                                            if ( tcItem.id == null ) err = "id not set";
                                            if ( tcItem.type == null ) err = "type not set";
                                            if ( tcItem.type != ToolType.Function ) err = "type unknown";
                                            
                                            if ( err != null ) throw new Error("should never happen line130: " + err);
                                            
                                            toolCalls.push(tcItem);
                                            if ( tcItem.function.arguments !== "" ) {
                                                console.error("error line 143: check arguments initial value:", tcItem.function.arguments);
                                            }
                                        } else {
                                            // now the call-object already exists in "toolCalls".
                                            const callData = toolCalls[tcItem.index];
                                            callData.function.arguments += tcItem.function.arguments;
                                        }
                                        //postLogEvent("postS TC: " + JSON.stringify(tool_calls, null, 4));
                                    }
                                }
                            }
                            
                            else if ( reason === FinishReason.Stop ) {
                                // text generation is completed.
                                // => nothing to do here: the stream will close soon, and this function completes.
                            }
                            
                            else if ( reason === FinishReason.Length ) {
                                // text generation stops because token limit was reached.
                                // => nothing to do here: the stream will close soon, and this function completes.
                                // => mark the stop reason into message-data and show it in UI.
                                tokenLimitReached = true;
                            }
                            
                            else if ( reason === FinishReason.ToolCalls ) {
                                // text generation stops because of tool calls.
                                // => nothing to do here: the stream will close soon, and this function completes.
                                // => the "toolCalls" table is up-to-date and ready to be returned.
                            }
                            
                            else {
                                console.error("ERR: reason is unknown:", line);
                                throw new Error("ERROR: " + line);
                            }
                        }
                        
                        // timings are sent in the final chunk of a request only.
                        if ( resp.timings != null ) {
                            const digits = 2;
                            timings = "(prompt " + resp.timings.prompt_n + " tok in ";
                            timings += (0.001 * resp.timings.prompt_ms).toFixed(digits) + " sec => ";
                            timings += resp.timings.prompt_per_second.toFixed(digits) + " t/s) ";
                            timings += "(generated " + resp.timings.predicted_n + " tok in ";
                            timings += (0.001 * resp.timings.predicted_ms).toFixed(digits) + " sec => ";
                            timings += resp.timings.predicted_per_second.toFixed(digits) + " t/s)";
                            t_prompt_n = resp.timings.prompt_n;
                            t_predicted_n = resp.timings.predicted_n;
                        }
                    } else {
                        console.error("ERR: response not valid:", line);
                        throw new Error("ERROR: " + line);
                    }
                } else {
                    console.error("ERR: received unknown data:", line);
                    throw new Error("ERROR: " + line);
                }
            }
            
            appendContentsToActiveMessage(newMessageContent, newReasoningContent);
        }
    } catch ( e: any ) {
        if ( typeof errorMessage === "string" ) errorMessage += "\n"; // prepare...
        else errorMessage = ""; // ...errorMessage so that a new line can be appended.
        
        if ( e instanceof TypeError ) {
            console.error("TypeError: Browser may not support async iteration:", e);
            errorMessage += "ERROR: Browser may not support async iteration.";
        } else if ( e instanceof Error ) {
            //console.error("Error:", e); // most of these are already logged above...
            let msg = e.message.trim(); // ...EXCEPT the case of STOP-button-click.
            if ( msg === "The operation was aborted." ) msg = "NOTICE: " + msg;
            errorMessage += msg;
        } else {
            console.error("ERR:", e);
            errorMessage += "ERROR: " + e;
        }
    }
    
    // OK the response is now complete.
    
    const resp: _ChatPostResponse = {
        newToolCalls: toolCalls,
        tokenLimitReached: tokenLimitReached,
        errorMessage: errorMessage,
        timings1: timings,
        t_prompt_n: t_prompt_n,
        t_predicted_n: t_predicted_n,
    };
    return resp;
}

