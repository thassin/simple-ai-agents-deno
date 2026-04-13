
import {
    init, clearEverything, handleCommand, handleSubmit, completedMessages
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

// TODO here you can:
// => inspect contents of the last message (AI response).
// => study what tools were used, were the tool-calls successful, etc...
// => or continue chat further, just by calling handleSubmit() again.

/* this is an example about continuing chat further.
await handleSubmit("tell a short story about the animals.");
console.log("PRINTING THE LAST MESSAGE:");
console.log(completedMessages[completedMessages.length - 1]);
*/

