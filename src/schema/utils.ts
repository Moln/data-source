import type {JSONSchema7} from "json-schema";
import type {BaseRootSchema} from "./interfaces";
import {isEmptyObject} from "../utils";

export const DEFAULT_PRIMARY_KEY = 'id';

export const DEFAULT_SCHEMA: BaseRootSchema = {
    type: 'object',
    primaryKey: DEFAULT_PRIMARY_KEY,
};

export function schemaDefaultValues(schema: JSONSchema7): object {
    const values: { [key: string]: any } = {};
    const properties = schema.properties as { [key: string]: JSONSchema7 };
    if (properties) {
        Object.entries(properties).forEach(([key, item]) => {
            switch (item.type) {
                case 'object':
                    const subValues = schemaDefaultValues(item);
                    if (!isEmptyObject(subValues)) {
                        values[key] = subValues;
                    }
                    break;
                default:
                    if (item.default !== undefined) {
                        values[key] = item.default;
                    }
                    break;
            }
        });
    }

    return values;
}


export class ValidatorError extends Error {
    constructor(
        message: string,
        public readonly keys: string[],
        public readonly value: any,
        public readonly schema: JSONSchema7,
        public readonly keyword: string
    ) {
        super(message);
    }
}


export class Errors {
    public errors: ValidatorError[] = []
    constructor() {
    }

    add(err: ValidatorError) {
        this.errors.push(err)
    }

    ok() {
        return this.errors.length === 0
    }
}
