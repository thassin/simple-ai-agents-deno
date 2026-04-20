
export interface _HashMap<T> {
    [key: string]: T; // "index signature" telling that keys are strings always.
}

// utils for datatype detection/verification.

export function isObject(obj: unknown): boolean {
    return (
        obj != null &&
        typeof obj === "object" &&
        Array.isArray(obj) === false
    );
}

export function isArray(obj: unknown): boolean {
    return (
        obj != null &&
        typeof obj === "object" &&
        Array.isArray(obj) === true
    );
}

export function isString(obj: unknown): boolean {
    return typeof obj === "string";
}

export function isNumber(obj: unknown): boolean {
    return typeof obj === "number";
}

export function isBoolean(obj: unknown): boolean {
    return typeof obj === "boolean";
}

// reasoning-enums belong to completion-API, but need to declare them here,
// since needed in _ConfigResponse (both in client and in server).

export enum ReasoningEffort {
    None = "none",
    Minimal = "minimal",
    Low = "low",
    Medium = "medium",
    High = "high",
    XtraHigh = "xhigh",
}

export enum ReasoningFormat {
    None = "none", // The model's reasoning (e.g., text between <think> tags) is treated as normal text and included directly in the content field. No special parsing is performed.
    DeepSeek = "deepseek", // The server parses the reasoning chain and puts it into a separate reasoning_content field in the API response. This matches the standard used by DeepSeek and OpenAI's O1/O3 models.
    //Hidden = "hidden", // The reasoning process is generated but stripped from the final output. The user only sees the final answer.
    Auto = "auto", // The server attempts to automatically detect the correct format based on the model's chat template.
}

