
import {
//    _HashMap,
    _Command, _CommandResult,
} from "../../../shared/shared.ts";

import { allCommands } from "../commands.ts";

const name = "/help";
const desc = "List and describe all available commands.";

export class HelpCommand implements _Command {
    public getName(): string {
        return name;
    }
    
    public getDesc(): string {
        return desc;
    }
    
    public async execute(params: Array<string>): Promise<_CommandResult> {
        let input = name;
        if ( params.length > 0 ) input += " (ignored " + params.length + " parameters)";
        
        let output = "OK: list of all available commands:\n";
        for ( const cmd of allCommands ) {
            const name = cmd.getName();
            let indent = "";
            for ( let i = name.length; i < 15; i++ ) indent += " ";
            const desc = cmd.getDesc();
            output += "    " + name + indent + desc + "\n";
        }
        
        const result: _CommandResult = {
            success: true,
            input: input,
            output: output,
        };
        return result;
    }
}

