import {
  IDataProvider,
  FetchParams,
  OptionsArg,
  ResponseCollection,
} from '../interfaces';
import axios, { AxiosInstance } from 'axios';
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

type NormalizeParams<T extends object> = (params: FetchParams<T>) => object;

export function normalizeJsonApiParams<T extends object>(
  params: FetchParams<T>
) {
  const filter: { [key: string]: string } = {};
  params.filter?.filters.forEach(item => {
    if ('field' in item) {
      filter[item.field] = item.value;
    }
  });

  return {
    filter,
    sort: params?.sort,
    page: params?.page,
    cursor: params?.cursor,
    page_size: params?.pageSize,
  };
}

export function normalizeRootFilterParams<T extends object>(
  params: FetchParams<T>
) {
  let result: { filter?: object } = normalizeJsonApiParams(params);

  const filter = result.filter;
  delete result.filter;

  return {
    ...result,
    ...filter,
  };
}

export default class RestProvider<
  T extends Record<string, any> = Record<string, any>
> implements IDataProvider<T> {
  constructor(
    protected readonly url: string,
    protected readonly http: AxiosInstance = axios,
    public readonly schema: Schema<T> = new Schema<T>(DEFAULT_SCHEMA),
    protected readonly normalizeParams: NormalizeParams<T> = (
      params: FetchParams<T>
    ) => ({
      filter: params?.filter,
      sort: params?.sort,
      page: params?.page,
      cursor: params?.cursor,
      page_size: params?.pageSize,
    })
  ) {}

  public createDataSource(options?: OptionsArg<T>): DataSource<T> {
    return new DataSource<T>(this, this.schema, options);
  }

  async get(id: string | number): Promise<T | void> {
    const response = await this.http.get<T>(`${this.url}/${id}`);
    this.schema.validate(response.data);

    return response.data;
  }

  async create(model: Partial<T>): Promise<T> {
    const response = await this.http.post<T>(
      this.url,
      this.schema.toScalar(model)
    );
    this.schema.validate(response.data);

    return response.data;
  }

  async fetch(params?: FetchParams<T>): Promise<ResponseCollection<T>> {
    const response = await this.http.get<ResponseCollection<T>>(this.url, {
      params: params && this.normalizeParams(params),
    });

    response.data.data.forEach(row => {
      this.schema.validate(row);
    });

    return response.data;
  }

  async update(primary: T[keyof T], model: Partial<T>): Promise<T> {
    const response = await this.http.patch<T>(
      `${this.url}/${primary}`,
      this.schema.toScalar(model)
    );
    this.schema.validate(response.data);

    return response.data;
  }

  async remove(model: Partial<T> | T[keyof T]): Promise<void> {
    if (typeof model === 'object') {
      await this.http.delete<T>(
        `${this.url}/${(model as T)[this.schema.primary]}`
      );
    } else {
      await this.http.delete<T>(`${this.url}/${model}`);
    }

    return;
  }
}
