import ArrayProvider from './ArrayProvider';
import type {
  IDataProvider,
  FetchParams,
  Collection,
} from './interfaces';
import {DEFAULT_PRIMARY_KEY} from "../schema/utils";

export default class CacheServerProvider<
  T extends Record<string, any> = Record<string, any>
> implements IDataProvider<T> {
  private data: ArrayProvider<T> | null = null;

  constructor(
      private readonly serverProvider: IDataProvider<T>,
      private readonly primary: keyof T | string = DEFAULT_PRIMARY_KEY
  ) {}

  async fetch(params?: FetchParams<T>): Promise<Collection<T>> {
    if (!this.data) {
      const result = await this.serverProvider.fetch();

      this.data = new ArrayProvider<T>(result.data, this.primary);
    }

    return this.data.fetch(params);
  }

  async create(model: Partial<T>): Promise<T> {
    const result = await this.serverProvider.create(model);
    this.data = null;
    return result;
  }

  async get(primary: string | number): Promise<T | void> {
    if (!this.data) {
      return this.serverProvider.get(primary);
    }

    return this.data.get(primary);
  }

  async remove(primary: string | number): Promise<void> {
    await this.serverProvider.remove(primary);
    this.data = null;
  }

  async update(primary: T[keyof T], model: Partial<T>): Promise<T> {
    const result = await this.serverProvider.update(primary, model);
    this.data = null;
    return result;
  }

  clear() {
    this.data = null;
  }
}
