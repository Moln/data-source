import type {BaseRootSchema, ISchema, ISchemaList} from "./interfaces";
import {DEFAULT_PRIMARY_KEY, DEFAULT_SCHEMA, Errors} from "./utils";
import {isArray} from "../utils";
import type {JSONSchema7} from "json-schema";
import {validateAll} from "./validator";

export default class Schema implements ISchema {

    constructor(public readonly schema: BaseRootSchema = DEFAULT_SCHEMA) {
    }

    get primary(): string {
        return this.schema.primaryKey || DEFAULT_PRIMARY_KEY
    }

    isReadOnly(keys: string | string[]): boolean {
        keys = isArray(keys) ? keys : [keys]
        return this.getSchema(keys).readOnly === true
    }

    validate(data: any, keys: string[] = []): Errors {
        return validateAll(data, this.getSchema(keys))
    }

    private getSchema(keys: string[] = []) {
        let target: JSONSchema7 = this.schema
        for (const key of keys) {
            target = target.properties?.[key] as JSONSchema7
            if (! target) {
                return {};
            }
        }
        return target
    }
}

const defaultSchema = new Schema()

export class SchemaList implements ISchemaList {
    schemas: Record<string, Schema> = {}

    add(key: string, schema: JSONSchema7) {
        this.schemas[key] = new Schema(schema as BaseRootSchema)
    }

    get(key: string) {
        if (! this.schemas[key]) {
            return defaultSchema as ISchema
        }
        return this.schemas[key] as ISchema
    }
}
