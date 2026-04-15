
import {
    init, clearEverything, handleCommand, handleSubmit, completedMessages, Role,
} from "batch_ai_agent/batch.ts";

await init();

// adjust tool-calling permissions using commands.
const out1 = await handleCommand("/tools-deny all");
console.log(out1);

// calling clearEverything() will clear messages AND update the system-role message.
// => therefore call it AFTER adjusting the proper tool permissions.
clearEverything();

const prompt = "print out 3 animal emojis, and create funny names for them.";
await handleSubmit(prompt);

console.log("PRINTING OUT ALL MESSAGES:");
console.log(completedMessages);

let lastAssistantResponse = "";
let lastResponse_totalTokenCount = -1;
if ( completedMessages.length > 0 ) {
    const lastMessage = completedMessages[completedMessages.length - 1];
    if ( lastMessage.role === Role.Assistant ) {
        lastAssistantResponse = lastMessage.content;
        lastResponse_totalTokenCount = lastMessage.t_prompt_n + lastMessage.t_predicted_n;
        if ( lastResponse_totalTokenCount < 0 ) lastResponse_totalTokenCount = 0;
    }
}

console.log();
console.log("LAST RESPONSE CONTENTS:    (total tokens used = " + lastResponse_totalTokenCount + ")");
console.log(lastAssistantResponse);

// TODO here you can:
// => inspect contents of the last message (AI response).
// => study what tools were used, were the tool-calls successful, etc...
// => or continue chat further, just by calling handleSubmit() again.

/* this is an example about continuing chat further.
console.log();
console.log("THE SECOND handleSubmit() CALL IS STARTING NOW.");
await handleSubmit("tell a short story about the animals.");
console.log();
console.log("PRINTING OUT THE LAST MESSAGE CONTENTS:");
console.log(completedMessages[completedMessages.length - 1].content);
*/

