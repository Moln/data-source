import type {ScalarOptions} from "./interfaces.ts";

export const toScalar = (value: any, options: ScalarOptions = {}) => {
    if (value instanceof Date) {
        value = value.getTime()
    }
    if (typeof value === "string" && options.ignoreCase === true) {
        value = value.toLowerCase()
    }
    return value
}