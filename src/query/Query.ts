import type {
  CompareFn,
  DataSourceFilterItem,
  DataSourceFilters,
  SortDir,
  SortOptions,
  SortOptions1,
  SortOptions2,
} from '../interfaces';
import type {
  FieldType,
} from '../internal';

import {accessor, isArray, isDate, isFunction, isNumber} from '../utils';
import {normalizeOperator, operators} from './operator';
import {toScalar} from "./utils";
import type {
  AggregateMethods,
  AggregateReturn,
  DataSourceGroupItem,
  DataSourceGroupItemAggregate,
  GroupItem,
  GroupItem2
} from "./interfaces";

const Comparer = {
  selector<T>(field: FieldType<T>): (data: T) => string {
    if (isFunction(field)) {
      return field
    }
    if (!isArray(field)) {
      field = String(field).split('.')
    }

    return (data) => accessor.get(data, field as string[])
  },

  compare<T>(field: FieldType<T>): CompareFn {
    const selector = this.selector(field);
    return (a: any, b: any) => {
      a = selector(a);
      b = selector(b);

      if (a == null && b == null) {
        return 0;
      }

      if (a == null) {
        return -1;
      }

      if (b == null) {
        return 1;
      }

      if (a.localeCompare) {
        return a.localeCompare(b);
      }

      return a > b ? 1 : a < b ? -1 : 0;
    };
  },

  create<T>(sort: SortOptions1 | SortOptions2<T>): CompareFn {
    const compare = (sort as SortOptions1).compare || this.compare((sort as SortOptions2<T>).field);

    if (sort.dir === 'desc') {
      return (a, b) => {
        return compare(b, a, true);
      };
    }

    return compare;
  },

  combine(comparers: CompareFn[]): CompareFn {
    return (a, b) => {
      let result = comparers[0](a, b);
      const length = comparers.length;

      for (let idx = 1; idx < length; idx++) {
        result = result || comparers[idx](a, b);
      }

      return result;
    };
  },
};

export default class Query<T extends object> {
  constructor(private data: T[]) {}

  toArray(): T[] {
    return this.data;
  }

  range(index: number, count: number): Query<T> {
    return new Query(this.data.slice(index, index + count));
  }

  skip(count: number): Query<T> {
    return new Query(this.data.slice(count));
  }

  take(count: number): Query<T> {
    return new Query(this.data.slice(0, count));
  }

  select<U extends object>(selector: (value: T, index: number, array: T[]) => U) {
    return new Query(this.data.map(selector));
  }

  order(selector: SortOptions<T>, dir: SortDir = 'asc', inPlace?: boolean) {
    const descriptors = normalizeSort(selector, dir)!;
    const comparers: CompareFn[] = [];

    descriptors.forEach(descriptor => {
      comparers.push(Comparer.create(descriptor));
    });

    const comparer = Comparer.combine(comparers);

    if (inPlace) {
      return new Query(this.data.sort(comparer));
    }

    return new Query(this.data.slice(0).sort(comparer));
  }

  orderBy(field: SortOptions<T>, inPlace?: boolean) {
    return this.order(field, 'asc', inPlace);
  }

  orderByDescending(field: SortOptions<T>, inPlace?: boolean) {
    return this.order(field, 'desc', inPlace);
  }

  filter(
    expressions:
      | DataSourceFilterItem<T>
      | DataSourceFilterItem<T>[]
      | DataSourceFilters<T>
      | null
  ) {
    expressions = normalizeFilter(expressions);

    if (!expressions || expressions.filters.length === 0) {
      return this;
    }

    return new Query(this.data.filter(filterExpr(expressions)));
  }

  group(descriptors: string | DataSourceGroupItem<T>): Query<GroupItem2<T>>;
  group(
      descriptors: DataSourceGroupItem<T>[],
      allData?: T[]
  ): Query<GroupItem<T>>;
  group(
      descriptors: string | DataSourceGroupItem<T> | DataSourceGroupItem<T>[],
      allData?: T[]
  ): Query<GroupItem<T>> {
    descriptors = normalizeGroup(descriptors || []);
    allData = allData || this.data;

    const dLen = descriptors.length;
    if (!dLen) {
      throw new Error('Empty descriptors');
    }

    const descriptor = descriptors[0];
    return this.groupBy(descriptor).select(group => {
      const data = new Query(allData as T[]).filter([
        {
          field: group.field,
          operator: 'eq',
          value: group.value,
          ignoreCase: false,
        },
      ]);
      return {
        field: group.field,
        value: group.value,
        items:
            dLen > 1
                ? new Query(group.items)
                    .group(
                        (descriptors as DataSourceGroupItem<T>[]).slice(1),
                        data.toArray()
                    )
                    .toArray()
                : group.items,
        hasSubgroups: dLen > 1,
        aggregates: descriptor.aggregates
            ? data.aggregate(descriptor.aggregates)
            : {},
      } as GroupItem<T>;
    });
  }


  groupBy(descriptor: string | DataSourceGroupItem<T>): Query<GroupItem2<T>> {
    descriptor = normalizeGroup(descriptor)[0];
    if (!this.data.length) {
      return new Query([]);
    }

    const field = descriptor.field;
    const sorted = descriptor.skipItemSorting
      ? this.data
      : this.order(field, descriptor.dir).toArray();
    const keys = field.split('.')

    const result: Record<string, GroupItem2<T>> = {};

    sorted.forEach(item => {
      const value = accessor.get(item, keys);
      const key = toScalar(value)
      if (! result[key]) {
        result[key] = {
          field,
          value,
          items: [],
        }
      }
      result[key].items.push(item);
    });

    return new Query(Object.values(result));
  }

  aggregate(aggregates: DataSourceGroupItemAggregate<T>[]): AggregateReturn<T> {
    const len = this.data.length;
    const result = {} as AggregateReturn<T>;
    const state = {} as AggregateReturn<T>;

    this.data.forEach((item, idx) => {
      calculateAggregate(result, aggregates, item, idx, len, state);
    });

    return result as AggregateReturn<T>;
  }
}

export function normalizeFilter<T>(
  expression:
    | DataSourceFilterItem<T>
    | DataSourceFilterItem<T>[]
    | DataSourceFilters<T>
    | null
): DataSourceFilters<T> | null {
  if (!expression) {
    return null;
  }
  if ('logic' in expression) {
    // pass
  } else if ('field' in expression) {
    expression = { logic: 'and', filters: [expression] };
  } else if (isArray(expression)) {
    expression = { logic: 'and', filters: expression };
  }

  normalizeOperator(expression);

  return expression;
}

function filterExpr<T>(expression: DataSourceFilters<T>) {
  const {filters, logic} = expression;

  return (row: T) => {
    const method = logic === "and" ? "every" : "some"
    return filters[method]((filter) => {
      if ('filters' in filter) {
        return filterExpr(filter)
      } else {
        return operators[filter.operator!](accessor.get(row, filter.field.split('.')), filter.value, filter)
      }
    })
  }
}

export function normalizeSort<T>(
  field: SortOptions<T>,
  dir: SortDir = 'asc'
): (SortOptions1 | SortOptions2<T>)[] | null {
  if (isArray(field)) {
    return field;
  } else if (field === null) {
    return null;
  } else if (typeof field === 'string') {
    return [{ field, dir }];
  } else {
    field.dir = field.dir || dir;
    return [field];
  }
}


function normalizeGroup<T>(
  field: string | DataSourceGroupItem<T> | DataSourceGroupItem<T>[],
  dir: SortDir = 'asc',
  compare?: CompareFn,
  skipItemSorting?: boolean
): DataSourceGroupItem<T>[] {
  const descriptors: DataSourceGroupItem<T>[] = [];

  if (typeof field === 'string') {
    descriptors.push({ field, dir, compare, skipItemSorting });
  } else if (!isArray(field)) {
    descriptors.push(field);
  } else {
    return field;
  }

  return descriptors;
}

function calculateAggregate<T extends object>(
  accumulator: AggregateReturn<T>,
  aggregates: DataSourceGroupItemAggregate<T>[],
  item: T,
  index: number,
  length: number,
  state: AggregateReturn<T>
) {
  aggregates.forEach(aggr => {
    const functionName = aggr.aggregate;
    const field = aggr.field;
    accumulator[field] = accumulator[field] || {};
    state[field] = state[field] || {};
    state[field][functionName] = state[field][functionName] || {};
    accumulator[field][functionName] = functions[functionName](
      accumulator[field][functionName],
      item,
      accessor.get(item, field.split(".")),
      index,
      length,
      state[field][functionName]
    );
  });
}

type AggregateFn = (
  accumulator: any | undefined,
  item: object,
  value: any,
  index: number,
  length: number,
  state: { [x: string]: any }
) => number;

const functions: { [key in AggregateMethods]: AggregateFn } = {
  sum(accumulator, _, value): number {

    if (!isNumber(accumulator)) {
      accumulator = value;
    } else if (isNumber(value)) {
      accumulator += value;
    }

    return accumulator;
  },
  count(accumulator) {
    return (accumulator || 0) + 1;
  },
  average(accumulator, _, value, index, length, state): number {
    if (state.count === undefined) {
      state.count = 0;
    }

    if (!isNumber(accumulator)) {
      accumulator = value;
    } else if (isNumber(value)) {
      accumulator += value;
    }

    if (isNumber(value)) {
      state.count++;
    }

    if (index === length - 1 && isNumber(accumulator)) {
      accumulator = accumulator / state.count;
    }
    return accumulator;
  },
  max(accumulator, _, value) {
    if (!isNumber(accumulator) && !isDate(accumulator)) {
      accumulator = value;
    }

    if (accumulator < value && (isNumber(value) || isDate(value))) {
      accumulator = value;
    }
    return accumulator;
  },
  min(accumulator, _, value) {
    if (!isNumber(accumulator) && !isDate(accumulator)) {
      accumulator = value;
    }

    if (accumulator > value && (isNumber(value) || isDate(value))) {
      accumulator = value;
    }
    return accumulator;
  },
};
