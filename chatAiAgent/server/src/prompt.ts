
import {
    ReasoningEffort,
    _ConfigPathInfo,
} from "../../shared/shared.ts";

import {
    LLAMA_REASONING_EFFORT,
    PROJECT_README_FILENAME,
    PROJECT_AGENTS_FILENAME,
} from "./config.ts";

import { getActiveTools } from "./tools.ts";

export async function getSystemPrompt(path_info: _ConfigPathInfo|null): Promise<string> {
    const date = new Date();
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    //const dateStr = "year=" + year + " month=" + month + " day=" + day;
    const dateStr = year + "-" + month.toString().padStart(2, "0") + "-" + day.toString().padStart(2, "0");
    const timeStr = hour.toString().padStart(2, "0") + ":" + minute.toString().padStart(2, "0");
    
    let introSection = "";
    introSection += "You are a helpful assistant";
    if ( path_info != null ) {
        introSection += ", working in a software development project";
    }
    introSection += ".\n\n";
    
    let projectSection = "";
    //projectSection += "Current date is: " + dateStr + ".\n";
    projectSection += "Current date: " + dateStr + " time: " + timeStr + ".\n";
    if ( path_info != null ) {
        let rootDir: string = path_info.project_root_directory;
        if ( rootDir.endsWith("/") ) {
            // remove trailing slash (should always happen).
            rootDir = rootDir.slice(0, -1);
        }

        let subDir: string = path_info.working_subdirectory;
        if ( subDir.endsWith("/") ) {
            // remove trailing slash (should always happen).
            subDir = subDir.slice(0, -1);
        }
        
        if ( subDir !== "" ) {
            projectSection += "Project root directory is: \"" + rootDir + "\"\n";
            //projectSection += "You are working in directory: \"" + rootDir + "/" + subDir + "\" (that is, you are working in subdirectory \"" + subDir + "\" of project root)\n\n";
            projectSection += "You are working in directory: \"" + rootDir + "/" + subDir + "\" (that is, in subdirectory \"" + subDir + "\" of project root)\n\n";
        } else {
            projectSection += "You are working in the project root directory: " + rootDir + "\n\n";
        }
        
        // append root-dir readme/agents files.
        
        try {
            const path = path_info.project_root_directory + PROJECT_README_FILENAME;
            const readme = (await Deno.readTextFile(path)).trim();
            if ( readme !== "" ) {
                projectSection += "Project root README file:\n";
                projectSection += readme + "\n\n";
            }
        } catch ( error: any ) {
            // file did not exist.
        }
        
        try {
            const path = path_info.project_root_directory + PROJECT_AGENTS_FILENAME;
            const agents = (await Deno.readTextFile(path)).trim();
            if ( agents !== "" ) {
                projectSection += "Project root AGENTS file:\n";
                projectSection += agents + "\n\n";
            }
        } catch ( error: any ) {
            // file did not exist.
        }
        
        if ( subDir !== "" ) {
            const parts = subDir.split("/");
            
            let dirName = "";
            for ( const part of parts ) {
                dirName += part;
                let dirNameOut = dirName;
                dirName += "/";
                
                try {
                    const path = path_info.project_root_directory + dirName + PROJECT_README_FILENAME;
                    const readme = (await Deno.readTextFile(path)).trim();
                    if ( readme !== "" ) {
                        projectSection += "Subdirectory \"" + dirNameOut + "\" README file:\n";
                        projectSection += readme + "\n\n";
                    }
                } catch ( error: any ) {
                    // file did not exist.
                }
                
                try {
                    const path = path_info.project_root_directory + dirName + PROJECT_AGENTS_FILENAME;
                    const agents = (await Deno.readTextFile(path)).trim();
                    if ( agents !== "" ) {
                        projectSection += "Subdirectory \"" + dirNameOut + "\" AGENTS file:\n";
                        projectSection += agents + "\n\n";
                    }
                } catch ( error: any ) {
                    // file did not exist.
                }
            }
        }
    } else {
        // no need to tell anything about the paths is this case.
        projectSection += "\n"; // add a bit formatting.
    }
    
    let toolsCount = 0;
    let toolsListing = "";
    const activeTools = getActiveTools();
    for ( const toolName in activeTools ) {
        toolsCount++;
        const tool = activeTools[toolName];
        toolsListing += "- " + toolName + ": " + tool.getDesc() + "\n";
    }
    
    let toolsSection = "";
    if ( toolsCount > 0 ) {
        toolsSection += "You may call tools to carry out the given tasks, here is a summary of available tools:\n";
        toolsSection += toolsListing; // .trimEnd(); ???
        toolsSection += "\n";
        
        toolsSection += "Be careful to call tools only if instructed to do so, ";
        toolsSection += "and/or if it is necessary for carrying out the given instructions. ";
        toolsSection += "Try to minimize the amount of tool calls needed. ";
        toolsSection += "\n\n";
        
toolsSection += "If instructed to write data to a file, it is safe to proceed, without checking if a file already exists, or what contents it may have. ";
        toolsSection += "If in doubt, prefer expressing a result as a part of your response, instead of writing it to a file. ";
        toolsSection += "If a file operation (reading or writing) fails, the default action is just to report the error and stop any further actions. ";
        toolsSection += "Repeating a failed file operation is not likely to lead any other result than the first failed attempt did. ";
        toolsSection += "\n\n";
        
        toolsSection += "If you want to call a tool, do not create any explanatory text with it, only return the tool call code, without including any other text with it. ";
        toolsSection += "Instead when you are done using tools, you should explain what you did with the tools at the end of your response.";
        
        toolsSection += "\n\n";
    }
    
    let endSection = "";
    // TODO tartteeko mitään tällaista?!? onhan tämä kuitenkin siellä "system" osiossa ja siksi erillinen juttu?!?
    endSection += "End of project introduction.\n\n";
    
    let reasoning = "";
    if ( LLAMA_REASONING_EFFORT !== ReasoningEffort.None ) {
        
        // 20260421 about reasoning:
        // (not sure about others but at least) Ministral-3 needs certain prompt content to enable reasoning.
        // https://huggingface.co/mistralai/Ministral-3-14B-Reasoning-2512/discussions/1 
        // => TODO model settings unknown currently => can't detect Ministral-3 here.
        
        reasoning += "# HOW YOU SHOULD THINK AND ANSWER:\n\n";
        reasoning += "First draft your thinking process (inner monologue) until you arrive at a response.\n";
        reasoning += "Format your response using Markdown, and use LaTeX for any mathematical equations.\n";
        reasoning += "Write both your thoughts and the response in the same language as the input.\n\n";
        reasoning += "Your thinking process must follow the template below:\n";
        reasoning += "[THINK]\n";
        reasoning += "Your thoughts or/and draft, like working through an exercise on scratch paper.\n";
        reasoning += "Be as casual and as long as you want until you are confident to generate the response to the user.\n";
        reasoning += "[/THINK]\n";
        reasoning += "Here, provide a self-contained response.\n";
        
        // https://huggingface.co/mistralai/Ministral-3-8B-Reasoning-2512/discussions/5 
        reasoning += "It is imperative to close the [THINK] tag with a [/THINK] closing tag once you are ready to present the answer to the user or start a tool-call.\n";
        
// 20260422 using Ministral-3-8B-Reasoning there indeed was problems in closing the reasoning-stage.
// => the symptom was that tool-calling steps were lost and an empty respose was given.

// THE PROBLEM WAS LIKE THIS:
// sometimes stuff like this is seen on reasoning-content side (while it should go to real-content side):
// [TOOL_CALLS]read_file[ARGS]{"filepath": "./some_file.txt"}
// [TOOL_CALLS]write_file[ARGS]{"filepath": "./some_file.txt", "content": "some_file_contents"}

// also see:
// https://huggingface.co/mistralai/Ministral-3-14B-Instruct-2512/blob/main/chat_template.jinja 
// https://huggingface.co/mistralai/Ministral-3-14B-Reasoning-2512/blob/main/chat_template.jinja 

        // one could also consider use of RAG (Retrieval-Augmented Generation) or Context Stuffing style?
        // => especially if there is no need for AI to really decide on it's own which tool to use.
        // => that would make data import/export less depedent on tool-calling-details of model.
        
        reasoning += "\n";
    }
    
    const prompt = introSection + projectSection + toolsSection + endSection + reasoning;
    return prompt.trim();
}

// Current date is: year=${year} month=${month} day=${day}

