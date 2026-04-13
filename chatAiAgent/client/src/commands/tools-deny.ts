
import {
    isObject, isBoolean,
    _Command, _CommandResult,
    _ToolsPostRequest, _ToolsPostResponse, isValidToolsPostResponse,
} from "../../../shared/shared.ts";

import {
    _ToolInfo,
    getToolNamesAndPermissions,
    updateTools,
} from "../client.ts";

const name = "/tools-deny";
const desc = "Disable tools as specified in parameters.";

export class ToolsDenyCommand implements _Command {
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
            tools_allow: undefined,
            tools_deny: params,
        };
        
        // NOTE: same url for tools-allow and tools-deny POST.
        const url = "/tools";
        
        let success: boolean = false;
        let num_permissions_changed: number = 0;
        let warnings: Array<string> = [];
        
        try {
            const response: Response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(postData),
                headers: {'Content-Type': 'application/json'},
            });
            
            if ( response.ok === false ) {
                console.error("POST " + url + " failed!");
            } else if ( response.status >= 400 ) {
                console.error("POST " + url + " failed: " + response.status + " - " + response.statusText);
            } else {
                console.log("response.status = " + response.status);
                const obj: any = await response.json();
                if ( isValidToolsPostResponse(obj) ) {
                    const resp: _ToolsPostResponse = obj;
                    success = resp.success;
                    num_permissions_changed = resp.num_permissions_changed;
                    warnings = resp.warnings;
                    console.log("response: success=" + success + " num_changed=" + num_permissions_changed + " warnings=" + warnings.length);
                }
                await updateTools(true); // call updateTools() now so that prompt messages get updated.
            }
        } catch ( e: any ) {
            console.error("Error during fetch:", e);
            const result: _CommandResult = {
                success: false,
                input: undefined,
                output: "ERROR: command processing failed.",
            };
            return result;
        }
        
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

