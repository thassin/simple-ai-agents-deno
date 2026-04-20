
import {
    ReasoningEffort,
} from "./shared/shared.ts";

export const AI_AGENT_NAME = "batch";
export const AI_AGENT_VERSION = "0.1.0";

export const LONG_NAME = AI_AGENT_NAME + "-AI-agent";

export const LLAMA_API_URL: string = "http://localhost:9999";
export const LLAMA_TEMPERATURE: number = 0.1;
export const LLAMA_REASONING_EFFORT: ReasoningEffort = ReasoningEffort.None; // use "None" to disable reasoning.

export const USE_STREAMING: boolean = false;

export const PROJECT_README_FILENAME = "README.md";
export const PROJECT_AGENTS_FILENAME = "AGENTS.md";

