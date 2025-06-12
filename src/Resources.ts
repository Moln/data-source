import RestProvider from './data-providers/RestProvider';
import axios, {type AxiosInstance} from 'axios';
import DataSource from "./DataSource";
import CacheServerProvider from "./data-providers/CacheServerProvider";
import type {ISchema, ISchemaList} from "./schema";
import {SchemaList} from "./schema";
import ArrayProvider from "./data-providers/ArrayProvider";
import type {OptionsArg} from "./internal";
import {isArray} from "./utils.ts";
import type {IDataProvider} from "./data-providers";

type ExtendOptions = {
    cacheable?: boolean,
    schema?: ISchema,
    schemaId?: string,
    pathParams?: string | number | Record<string, string | number>,
}
type CreateOptions<T extends Record<string, any> = Record<string, any>> =
    ConstructorParameters<typeof RestProvider<T>>[2]
    & ExtendOptions

export default class Resources {
    constructor(
        private http: AxiosInstance = axios,
        public schemas: ISchemaList = new SchemaList()
    ) {
    }

    create<T extends Record<string, any> = Record<string, any>>(
        path: string,
        options: CreateOptions<T> = {}
    ) {
        const {schemaId, cacheable} = options
        let {pathParams = {}} = options
        if (! schemaId) {
            options.schemaId = path
        }
        const schema = this.getSchema(options)
        options.schema = schema

        if (pathParams && typeof pathParams !== 'object') {
            pathParams = {id: pathParams};
        }

        Object.entries(pathParams).forEach(([key, value]) => {
            path = path.replace('{' + key + '}', String(value));
        });

        const rest = new RestProvider<T>(`/${path}`, this.http, options);
        if (cacheable === true) {
            return new CacheServerProvider(rest, schema.primary)
        }

        return rest
    }

    private getSchema<T extends Record<string, any> = Record<string, any>>({schemaId, schema}: CreateOptions<T> & OptionsArg<T>) {
        if (schema) {
            return schema
        } else {
            return this.schemas.get(schemaId!)
        }
    }

    public createDataSource<T extends Record<string, any> = Record<string, any>>(
        pathOrData: string | T[],
        options: CreateOptions<T> & OptionsArg<T> = {}
    ) {
        let provider: IDataProvider<T>;
        if (isArray(pathOrData)) {
            options.schema = this.getSchema(options)
            provider = this.createByArray(pathOrData, options);
        } else {
            provider = this.create(pathOrData, options);
        }
        return new DataSource<T>(provider, options);
    }

    public createByArray<T extends Record<string, any> = Record<string, any>>(
        data: T[],
        options: OptionsArg<T> & {schemaId?: string} = {}
    ) {
        return new ArrayProvider(data, this.getSchema(options).primary)
    }
}
