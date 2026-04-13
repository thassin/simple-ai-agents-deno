
import { _Command, _CommandResult } from "../shared/shared.ts";

import { ToolsAllowCommand } from "./commands/tools-allow.ts";
import { ToolsDenyCommand } from "./commands/tools-deny.ts";

export const allCommands: Array<_Command> = [
    new ToolsAllowCommand(),
    new ToolsDenyCommand(),
];

export async function handleCommand(cmd: string): Promise<_CommandResult> {
    cmd = cmd.trim(); // double-check trimming.
    
    if ( cmd.includes("\n") ) {
        const result: _CommandResult = {
            success: false,
            input: undefined,
            output: "ERROR: no newline characters allowed in commands.",
        };
        return result;
    }
    
    const orig = cmd; // take a backup for later use.
    const parts = new Array<string>();
    
    let pos: number = 0;
    let singleQuoteOn: boolean = false;
    let doubleQuoteOn: boolean = false;
    
    let isQuotedPart = false;
    
    let pos_orig = 0;
    let pos_error = -1;
    
    while ( cmd.length > 0 ) {
        let discard = false;
        let newPartReady = false;
        
        if ( singleQuoteOn ) {
            if ( cmd[pos] === "'" ) {
                // the next char must be a space, or we must be at end.
                if ( pos + 1 < cmd.length && cmd[pos + 1] !== " " ) {
                    pos_error = pos_orig + pos;
                    break;
                }
                singleQuoteOn = false;
                newPartReady = true;
                isQuotedPart = true;
            }
        }
        else if ( doubleQuoteOn ) {
            if ( cmd[pos] === '"' ) {
                // the next char must be a space, or we must be at end.
                if ( pos + 1 < cmd.length && cmd[pos + 1] !== " " ) {
                    pos_error = pos_orig + pos;
                    break;
                }
                doubleQuoteOn = false;
                newPartReady = true;
                isQuotedPart = true;
            }
        }
        else {
            if ( cmd[pos] === "'" ) {
                // the buffer must be empty (may not be in middle of a word).
                if ( pos !== 0 ) {
                    pos_error = pos_orig + pos;
                    break;
                }
                singleQuoteOn = true;
                discard = true;
            }
            else if ( cmd[pos] === '"' ) {
                // the buffer must be empty (may not be in middle of a word).
                if ( pos !== 0 ) {
                    pos_error = pos_orig + pos;
                    break;
                }
                doubleQuoteOn = true;
                discard = true;
            }
            else {
                // split parts by space...
                if ( cmd[pos] === " " ) newPartReady = true;
                // ...and include the end part.
                if ( pos >= cmd.length ) newPartReady = true;
            }
        }
        
        if ( newPartReady ) {
            let newPart = cmd.substring(0, pos);
            if ( isQuotedPart === false ) newPart = newPart.trim();
            if ( newPart.length > 0 ) parts.push(newPart);
            isQuotedPart = false;
            discard = true;
        }
        
        if ( discard ) {
            cmd = cmd.substring(pos + 1);
            pos_orig += pos + 1;
            pos = 0;
        } else {
            pos++;
        }
        
        //alert("pos=" + pos + " :: " + cmd);
    }
    
    if ( pos_error >= 0 ) {
        let msg = "";
        msg += "ERROR: parse error: " + orig + "\n";
        let indent = "";
        for ( let i = 0; i < pos_error + 19; i++ ) indent += " ";
        msg += indent + "^^^ near position: " + ( pos_error + 1 );
        const result: _CommandResult = {
            success: false,
            input: undefined,
            output: msg,
        };
        return result;
    }
    
    let cmd_name = "";
    if ( parts.length > 0 ) {
        // @ts-ignore : assume that result is a real value based on array size check.
        cmd_name = parts.shift();
    }
    
    console.log("COMMAND: " + cmd_name, parts);
    
    let handler: _Command|null = null;
    for ( const c of allCommands ) {
        if ( c.getName() !== cmd_name ) continue;
        handler = c;
        break;
    }
    
    if ( handler == null ) {
        const result: _CommandResult = {
            success: false,
            input: undefined,
            output: "ERROR: unknown command: " + cmd_name,
        };
        return result;
    }
    
    return handler.execute(parts);
}

