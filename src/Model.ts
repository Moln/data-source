import Schema, {DEFAULT_SCHEMA} from "./Schema";
import {IModel, IModelT} from "./interfaces";
import {intercept, observable, runInAction, toJS,} from "mobx"
import {deepObserve} from "mobx-utils";
import {guid} from "./utils";

const PROPERTIES = Symbol('dataSource.model');

// export function schema<T>(schema: object): ClassDecorator {
//     return (target: Function) => {
//         if (target === Model) {
//             target.prototype[PROPERTIES].schema = new Schema(schema);
//             return target as any;
//         }
//
//         throw new TypeError('Invalid decorator target');
//     }
// }

interface ModelProperties<T extends object> {
    uuid: string;
    model: T;
    obModel: T;
    schema: Schema<T>;
    // dirtyFields: Map<keyof T, T[keyof T] | undefined>;
    dirtyFields: (keyof T)[];
}

function defineProperty<T extends object>(model: Model<T>, obj: T, key: keyof T | string) {

    const descriptor = Object.getOwnPropertyDescriptor(obj, key)
    const additionalDescriptor = descriptor ? { enumerable: descriptor.enumerable } : {}

    Object.defineProperty(model, key, {
        ...additionalDescriptor,
        configurable: true,
        get() {
            return obj[key as keyof T]
        },
        set(value: any) {
            obj[key as keyof T] = value
        },
    })
}

export default class Model<T extends object> implements IModel<T> {
    private readonly [PROPERTIES]: ModelProperties<T>;

    constructor(model: T, schema: Schema<T> = new Schema<T>(DEFAULT_SCHEMA)) {

        // makeObservable(this, {
        //     submit: action,
        //     reset: action,
        //     resetProperty: action,
        // })

        if (! schema.validate(model)) {
            console.warn('Error model value: ', schema.validate.errors, model);
            throw new Error('Error model value: ' + JSON.stringify(model))
        }

        const obModel = observable(model);
        const properties = this[PROPERTIES] = {
            uuid: guid(),
            model,
            obModel,
            dirtyFields: [],
            schema,
        } as ModelProperties<T>;

        Object.keys(model).forEach((key) => {
            if (!(key in this)) {
                defineProperty(this, obModel, key as keyof T)
            }
        })

        deepObserve(obModel, (change, path, root) => {
            const name = (change.object === root ? (change as any).name : path.split('/')[0]) as keyof T;
            if (typeof name !== "string") return;

            const index = properties.dirtyFields.indexOf(name);

            if (change.type === 'update') {
                if (index !== -1) {
                    if (change.newValue === properties.model[name]) {
                        properties.dirtyFields.splice(index, 1)
                    }
                } else {
                    properties.dirtyFields.push(name);
                }
            } else if (index === -1) {
                properties.dirtyFields.push(name);
            }
        });
        // observe(this, (change) => {
        //     console.log('observe', change)
        //     const name: keyof T = change.name as keyof T;
        //     if (typeof name !== "string") return;
        //     if (! properties.dirtyFields.has(name)) {
        //         switch (change.type) {
        //             case "add":
        //                 properties.dirtyFields.set(name, undefined );
        //                 break;
        //             case "update":
        //             case "remove":
        //                 properties.dirtyFields.set(name, change.oldValue);
        //                 break;
        //         }
        //     }
        // });

        intercept(obModel, (change) => {
            console.log(change);
            // model.schema.validate()
            return change;
        });
    }

    getUuid(): string {
        return this[PROPERTIES].uuid;
    }

    dirtyFields(): Partial<T> {
        const fields = {} as Partial<T>;
        const properties = this[PROPERTIES];
        properties.dirtyFields.forEach(key => {
            fields[key] = properties.obModel[key]
        })

        return toJS(fields);
    }

    isDirty(): boolean {
        return this[PROPERTIES].dirtyFields.length > 0;
    }

    set(keys: keyof T | string | (string | keyof T)[] | Partial<T> , value?: any): this {

        if (typeof keys === 'object') {
            if (! Array.isArray(keys)) {
                Object.entries(keys).forEach(([key, value]) => {
                    this.set(key, value);
                })

                return this;
            }
        } else {
            keys = [keys as keyof T]
        }

        runInAction(() => {
            const model = this[PROPERTIES].obModel
            let _keys =  (keys as (keyof T)[]);
            if (_keys[0] in model) {
                defineProperty(this, model, _keys[0])
            }

            let target: any = model;
            let lastKey = _keys.pop();
            _keys.forEach((key, index) => {
                target = target[key]
            })

            target[lastKey] = value
        })

        return this;
    }

    get(key: string | keyof T): T[keyof T] {
        return this[PROPERTIES].obModel[key as keyof T];
    }

    isPropertyDirty(key: keyof T): boolean {
        return this[PROPERTIES].dirtyFields.indexOf(key) !== -1
    }

    submit(): this {
        const properties = this[PROPERTIES];
        properties.model = this.toJS();

        this[PROPERTIES].dirtyFields = [];
        return this;
    }

    reset(): this {
        const properties = this[PROPERTIES];

        properties.dirtyFields.forEach((key) => {
            if (key in properties.model) {
                properties.obModel[key] = properties.model[key]
            } else {
                delete properties.obModel[key];
            }
        });
        this[PROPERTIES].dirtyFields = [];

        return this;
    }

    resetProperty(key: keyof T): this {

        const dirtyFields = this[PROPERTIES].dirtyFields;
        const index = dirtyFields.indexOf(key)

        if (index !== -1) {
            dirtyFields.splice(index, 1)
            this.set(key, this[PROPERTIES].model[key]);
        }

        return this;
    }

    isNew(): boolean {
        return !(this as any)[this[PROPERTIES].schema.primary];
    }

    toJS(uuid?: boolean) {
        const obj: T & {__uuid?: string} = toJS(this[PROPERTIES].obModel);
        obj.__uuid = this.getUuid()

        return obj;
    }

    observe(listener: Parameters<typeof deepObserve>[1]) {
        deepObserve(this[PROPERTIES].obModel, listener)
    }
}

export function createModel<T extends object>(obj: T, schema?: Schema<T>): IModelT<T> {
    return new Model<T>(obj, schema) as any;
}

/*
export function model<T extends Object = Object>(obj: T): T & {[MODEL]: ModelProperties} {
    // return (new Model(obj, schema || new Schema(DEFAULT_SCHEMA))) as Model<T> & T;
    let canceling = false;
    const model: ModelProperties = {
        dirty: false,
        dirtyFields: {},
        cancelChange(): void {
            canceling = true;
            Object.keys(this.dirtyFields).forEach((key) => {
                if (this.dirtyFields[key] === undefined) {
                    delete (obj as {[x: string]: any;})[key];
                } else {
                    (obj as {[x: string]: any;})[key] = this.dirtyFields[key]
                }
            });
            this.dirtyFields = {};
            this.dirty = false;
            canceling = false;
        }
    };

    const obj1 = observable(obj as T & {[MODEL]: ModelProperties});

    obj1[MODEL] = model;

    observe(obj1, (change: IObjectDidChange) => {
        if (typeof change.name !== "string" || canceling) return;
        const name: string = change.name;
        model.dirty = true;
        if (! model.dirtyFields.hasOwnProperty(change.name)) {
            switch (change.type) {
                case "add":
                    model.dirtyFields[name] = undefined;
                    break;
                case "update":
                case "remove":
                    model.dirtyFields[name] = change.oldValue;
                    break;
            }
        }
    });

    return obj1;
}
*/
/*
export class Model<T extends object> {
    private [MODEL]: ModelProperties;

    constructor(obj: T, schema?: Schema) {
        extendObservable(this, obj);
        observe(this, (change: IObjectDidChange) => {
            if (change.type == 'update' && change.oldValue === change.newValue) {
                // this[MODEL].dirty = true;
            }
        });

        // this[MODEL] = {
        //     dirty: false,
        //     // schema: schema,
        //     dirtyFields: {},
        // };

        // for (let key in obj) {
        //     Object.defineProperty(this, key, {
        //         get: () => obj[key],
        //         set: (value: any) => {
        //             if (obj[key] !== value) {
        //                 obj[key] = value;
        //                 // this.updatedKeys.push(key);
        //             }
        //         },
        //     });
        // }
    }

    // isNew(): boolean {
    //     // return !(this as any)[this[MODEL].schema.primary];
    // }
    //
    // isDirty(): boolean {
    //     // return this[MODEL].dirty;
    // }
}
*/
