
// the http server implemented here is based on:
// https://docs.deno.com/runtime/reference/std/http/ 
// => see the "Routing" -example.

import { route, type Route } from "@std/http/unstable-route";
//import { serveDir } from "@std/http/file-server"; // not needed.

import {
    _HashMap,
    isObject, isArray, isString,
    ReasoningEffort,
    _LogRequest, _LogResponse,
    _ConfigResponse, _ConfigPathInfo, isValidConfigResponse,
    _ToolsResponse, isValidToolsResponse,
    _ToolsPostRequest, _ToolsPostResponse,
    _OaiApi_v1ChatCompletion_Tool,
    _ToolCallRequest, _AgentToolResult,
} from "../../shared/shared.ts";

import {
    AI_AGENT_NAME, AI_AGENT_VERSION, LONG_NAME,
    LLAMA_API_URL, LLAMA_TEMPERATURE, LLAMA_REASONING_EFFORT,
    BROWSER, USE_STREAMING,
    PROJECT_README_FILENAME,
} from "./config.ts";

import { getHTML } from "../html_final/html.ts";
import { getSystemPrompt } from "./prompt.ts";
import { allTools, getActiveTools, handleToolPermissions } from "./tools.ts";

const args = parseArgs();

// assign the default values.
let llama_api_url = LLAMA_API_URL;
let llama_temperature = LLAMA_TEMPERATURE;
let llama_reasoning_effort = LLAMA_REASONING_EFFORT;

// if configName is set => change the config as requested.
if ( args.configName != null ) {
    // TODO... set your custom values above based on configName.
}

// if help option was set, display help and quit.
if ( args.help ) {
    console.log(LONG_NAME + " v" + AI_AGENT_VERSION);
    console.log();
    
    console.log("Options:");
    console.log("  -c, --config         Set configuration name.");
    console.log("  -rd, --root-dir      Assign fixed project directory.");
    console.log("  -s, --simple         Ignore project directory.");
    console.log("  -h, --help           Display options and quit.");
    console.log();

    console.log("Current configuration:");
    console.log("  api_url:             " + llama_api_url);
    console.log("  temperature:         " + llama_temperature);
    console.log("  reasoning_effort:    " + llama_reasoning_effort);
    
    Deno.exit(0);
}

console.log(LONG_NAME + " v" + AI_AGENT_VERSION + " starting...");

// for sake of simplicity, let's declare working_directory as const.
// => either set project-root using commandline options, or detect it automatically.
const working_directory = Deno.cwd();

const path_info = await setupPathInfo();

export const config: _ConfigResponse = {
    ai_agent_name: AI_AGENT_NAME,
    ai_agent_version: AI_AGENT_VERSION,
    ui_long_name: LONG_NAME,
    ui_const_ok: "OK: ",
    ui_const_err: "ERROR: ",
    llama_api_url: llama_api_url,
    llama_temperature: llama_temperature,
    llama_reasoning_effort: llama_reasoning_effort,
    use_streaming: USE_STREAMING,
    path_info: path_info,
    current_working_directory: working_directory,
};

const routes: Route[] = [
    {
        method: ["GET"],
        pattern: new URLPattern({ pathname: "/" }),
        handler: indexHandler,
    },
    {
        method: ["POST"],
        pattern: new URLPattern({ pathname: "/log" }),
        handler: logHandler,
    },
    {
        method: ["GET"],
        pattern: new URLPattern({ pathname: "/config" }),
        handler: configHandler,
    },
    {
        method: ["GET"],
        pattern: new URLPattern({ pathname: "/tools" }),
        handler: toolsHandler,
    },
    {
        method: ["POST"],
        pattern: new URLPattern({ pathname: "/tools" }),
        handler: toolsUpdateHandler,
    },
    {
        method: ["POST"],
        pattern: new URLPattern({ pathname: "/toolcall" }),
        handler: toolCallHandler,
    },
];

function defaultHandler(req: Request) {
    console.log("defaultHandler: unknown request: " + req.method + " " + req.url);
    return new Response("Not found", { status: 404 });
}

// https://docs.deno.com/api/deno/~/Deno.serve 
// https://docs.deno.com/api/deno/~/Deno.ServeTcpOptions 

const hostname = "localhost";
const port = 8080;

const ac = new AbortController();
const server = await Deno.serve(
    { hostname: hostname, port: port, signal: ac.signal, },
    route(routes, defaultHandler),
);

console.log();
console.log("server is now running:", server);
console.log();



// FIREFOX testing and commandline options:
//    $ firefox --ProfileManager 
//    $ firefox -P test 
// => using a custom profile allows browser to remember window-size settings.
// --new-instance --private-window

// https://docs.deno.com/examples/subprocess_running_files/ 
// https://docs.deno.com/api/deno/~/Deno.Command 
// https://docs.deno.com/api/deno/~/Deno.CommandOptions 
// https://docs.deno.com/api/deno/~/Deno.ChildProcess 

const b_url = "http://" + hostname + ":" + port + "/";

let browserApp = "";
const b_args = new Array<string>();

// case FIREFOX:

const browserApp_ff = "firefox";
// @ts-ignore : is intentional compare, never mind.
if ( BROWSER === browserApp_ff ) {

    /*
    // this is the original way of starting firefox browser (before aug-2026):
    browserApp = browserApp_ff;
    // use a custom profile in firefox => browser will remember window-size settings.
    b_args.push("-P");
    b_args.push("test"); // this is the profile name.
    // using a private window prevents: 1) showing old tabs/sessions, and 2) filling history.
    b_args.push("--private-window");
    // tell browser to open the app URL.
    b_args.push(b_url);
    */

    // in aug-2026 firefox behaviour changed, so that it just seems to return immediately,
    // and there is no commandline option that would make it wait for pages/tabs to be closed.
    // => chain the browser-launch-command to a "sleep" command, to keep our server running.
    // => and then launch a shell instance to handle the chained commands.
    browserApp = "sh";
    b_args.push("-c");
    b_args.push(browserApp_ff + " -P test --private-window " + b_url + " && sleep infinity");
}

// case CHROMIUM:

const browserApp_c = "chromium";
if ( BROWSER === browserApp_c ) {
    // chromium process keeps running until all pages/tabs are closed.
    browserApp = browserApp_c;
    // use a custom profile => browser will remember window-size settings???
    b_args.push("--new-window");
    b_args.push("--incognito");
    // tell browser to open the app URL.
    b_args.push(b_url);
}

if ( browserApp === "" ) {
    console.log("ERROR: unknown browser app: " + BROWSER + ".");
    console.log("=> check and/or update browser configuration: see file server.ts lines 140-160.");
    Deno.exit(1);
}

const command = new Deno.Command(browserApp, {
    args: b_args,
    // TODO signal? not needed here, we already use AbortController for the server?!?
    stdin: "null",
    stdout: "null",
    stderr: "null",
});

try {
    const child = command.spawn();
    
    // calling ref() here means: Ensure that the status of the child process prevents the Deno process from exiting.
    child.ref(); // that sounds good. however, not much difference is seen in practice?!?
    
    const pid = child.pid;
    console.log("browser started with PID=" + pid);
    console.log();
    
    const status = await child.status;
    console.log("browser process completed:", status);
    
    // the UI in browser was closed => trigger the "abort" signal now.
    // => the server will shutdown, and finally the whole app will shutdown.
    ac.abort();
} catch (error) {
    console.error("Error while running browser: ", error);
    Deno.exit(2);
}

// to wait for the server to close, await the promise returned from the Deno.serve API.
server.finished.then(() => console.log(LONG_NAME + " says goodbye!"));

//////////////////////////////////////////////////////////////////////////////////////////////

function report_api_url(value: string): void {
    console.log("using llama_api_url: " + value);
}

function report_reasoning_effort(value: ReasoningEffort): void {
    console.log("using llama_reasoning_effort: " + value);
}

function indexHandler(): Response {
    const content = getHTML();
    return new Response(content, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

async function logHandler(request: Request): Promise<Response> {
    const postData = await request.text();
    
    const obj = JSON.parse(postData) as _LogRequest;
    let success = false;
    
    // do a simple typecheck for the request.
    if ( isObject(obj) && isString(obj.msg) ) {
        success = true;
        const msg: string = "\n" + obj.msg.trim() + "\n\n";
        console.log("LOG event received!");
        
        // https://docs.deno.com/examples/writing_files/ 
        
        const filePath = "/tmp/myserverlog.txt";
        await Deno.writeTextFile(filePath, msg, { append: true });
    }
    const response: _LogResponse = {
        success: success,
    };
    const content = JSON.stringify(response);
    return new Response(content, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

function configHandler(): Response {
    const content = JSON.stringify(config);
    return new Response(content, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

async function toolsHandler(): Promise<Response> {
    const all_tool_names = new Array<string>();
    const active_tools = new Array<_OaiApi_v1ChatCompletion_Tool>();
    for ( const tool of allTools ) {
        all_tool_names.push(tool.getName());
        if ( tool.isAllowed ) {
            active_tools.push(tool.getData());
        }
    }
    const response: _ToolsResponse = {
        active_tools: active_tools,
        all_tool_names: all_tool_names,
        system_prompt: await getSystemPrompt(path_info),
    };
    const content = JSON.stringify(response);
    return new Response(content, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

async function toolsUpdateHandler(request: Request): Promise<Response> {
    const postData = await request.text();
    
    const response: _ToolsPostResponse = {
        success: false,
        num_permissions_changed: 0,
        warnings: new Array<string>(),
    };
    
    const obj = JSON.parse(postData) as _ToolsPostRequest;
    
    // do a simple typecheck for the request.
    if ( isObject(obj) ) {
        if ( isArray(obj.tools_allow) && obj.tools_deny == null ) {
            response.success = true;
            // NOTE! 3rd param "response" is modified in call.
            // @ts-ignore : obj.tools_allow is of type array.
            handleToolPermissions(obj.tools_allow, true, response);
        }
        if ( obj.tools_allow == null && isArray(obj.tools_deny) ) {
            response.success = true;
            // NOTE! 3rd param "response" is modified in call.
            // @ts-ignore : obj.tools_deny is of type array.
            handleToolPermissions(obj.tools_deny, false, response);
        }
    }
    
    const content = JSON.stringify(response);
    return new Response(content, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

async function toolCallHandler(request: Request): Promise<Response> {
    const postData = await request.text();
    
    const obj = JSON.parse(postData) as _ToolCallRequest;
    let error: string = "";
    let desc: string = "";
    
    const ERROR_RESPONSE = "tool-call failed"; // simple response for AI telling operation failed.
    
    // do a simple typecheck for the request.
    if ( isObject(obj) && isString(obj.name) && isString(obj.arguments) ) {
        const toolName = obj.name;
        const activeTools = getActiveTools();
        if ( activeTools[toolName] != null ) {
            const args1: any = JSON.parse(obj.arguments);
            if ( isObject(args1) ) {
                // to fulfill the formal parameters declaration,
                // convert "args1" object to a hashmap with string keys.
                // => practically this should not change anything...
                const args2: _HashMap<any> = {};
                for ( const key in args1 ) {
                    const key2 = key.toString();
                    args2[key2] = args1[key];
                }
                
                console.log("STARTING TOOL CALL:", toolName, JSON.stringify(args2, null, 4));
                
                const response: _AgentToolResult = await activeTools[toolName].execute(args2);
                
                const content = JSON.stringify(response);
                return new Response(content, {
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                });
            } else {
                error = ERROR_RESPONSE;
                desc = "tool-call failed: arguments parse error";
            }
        } else {
            error = ERROR_RESPONSE;
            desc = "tool-call failed: tool not found";
        }
    } else {
        error = ERROR_RESPONSE;
        desc = "tool-call failed: request not valid";
    }
    
    const response: _AgentToolResult = {
        success: false,
        result: undefined,
        error: error,
        ui_desc: desc,
    };
    const content = JSON.stringify(response);
    return new Response(content, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

//////////////////////////////////////////////////////////////////////////////////////////////

async function setupPathInfo(): Promise<_ConfigPathInfo|null> {
    if ( args.simple ) {
        console.log("not assigning project-root-dir (simple-mode).");
        return null;
    }
    if ( args.rootDir == null ) {
        console.log("trying to auto-detect project-root-dir.");
        
        // starting from working_directory, repeat the following:
        //  1) check if the directory contains a README file.
        //  2) if not, continue search in parent directory.
        
        let searchPath = working_directory;
        while ( true ) {
            const testPath = searchPath + "/" + PROJECT_README_FILENAME;
            if ( await isFile(testPath) ) {
                console.log("=> assigned project-root-dir: " + searchPath);
                
                let finalRootDir = searchPath;
                if ( finalRootDir.endsWith("/") === false ) {
                    // usually we need to append a final directory-separator to root-dir.
                    // => the only exception is when the root-dir is assigned to "/".
                    finalRootDir += "/";
                }
                
                let subdir = working_directory.replace(finalRootDir, "");
///////////////////////////////////////////////////////////////////////////////
/* if ( subdir.startsWith("/") ) {        NOT NEEDED...
    // usually the subdir starts with a slash, which we need to remove.
    // => the only exception is when subdir is empty.
    subdir = subdir.substring(1);
} */
///////////////////////////////////////////////////////////////////////////////
                if ( subdir !== "" && subdir.endsWith("/") === false ) {
                    // usually we need to append a final directory-separator to subdir.
                    // => the only exception is when subdir is empty.
                    subdir += "/";
                }
                
                const pathInfo: _ConfigPathInfo = {
                    project_root_directory: finalRootDir, // always ends with a directory-separator.
                    working_subdirectory: subdir, // is either empty, or ends with a directory-separator.
                };
                return pathInfo;
            }
            searchPath = await getParentDirPathOrEmpty(searchPath);
            if ( searchPath === "" ) break; // no parent found => exit the loop.
        }
        console.error("ERROR: no README file found (use -s option to ignore).");
        Deno.exit(1);
    } else {
        console.log("trying to assign project-root-dir: " + args.rootDir);
        
        // this is OK as long as:
        //  1) working_directory is contained into the given rootDir, and
        //  2) the given rootDir contains a README file.
        
        let realPath: string;
        let isDir: boolean;
        try {
            realPath = await Deno.realPath(args.rootDir);
            isDir = await isDirectory(realPath);
        } catch ( error: any ) {
            realPath = "";
            isDir = false;
        }
        if ( isDir === false ) {
            console.error("ERROR: no such directory:", args.rootDir);
            Deno.exit(1);
        }
        
        if ( working_directory.startsWith(realPath) === false ) {
            console.error("ERROR: current directory is not contained in directory:", args.rootDir);
            Deno.exit(1);
        }
        
        let finalRootDir = realPath;
        if ( finalRootDir.endsWith("/") === false ) {
            // usually we need to append a final directory-separator to root-dir.
            // => the only exception is when the root-dir is assigned to "/".
            finalRootDir += "/";
        }
        
        let subdir = working_directory.replace(finalRootDir, "");
///////////////////////////////////////////////////////////////////////////////
/* if ( subdir.startsWith("/") ) {        NOT NEEDED...
    // usually the subdir starts with a slash, which we need to remove.
    // => the only exception is when subdir is empty.
    subdir = subdir.substring(1);
} */
///////////////////////////////////////////////////////////////////////////////
        if ( subdir !== "" && subdir.endsWith("/") === false ) {
            // usually we need to append a final directory-separator to subdir.
            // => the only exception is when subdir is empty.
            subdir += "/";
        }
        
        const testPath = realPath + "/" + PROJECT_README_FILENAME;
        if ( await isFile(testPath) === false ) {
            console.error("ERROR: no README file found in directory:", args.rootDir);
            Deno.exit(1);
        }
        
        const pathInfo: _ConfigPathInfo = {
            project_root_directory: finalRootDir, // always ends with a directory-separator.
            working_subdirectory: subdir, // is either empty, or ends with a directory-separator.
        };
        return pathInfo;
    }
}

// https://docs.deno.com/examples/checking_directory_existence/ 
async function isDirectory(path: string): Promise<boolean> {
    try {
        const fileInfo = await Deno.lstat(path);
        if ( fileInfo.isSymlink ) return false; // ignore symlinks!
        return fileInfo.isDirectory;
    } catch ( error: any ) {
        // the "not-found" case should be already covered by Deno.realPath().
        if ( error instanceof Deno.errors.NotFound === false ) {
            throw error;
        }
        return false;
    }
}

async function isFile(path: string): Promise<boolean> {
    try {
        const fileInfo = await Deno.lstat(path);
        if ( fileInfo.isSymlink ) return false; // ignore symlinks!
        return fileInfo.isFile;
    } catch ( error: any ) {
        // the "not-found" case should be already covered by Deno.realPath().
        if ( error instanceof Deno.errors.NotFound === false ) {
            throw error;
        }
        return false;
    }
}

async function getParentDirPathOrEmpty(path: string): Promise<string> {
    path = path.trim(); // cleanup the input data just in case...
    path = path.replace(/\/+/, "/"); // join multiple consecutive dir-separators.
    // if the path is empty, then it (is not valid and therefore) cannot have a parent.
    if ( path === "" ) return "";
    // to be valid, the path should now at least start with "/".
    if ( path.startsWith("/") === false ) {
        console.log("WARNING: path is not valid: '" + path + "'.");
        return "";
    }
    // if the path is just "/", then it cannot have a parent.
    if ( path === "/" ) return "";
    // use Deno.realPath() to get the parent directory.
    // => NOTE this works otherwise, but "/.." will yield "/" instead of error.
    try {
        return await Deno.realPath(path + "/..");
    } catch ( error: any ) {
        console.log("WARNING: path has no parent: '" + path + "'.");
        return "";
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////

interface _Args {
    simple: boolean; // do not try to determine project-root-dir (leaving path_info null).
    rootDir: string|null; // explicitly set the project-root-dir.
    configName: string|null; // specify configuration.
    help: boolean; // just display help and exit.
}

function parseArgs(): _Args {
    let args: _Args = {
        simple: false,
        rootDir: null,
        configName: null,
        help: false,
    };
    
    const OPT_S_1 = "-s";
    const OPT_S_2 = "--simple";
    
    const OPT_RD_1 = "-rd";
    const OPT_RD_2 = "--root-dir";
    
    const OPT_C_1 = "-c";
    const OPT_C_2 = "--config";
    
    const OPT_H_1 = "-h";
    const OPT_H_2 = "--help";
    
    const ERR_BAD_OPTIONS = "ERROR: conflicting options detected.";
    const ERR_UNK_OPTION = "ERROR: unknown option: ";
    
    let prev: string = "";
    for ( let i = 0; i < Deno.args.length; i++ ) {
        let arg = Deno.args[i];
        //console.log("    arg " + i + " : " + Deno.args[i]);
        
        let isOK = false;
        
        // options with no parameter (just clear "prev" for these).
        
        if ( arg === OPT_S_1 || arg === OPT_S_2 ) {
            if ( args.rootDir != null ) {
                console.log(ERR_BAD_OPTIONS);
                Deno.exit(1);
            }
            args.simple = true;
            prev = "";
            isOK = true;
        }
        
        if ( arg === OPT_H_1 || arg === OPT_H_2 ) {
            if ( args.rootDir != null ) {
                console.log(ERR_BAD_OPTIONS);
                Deno.exit(1);
            }
            args.help = true;
            prev = "";
            isOK = true;
        }
        
        // handle parameter values (if "prev" contains short option type).
        
        // check if the previous option was about root-dir.
        if ( prev === OPT_RD_1 ) {
            args.rootDir = arg;
            prev = arg = ""; // CLEAR BOTH NOW.
            isOK = true;
        }
        
        // check if the previous option was about config-name.
        if ( prev === OPT_C_1 ) {
            args.configName = arg;
            prev = arg = ""; // CLEAR BOTH NOW.
            isOK = true;
        }
        
        // options with parameter (need to set "prev" for these).
        
        if ( arg === OPT_RD_1 || arg === OPT_RD_2 ) {
            if ( args.simple ) {
                console.log(ERR_BAD_OPTIONS);
                Deno.exit(1);
            }
            prev = OPT_RD_1;
            isOK = true;
        }
        
        if ( arg === OPT_C_1 || arg === OPT_C_2 ) {
            prev = OPT_C_1;
            isOK = true;
        }
        
        // TODO anything else?!?
        
        if ( isOK === false ) {
            console.log(ERR_UNK_OPTION + arg + " at position: " + (i + 1) + ".");
            Deno.exit(1);
        }
    }
    
    return args;
}

//////////////////////////////////////////////////////////////////////////////////////////////

