import type {
  IDataProvider,
  FetchParams,
  Collection,
} from './interfaces';
import { guid } from '../utils';
import Query from '../query/Query';
import {DEFAULT_PRIMARY_KEY} from "../schema/utils";

export default class ArrayProvider<
  T extends Record<string, any> = Record<string, any>
> implements IDataProvider<T> {
  constructor(
    public readonly data: T[],
    private readonly primary: keyof T | string = DEFAULT_PRIMARY_KEY
  ) {
    data.forEach(item => {
      if (!item[primary]) {
        item[primary] = guid() as any;
      }
    });
  }

  get(primary: string | number): Promise<T | void> {
    const row = this.data.find(row => row[this.primary] === primary);
    return Promise.resolve(row);
  }

  create(model: Partial<T>): Promise<T> {
    if (!model[this.primary]) {
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

  async remove(primary: string | number): Promise<void> {
    const index = this.data.findIndex(row => row[this.primary] === primary);

    if (index !== -1) {
      this.data.splice(index, 1);
    }
  }

  fetch(params?: FetchParams<T>): Promise<Collection<T>> {
    const page = params?.page;
    const pageSize = params?.pageSize;

    let data = new Query(this.data);

    if (params?.sort) {
      data = data.order(params.sort);
    }
    if (params?.filter) {
      data = data.filter(params.filter);
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
}
