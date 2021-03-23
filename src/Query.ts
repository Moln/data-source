import {
    AggregateMethods,
    AggregateReturn,
    CompareFn,
    DataSourceFilterItem,
    DataSourceFilters,
    DataSourceGroupItem,
    DataSourceGroupItemAggregate,
    FieldType,
    GroupItem,
    GroupItem2,
    SortDir,
    SortOptions,
    SortOptions1,
    SortOptions2
} from "./interfaces";
import * as utils from "./utils";
import {expr, getter, isArray, isDate, isFunction, isNumber} from "./utils";
import {normalizeOperator, operators} from "./operator";

const Comparer = {
    selector<T>(field: FieldType<T>): (data: T) => string {
        return isFunction(field) ? field : getter(field);
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

            return a > b ? 1 : (a < b ? -1 : 0);
        };
    },

    create<T>(sort: SortOptions1 | SortOptions2<T>): CompareFn {
        const compare = (sort as SortOptions1).compare || this.compare((sort as SortOptions2<T>).field);

        if (sort.dir === "desc") {
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

            for (let idx = 1; idx < length; idx ++) {
                result = result || comparers[idx](a, b);
            }

            return result;
        };
    }
};


export default class Query<T extends Object> {
    constructor(private data: T[]) {
    }

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

    select<U>(selector: (value: T, index: number, array: T[]) => U) {
        return new Query(this.data.map(selector));
    }

    order(selector: SortOptions<T>, dir: SortDir = 'asc', inPlace?: boolean) {
        const descriptors = normalizeSort(selector, dir);
        const comparers: CompareFn[] = [];

        descriptors.forEach((descriptor) => {
            comparers.push(Comparer.create(descriptor));
        });

        const comparer = Comparer.combine(comparers);

        if (inPlace) {
            return new Query(this.data.sort(comparer));
        }

        return new Query(this.data.slice(0).sort(comparer));
    }

    orderBy(field: SortOptions<T>, inPlace?: boolean) {
        return this.order(field, "asc", inPlace);
    }

    orderByDescending(field: SortOptions<T>, inPlace?: boolean) {
        return this.order(field, "desc", inPlace);
    }

    // sort(field: SortOptions, dir?: SortDir, comparer: typeof Comparer = Comparer, inPlace?: boolean) {
    //     const descriptors = normalizeSort(field, dir),
    //         comparers: CompareFn[] = [];
    //
    //     descriptors.forEach((descriptors) => {
    //         comparers.push(comparer.create(descriptors));
    //     });
    //
    //     if (descriptors.length) {
    //         return this.orderBy({ compare: comparer.combine(comparers) }, inPlace);
    //     }
    //
    //     return this;
    // }

    filter(expressions: DataSourceFilterItem<T> | DataSourceFilterItem<T>[] | DataSourceFilters<T> | null) {

        expressions = normalizeFilter(expressions);

        if (!expressions || expressions.filters.length === 0) {
            return this;
        }

        const compiled = filterExpr(expressions);
        const fields = compiled.fields;
        const operators = compiled.operators;

        const predicate = new Function("d, __f, __o", "return " + compiled.expression) as (...a: any) => boolean;
        let filter = predicate;

        if (fields.length || operators.length) {
            filter = function(d: any) {
                return predicate(d, fields, operators);
            };
        }

        return new Query(this.data.filter(filter));
    }
    group(descriptors: string | DataSourceGroupItem<T>): Query<GroupItem2<T>>;
    group(descriptors: DataSourceGroupItem<T>[], allData?: T[]): Query<GroupItem<T>>;
    group(descriptors: string | DataSourceGroupItem<T> | DataSourceGroupItem<T>[], allData?: T[]): Query<GroupItem<T>> {
        descriptors = normalizeGroup(descriptors || []);
        allData = allData || this.data;

        const dLen = descriptors.length;
        if (!dLen) {
            throw new Error('Empty descriptors');
        }

        const descriptor = descriptors[0];
        return this.groupBy(descriptor).select((group) => {
            const data = new Query(allData as T[]).filter([ { field: group.field, operator: "eq", value: group.value, ignoreCase: false } ]);
            return {
                field: group.field,
                value: group.value,
                items: dLen > 1
                    ? new Query(group.items).group((descriptors as DataSourceGroupItem<T>[]).slice(1), data.toArray()).toArray()
                    : group.items,
                hasSubgroups: dLen > 1,
                aggregates: descriptor.aggregates ? data.aggregate(descriptor.aggregates) : {}
            } as GroupItem<T>;
        });
    }

    groupBy(descriptor: string | DataSourceGroupItem<T>): Query<GroupItem2<T>> {
        descriptor = normalizeGroup(descriptor)[0];
        if (!this.data.length) {
            return new Query([]);
        }

        const field = descriptor.field;
        const sorted = descriptor.skipItemSorting ? this.data : this.order(field, descriptor.dir).toArray();
        const accessor = utils.accessor(field);
        let currentValue;
        let groupValue = accessor.get(sorted[0]);
        let group: GroupItem2<T> = {
                field,
                value: groupValue,
                items: []
            };

        const result = [group];

        sorted.forEach((item) => {
            currentValue = accessor.get(item);
            if(!groupValueComparer(groupValue, currentValue)) {
                groupValue = currentValue;
                group = {
                    field,
                    value: groupValue,
                    items: []
                };
                result.push(group);
            }
            group.items.push(item);
        });

        if (isFunction(descriptor.compare)) {
            return new Query(result).order({ compare: descriptor.compare }, descriptor.dir);
        }

        return new Query(result);
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

export function normalizeFilter<T>(expression: DataSourceFilterItem<T> | DataSourceFilterItem<T>[] | DataSourceFilters<T> | null): DataSourceFilters<T> | null {

    if (! expression) {
        return null;
    }
    if ('logic' in expression) {
        // pass
    } else if ('field' in expression) {
        expression = {logic: "and", filters: [expression]};
    } else if (isArray(expression)) {
        expression = {logic: "and", filters: expression};
    }

    normalizeOperator(expression);

    return expression;
}

export function compareFilters<T>(
    expr1: DataSourceFilterItem<T> | DataSourceFilterItem<T>[] | DataSourceFilters<T> | null,
    expr2:  DataSourceFilterItem<T> | DataSourceFilterItem<T>[] | DataSourceFilters<T> | null,
): boolean {
    expr1 = normalizeFilter(expr1);
    expr2 = normalizeFilter(expr2);

    if (!expr1 || !expr2) {
        return expr1 === expr2;
    }

    if (expr1.logic !== expr2.logic) {
        return false;
    }

    let f1: DataSourceFilters<T>;
    let f2: DataSourceFilters<T>;
    let filters1 = (expr1.filters || []).slice();
    let filters2 = (expr2.filters || []).slice();

    if (filters1.length !== filters2.length) {
        return false;
    }

    filters1 = filters1.sort(fieldComparer);
    filters2 = filters2.sort(fieldComparer);

    for (let idx = 0; idx < filters1.length; idx++) {
        f1 = filters1[idx] as DataSourceFilters<T>;
        f2 = filters2[idx] as DataSourceFilters<T>;

        if (f1.logic && f2.logic) {
            if (!compareFilters(f1, f2)) {
                return false;
            }
        } else if (!compareDescriptor(f1, f2)) {
            return false;
        }
    }

    return true;
}

function filterExpr<T>(expression: DataSourceFilters<T>) {
    const logic = { and: " && ", or: " || " };
    const expressions: string[] = [];
    const fieldFunctions: Function[] = [];
    const operatorFunctions: Function[] = [];
    const filters = expression.filters;

    filters.forEach((filter) => {

        let expressionStr = '';
        if ('filters' in filter) {
            const exp = filterExpr(filter);
            // Nested function fields or operators - update their index e.g. __o[0] -> __o[1]
            expressionStr = exp.expression
                .replace(/__o\[(\d+)\]/g, function(match, index) {
                    index = +index;
                    return "__o[" + (operatorFunctions.length + index) + "]";
                })
                .replace(/__f\[(\d+)\]/g, function(match, index) {
                    index = +index;
                    return "__f[" + (fieldFunctions.length + index) + "]";
                });

            operatorFunctions.push.apply(operatorFunctions, exp.operators);
            fieldFunctions.push.apply(fieldFunctions, exp.fields);
        } else {
            const field = filter.field;
            const operator = filter.operator;
            let exp: string;

            if (typeof field === "function") {
                exp = "__f[" + fieldFunctions.length +"](d)";
                fieldFunctions.push(field);
            } else {
                exp = expr(field);
            }

            if (typeof operator === 'function') {
                expressionStr = "__o[" + operatorFunctions.length + "](" + exp + ", " + operators.quote(filter.value) + ")";
                operatorFunctions.push(operator);
            } else {
                expressionStr = (operators as any)[(operator || "eq").toLowerCase()](exp, filter.value, filter.ignoreCase !== undefined? filter.ignoreCase : true, expression.accentFoldingFiltering);
            }
        }

        expressions.push(expressionStr);
    });

    return  {
        expression: "(" + expressions.join(logic[expression.logic || 'and']) + ")",
        fields: fieldFunctions,
        operators: operatorFunctions
    };
}

// export function normalizeSort(field: string, dir?: SortDir): SortOptions[];
// export function normalizeSort(field: SortOptions): SortOptions[];
// export function normalizeSort(field: SortOptions[]): SortOptions[];
export function normalizeSort<T>(field: SortOptions<T>, dir: SortDir = 'asc'): (SortOptions1 | SortOptions2<T>)[] {
    if (isArray(field)) {
       return field;
    }

    if (typeof field === 'string') {
        return [{ field, dir }];
    } else {
        field.dir = field.dir || dir;
        return [field];
    }
}

function isFilters<T>(f: DataSourceFilterItem<T> | DataSourceFilters<T>): f is DataSourceFilters<T> {
    return 'logic' in f;
}

function compareDescriptor<T>(f1: DataSourceFilterItem<T> | DataSourceFilters<T>, f2: DataSourceFilterItem<T> | DataSourceFilters<T>): boolean {
    if (isFilters(f1) || isFilters(f2)) {
        return false;
    }

    return f1.field === f2.field && f1.value === f2.value && f1.operator === f2.operator;
}

function fieldComparer<T>(a: DataSourceFilterItem<T> | DataSourceFilters<T>, b: DataSourceFilterItem<T> | DataSourceFilters<T>) {
    if (isFilters(a) || isFilters(b)) {
        return 0;
    }
    if (a.field > b.field) {
        return 1;
    } else if (a.field < b.field) {
        return -1;
    } else {
        return 0;
    }
}

function normalizeGroup<T>(field: string | DataSourceGroupItem<T> | DataSourceGroupItem<T>[], dir: SortDir = "asc", compare?: CompareFn, skipItemSorting?: boolean): DataSourceGroupItem<T>[] {
    const descriptors: DataSourceGroupItem<T>[] = [];

    if (typeof field === 'string') {
        descriptors.push({ field, dir, compare, skipItemSorting});
    } else if (!isArray(field)) {
        descriptors.push(field);
    } else {
        return field;
    }

    return descriptors;
}

function groupValueComparer(a: any, b: any) {
    if (a && a.getTime && b && b.getTime) {
        return a.getTime() === b.getTime();
    }
    return a === b;
}

function calculateAggregate<T extends Object>(
    accumulator: AggregateReturn<T>,
    aggregates: DataSourceGroupItemAggregate<T>[],
    item: T,
    index: number,
    length: number,
    state: AggregateReturn<T>)
{
    aggregates = aggregates || [];
    aggregates.forEach((aggr) => {
        const functionName = aggr.aggregate;
        const field = aggr.field;
        accumulator[field] = accumulator[field] || {};
        state[field] = state[field] || {};
        state[field][functionName] = state[field][functionName] || {};
        accumulator[field][functionName] = functions[functionName](
            accumulator[field][functionName],
            item,
            utils.accessor(field),
            index,
            length,
            state[field][functionName]
        );
    });
}

type AggregateFn = (
        accumulator: any | undefined,
        item: object,
        accessor: ReturnType<typeof utils.accessor>,
        index: number,
        length: number,
        state: {[x: string]: any}
    ) => number;

const functions: {[key in AggregateMethods]: AggregateFn} = {
    sum(accumulator, item, accessor): number {
        const value = accessor.get(item) as number;

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
    average(accumulator, item, accessor, index, length, state): number {
        const value = accessor.get(item) as number;

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

        if(index === length - 1 && isNumber(accumulator)) {
            accumulator = accumulator / state.count;
        }
        return accumulator;
    },
    max(accumulator, item, accessor) {
        const value = accessor.get(item);

        if (!isNumber(accumulator) && !isDate(accumulator)) {
            accumulator = value;
        }

        if(accumulator < value && (isNumber(value) || isDate(value))) {
            accumulator = value;
        }
        return accumulator;
    },
    min(accumulator, item, accessor) {
        const value = accessor.get(item);

        if (!isNumber(accumulator) && !isDate(accumulator)) {
            accumulator = value;
        }

        if(accumulator > value && (isNumber(value) || isDate(value))) {
            accumulator = value;
        }
        return accumulator;
    }
};
