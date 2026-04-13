
import {
    isObject, isBoolean,
    _Command, _CommandResult,
    _ToolsPostRequest, _ToolsPostResponse, isValidToolsPostResponse,
} from "../../shared/shared.ts";

import {
    _ToolInfo,
    getToolNamesAndPermissions,
    updateTools,
} from "../client.ts";

import {
    toolsUpdateHandler,
} from "../../server/server.ts";

const name = "/tools-allow";
const desc = "Enable tools as specified in parameters.";

export class ToolsAllowCommand implements _Command {
    public getName(): string {
        return name;
    }
    
    public getDesc(): string {
        return desc;
    }
    
    public async execute(params: Array<string>): Promise<_CommandResult> {
        let input = name;
        for ( const param of params ) {
            input += ' "' + param + '"';
        }
        
        const postData: _ToolsPostRequest = {
            tools_allow: params,
            tools_deny: undefined,
        };
        
        let success: boolean = false;
        let num_permissions_changed: number = 0;
        let warnings: Array<string> = [];
        
        const obj: _ToolsPostResponse = toolsUpdateHandler(postData);
        if ( isValidToolsPostResponse(obj) ) {
            const resp: _ToolsPostResponse = obj;
            success = resp.success;
            num_permissions_changed = resp.num_permissions_changed;
            warnings = resp.warnings;
            console.log("response: success=" + success + " num_changed=" + num_permissions_changed + " warnings=" + warnings.length);
        }
        updateTools(); // call updateTools() now so that prompt messages get updated.
        
        const tools = getToolNamesAndPermissions();
        const txt1 = "Allowed ✅";
        const txt2 = "Denied! ❌";
        
        const status = ( success ? "OK" : "ERROR" );
        let output = status + ": count of tool permissions changed: " + num_permissions_changed;
        if ( warnings.length < 1 ) output += "\n";
        else {
            output += " with " + warnings.length + " warnings:\n";
            for ( const msg of warnings ) {
                output += "    " + msg.trim() + "\n";
            }
        }
        
        output += "Listing all tools with their permission-settings:\n";
        for ( const tool of tools ) {
            const perm = ( tool.allowed ? txt1 : txt2 );
            output += "    " + perm + " :  " + tool.name + "\n";
        }
        
        const result: _CommandResult = {
            success: true,
            input: input,
            output: output,
        };
        return result;
    }
}

