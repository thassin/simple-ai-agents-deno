
import {
    isObject, isArray,
} from "../shared/shared.ts";

// messaging to llama.cpp server (or equivalent):
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

// https://www.typescriptlang.org/docs/handbook/enums.html#string-enums 
// https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings 
// => kts reverse-mappings jos tarttee (toistaiseksi ei ole tarvetta).
// => suoritusaikana vain string-esitykset on olemassa/käytössä.
export enum Role {
    // OpenAI-ChatCompletion-API roles:
    System = "system",
    User = "user",
    Assistant = "assistant",
}

export enum FinishReason {
    Stop = "stop",
    Length = "length",
}

export interface _ChatPostResponse {
    tokenLimitReached: boolean,
    errorMessage: string|null,
    
    timings1: string|null,
    t_prompt_n: number; // initialized to -1, final value from timings.
    t_predicted_n: number; // initialized to -1, final value from timings.
}

//////////////////////////////////////////////////////////////////////////////////////////////

export interface _UI_Message { // vrt _OaiApi_v1ChatCompletionRequest_MessageParam
    role: Role;
    content: string;
    
    // the fields above are consistent with the _OaiApi_v1ChatCompletionRequest_MessageParam interface.
    
    // the fields below are the application's own extra information related to the UI.
    // => see the function createCopy() which drops the extra fields from copy result.
    
    timings2: string|null,
    t_prompt_n: number; // initialized to -1, final value from timings.
    t_predicted_n: number; // initialized to -1, final value from timings.
    
    errorMessages: string|null, // set if an an error occurred (AND ALSO the stopped -flag is set).
    stopped: boolean; // set if the user pressed STOP-button in streaming-mode (OR an error occurred).
};

export function createCopy(message: _UI_Message): _OaiApi_v1ChatCompletionRequest_MessageParam {
    return {
        role: message.role,
        content: message.content,
    };
}

//////////////////////////////////////////////////////////////////////////////////////////////

// https://developers.openai.com/api/reference/resources/chat/ 
// https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create 
// https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/update 

// https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md 
// https://github.com/ggml-org/llama.cpp/wiki/Templates-supported-by-llama_chat_apply_template 

// https://developers.openai.com/api/reference/overview 
// https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create 

// https://community.openai.com/t/what-models-support-parallel-tool-calls-and-when-to-use-it/1310788 
// "The model may choose to call multiple functions in a single turn. You can prevent this by setting parallel_tool_calls to false, which ensures exactly zero or one tool is called."

export interface _OaiApi_v1ChatCompletionRequest {
    //model: string|undefined;
    
    // TODO does this exist at all? does this have any effect?
    cache_prompt: boolean|undefined;
    
    messages: Array<_OaiApi_v1ChatCompletionRequest_MessageParam>;
    //max_tokens: number|undefined;
    temperature: number;
    store: boolean;
    stream: boolean;
    
    // reasoning_format? TODO
    // thinking_forced_open? TODO
}

export interface _OaiApi_v1ChatCompletionRequest_MessageParam {
    role: Role;
    content: string;
};

// these are responses.

export interface _OaiApi_v1ChatCompletionResponse {
    choices: Array<_OaiApi_v1ChatCompletionResponse_Choice>;
    created: number; // creation timestamp.
    model: string;
    system_fingerprint: string;
    object: string; // is always: "chat.completion".
    usage: _OaiApi_v1ChatCompletionResponse_Usage;
    id: string;
    
    // TODO is this llama.cpp -specific field?!?
    timings: _OaiApi_v1ChatCompletionResponse_Timings|undefined;
}

export interface _OaiApi_v1ChatCompletionResponse_Usage {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
}

// TODO where to get docs for these? THIS IS LLAMA.CPP ONLY?!?
interface _OaiApi_v1ChatCompletionResponse_Timings {
    cache_n: number;
    prompt_n: number;
    prompt_ms: number;
    prompt_per_token_ms: number;
    prompt_per_second: number;
    predicted_n: number;
    predicted_ms: number;
    predicted_per_token_ms: number;
    predicted_per_second: number;
}

export interface _OaiApi_v1ChatCompletionResponse_Choice {
    message: _OaiApi_v1ChatCompletionResponse_Message;
    finish_reason: FinishReason;
    index: number;
};

export interface _OaiApi_v1ChatCompletionResponse_Message {
    role: Role;
    content: string|undefined; // either-or refusal
    refusal: string|undefined; // either-or content
};

export function isValidResponse(obj: unknown): obj is _OaiApi_v1ChatCompletionResponse {
    if ( isObject(obj) === false ) return false;
    const obj2 = obj as _OaiApi_v1ChatCompletionResponse;
    if ( isArray(obj2.choices) === false ) return false;
    
    // TODO...
    // not checking all of the fields.
    
    return true;
}

//////////////////////////////////////////////////////////////////////////////////////////////

// the streaming-message-variants follow.
// => no idea so far, how much difference there really is in "basic"/"streaming".
// => these variants can be merged later, if it seems to make sense.

export interface _OaiApi_v1ChatCompletionStreamResponse {
    choices: Array<_OaiApi_v1ChatCompletionStreamResponse_Choice>;
    
// AT LEAST THESE ADDITIONAL FIELDS DO EXIST:
    //"created": 1711223344,
    //"id": "chatcmpl-rKvcCwRC9nD9BcQA7gqp9QqmxTL9YzB2",
    //"model": "model.gguf",
    //"system_fingerprint": "b8201-fdb18621d",
    //"object": "chat.completion.chunk",
    
    // TODO is this llama.cpp-specific field?!?
    timings: _OaiApi_v1ChatCompletionResponse_Timings|undefined;
}

export interface _OaiApi_v1ChatCompletionStreamResponse_Choice {
    finish_reason: string|null;
    index: number;
    delta: _OaiApi_v1ChatCompletionStreamResponse_Delta;
};

export interface _OaiApi_v1ChatCompletionStreamResponse_Delta {
    content: string|undefined;
};

export function isValidStreamResponse(obj: unknown): obj is _OaiApi_v1ChatCompletionStreamResponse {
    if ( isObject(obj) === false ) return false;
    const obj2 = obj as _OaiApi_v1ChatCompletionStreamResponse;
    if ( isArray(obj2.choices) === false ) return false;
    
    // TODO...
    // not checking all of the fields.
    
    return true;
}

//////////////////////////////////////////////////////////////////////////////////////////////

