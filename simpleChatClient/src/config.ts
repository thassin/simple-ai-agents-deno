
import {
    ReasoningEffort,
} from "./shared/shared.ts";

export const LLAMA_API_URL: string = "http://localhost:9999";
export const LLAMA_TEMPERATURE: number = 0.1;
export const LLAMA_REASONING_EFFORT: ReasoningEffort = ReasoningEffort.None; // use "None" to disable reasoning.

export const USE_STREAMING: boolean = true;

