
// here we need some functions related to:
// => tool permissions handling.
// => tool-calling.

import {
    _HashMap, isObject, isArray,
    _ToolsPostRequest, _ToolsPostResponse,
    _ToolCallRequest, _AgentToolResult,
} from "../shared/shared.ts";

import { allTools, getActiveTools, handleToolPermissions } from "./tools.ts";

export function toolsUpdateHandler(obj: _ToolsPostRequest): _ToolsPostResponse {
    const response: _ToolsPostResponse = {
        success: false,
        num_permissions_changed: 0,
        warnings: new Array<string>(),
    };
    
    if ( isArray(obj.tools_allow) && obj.tools_deny == null ) {
        response.success = true;
        // NOTE! 3rd param "response" is modified in call.
        // @ts-ignore : obj.tools_allow is of type array.
        handleToolPermissions(obj.tools_allow, true, response);
    }
    if ( obj.tools_allow == null && isArray(obj.tools_deny) ) {
        response.success = true;
        // NOTE! 3rd param "response" is modified in call.
        // @ts-ignore : obj.tools_deny is of type array.
        handleToolPermissions(obj.tools_deny, false, response);
    }
    
    return response;
}

export async function toolCallHandler(obj: _ToolCallRequest): Promise<_AgentToolResult> {
    let error: string = "";
    let desc: string = "";
    
    const ERROR_RESPONSE = "tool-call failed"; // simple response for AI telling operation failed.
    
    const toolName = obj.name;
    const activeTools = getActiveTools();
    if ( activeTools[toolName] != null ) {
        const args1: any = JSON.parse(obj.arguments);
        if ( isObject(args1) ) {
            // to fulfill the formal parameters declaration,
            // convert "args1" object to a hashmap with string keys.
            // => practically this should not change anything...
            const args2: _HashMap<any> = {};
            for ( const key in args1 ) {
                const key2 = key.toString();
                args2[key2] = args1[key];
            }
            
            console.log("STARTING TOOL CALL:", toolName, JSON.stringify(args2, null, 4));
            
            const response: _AgentToolResult = await activeTools[toolName].execute(args2);
            
            return response;
        } else {
            error = ERROR_RESPONSE;
            desc = "tool-call failed: arguments parse error";
        }
    } else {
        error = ERROR_RESPONSE;
        desc = "tool-call failed: tool not found";
    }
    
    const response: _AgentToolResult = {
        success: false,
        result: undefined,
        error: error,
        ui_desc: desc,
    };
    return response;
}

