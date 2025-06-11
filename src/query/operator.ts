import type { DataSourceFilters, OperatorKeys } from '../interfaces';
import {isArray} from "../utils";
import {toScalar} from "./utils";
import type {ScalarOptions} from "./interfaces";

export const OPERATOR_MAP = {
  '==': 'eq',
  equals: 'eq',
  isequalto: 'eq',
  equalto: 'eq',
  equal: 'eq',
  '!=': 'neq',
  ne: 'neq',
  notequals: 'neq',
  isnotequalto: 'neq',
  notequalto: 'neq',
  notequal: 'neq',
  '<': 'lt',
  islessthan: 'lt',
  lessthan: 'lt',
  less: 'lt',
  '<=': 'lte',
  le: 'lte',
  islessthanorequalto: 'lte',
  lessthanequal: 'lte',
  '>': 'gt',
  isgreaterthan: 'gt',
  greaterthan: 'gt',
  greater: 'gt',
  '>=': 'gte',
  isgreaterthanorequalto: 'gte',
  greaterthanequal: 'gte',
  ge: 'gte',
  notsubstringof: 'doesnotcontain',
  isnull: 'isnull',
  isempty: 'isempty',
  isnotempty: 'isnotempty',
} as Record<OperatorKeys, OperatorKeys>;

export function normalizeOperator<T>(expression: DataSourceFilters<T>) {
  expression.filters.forEach(filter => {
    if ('field' in filter) {
      const operator = filter.operator || '==';
      filter.operator = OPERATOR_MAP[operator] || operator;
    } else {
      normalizeOperator<T>(filter);
    }
  });
}

type OperatorExprFn = (
  left: any,
  right: any,
  options: ScalarOptions,
) => boolean;


export const operators: Record<OperatorKeys | string, OperatorExprFn> = {
  eq(a, b, options) {
    return toScalar(a, options) == toScalar(b, options)
  },
  neq(a, b, options) {
    return toScalar(a, options) != toScalar(b, options)
  },
  gt(a, b, options) {
    return toScalar(a, options) > toScalar(b, options)
  },
  gte(a, b, options) {
    return toScalar(a, options) >= toScalar(b, options)
  },
  lt(a, b, options) {
    return toScalar(a, options) < toScalar(b, options)
  },
  lte(a, b, options) {
    return toScalar(a, options) <= toScalar(b, options)
  },
  startswith(a, b, options) {
    return toScalar(a, options).startsWith(toScalar(b, options))
  },
  doesnotstartwith(a, b, options) {
    return !operators.startswith(a, b, options)
  },
  endswith(a, b, options) {
    return toScalar(a, options).endsWith(toScalar(b, options))
  },
  doesnotendwith(a, b, options) {
    return !operators.endswith(a, b, options)
  },
  contains(a, b, options) {
    return toScalar(a, options).indexOf(toScalar(b, options)) >= 0
  },
  doesnotcontain(a, b, options) {
    return toScalar(a, options).indexOf(toScalar(b, options)) < 0
  },
  matches(a, b) {
    b = b.substring(1, b.length - 1);
    const bRegex = new RegExp(b)
    return bRegex.test(a)
  },
  doesnotmatch(a, b, options) {
    return ! operators.matches(a, b, options)
  },
  in(a: any, b: any[]) {
    b = isArray(b) ? b : [b]
    return b.includes(a)
  },
  isempty(a: string) {
    return a === '';
  },
  isnotempty(a: string) {
    return a !== '';
  },
  isnull(a: string) {
    return a === null;
  },
  isnotnull(a: string) {
    return a !== null;
  },
  isnullorempty(a: string) {
    return a === null || a === '';
  },
  isnotnullorempty(a: string) {
    return a !== null && a !== '';
  },
};
