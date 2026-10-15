
import {
    overrideSystemPrompt,
    getCurrentSystemPrompt,
    init, clearEverything,
    handleCommand, handleSubmit,
    completedMessages, Role,
} from "batch_ai_agent/batch.ts";

const mySystemPrompt = `
You are an expert language translator.
Your only task is to accurately translate the provided text into the requested target language.

Follow these rules strictly:
1. Translate the meaning naturally. Do not provide literal, word-for-word translations if it alters the natural flow of the target language.
2. Preserve formatting (e.g., bullet points, Markdown, capitalization).
3. Do not include introductory or concluding remarks (e.g., "Here is your translation").
4. Output ONLY the translated text.
`;

// calling this before init() will set a custom system-prompt (with tools-section appended).
overrideSystemPrompt(mySystemPrompt);

await init();

// adjust tool-calling permissions using commands.
const out1 = await handleCommand("/tools-allow all");
console.log(out1);

// calling clearEverything() will clear messages AND update the system-role message.
// => therefore call it AFTER adjusting the proper tool permissions.
clearEverything();

console.log("**** START of full system prompt ****");
console.log();
console.log(getCurrentSystemPrompt());
console.log();
console.log("**** END of full system prompt ****");

// this test covers AI tool calling.
// => we instruct AI to read a local file, and write a result to another local file.

const prompt = `
Use read_file tool to read a local file: "./test_IN_fr.txt" which ontains some text in french.
Translate the text to english, and use write_file tool to save the translation to a local file: "./test_OUT_en.txt"
`;

await handleSubmit(prompt, null);

//console.log("PRINTING OUT ALL MESSAGES:");
//console.log(completedMessages);

let toolCallTotalCount = 0;
let toolCallErrorCount = 0;
let toolCallEvents: Array<string> = new Array<string>();

for ( const message of completedMessages ) {
    if ( message.role !== Role.Tool ) continue;
    toolCallTotalCount++;
    
    if ( message.tool_call_info2 !== true ) {
        toolCallErrorCount++;
    }
    
    const info: string = message.tool_call_info1 ?? "";
    toolCallEvents.push(info.trim());
}

let lastAssistantResponse = "";
let lastAssistantReasoning = "";
let lastResponse_totalTokenCount = -1;
if ( completedMessages.length > 0 ) {
    const lastMessage = completedMessages[completedMessages.length - 1];
    
    if ( lastMessage.stopped && lastMessage.errorMessages === "fetch failed" ) {
        console.log();
        console.log("ERROR: there was no response from server, check connection.");
        Deno.exit(1);
    }
    
    if ( lastMessage.role === Role.Assistant ) {
        lastAssistantResponse = lastMessage.content;
        if ( lastMessage.reasoning_content != null ) lastAssistantReasoning = lastMessage.reasoning_content;
        lastResponse_totalTokenCount = lastMessage.t_prompt_n + lastMessage.t_predicted_n;
        if ( lastResponse_totalTokenCount < 0 ) lastResponse_totalTokenCount = 0;
    }
}

console.log();
console.log("TOOL-CALLING SUMMARY: totalCount=" + toolCallTotalCount + " errorCount=" + toolCallErrorCount);
if ( toolCallEvents.length > 0 ) {
    console.log("TOOL-CALLING EVENTS:");
    for ( let i = 0; i < toolCallEvents.length; i++ ) {
        console.log("    EVENT-" + i + ":");
        console.log(toolCallEvents[i]);
        console.log();
    }
} else {
    console.log();
}

if ( lastAssistantReasoning !== "" ) {
    console.log("LAST REASONING CONTENTS:");
    console.log(lastAssistantReasoning);
}

console.log("LAST RESPONSE CONTENTS:    (total tokens used = " + lastResponse_totalTokenCount + ")");
console.log(lastAssistantResponse);

