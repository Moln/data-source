import {
  IDataProvider,
  FetchParams,
  OptionsArg,
  ResponseCollection,
} from '../interfaces';
import { DataSource, DEFAULT_SCHEMA, guid } from '../';
import Schema from '../Schema';
import Query from "../Query";
import Model from "../Model";

// export function factory<T extends object = object>(url: string): DataSource<T>;
// export function factory<T extends object = object>(data: T[] | string, schema: BaseRootSchema = DEFAULT_SCHEMA, options: OptionsArg<T> = {}) {
//     return new DataSource<T>(
//         data instanceof Array ? new ArrayProvider(data) : new RestProvider(data),
//         new Schema<T>(schema),
//         options,
//     );
// }

export default class ArrayProvider<
  T extends Record<string, any> = Record<string, any>
> implements IDataProvider<T> {
  constructor(
    public readonly data: T[],
    public readonly schema: Schema<T> = new Schema<T>(DEFAULT_SCHEMA)
  ) {
    data.forEach((item) => {
      if (!item[schema.primary]) {
        item[schema.primary] = guid() as any
      }
    })
  }

  createDataSource(options?: OptionsArg<T>): DataSource<T> {
    return new DataSource<T>(this, this.schema, options);
  }

  get primary(): keyof T {
    return this.schema.primary as keyof T;
  }

  get(primary: string | number): Promise<T | void> {
    const row = this.data.find(row => row[this.primary] === primary);
    return Promise.resolve(row);
  }

  create(model: Partial<T>): Promise<T> {
    if (model instanceof Model) {
      model = model.toJS()
    }
    if (! model[this.primary]) {
      model[this.primary] = guid() as any;
    }
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

    const page = params?.page;
    const pageSize = params?.pageSize;

    let data = new Query(this.data);

    if (params?.sort) {
      data = data.order(params.sort)
    }
    if (params?.filter) {
      data = data.filter(params.filter)
    }

    if (!page || !pageSize) {
      return Promise.resolve({
        data: data.toArray(),
        total: this.data.length,
      });
    }

    const start = (page - 1) * pageSize;
    return Promise.resolve({
      data: data.range(start, pageSize).toArray(),
      total: data.toArray().length,
    });
  }

  sub<T2 extends Record<string, any> = Record<string, any>>(
    id: string | number,
    resource: string
  ): IDataProvider<T2> {
    const row = this.data.find(row => row[this.primary] === id);
    const data = (row && row[resource]) || [];

    return new ArrayProvider(data, new Schema<T2>(this.schema.ajv, resource));
  }
}
