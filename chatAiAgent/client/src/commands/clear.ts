
import {
//    _HashMap,
    _Command, _CommandResult,
} from "../../../shared/shared.ts";

import { clearEverything } from "../client.ts";

const name = "/clear";
const desc = "Clear all previous messages.";

export class ClearCommand implements _Command {
    public getName(): string {
        return name;
    }
    
    public getDesc(): string {
        return desc;
    }
    
    public async execute(params: Array<string>): Promise<_CommandResult> {
        clearEverything();
        
        let input = name;
        if ( params.length > 0 ) input += " (ignored " + params.length + " parameters)";
        
        const result: _CommandResult = {
            success: true,
            input: undefined,
            output: undefined, // indicates that UI-message-handling is a special case.
        };
        return result;
    }
}

