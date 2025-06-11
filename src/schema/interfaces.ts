import type {JSONSchema7} from "json-schema";
import type {Errors} from "./utils";

export interface BaseRootSchema extends JSONSchema7 {
    type: 'object';
    primaryKey?: string;
}

export interface ISchema {

    readonly schema: BaseRootSchema;

    get primary(): string

    isReadOnly(keys: string | string[]): boolean;
    validate(data: any, keys?: string[]): Errors;
}

export interface ISchemaList {
    add(id: string, schema: JSONSchema7): void
    get(id: string): ISchema
}