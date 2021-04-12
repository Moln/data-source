import { DataSourceFilterItem, DataSourceFilters } from './interfaces';

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

// Core

function wrapExpression(members: string[], paramName: string): string {
  let result = paramName || 'd';
  let count = 1;

  for (let idx = 0, length = members.length; idx < length; idx++) {
    let member = members[idx];
    if (member !== '') {
      const index = member.indexOf('[');

      if (index !== 0) {
        if (index === -1) {
          member = '.' + member;
        } else {
          count++;
          member =
            '.' +
            member.substring(0, index) +
            ' || {})' +
            member.substring(index);
        }
      }

      count++;
      result += member + (idx < length - 1 ? ' || {})' : ')');
    }
  }
  return new Array(count).join('(') + result;
}
export function expr(expression: string, paramName?: string): string;
export function expr(
  expression: string,
  safe?: string | boolean,
  paramName?: string
): string {
  if (typeof safe === 'string') {
    paramName = safe;
    safe = false;
  }

  paramName = paramName || 'd';

  if (expression && expression.charAt(0) !== '[') {
    expression = '.' + expression;
  }

  if (safe) {
    expression = expression.replace(/"([^.]*)\.([^"]*)"/g, '"$1_$DOT$_$2"');
    expression = expression.replace(/'([^.]*)\.([^']*)'/g, "'$1_$DOT$_$2'");
    expression = wrapExpression(expression.split('.'), paramName);
    expression = expression.replace(/_\$DOT\$_/g, '.');
  } else {
    expression = paramName + expression;
  }

  return expression;
}

interface AccessorCache {
  [key: string]: Function;
}

const getterCache: AccessorCache = {};
const setterCache: AccessorCache = {};

export function getter<T>(
  expression: keyof T | string,
  paramName?: string
): (data: T) => any {
  const key = expression + (paramName || '');
  return (getterCache[key] =
    getterCache[key] ||
    new Function('d', 'return ' + expr(expression as string, paramName))) as (
    data: T
  ) => any;
}

export function setter<T>(
  expression: keyof T | string
): (data: T, value: any) => void {
  return (setterCache[expression as string] =
    setterCache[expression as string] ||
    new Function('d,value', expr(expression as string) + '=value')) as (
    data: T,
    value: any
  ) => void;
}

export function accessor<T>(expression: keyof T | string) {
  return {
    get: getter<T>(expression),
    set: setter<T>(expression),
  };
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
    random,
    chars = 'abcdef';

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
