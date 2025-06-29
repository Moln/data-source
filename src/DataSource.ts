import type {
  DataSourceFilterItem,
  DataSourceFilters,
  IDataSource,
  IModelT,
  OperatorKeys,
  SortDir,
  SortOptions,
  SortOptions1,
  SortOptions2,
  ModelFactory,
} from './interfaces';
import {
  action,
  computed,
  intercept,
  makeObservable,
  observable,
  observe,
  runInAction,
} from 'mobx';
import {
  normalizeFilter,
  normalizeSort,
} from './query/Query';
import {Schema} from './schema'
import Model, {createModel} from './Model'
import type {ISchema} from './schema'
import type {IDataProvider} from "./data-providers";
import type {OptionsArg} from "./internal";
import {isArray} from "./utils";
import {commonConfigs} from "./config";


interface Changes<T> {
  added: IModelT<T>[];
  removed: IModelT<T>[];
  updated: IModelT<T>[];
}

export default class DataSource<
  T extends Record<string, any> = Record<string, any>,
  M extends Record<string, any> = Record<string, any>
> implements IDataSource<T, M> {

  private lastFetchProcess?: Promise<IModelT<T>[]>;

  data: IModelT<T>[] = observable.array<IModelT<T>>([]);
  meta: M = {} as M;
  paginator: IDataSource<T>['paginator'];
  total = 0;
  filter: DataSourceFilters<T> | null = null;
  sort: (SortOptions1 | SortOptions2<T>)[] | null = null;

  private changes: Changes<T> = {
    added: [],
    removed: [],
    updated: [],
  };
  private originData: T[] = [];

  private readonly modelFactory: ModelFactory<T>;

  private readonly autoSync: boolean;

  public readonly schema: ISchema

  constructor(
    public readonly dataProvider: IDataProvider<T>,
    options: OptionsArg<T> = {}
  ) {
    const {
      paginator = {},
      modelFactory = createModel as ModelFactory<T>,
      autoSync = false,
      schema = new Schema(),
    } = options;
    const pageSize = commonConfigs.pagination.defaultPageSize

    if (paginator === false) {
      this.paginator = false;
    } else if (paginator.type === 'cursor') {
      this.paginator = {
        type: 'cursor',
        pageSize,
        cursor: null,
        ...paginator,
      };
    } else {
      this.paginator = {
        page: 1,
        pageSize,
        ...(paginator),
        type: 'page',
      }
    }

    this.schema = schema;
    this.modelFactory = modelFactory;
    this.autoSync = autoSync;

    makeObservable(this, {
      data: observable,
      paginator: observable,
      total: observable,
      filter: observable,
      sort: observable,
      loadings: observable,
      meta: observable,

      loading: computed,

      insert: action,
      add: action,
      remove: action,
      cancelChanges: action,
      setSort: action,
      setFilters: action,
      addFilter: action,
      removeFilter: action,
      sync: action,
    });

    // const dataListener: Parameters<typeof observe>[2]  =

    const changes = this.changes;
    const initData = () => {
      intercept(this.data, (change) => {
        if (this.loadings.syncing) return null;
        if (change.type !== 'splice') {
          console.warn('Deny change: ', change);
          return null;
        }
        change.added = change.added.map((obj: T) => {
          const m = this.parse(obj);
          changes.added.push(m);
          return m;
        });
        if (change.removedCount) {
          const changed = change.object
            .slice(change.index, change.index + change.removedCount);

          const removed = changed.filter((item) => !item.isNew())
          const added = changed.filter((item) => item.isNew())
          if (removed.length) {
            changes.removed = changes.removed.concat(removed);
          }
          if (added) {
            added.forEach((item) => {
              const index = changes.added.findIndex(m => m === item);
              if (index >= 0) {
                changes.added.splice(index, 1);
              }
            })
          }
        }
        return change;
      });
      observe(this.data, (change: any) => {
        if (change.type !== 'splice') {
          return;
        }
        if (this.autoSync) {
          this.sync();
        }
      });
    };

    intercept(this, 'data', c => {
      if (c.type !== 'update') {
        throw new Error(`Deny change type "${c.type}".`);
      }
      if (!isArray(c.newValue)) {
        console.warn(c);
        throw new Error('Type error, only object[] type.');
      }

      changes.added = [];
      changes.updated = [];
      changes.removed = [];

      c.newValue = c.newValue.map(this.parse);

      return c;
    });

    initData();
    observe(this, 'data', initData);
  }

  get page() {
    const paginator = this.paginator as false | { page: number };
    return paginator ? paginator.page : undefined;
  }

  get pageSize() {
    const paginator = this.paginator as false | { pageSize: number };
    return paginator ? paginator.pageSize : undefined;
  }

  set page(value: number | undefined) {
    (this.paginator as { page: number }).page = value as number;
  }

  set pageSize(value: number | undefined) {
    (this.paginator as { pageSize: number }).pageSize = value as number;
  }

  get cursor() {
    const paginator = this.paginator as false | { cursor: number };
    return paginator ? paginator.cursor : undefined;
  }

  set cursor(value: string | number | undefined) {
    (this.paginator as any).cursor = value;
  }

  insert(index: number, obj: T | object): IModelT<T> {
    const m = this.parse(obj as T);
    this.data.splice(index, 0, m);
    return m;
  }

  add(obj: T | object): IModelT<T> {
    const size = this.data.push(obj as IModelT<T>);
    return this.data[size - 1];
  }

  loadings = {
    fetching: false,
    syncing: false,
  };

  get loading() {
    return this.loadings.fetching;
  }

  get primary(): keyof T & string {
    return this.schema.primary;
  }

  hasChanges() {
    const { updated, added, removed } = this.changes;
    return Boolean(updated.length || added.length || removed.length);
  }

  cancelChanges(model?: IModelT<T>) {
    const splice = (key: keyof Changes<T>) => {
      const index = this.changes[key].findIndex(m => m === model);
      this.changes[key].splice(index, 1);

      return index;
    };

    if (model) {
      // Added
      if (model.isNew()) {
        const index = this.data.findIndex(m => m === model);
        this.data.splice(index, 1);
        return;
      }

      // Updated
      if (model.isDirty()) {
        model.reset();
        splice('updated');
        return;
      }

      // Removed
      if (splice('removed') !== -1) {
        this.data.push(model);
      }
      return;
    }

    this.data = this.originData as IModelT<T>[];
  }

  async fetchInit(): Promise<IModelT<T>[]> {
    if (!this.lastFetchProcess) {
      this.lastFetchProcess = this.fetch();
    }

    return this.lastFetchProcess;
  }

  async fetch(): Promise<IModelT<T>[]> {
    const call = async () => {
      runInAction(() => {
        this.loadings.fetching = true;
      });
      try {
        const { data, total, ...meta } = await this.dataProvider.fetch(this);

        runInAction(() => {
          if (total !== undefined) {
            this.total = total;
          }

          this.originData = data;
          this.data = data as IModelT<T>[];
          this.loadings.fetching = false;
          this.meta = meta as M;
        });
      } finally {
        runInAction(() => {
          this.loadings.fetching = false;
        });
      }

      return this.data;
    };

    this.lastFetchProcess = call();

    return this.lastFetchProcess;
  }

  remove(model: string | number | IModelT<T>): number {
    let idx: number
    if (typeof model !== 'object') {
      idx = this.data.findIndex(item => item[this.primary] === model);
    } else {
      idx = this.data.findIndex(row => row === model);
    }

    if (idx !== -1) {
      this.data.splice(idx, 1);
    }

    return idx;
  }

  setSort(field: SortOptions<T>, dir?: SortDir) {
    this.sort = normalizeSort(field, dir);
    return this.sort;
  }

  setFilters(
    filters:
      | DataSourceFilterItem<T>
      | DataSourceFilterItem<T>[]
      | DataSourceFilters<T>
      | null
  ) {
    this.filter = normalizeFilter(filters);
    return this.filter;
  }

  addFilter(filter: DataSourceFilterItem<T>) {
    if (!this.filter) {
      this.setFilters(filter);
    } else {
      normalizeFilter(filter);
      const item = this.filter.filters.find(
        item =>
          'field' in item &&
          item.field === filter.field &&
          item.operator === filter.operator
      ) as DataSourceFilterItem<T> | undefined;

      if (!item) {
        this.filter.filters.push(filter);
      } else {
        item.value = filter.value;
      }
    }
  }

  removeFilter(field: string, operator?: OperatorKeys) {
    if (!this.filter) return;
    const idx = this.filter.filters.findIndex(
      item =>
        'field' in item &&
        item.field === field &&
        (!operator || item.operator === operator)
    );

    if (idx !== -1) {
      this.filter?.filters.splice(idx, 1);
    }
  }

  get(id: string | number): IModelT<T> | undefined {
    return this.data.find(item => item[this.primary] === id);
  }

  submit() {
    const changes = this.changes;

    for (const model of changes.added) {
      model.submit();
    }
    for (const model of changes.updated) {
      model.submit();
    }

    this.originData = this.toJS();

    changes.added = [];
    changes.updated = [];
    changes.removed = [];
  }

  async sync() {
    const changes = this.changes;
    const submitModel = (model: IModelT<T>, newModel: T) => {
      Object.entries(newModel).forEach(([key, val]) => {
        model.set(key, val);
      });
      model.submit();
    };

    this.loadings.syncing = true;

    try {
      for (const model of changes.added) {
        const newModel = await this.dataProvider.create(model.toJS());
        submitModel(model, newModel);
      }
      for (const model of changes.updated) {
        const newModel = await this.dataProvider.update(
          model.getKey(),
          model.dirtyFields()
        );
        submitModel(model, newModel);
      }
      for (const model of changes.removed) {
        await this.dataProvider.remove(model.getKey());
      }
    } finally {
      this.loadings.syncing = false;
    }

    this.originData = this.toJS();

    changes.added = [];
    changes.updated = [];
    changes.removed = [];
    return;
  }

  private parse = (obj: T): IModelT<T> => {
    if (obj instanceof Model) {
      return obj as any;
    }

    const m = this.modelFactory(obj, this.schema) as IModelT<T>;

    m.observe(() => {
      if (this.loadings.syncing) return;

      if (m.isNew()) {
        return;
      }

      const idx = this.changes.updated.indexOf(m);
      if (m.isDirty()) {
        if (idx === -1) {
          this.changes.updated.push(m);

          if (this.autoSync) {
            this.sync();
          }
        }
      } else {
        this.changes.updated.splice(idx, 1);
      }
    });

    return m;
  };

  toJS = (uuid?: boolean): T[] => this.data.map(item => item.toJS(uuid));
}
