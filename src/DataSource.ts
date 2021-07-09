import {
  IDataProvider,
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

export class DataSource<T extends Record<string, any> = Record<string, any>>
  implements IDataSource<T> {
  static defaultPageSize = 20;

  private lastFetchProcess?: Promise<IModelT<T>[]>;

  data: IModelT<T>[] = observable.array<IModelT<T>>([]);

  paginator: IDataSource['paginator'] = {
    page: 1,
    pageSize: DataSource.defaultPageSize,
  }
  total = 0;
  filter: DataSourceFilters<T> | null = null;
  sort: (SortOptions1 | SortOptions2<T>)[] | null = null;

  private changes: Changes<T> = {
    added: [],
    removed: [],
    updated: [],
  };
  private originData: T[] = [];

  private modelFactory: Exclude<OptionsArg<T>['modelFactory'], undefined> = createModel

  private autoSync: boolean = false;

  constructor(
    public readonly dataProvider: IDataProvider<T>,
    public readonly schema: Schema<T> = new Schema<T>(DEFAULT_SCHEMA),
    options: OptionsArg<T> = {}
  ) {
    const paginator = options.paginator
    if (paginator !== undefined) {
      this.paginator = paginator && { page: 1, pageSize: DataSource.defaultPageSize, ...paginator };
    }
    if (options.modelFactory) {
      this.modelFactory = options.modelFactory
    }
    this.autoSync = options.autoSync || false

    makeObservable(this, {
      data: observable,
      paginator: observable,
      total: observable,
      filter: observable,
      sort: observable,
      loadings: observable,
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
      intercept(this.data, (change: any) => {
        if (this.loadings.syncing) return;
        if (change.type !== 'splice') {
          console.log('Invalid change', change);
          return;
        }
        change.added = change.added.map((obj: T) => {
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
      observe(this.data, (change: any) => {
        if (change.type !== 'splice') {
          return;
        }
        this.autoSync && this.sync()
      })
    };

    intercept(this, 'data', c => {
      if (c.type !== 'update') {
        throw new Error(`Deny change type "${c.type}".`);
      }
      if (!Array.isArray(c.newValue)) {
        console.warn(c);
        throw new Error('Type error');
      }

      changes.added = [];
      changes.updated = [];
      changes.removed = [];

      // this.bindModels.forEach((disposer) => disposer())
      // this.bindModels.clear();

      c.newValue = c.newValue.map(this.parse);

      return c;
    });

    initData()
    observe(this, 'data', initData);
  }

  get page() {
    const paginator = this.paginator as (false | {page: number})
    return paginator ? paginator.page : undefined
  }

  get pageSize() {
    const paginator = this.paginator as (false | {pageSize: number})
    return paginator ? paginator.pageSize : undefined
  }

  set page(value: number | undefined) {
    (this.paginator as {page: number}).page = value as number
  }

  set pageSize(value: number | undefined) {
    (this.paginator as {pageSize: number}).pageSize = value as number
  }

  get cursor() {
    const paginator = this.paginator as (false | {cursor: number})
    return paginator ? paginator.cursor : undefined
  }

  set cursor(value: string | number | undefined) {
    (this.paginator as any).cursor = value
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

  hasChanges() {
    const {updated, added, removed} = this.changes
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
          this.loadings.fetching = false;
        });
      } catch (e) {
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
    if (typeof model !== 'object') {
      const item = this.get(model)
      if (! item) {
        return -1
      }
      model = item;
    }

    const i = this.data.findIndex(row => row === model);
    if (model.isNew()) {
      this.cancelChanges(model);
      return i;
    }

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

  get(id: string | number): IModelT<T> | undefined {
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

    // changes.removed.forEach(item => this.bindModels.delete(item))
    changes.added = [];
    changes.updated = [];
    changes.removed = [];
    return;
  }

  // private bindModels: Map<IModelT<T>, IDisposer> = new Map();

  private parse = (obj: T): IModelT<T> => {
    if (obj instanceof Model) {
      return obj as any;
    }

    const m = this.modelFactory(obj, this.schema);

    m.observe(change => {
      if (this.loadings.syncing) return;

      if (m.isNew()) {
        return ;
      }

      const idx = this.changes.updated.indexOf(m);
      if (m.isDirty()) {
        if (idx === -1) {
          this.changes.updated.push(m);

          this.autoSync && this.sync()
        }
      } else {
        this.changes.updated.splice(idx, 1);
      }
    });

    // const m = obj instanceof Model ? obj : createModel<T>(obj, this.schema);
    //
    // if (! this.bindModels.has(m)) {
    //   const disposer = m.observe(() => {
    //     if (this.loadings.syncing) return;
    //
    //     const idx = this.changes.updated.indexOf(m);
    //     if (m.isDirty()) {
    //       if (idx === -1) {
    //         this.changes.updated.push(m);
    //       }
    //     } else {
    //       this.changes.updated.splice(idx, 1);
    //     }
    //   });
    //
    //   this.bindModels.set(m, disposer);
    // }

    return m;
  };

  toJS = (uuid?: boolean): T[] => this.data.map(item => item.toJS(uuid));
}
