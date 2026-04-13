
import { basename } from "jsr:@std/path";

import {
    _HashMap, ToolType, isString,
    _AgentTool, _AgentToolResult,
    _OaiApi_v1ChatCompletion_Tool,
    _OaiApi_v1ChatCompletion_Tool_FunctionDefinition,
    _OaiApi_v1ChatCompletion_Tool_FunctionDef_Params,
    _OaiApi_v1ChatCompletion_Tool_FunctionDef_ParamProps,
} from "../../../shared/shared.ts";

const name = "read_file";
const desc = "Read string data from a file. Result is JSON, with either field \"content\" containing the file contents if file read was successful, or field \"error\" containing an error message if file read failed.";

export class ReadFileTool implements _AgentTool {
    public isAllowed: boolean;
    
    public constructor(allowByDefalt: boolean) {
        this.isAllowed = allowByDefalt;
    }
    
    public getName(): string {
        return name;
    }
    
    public getDesc(): string {
        return desc;
    }
    
    public getData(): _OaiApi_v1ChatCompletion_Tool {
        return {
            "type": ToolType.Function,
            "function": {
                "name": name,
                "description": desc,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "filepath": {
                            "type": "string",
                            "description": "Either a path relative to working directory, or an absolute path, to the file to be read."
                        },
                    },
                    "required": [ "filepath" ],
                    "additionalProperties": false,
                },
                "strict": true,
            }
        };
    }
    
    public async execute(params: _HashMap<any>): Promise<_AgentToolResult> {
        let success = false;
        let result: string|undefined = undefined;
        let error: string|undefined = undefined;
        let desc: string = "";
        
        const ERROR_RESPONSE = "file read failed"; // simple response for AI telling operation failed.
        
        if ( isString(params["filepath"]) ) {
            const filepath: string = params["filepath"];
            
            // parameters are valid => start the operation.
            //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            
            let content: string|undefined = undefined;
            try {
                content = await Deno.readTextFile(filepath);
                success = true;
                const filename = basename(filepath); 
                desc = "file read successful, " + content.length + " characters read from file: '" + filename + "'.";
            } catch ( e: any ) {
                error = ERROR_RESPONSE;
                console.log("TOOLS / " + name + ": ERROR reading file: " + filepath);
                console.log("TOOLS / " + name + ":", e);
                desc = "file read failed."; // TODO how to get a short description? safely?!?
            }
            
            // result is JSON containing:
            //    *) field "content" if operation was successful.
            //    *) field "error" if operation failed.
            const obj: object = {
                content: content,
                error: error,
            };
            
            result = JSON.stringify(obj);
        } else {
            error = ERROR_RESPONSE;
            desc = 'required parameter missing: "filepath".';
        }
        
        let res: _AgentToolResult = {
            success: success,
            result: result,
            error: error,
            ui_desc: desc,
        };
        
        console.log("TOOL " + name + " RESPONSE:", JSON.stringify(res, null, 4));
        
        return res;
    }
}

