import RestProvider from './data-providers/RestProvider';
import axios, {type AxiosInstance} from 'axios';
import DataSource from "./DataSource";
import CacheServerProvider from "./data-providers/CacheServerProvider";
import type {ISchemaList} from "./schema";
import {SchemaList} from "./schema";
import ArrayProvider from "./data-providers/ArrayProvider";
import type {OptionsArg} from "./internal";

type ExtendOptions = { cacheable?: boolean, schemaId?: string }
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
        pathValues?: string | number | Record<string, string | number>,
        options?: CreateOptions<T>
    ) {

        if (pathValues && typeof pathValues !== 'object') {
            pathValues = {id: pathValues};
        }

        Object.entries(pathValues || {}).forEach(([key, value]) => {
            path = path.replace('{' + key + '}', String(value));
        });

        const rest = new RestProvider<T>(`/${path}`, this.http, options);
        if (options?.cacheable === true) {
            const schema = this.schemas.get(options?.schemaId || path)
            return new CacheServerProvider(rest, schema.primary)
        }

        return rest
    }

    public createDataSource<T extends Record<string, any> = Record<string, any>>(
        path: string,
        pathValues?: string | number | Record<string, string | number>,
        options?: CreateOptions<T> & OptionsArg<T>
    ) {
        const provider = this.create(path, pathValues, options)
        const schema = this.schemas.get(path)
        return new DataSource<T>(provider, {schema, ...options});
    }

    public createDataSourceByArray<T extends Record<string, any> = Record<string, any>>(
        data: T[],
        options?: OptionsArg<T> & {schemaId?: string}
    ) {
        const provider = new ArrayProvider(data)
        const schema = this.schemas.get(options?.schemaId || "")
        return new DataSource<T>(provider, {schema, ...options});
    }
}
