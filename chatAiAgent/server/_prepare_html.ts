
import { LONG_NAME } from "./src/config.ts";

let path: string;

// read the html-template file.
path = "./html_in/index.html_in";
let html = Deno.readTextFileSync(path);

// read the javascript file.
path = "./html_in/client.js";
const javascript = Deno.readTextFileSync(path);

// create and save the final "amalgamated" html.

html = html.replace("%%%%pagetitle%%%%", LONG_NAME);
html = html.replace("%%%%javascript%%%%", javascript);

path = "./html_final/html_template";
let typescript = Deno.readTextFileSync(path);

// save the final html as a base64-encoded string.
// => just to hide the content from typescript compiler.
html = btoa(html);

typescript = typescript.replace("%%%%html%%%%", html);

path = "./html_final/html.ts";
Deno.writeTextFileSync(path, typescript);

console.log("prepare-html OK");
Deno.exit(0);

