import type {IDataSource} from "../interfaces";

export interface IDataProvider<
    T extends Record<string, any> = Record<string, any>
> {
    fetch(params?: FetchParams<T>): Promise<Collection<T>>;
    get(primary: string | number): Promise<T | void>;
    create(model: Partial<T>): Promise<T>;
    update(primary: string | number, model: Partial<T>): Promise<T>;
    remove(primary: string | number): Promise<void>;
}

export type FetchParams<T extends object> = Partial<
    Pick<IDataSource<T>, 'filter' | 'sort' | 'page' | 'pageSize' | 'cursor'>
> & { cursor?: string | number };

export interface Collection<T extends object = { [k in string]: any }> {
    data: T[];
    total?: number;
    [key: string]: any;
}