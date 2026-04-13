
import {
//    _HashMap,
    _Command, _CommandResult,
} from "../../../shared/shared.ts";

import { _ToolInfo, getToolNamesAndPermissions } from "../client.ts";

const name = "/tools";
const desc = "List all tools with current permission-settings.";

export class ToolsCommand implements _Command {
    public getName(): string {
        return name;
    }
    
    public getDesc(): string {
        return desc;
    }
    
    public async execute(params: Array<string>): Promise<_CommandResult> {
        let input = name;
        if ( params.length > 0 ) input += " (ignored " + params.length + " parameters)";
        
        const tools = getToolNamesAndPermissions();
        const txt1 = "Allowed ✅";
        const txt2 = "Denied! ❌";
        
        let output = "OK: listing all tools with their permission-settings:\n";
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

