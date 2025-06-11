import type { DataSourceFilterItem, DataSourceFilters } from './interfaces';

export function isFunction(func: any): func is Function {
  return 'function' == typeof func;
}

export function isNumber(val: any): val is number {
  return typeof val === 'number' && !isNaN(val);
}

export function isDate(val: any): val is Date {
  return val && val.getTime;
}

export const isArray = Array.isArray;

export function isEmptyObject(obj: object): boolean {
  for (const _ in obj) {
    return false;
  }

  return true;
}

export const accessor = {
  get: (obj: any, keys: (string | number)[]): any => {
    let target = obj
    for (const key of keys) {
      if (target === undefined || target === null) {
        return undefined
      }
      target = target[key]
    }

    return target
  },
  set: (obj: Record<string, any>, keys: string[], value: any) => {
    if (! keys.length) {
      return ;
    }
    const lastKey = keys[keys.length - 1]
    const parent = accessor.get(obj, keys.slice(0, -1))!
    parent[lastKey] = value
  },
}

export function toFilter<T extends object>(
  params: { [key in keyof T]: any }
): DataSourceFilters<T> {
  const filters: DataSourceFilterItem<T>[] = [];

  Object.entries(params).forEach(([field, value]) => {
    return filters.push({ field, value });
  });

  return { filters };
}

export function guid() {
  let id = '',
    random;
  const chars = 'abcdef';

  id += chars[Math.floor(Math.random() * Math.floor(chars.length))];

  for (let i = 1; i < 32; i++) {
    random = (Math.random() * 16) | 0;

    if (i === 8 || i === 12 || i === 16 || i === 20) {
      id += '-';
    }
    id += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(16);
  }

  return id;
}
