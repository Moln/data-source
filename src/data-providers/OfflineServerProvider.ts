import {
    ArrayProvider,
    DataProvider,
    DataSource,
    DEFAULT_SCHEMA,
    FetchParams,
    OptionsArg,
    ResponseCollection,
} from "../index";
import Schema from "../Schema";

export default class OfflineServerProvider<T extends object = object>  implements DataProvider<T>  {

    private data?: ArrayProvider<T>;

    constructor(
        private serverProvider: DataProvider<T>,
        private readonly schema: Schema<T> = new Schema<T>(DEFAULT_SCHEMA),
    ) {
    }

    createDataSource(options?: OptionsArg<T>): DataSource<T> {
        return new DataSource<T>(this, this.schema, options)
    }

    async fetch(params?: FetchParams<T>): Promise<ResponseCollection<T>> {
        if (! this.data) {
            const result = await this.serverProvider.fetch();

            this.data = new ArrayProvider<T>(result.data);
        }

        return this.data.fetch(params);
    }

    create(model: Partial<T>): Promise<T> {
        return this.serverProvider.create(model);
    }

    get(primary: T[keyof T]): Promise<T | void> {
        return this.serverProvider.get(primary);
    }

    remove(model: Partial<T>): Promise<void> {
        return this.serverProvider.remove(model);
    }

    update(primary: T[keyof T], model: Partial<T>): Promise<T> {
        return this.serverProvider.update(primary, model);
    }
}
