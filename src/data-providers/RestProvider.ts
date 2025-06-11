import type {
  IDataProvider,
  FetchParams,
  Collection,
} from './interfaces';
import axios, {type AxiosInstance, type AxiosResponse} from 'axios';
import {commonConfigs} from "../config";

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
  const result: { filter?: object } = normalizeJsonApiParams(params);

  const filter = result.filter;
  delete result.filter;

  return {
    ...result,
    ...filter,
  };
}

interface Options<T extends object> {
  normalizeParams: NormalizeParams<T>,
  normalizeCollectionResponse: (response: AxiosResponse) => Collection<T>
  normalizeEntityResponse: (response: AxiosResponse) => T
}

export default class RestProvider<
  T extends Record<string, any> = Record<string, any>
> implements IDataProvider<T> {
  protected readonly options: Options<T>

  constructor(
    protected readonly url: string,
    protected readonly http: AxiosInstance = axios,
    options?: Partial<Options<T>>
  ) {
    this.options = {
      ...commonConfigs.restProvider as Options<T>,
      ...options,
    }
  }

  async get(id: string | number): Promise<T | void> {
    const response = await this.http.get<T>(`${this.url}/${id}`);
    return this.options.normalizeEntityResponse(response)
  }

  async create(model: Partial<T>): Promise<T> {
    const response = await this.http.post<T>(this.url, model);
    return this.options.normalizeEntityResponse(response)
  }

  async fetch(params?: FetchParams<T>): Promise<Collection<T>> {
    const response = await this.http.get<Collection<T>>(this.url, {
      params: params && this.options.normalizeParams(params),
    });
    return this.options.normalizeCollectionResponse(response)
  }

  async update(primary: string | number, model: Partial<T>): Promise<T> {
    const response = await this.http.patch<T>(`${this.url}/${primary}`, model);
    return this.options.normalizeEntityResponse(response)
  }

  async remove(primary: string | number): Promise<void> {
    await this.http.delete(`${this.url}/${primary}`);

    return;
  }
}
