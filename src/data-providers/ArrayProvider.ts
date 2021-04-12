import {
  DataProvider,
  FetchParams,
  OptionsArg,
  ResponseCollection,
} from '../interfaces';
import { DataSource, DEFAULT_SCHEMA } from '../';
import Schema from '../Schema';

// export function factory<T extends object = object>(url: string): DataSource<T>;
// export function factory<T extends object = object>(data: T[] | string, schema: BaseRootSchema = DEFAULT_SCHEMA, options: OptionsArg<T> = {}) {
//     return new DataSource<T>(
//         data instanceof Array ? new ArrayProvider(data) : new RestProvider(data),
//         new Schema<T>(schema),
//         options,
//     );
// }

export default class ArrayProvider<T extends object = object>
  implements DataProvider<T> {
  constructor(
    private data: T[],
    public readonly schema: Schema<T> = new Schema<T>(DEFAULT_SCHEMA)
  ) {}

  createDataSource(options?: OptionsArg<T>): DataSource<T> {
    return new DataSource<T>(this, this.schema, options);
  }

  get primary(): keyof T {
    return this.schema.primary as keyof T;
  }

  get(primary: T[keyof T]): Promise<T | void> {
    const row = this.data.find(row => row[this.primary] === primary);
    return Promise.resolve(row);
  }

  create(model: Partial<T>): Promise<T> {
    this.data.push(model as T);
    return Promise.resolve(model as T);
  }

  async update(primary: T[keyof T], model: Partial<T>): Promise<T> {
    const row = await this.get(primary);

    if (!row) {
      throw new Error(`Item "${primary}" not found.`);
    }

    Object.assign(row, model);
    return row;
  }

  async remove(model: Partial<T>): Promise<void> {
    const primary = model[this.primary] as T[keyof T];

    if (!primary) {
      throw new Error(`Primary "${this.primary}" not found.`);
    }

    const index = this.data.findIndex(row => row[this.primary] === primary);

    if (index !== -1) {
      this.data.splice(index, 1);
    }
  }

  fetch(params?: FetchParams<T>): Promise<ResponseCollection<T>> {
    if (!params) {
      return Promise.resolve({
        data: this.data,
        total: this.data.length,
      });
    }

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 0;

    const start = (page - 1) * pageSize;
    return Promise.resolve({
      data: this.data.slice(start, start + pageSize),
      total: this.data.length,
    });
  }
}
