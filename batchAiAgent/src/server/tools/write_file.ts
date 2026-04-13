
import { basename } from "jsr:@std/path";
import { exists } from "jsr:@std/fs/exists";

import {
    _HashMap, ToolType, isString,
    _AgentTool, _AgentToolResult,
    _OaiApi_v1ChatCompletion_Tool,
    _OaiApi_v1ChatCompletion_Tool_FunctionDefinition,
    _OaiApi_v1ChatCompletion_Tool_FunctionDef_Params,
    _OaiApi_v1ChatCompletion_Tool_FunctionDef_ParamProps,
} from "../../shared/shared.ts";

const name = "write_file";
//const desc = "Write string data to a file. Result is JSON, containing field \"status\" indicating success as a boolean true/false value.";
//    ==>>    ei oikein toimi, kun ei "status" sanasta ymmärrä/varmistu että onnistui??? käytä SELKEÄMPÄÄ ilmaisua?!?
const desc = "Write string data to a file. Result is JSON, containing field \"write_file_success\" indicating function success as a boolean true/false value.";

export class WriteFileTool implements _AgentTool {
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
                            "description": "Either a path relative to working directory, or an absolute path, to the file to be written."
                        },
                        "content": {
                            "type": "string",
                            "description": "String data content to be written to the file."
                        },
                    },
                    "required": [ "filepath", "content" ],
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
        
        const ERROR_RESPONSE = "file write failed"; // simple response for AI telling operation failed.
        
        if ( isString(params["filepath"]) && isString(params["content"]) ) {
            const filepath: string = params["filepath"];
            const content: string = params["content"];
            
            // parameters are valid => start the operation.
            //^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            
            try {

// TODO jos tiedosto on jo olemassa, niin tee varmuuskopio! aikaleimalla.
// TODO jos tiedosto on jo olemassa, niin tee varmuuskopio! aikaleimalla.
// TODO jos tiedosto on jo olemassa, niin tee varmuuskopio! aikaleimalla.
// https://docs.deno.com/examples/checking_file_existence/ 

                const alreadyExists: boolean = await exists(filepath, { isFile: true });
                if ( alreadyExists ) {
                    const now = new Date();
                    
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');
                    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
                    
                    const backup = filepath + "-bak-" + year + month + day + "-" + hours + minutes + seconds + "-" + milliseconds;
                    await Deno.rename(filepath, backup);
                }
                
                await Deno.writeTextFile(filepath, content);
                success = true;
                const filename = basename(filepath); 
                desc = "file write successful, " + content.length + " characters written to file: '" + filename + "'.";
            } catch ( e: any ) {
                error = ERROR_RESPONSE;
                console.log("TOOLS / " + name + ": ERROR writing file: " + filepath);
                console.log("TOOLS / " + name + ":", e);
                desc = "file write failed."; // TODO how to get a short description? safely?!?
            }
            
            // result is JSON containing:
            //    *) field "write_file_success" indicating operation success.
            const obj: object = {
                write_file_success: success,
            };
            
            result = JSON.stringify(obj);
        } else {
            error = ERROR_RESPONSE;
// TODO korjaa tää, voi olla 1 tai 2 mitkä puuttuu.
// TODO korjaa tää, voi olla 1 tai 2 mitkä puuttuu.
// TODO korjaa tää, voi olla 1 tai 2 mitkä puuttuu.
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

