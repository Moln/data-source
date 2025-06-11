import type {ModelFactory} from "./interfaces";
import type {ISchema} from "./schema/interfaces.ts";

export interface OptionsArg<T extends object = object> {
    schema?: ISchema,
    modelFactory?: ModelFactory<T>;
    paginator?:
        | false
        | { page?: number; pageSize?: number; type?: 'page' }
        | { cursor?: string | number | null; pageSize?: number; type?: 'cursor' };
    autoSync?: boolean;
}

export type IDisposer = () => void;


export type FieldType<T> = keyof T | string | string[] | ((d: T) => string);
