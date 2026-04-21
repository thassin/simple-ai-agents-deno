
import {
    ReasoningEffort,
} from "./shared/shared.ts";

export const LLAMA_API_URL: string = "http://localhost:9999";

export const LLAMA_TEMPERATURE: number = 0.1;

// options: None (to disable reasoning), Minimal, Low, Medium, High, XtraHigh.
export const LLAMA_REASONING_EFFORT: ReasoningEffort = ReasoningEffort.None;

export const USE_STREAMING: boolean = true;

