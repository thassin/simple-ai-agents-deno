
import {
    ReasoningEffort,
} from "../../shared/shared.ts";

export const AI_AGENT_NAME = "chat";
export const AI_AGENT_VERSION = "0.1.0";

export const LONG_NAME = AI_AGENT_NAME + "-AI-agent";

// PROBLEM: latest firefox versions after 153.5.0esr won't keep running, but seem to exit after startup and then run in background.
// THEREFORE it is no longer possible to detect when the session ends (by watching the firefox process which we started).
//export const BROWSER = "firefox";
export const BROWSER = "chromium"; // chromium process lasts until the window is closed.

export const LLAMA_API_URL: string = "http://localhost:9999";
export const LLAMA_TEMPERATURE: number|undefined = undefined;
// options: None (to disable reasoning), Minimal, Low, Medium, High, XtraHigh.
export const LLAMA_REASONING_EFFORT: ReasoningEffort = ReasoningEffort.None;

export const USE_STREAMING: boolean = true;

export const PROJECT_README_FILENAME = "README.md";
export const PROJECT_AGENTS_FILENAME = "AGENTS.md";

