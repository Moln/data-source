
import type {JSONSchema7, JSONSchema7TypeName} from "json-schema";

import {accessor, isArray} from "../utils";
import {Errors, ValidatorError} from "./utils";


type Validator = {
    validate: (data: any, property: JSONSchema7, keys: string[], root: any, errors: Errors) => void,
    types?: JSONSchema7TypeName[]
    name: keyof JSONSchema7
}

export const validators: Validator[] = [
    {
        validate: (data, schema, keys, root, errors) => {
            if (! schema.type) {
                return ;
            }
            const types = normalizeType(schema.type)
            data = castValue(data, types)
            accessor.set(root, keys, data)

            if (! types.includes(getType(data, types.includes("number")))) {
                errors.add(new ValidatorError(`Type must be: ${types.toString()}`, keys, data, schema, 'type'))
            }
        },
        name: 'type',
    },
    {
        validate: (data, schema, keys, _2, errors) => {
            const properties = (schema.properties || {}) as Record<string, JSONSchema7>
            const required = schema.required || []
            const errorKeys = required
                .filter((key) => !(properties[key]?.default) && (data[key] === undefined || data[key] === null));

            if (errorKeys.length) {
                errors.add(new ValidatorError(`(${errorKeys.join(', ')}) is required`, keys, data, schema, 'required'))
            }
        },
        types: ["object"],
        name: "required",
    },
    {
        validate: (data, schema, keys, root, errors) => {
            Object.entries(schema.properties || {}).forEach(([key, subSchema]) => {
                validateAll(data[key], subSchema as JSONSchema7, keys.concat(key), root, errors)
            })
        },
        types: ["object"],
        name: "properties",
    },
]

const normalizeType = (type: JSONSchema7['type']) => isArray(type) ? type : (type ? [type] : [])

export const validateAll = (data: any, schema: JSONSchema7, keys: string[] = [], root: any = data, errors: Errors = new Errors()) => {
    if (data === undefined) {
        if (schema.default === undefined) {
            return errors;
        }

        data = schema.default
        accessor.set(root, keys, schema.default)
    }

    Object.values(validators).forEach((validator) => {
        if (schema[validator.name] === undefined) {
            return ;
        }
        schema.type = normalizeType(schema.type)
        if (! validator.types || validator.types.some((t) => schema.type!.includes(t))) {
            validator.validate(data, schema, keys, root, errors)
        }
    })
    return errors
}


function castValue(value: any, type: JSONSchema7TypeName[]): any {
    if (typeof value == "string") {
        if (type.includes("number") || type.includes("integer")) {
            return Number(value)
        }
    } else if (typeof value == "number") {
        if (type.includes("string")) {
            return String(value)
        } else if (type.includes("boolean")) {
            return Boolean(value)
        }
    }

    return value
}

function getType(val: any, hasNumber: boolean): JSONSchema7TypeName {
    const type = typeof val
    if (["string", "boolean"].includes(type)) {
        return type as JSONSchema7TypeName
    } else if (type == "number") {
        if (hasNumber) {
            return type
        } else {
            return Number.isInteger(val) ? "integer" : "number"
        }
    } else if (val === null) {
        return "null"
    } else if (isArray(val)) {
        return "array"
    } else {
        return type as JSONSchema7TypeName
    }
}
