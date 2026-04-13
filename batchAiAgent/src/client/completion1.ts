
import {
    getLlamaUrl,
    appendContentsToActiveMessage,
    postLogEvent,
} from "./client.ts";

import {
    FinishReason,
    _ChatPostResponse,
    _UI_Message,
    _OaiApi_v1ChatCompletionRequest,
    _OaiApi_v1ChatCompletionResponse,
    _OaiApi_v1ChatCompletionResponse_ToolCall,
    isValidResponse,
    _OaiApi_v1ChatCompletionResponse_Choice,
} from "./completion.ts";

export async function handlePost_buffered(postData: _OaiApi_v1ChatCompletionRequest, aborter: AbortController): Promise<_ChatPostResponse> {
    console.log("send BUFFERED request to AI-server...");
    
    const llama_url = getLlamaUrl();
    
    // TODO it would be good to have an indication to user if server is not responding at all BUT how?
    //const connectionTimeout_ms = 10000; // TODO no reasonable feedback about connection state/progress available?!?
    //const ERR_TIMEOUT = "ERROR: Connection timeout!";
    
    const toolCalls = new Array<_OaiApi_v1ChatCompletionResponse_ToolCall>();
    
    let tokenLimitReached: boolean = false;
    let errorMessage: string|null = null;
    let timings: string|null = null;
    
    try {
        // abort if connection is not about to start, but without limiting connection length.
        //const timeout_id = setTimeout(() => { errorMessage = ERR_TIMEOUT; aborter.abort(); }, connectionTimeout_ms);
        //const time1 = performance.now();
        
        const response: Response = await fetch(llama_url, {
            method: 'POST',
            body: JSON.stringify(postData),
            headers: {'Content-Type': 'application/json'},
            signal: aborter.signal,
        });
        
        //const time2 = performance.now();
        //console.log("delay to response-1 was: " + 0.001 * (time2 - time1) + " seconds.");
        
        // if we got this far, the connection has been started => clear the timeout now.
        //clearTimeout(timeout_id);
        
        if ( response.ok === false || response.status >= 400 ) {
            console.error("POST failed: " + response.status + " - " + response.statusText);
            throw new Error("ERROR: " + await response.text());
        } else {
            console.log("response.status = " + response.status);
            const obj: object = await response.json();
            
//const time3 = performance.now(); THIS IS JUST TO INDICATE that .json() returns almost immediately...
//console.log("delay to response-2 was: " + 0.001 * (time3 - time1) + " seconds.");
            
            //postLogEvent("postB JSON: " + JSON.stringify(obj, null, 4));
            
            if ( isValidResponse(obj) ) {
                const resp: _OaiApi_v1ChatCompletionResponse = obj;
                if ( resp.choices.length > 0 ) {
                    const c: _OaiApi_v1ChatCompletionResponse_Choice = resp.choices[0];
                    
// TODO the field c.index is the index of resp.choices -array?
// => here we just pick first choice always so that c.index === 0 always.
if ( c.index !== 0 ) console.error("found SPECIAL c.index:", c); // never happens?!?
                    
                    const reason = c.finish_reason;
                    
                    //postLogEvent("postB choice: " + reason);
                    
                    let completed1: boolean = false;
                    
                    if ( reason == null ) {
                        // this should never happen?!?
                        const content = c.message.content;
                        console.error("postB bad response:", reason, content);
                    }
                    
                    else if ( reason === FinishReason.Stop ) {
                        // text generation is completed.
                        // => nothing to do here: the stream will close soon, and this function completes.
                        completed1 = true;
                    }

                    else if ( reason === FinishReason.Length ) {
                        // text generation stops because token limit was reached.
                        // => nothing to do here: the stream will close soon, and this function completes.
                        // => TODO mark the stop reason into message-data and show it in UI.
                        completed1 = true;
                        tokenLimitReached = true;
                    }
                    
                    else if ( reason === FinishReason.ToolCalls ) {
                        // text generation stops because of tool calls.
                        completed1 = true;
                        
                        let tool_calls = c.message.tool_calls;
                        if ( tool_calls != null ) {
                            for ( const tcItem of tool_calls ) {
                                postLogEvent("postB push-new-tool-call: " + JSON.stringify(tcItem, null, 4));
                                toolCalls.push(tcItem);
                            }
                        }
                    }
                    
                    else {
                        console.error("ERR: reason is unknown:", c);
                        throw new Error("ERROR: " + JSON.stringify(c));
                    }
                    
                    if ( completed1 ) {
                        let content = c.message.content;
                        if ( content == null ) {
                            // this should not happen. did the model refuse to answer?
                            if ( c.message.refusal != null ) {
                                console.log("postB error: model refused to answer.");
                                content = c.message.refusal;
                            } else {
                                console.log("postB error: no answer received.");
                                content = "<empty>";
                            }
                        }
                        
                        appendContentsToActiveMessage(content);
                        
                        if ( resp.timings != null ) {
                            const digits = 2;
                            timings = "(prompt " + resp.timings.prompt_n + " tok in ";
                            timings += (0.001 * resp.timings.prompt_ms).toFixed(digits) + " sec => ";
                            timings += resp.timings.prompt_per_second.toFixed(digits) + " t/s) ";
                            timings += "(generated " + resp.timings.predicted_n + " tok in ";
                            timings += (0.001 * resp.timings.predicted_ms).toFixed(digits) + " sec => ";
                            timings += resp.timings.predicted_per_second.toFixed(digits) + " t/s)";
//console.log(timings);
                        }
                    }
                }
            } else {
                console.error("ERR: response not valid:", obj);
                throw new Error("ERROR: " + JSON.stringify(obj));
            }
        }
    } catch ( e: any ) {
        // @ts-ignore : if "errorMessage" is a string => it is safe to append.
        if ( typeof errorMessage === "string" ) errorMessage += "\n"; // prepare...
        else errorMessage = ""; // ...errorMessage so that a new line can be appended.
        
        if ( e instanceof Error ) {
            //console.error("Error:", e); // these cases are already logged above.
            errorMessage += e.message;
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
        timings: timings,
    };
    return resp;
}

