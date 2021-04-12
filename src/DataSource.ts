import {
  DataProvider,
  DataSourceFilterItem,
  DataSourceFilters,
  IDataSource,
  IModelT,
  OperatorKeys,
  OptionsArg,
  SortDir,
  SortOptions,
  SortOptions1,
  SortOptions2,
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
  createModel,
  DEFAULT_SCHEMA,
  Model,
  normalizeFilter,
  normalizeSort,
  Schema,
} from './';

// todo
// 1. option autoAsync
// 2. endless
// 3. pageable

interface Changes<T> {
  added: IModelT<T>[];
  removed: IModelT<T>[];
  updated: IModelT<T>[];
}

export class DataSource<T extends object = object> implements IDataSource<T> {
  static defaultPageSize = 20;

  private lastFetchProcess?: Promise<IModelT<T>[]>;

  data: IModelT<T>[] = observable.array<IModelT<T>>([]);

  page = 1;
  pageSize = DataSource.defaultPageSize;
  total = 0;
  filter: DataSourceFilters<T> | null = null;
  sort: (SortOptions1 | SortOptions2<T>)[] = [];

  private changes: Changes<T> = {
    added: [],
    removed: [],
    updated: [],
  };
  private originData: T[] = [];

  constructor(
    public readonly dataProvider: DataProvider<T>,
    public readonly schema: Schema<T> = new Schema<T>(DEFAULT_SCHEMA),
    options: OptionsArg<T> = {}
  ) {
    if (options.pageSize) {
      this.pageSize = options.pageSize;
    }
    if (options.page) {
      this.page = options.page;
    }

    makeObservable(this, {
      data: observable,
      page: observable,
      pageSize: observable,
      total: observable,
      filter: observable,
      sort: observable,
      loadings: observable,

      loading: computed,

      insert: action,
      add: action,
      remove: action,
      fetch: action,
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
      intercept<IModelT<T>>(this.data as any, (change: any) => {
        if (this.loadings.syncing) return;
        if (change.type !== 'splice') {
          console.log('Invalid change', change);
          return;
        }
        change.added = change.added.map((obj: IModelT<T>) => {
          const m = this.parse(obj);
          changes.added.push(m);
          return m;
        });
        if (change.removedCount) {
          const removed = change.object
            .slice(change.index, change.index + change.removedCount)
            .filter((item: IModelT<T>) => !item.isNew());

          changes.removed = changes.removed.concat(removed);
        }
        return change;
      });
    };

    intercept(this, 'data', c => {
      if (c.type !== 'update') {
        throw new Error(`Deny change type "${c.type}".`);
      }
      if (!Array.isArray(c.newValue)) {
        console.warn(c);
        throw new Error('Type error');
      }

      c.newValue = c.newValue.map(this.parse);

      return c;
    });
    observe(this, 'data', initData);
    // const data = (this.data as IObservableArray<IModelT<T>>);

    // data.observe((change) => {
    //     if (change.type == 'update') {
    //         return ;
    //     }
    //     change.added.forEach((item) => {
    //         observe(item, (change) => {
    //             this.changes.updates.push(item);
    //         })
    //     });
    //
    //     this.changes.splices.push(change as IArraySplice<IModel<T>>);
    // })

    // intercept(data, (c) => {
    //     if (c.type === "update") {
    //         throw new Error("Deny update array items.");
    //     }
    //
    //     return c;
    // });
  }

  insert(index: number, obj: T | object): IModelT<T> {
    const m = this.parse(obj as T);
    this.data.splice(index, 0, m);
    return m;
  }

  add(obj: T | object): IModelT<T> {
    const m = this.parse(obj as T);
    this.data.push(m);
    return m;
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

        splice('added');
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

    this.data = this.originData.slice() as IModelT<T>[];

    const changes = this.changes;
    changes.updated.forEach(updateModel => {
      updateModel.reset();
    });
    changes.added = [];
    changes.updated = [];
    changes.removed = [];
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
        const result = await this.dataProvider.fetch(this);

        runInAction(() => {
          if (result.total !== undefined) {
            this.total = result.total;
          }

          this.originData = result.data;
          this.data = result.data.map(item => this.parse(item));
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

  remove(model: IModelT<T>): number {
    if (model.isNew()) {
      this.cancelChanges(model);
      return -1;
    }

    const i = this.data.findIndex(row => row === model);
    if (i !== -1) {
      this.data.splice(i, 1);
    }

    return i;
  }

  setSort(
    field: SortOptions<T>,
    dir?: SortDir
  ): (SortOptions1 | SortOptions2<T>)[] {
    this.sort = normalizeSort(field, dir);
    return this.sort;
  }

  setFilters(
    filters:
      | DataSourceFilterItem<T>
      | DataSourceFilterItem<T>[]
      | DataSourceFilters<T>
      | null
  ): DataSourceFilters<T> | null {
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

  get(id: T[keyof T]): IModelT<T> | undefined {
    return this.data.find(item => item[this.primary] === id);
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
        const newModel = await this.dataProvider.create(model);
        submitModel(model, newModel);
      }
      for (const model of changes.updated) {
        const newModel = await this.dataProvider.update(
          model[this.primary],
          model.dirtyFields()
        );
        submitModel(model, newModel);
      }
      for (const model of changes.removed) {
        await this.dataProvider.remove(model);
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
      return obj;
    }

    const m = createModel<T>(obj, this.schema);

    m.observe(change => {
      if (this.loadings.syncing) return;

      const idx = this.changes.updated.indexOf(m);
      if (m.isDirty()) {
        if (idx === -1) {
          this.changes.updated.push(m);
        }
      } else {
        this.changes.updated.splice(idx, 1);
      }
    });

    return m;
  };

  toJS = (uuid?: boolean): T[] => this.data.map(item => item.toJS(uuid));
}
