import {ArrayProvider, DataProvider, DataSource, FetchParams, OptionsArg, ResponseCollection,} from "../index";

export default class OfflineServerProvider<T extends object = object>  implements DataProvider<T>  {

    private data: ArrayProvider<T> | null = null;

    readonly schema = this.serverProvider.schema;

    constructor(
        private serverProvider: DataProvider<T>,
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

    async create(model: Partial<T>): Promise<T> {
        const result = await this.serverProvider.create(model);
        this.data = null;
        return result;
    }

    async get(primary: T[keyof T]): Promise<T | void> {
        if (! this.data) {
            return this.serverProvider.get(primary);
        }

        return this.data.get(primary)
    }

    async remove(model: Partial<T>): Promise<void> {
        await this.serverProvider.remove(model);
        this.data = null;
    }

    async update(primary: T[keyof T], model: Partial<T>): Promise<T> {
        const result = await this.serverProvider.update(primary, model);
        this.data = null;
        return result;
    }
}
