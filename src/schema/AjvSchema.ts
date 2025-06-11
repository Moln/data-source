import Ajv from 'ajv';
import {accessor, guid} from '../utils';
import type {BaseRootSchema, ISchema, ISchemaList} from "./interfaces";
import {DEFAULT_PRIMARY_KEY, DEFAULT_SCHEMA, Errors, ValidatorError} from "./utils";
import type {JSONSchema7} from "json-schema";

export default class AjvSchema implements ISchema {


    public readonly schema: BaseRootSchema;

    constructor(
        private readonly ajv: Ajv,
        private schemaName: string = guid()
    ) {
        this.schema = (this.getSchema(schemaName)?.schema || DEFAULT_SCHEMA) as BaseRootSchema;
    }

    validate(data: any, keys?: string[]): Errors {
        const errors = new Errors()
        const validator = this.getSchema(keys)
        if (!validator) {
            return errors
        }
        const result = validator(data)
        if (result) {
            return errors
        }
        errors.errors = validator.errors!.map((err) => {
            const keys = err.instancePath.split("/")
            keys.shift()
            const value = accessor.get(data, keys)
            const schema = this.getSchema(keys)?.schema as JSONSchema7
            return new ValidatorError(err.message!, keys, value, schema, err.keyword)
        })

        return errors
    }

    get primary(): string {
        return this.schema.primaryKey || DEFAULT_PRIMARY_KEY;
    }

    isReadOnly(keys: string | string[]): boolean {
        const validator = this.getSchema(keys);
        return (validator?.schema as any)?.readOnly;
    }

    private getSchema<T = unknown>(keys: string | string[] = []) {
        const path = buildPath(keys);
        return this.ajv.getSchema<T>(this.schemaName + path);
    }
}

export class AjvSchemaList implements ISchemaList {
    constructor(
        private readonly ajv: Ajv = new Ajv({
            strict: false,
            useDefaults: true,
            coerceTypes: true,
        }),
    ) {
        ajvKeywordPrimaryKey(ajv);
    }

    get(id: string): ISchema {
        return new AjvSchema(this.ajv, id)
    }

    add(id: string, schema: JSONSchema7) {
        this.ajv.addSchema(schema, id);
    }
}


function ajvKeywordPrimaryKey(ajv: Ajv) {
    ajv.addKeyword({
        keyword: 'primaryKey',
        type: 'object',
        errors: false,
        valid: true,
        metaSchema: {
            type: 'string',
            default: 'id',
        },
    });
}

function buildPath(keys: string | string[]) {
    if (typeof keys == 'string') {
        keys = [keys];
    }
    return keys.length ? '#/properties/' + keys.join('/properties/') : '';
}
