
import {
    init, clearEverything, handleCommand, handleSubmit, completedMessages, Role,
} from "batch_ai_agent/batch.ts";

await init();

// adjust tool-calling permissions using commands.
const out1 = await handleCommand("/tools-allow all");
console.log(out1);

// calling clearEverything() will clear messages AND update the system-role message.
// => therefore call it AFTER adjusting the proper tool permissions.
clearEverything();

// this test covers AI tool calling.
// => we instruct AI to read a local file, and write a result to another local file.

const prompt = `
Use read_file tool to read a local file: "./test_IN.txt"
It contains some text in french. Translate the text to english.
As a last step, use write_file tool to save the translation to a local file: "./test_OUT.txt"
`;

await handleSubmit(prompt);

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

