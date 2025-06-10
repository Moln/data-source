import type {CompareFn, KeyOfString, SortDir} from "../interfaces";

export type AggregateMethods = 'average' | 'count' | 'max' | 'min' | 'sum';

export type AggregateReturn<T> = {
    [key in keyof T]: { [key in AggregateMethods]: any };
};

export interface DataSourceGroupItemAggregate<T> {
    field: KeyOfString<T>;
    aggregate: AggregateMethods;
}

export interface GroupItem<T> {
    field: KeyOfString<T> | string;
    value: any;
    items: (T | GroupItem<T>)[];
    aggregates?: AggregateReturn<T>;
}
export interface GroupItem2<T> extends GroupItem<T> {
    items: T[];
}

export interface DataSourceGroupItem<T> {
    field: KeyOfString<T> | string;
    dir?: SortDir;
    aggregates?: DataSourceGroupItemAggregate<T>[];
    compare?: CompareFn;
    skipItemSorting?: boolean;
}

export type ScalarOptions = Partial<{
    ignoreCase: boolean
}>