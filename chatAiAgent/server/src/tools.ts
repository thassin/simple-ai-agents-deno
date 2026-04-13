
import {
    _HashMap,
    _AgentTool,
    _ToolsPostResponse,
} from "../../shared/shared.ts";

import { ReadFileTool } from "./tools/read_file.ts";
import { WriteFileTool } from "./tools/write_file.ts";

export const allTools: Array<_AgentTool> = [
    new ReadFileTool(true),
    new WriteFileTool(false),
];

export function getActiveTools(): _HashMap<_AgentTool> {
    const tools: _HashMap<_AgentTool> = {};
    for ( const tool of allTools ) {
        if ( tool.isAllowed ) {
            const name = tool.getName();
            tools[name] = tool;
        }
    }
    return tools;
}

// parameters for tools-allow and tools-deny are just string parameters given by user.

// interpret "*" -character as a wildcard, which may exist either independently (matching
// all tools), or as a prefix/middle/postfix part of a tool name (max only once).

// also interpret "all" -value as an independent "*" wildcard.

// NOTE! all tool names should be trimmed and in lowercase.
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// => do trimming and lowercasing also here just to be sure.

export function handleToolPermissions(params: Array<string>, modeIsAllow: boolean, resp: _ToolsPostResponse): void {
    for ( const param of params ) {
        let val = param.trim().toLowerCase();
        if ( val === "all" ) val = "*";
        
        let wildcardCount = 0;
        for ( let i = 0; i < val.length; i++ ) {
            if ( val[i] === "*" ) wildcardCount++;
        }
        
        if ( wildcardCount > 1 ) {
            resp.warnings.push("Multiple wildcards not allowed: " + val);
            continue;
        }
        
        // an independent wildcard: "all" or "*".
        if ( val === "*" ) {
            for ( const tool of allTools ) {
                if ( tool.isAllowed !== modeIsAllow ) {
                    tool.isAllowed = modeIsAllow;
                    resp.num_permissions_changed++;
                }
            }
        } else {
            let match_count = 0;
            if ( wildcardCount === 0 ) {
                // no wildcard: value should match to toolname directly.
                for ( const tool of allTools ) {
                    const toolName = tool.getName().trim().toLowerCase();
                    
                    if ( toolName !== val ) continue;
                    
                    match_count++;
                    if ( tool.isAllowed !== modeIsAllow ) {
                        tool.isAllowed = modeIsAllow;
                        resp.num_permissions_changed++;
                    }
                }
            } else {
                // a prefix/middle/postfix wildcard.
                const pos = val.indexOf("*");
                if ( pos < 0 ) { // should never happen...
                    resp.warnings.push("ERROR during processing: " + val);
                    continue;
                }
                const start = val.substring(0, pos);
                const end = val.substring(pos + 1);
                for ( const tool of allTools ) {
                    const toolName = tool.getName().trim().toLowerCase();
                    
                    let start_match = true;
                    if ( start !== "" ) start_match = toolName.startsWith(start);
                    let end_match = true;
                    if ( end !== "" ) end_match = toolName.endsWith(end);
                    if ( start_match === false || end_match === false ) continue;
                    
                    match_count++;
                    if ( tool.isAllowed !== modeIsAllow ) {
                        tool.isAllowed = modeIsAllow;
                        resp.num_permissions_changed++;
                    }
                }
            }
            
            if ( match_count < 1 ) {
                resp.warnings.push("No tool matched: " + val);
            }
        }
    }
}

