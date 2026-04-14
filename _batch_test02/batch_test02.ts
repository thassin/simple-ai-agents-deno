
import {
    init, clearEverything, handleCommand, handleSubmit, completedMessages
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

console.log("PRINTING OUT ALL MESSAGES:");
console.log(completedMessages);

