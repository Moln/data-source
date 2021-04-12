import { DataSourceFilters, OperatorKeys } from './interfaces';

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
};

export function normalizeOperator<T>(expression: DataSourceFilters<T>) {
  expression.filters.forEach(filter => {
    if ('field' in filter) {
      const operator = (filter.operator as OperatorKeys) || '==';
      filter.operator = (OPERATOR_MAP as any)[operator] || operator;
    } else {
      normalizeOperator<T>(filter);
    }
  });
}

const dateRegExp = /^\/Date\((.*?)\)\/$/;
function quote(str: any): string {
  if (typeof str === 'string') {
    str = str.replace(/[\r\n]+/g, '');
  }
  return JSON.stringify(str);
}

function textOp(impl: (a: string, b: string, ignore: boolean) => any) {
  return function(
    a: string,
    b: string,
    ignore: boolean,
    accentFoldingFiltering: string | string[]
  ) {
    b += '';
    if (ignore) {
      a =
        '(' +
        a +
        " + '').toString()" +
        (accentFoldingFiltering
          ? ".toLocaleLowerCase('" + accentFoldingFiltering + "')"
          : '.toLowerCase()');
      b = accentFoldingFiltering
        ? b.toLocaleLowerCase(accentFoldingFiltering)
        : b.toLowerCase();
    }
    return impl(a, quote(b), ignore);
  };
}

function operator(
  op: string,
  a: any,
  b: any,
  ignore: boolean,
  accentFoldingFiltering?: string | string[]
): string {
  if (b != null) {
    if (typeof b === 'string') {
      const date = dateRegExp.exec(b);
      if (date) {
        b = new Date(+date[1]);
      } else if (ignore) {
        b = quote(
          accentFoldingFiltering
            ? b.toLocaleLowerCase(accentFoldingFiltering)
            : b.toLowerCase()
        );
        a =
          '((' +
          a +
          " || '')+'')" +
          (accentFoldingFiltering
            ? ".toLocaleLowerCase('" + accentFoldingFiltering + "')"
            : '.toLowerCase()');
      } else {
        b = quote(b);
      }
    }

    if (b.getTime) {
      // b looks like a Date
      a = '(' + a + '&&' + a + '.getTime?' + a + '.getTime():' + a + ')';
      b = b.getTime();
    }
  }

  return a + ' ' + op + ' ' + b;
}

function getMatchRegexp(pattern: string) {
  // take a pattern, as supported by Excel match filter, and
  // convert it to the equivalent JS regular expression.
  // Excel patterns support:
  //
  //   * - match any sequence of characters
  //   ? - match a single character
  //
  // to match a literal * or ?, they must be prefixed by a tilde (~)
  let rx = '/^';
  let esc = false;
  for (let i = 0; i < pattern.length; ++i) {
    const ch = pattern.charAt(i);
    if (esc) {
      rx += '\\' + ch;
    } else if (ch === '~') {
      esc = true;
      continue;
    } else if (ch === '*') {
      rx += '.*';
    } else if (ch === '?') {
      rx += '.';
    } else if ('.+^$()[]{}|\\/\n\r\u2028\u2029\xA0'.indexOf(ch) >= 0) {
      rx += '\\' + ch;
    } else {
      rx += ch;
    }
    esc = false;
  }
  return rx + '$/';
}

export const operators = {
  quote(value: any) {
    if (value && value.getTime) {
      return 'new Date(' + value.getTime() + ')';
    }
    return quote(value);
  },
  eq(
    a: any,
    b: any,
    ignore: boolean,
    accentFoldingFiltering: string | string[]
  ) {
    return operator('==', a, b, ignore, accentFoldingFiltering);
  },
  neq(
    a: any,
    b: any,
    ignore: boolean,
    accentFoldingFiltering: string | string[]
  ) {
    return operator('!=', a, b, ignore, accentFoldingFiltering);
  },
  gt(a: any, b: any, ignore: boolean) {
    return operator('>', a, b, ignore);
  },
  gte(a: any, b: any, ignore: boolean) {
    return operator('>=', a, b, ignore);
  },
  lt(a: any, b: any, ignore: boolean) {
    return operator('<', a, b, ignore);
  },
  lte(a: any, b: any, ignore: boolean) {
    return operator('<=', a, b, ignore);
  },
  startswith: textOp(function(a, b) {
    return a + '.lastIndexOf(' + b + ', 0) == 0';
  }),
  doesnotstartwith: textOp(function(a, b) {
    return a + '.lastIndexOf(' + b + ', 0) == -1';
  }),
  endswith: textOp(function(a, b) {
    const n = b ? b.length - 2 : 0;
    return a + '.indexOf(' + b + ', ' + a + '.length - ' + n + ') >= 0';
  }),
  doesnotendwith: textOp(function(a, b) {
    const n = b ? b.length - 2 : 0;
    return a + '.indexOf(' + b + ', ' + a + '.length - ' + n + ') < 0';
  }),
  contains: textOp(function(a, b) {
    return a + '.indexOf(' + b + ') >= 0';
  }),
  doesnotcontain: textOp(function(a, b) {
    return a + '.indexOf(' + b + ') == -1';
  }),
  matches: textOp(function(a, b) {
    b = b.substring(1, b.length - 1);
    return getMatchRegexp(b) + '.test(' + a + ')';
  }),
  doesnotmatch: textOp(function(a, b) {
    b = b.substring(1, b.length - 1);
    return '!' + getMatchRegexp(b) + '.test(' + a + ')';
  }),
  isempty(a: string) {
    return a + " === ''";
  },
  isnotempty(a: string) {
    return a + " !== ''";
  },
  isnull(a: string) {
    return '(' + a + ' == null)';
  },
  isnotnull(a: string) {
    return '(' + a + ' != null)';
  },
  isnullorempty(a: string) {
    return '(' + a + ' === null) || (' + a + " === '')";
  },
  isnotnullorempty(a: string) {
    return '(' + a + ' !== null) && (' + a + " !== '')";
  },
};
