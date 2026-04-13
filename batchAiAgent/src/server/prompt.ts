
import { _ConfigPathInfo } from "../shared/shared.ts";
import { PROJECT_README_FILENAME, PROJECT_AGENTS_FILENAME } from "../config.ts";
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
        // tässä tapauksessa ei tartte kertoa poluista yhtikäs mitään.
        projectSection += "\n"; // vähän vaan muotoilua.
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
    endSection += "End of project introduction.";
    
    
    ////////xxxxxxxxx tässä vielä se toinen merkintätapa...
/*    const prompt = `
Current date is: ${dateStr}.
${introSection}${projectSection}${toolsSection}
    `;*/ ////////xxxxx
    
    const prompt = introSection + projectSection + toolsSection + endSection;
    return prompt.trim();
}

// Current date is: year=${year} month=${month} day=${day}

