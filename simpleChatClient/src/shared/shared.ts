
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

