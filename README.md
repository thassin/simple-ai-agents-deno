# simple-ai-agents-deno
Simple interfaces to llama.cpp server, using typescript, with tool-calling support.

Prior Art:
- https://github.com/dinubs/spectre 
- https://github.com/sar/spectre 

In this project the idea and objective is the same as in Spectre AI Agent project, but differences are:
- deno is used instead of node.js.
- browser and HTML page is used as user interface.

There are 3 subdirectories, containing 3 different versions:
- chatAiAgent : the interactive tool version. App starts a local deno www-server, and launches a browser window (Firefox is used by default) to show the UI. The AI-chat works in browser, and it sends requests related to configuration, tool-calling etc to the deno www-server.
- batchAiAgent : the commandline batch tool version, which is a library (see _batch_test01 which is an example showing how to use the library). App starts a script, which can initiate an AI-chat, which you can control programmatically.
- simpleChatClient : this is a web page, containing AI-chat features without tool-calling and commands. Added as it may help in understanding how chatAiAgent version works.

In each of the subdirectory, there is a "config.ts" file which contains configuration values (like details of your AI server).

Steps for compiling and running simpleChatClient:
- cd simpleChatClient
- ./check.sh
- ./bundle.sh
- ./test.sh (script is using PHP test server as it's www-server, so either install PHP or change the script to use your favourite server).

Steps for compiling and running chatAiAgent:
- cd chatAiAgent/client
- ./check.sh
- ./bundle.sh
- cd ../server
- ./check.sh
- ./run.sh

Steps for compiling and running batchAiAgent (using _batch_test01 example as the main script):
- cd _batch_test01
- ./check.sh
- ./run.sh

Since deno supports compilation of programs to native apps, there is also script "chatAiAgent/server/compile_to_binary.sh" to do the compilation (it's quite similar to the run.sh script).

The programs have been tested using Linux OS and llama.cpp AI server.

Related to AI tool calling, there are 2 tools implemented:
- reading from a local file.
- writing to a local file.

Some things, including tool-calling permissions, are controlled by commands. Commands are special prompt sentences starting with slash "/" character. Here is a full list of commands available in chatAiAgent:
- /help : display available commands.
- /tools : list available tools and their current permission state.
- /tools-allow : add tools to allowed-tools list (use parameters "all" or "*" to allow all tools).
- /tools-deny : remove tools from allowed-tools list (use parameters "all" or "*" to deny all tools).
- /clear : clear all messages from chat and clear message cache.

NOTE-1: chatAiAgent has some logic to find project-root-directory by looking for README.md files; use commandline option -s (for simple or standalone) to ignore project directories.

NOTE-2: the tool for writing to files is not allowed by default: you have to change it's permission (for example using a command "/tools-allow all") to be able to use it.

NOTE-3: in batchAiAgent only /tools-allow and /tools-deny tools are usable (and /clear tool functionality is replaced using a direct function call).

Related resources:
- https://gist.github.com/philipp-meier/678a4679d0895276f270fac4c046ad14 : OpenAI function calling example

