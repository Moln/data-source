import Schema from './Schema';
import { deepObserve } from './mobx/utils';

export type FieldType<T> = keyof T | string | ((d: T) => string);

export type CompareFn = <T>(a: T, b: T, desc?: boolean) => number;

export interface SortOptions1 {
  compare: CompareFn;
  dir?: SortDir;
}

export interface SortOptions2<T> {
  field: FieldType<T>;
  dir?: SortDir;
}

export type KeyOfString<T> = Extract<keyof T, string>;

export type SortOptions<T> =
  | KeyOfString<T>
  | string
  | SortOptions1
  | SortOptions2<T>
  | (SortOptions1 | SortOptions2<T>)[];

export type SortDir = 'desc' | 'asc';

export type OperatorKeys =
  | '=='
  | 'eq'
  | 'equals'
  | 'isequalto'
  | 'equalto'
  | 'equal'
  | '!='
  | 'ne'
  | 'notequals'
  | 'isnotequalto'
  | 'notequalto'
  | 'notequal'
  | 'neq'
  | '<'
  | 'islessthan'
  | 'lessthan'
  | 'less'
  | '<='
  | 'lt'
  | 'lte'
  | 'islessthanorequalto'
  | 'lessthanequal'
  | 'le'
  | '>'
  | 'isgreaterthan'
  | 'greaterthan'
  | 'greater'
  | 'gt'
  | '>='
  | 'isgreaterthanorequalto'
  | 'greaterthanequal'
  | 'ge'
  | 'gte'
  | 'notsubstringof'
  | 'doesnotcontain'
  | 'isnull'
  | 'isnotnull'
  | 'isempty'
  | 'isnotempty'
  | 'contains'
  | 'endswith'
  | 'startswith'
  | 'in'
  | 'notlike'
  | 'doesnotstartwith'
  | 'doesnotendwith'
  | 'matches'
  | 'doesnotmatch'
  | 'isnullorempty'
  | 'isnotnullorempty'
;

export interface DataSourceFilterItem<T> {
  operator?: OperatorKeys;
  field: KeyOfString<T> | string;
  value: any;
  ignoreCase?: boolean;
}

export interface DataSourceFilters<T> {
  logic?: 'and' | 'or';
  filters: (DataSourceFilterItem<T> | DataSourceFilters<T>)[];
  accentFoldingFiltering?: string;
}

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

export interface IDataSource<
  T extends Record<string, any> = Record<string, any>
> {
  readonly dataProvider: IDataProvider<T>;
  readonly schema: Schema<T>;

  paginator: false |
      {page: number, pageSize: number, type: 'page'} |
      {cursor: string | number | null, pageSize: number, type: 'cursor'}
  page?: number;
  cursor?: string | number;
  pageSize?: number;
  total: number;
  data: IModelT<T>[];
  readonly meta: Record<string, any>;
  filter: DataSourceFilters<T> | null;
  sort: (SortOptions1 | SortOptions2<T>)[] | null;
  readonly loading: boolean;
  loadings: {
    fetching: boolean,
    syncing: boolean,
  };
  setSort(
    field: SortOptions<T>,
    dir?: SortDir
  ): (SortOptions1 | SortOptions2<T>)[] | null;

  setFilters(
    filters:
      | DataSourceFilterItem<T>
      | DataSourceFilterItem<T>[]
      | DataSourceFilters<T>
      | null
  ): DataSourceFilters<T> | null;

  add(model: T | object): IModelT<T>;

  insert(index: number, obj: T | object): IModelT<T>;

  remove(model: string | number | IModel<T>): number;

  get(id: string | number): IModelT<T> | undefined;

  // loading: boolean;
  fetch(forceRequest?: boolean): Promise<IModelT<T>[]>;

  sync(): Promise<void>;

  hasChanges(): boolean;

  cancelChanges(model?: IModel<T>): void;

  toJS(uuid?: boolean): T[];

  removeFilter(field: string, operator?: OperatorKeys): void;

  addFilter(filter: DataSourceFilterItem<T>): void;

  fetchInit(): Promise<IModelT<T>[]>;

  primary: keyof T & string;
}

export type FetchParams<T extends object> = Partial<
  Pick<IDataSource<T>, 'filter' | 'sort' | 'page' | 'pageSize' | 'cursor'>
> & {cursor?: string | number};


export interface ResponseCollection<T extends object = { [k in string]: any }> {
  data: T[];
  total?: number;
  [key: string]: any;
}

export interface ResponseEntity<T extends object = object> {
  data: T;
}

export interface OptionsArg<T extends object = object> {
  modelFactory?: (obj: T, schema?: Schema<T>) => IModel<T>;
  paginator?: false |
      {page?: number, pageSize?: number, type?: 'page'} |
      {cursor?: string | number | null, pageSize?: number, type?: 'cursor'}
  autoSync?: boolean;
}

export interface IModel<T> {
  [x: string]: any;

  set(values: Partial<T>): this;
  set(key: string | keyof T | (string | keyof T)[], value: any): this;
  set(
    key: string | keyof T | (string | keyof T)[] | Partial<T>,
    value?: any
  ): this;

  get(key: string | keyof T): T[keyof T];

  getUuid(): string;

  reset(): this;

  submit(): this;

  toJS(uuid?: boolean): T & { __uuid?: string };

  isNew(): boolean;

  isDirty(): boolean;

  isPropertyDirty(key: keyof T): boolean;

  dirtyFields(): Partial<T>;

  resetProperty(key: keyof T): this;

  observe(listener: Parameters<typeof deepObserve>[1]): IDisposer;
}

export type IDisposer = () => void;

export type IModelT<T> = IModel<T> & T;

export interface IDataProvider<
  T extends Record<string, any> = Record<string, any>
> {
  readonly schema: Schema<T>;

  createDataSource(options?: OptionsArg<T>): IDataSource<T>;
  fetch(params?: FetchParams<T>): Promise<ResponseCollection<T>>;

  get(primary: string | number): Promise<T | void>;
  create(model: Partial<T>): Promise<T>;
  update(primary: T[keyof T], model: Partial<T>): Promise<T>;
  remove(model: Partial<T> | T[keyof T]): Promise<void>;

  /**
   * @deprecated use Resources.create instead.
   */
  sub<T2 extends Record<string, any> = Record<string, any>>(
    id: string | number,
    resource: string
  ): IDataProvider<T2>;
}
