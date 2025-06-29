import Schema from './schema/Schema';
import type { IModel, IModelT } from './interfaces';
import { observable, runInAction, toJS } from 'mobx';
import { guid } from './utils';
import { deepObserve, deepIntercept } from './mobx/utils';
import type {ISchema} from "./schema/interfaces";

export const PROPERTIES = Symbol('dataSource.model');


interface ModelProperties<T extends object> {
  uuid: string;
  model: T;
  obModel: T;
  schema: ISchema;
  // dirtyFields: Map<keyof T, T[keyof T] | undefined>;
  dirtyFields: (keyof T)[];
}

function defineProperty<T extends object>(
  model: IModel<T>,
  mobxObj: T,
  key: keyof T | string
) {
  if (Model.prototype.hasOwnProperty(key)) {
    return;
  }

  const descriptor = Object.getOwnPropertyDescriptor(mobxObj, key);
  const additionalDescriptor = descriptor
    ? { enumerable: descriptor.enumerable }
    : {};

  Object.defineProperty(model, key, {
    ...additionalDescriptor,
    configurable: true,
    get() {
      return mobxObj[key as keyof T];
    },
    set(value: any) {
      mobxObj[key as keyof T] = value;
    },
  });
}

function isSetter(obj: object, key: string): boolean {
  return !!Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), key)
    ?.set;
}

export default class Model<T extends object> implements IModel<T> {
  private readonly [PROPERTIES]: ModelProperties<T>;

  constructor(model: T, schema: ISchema = new Schema()) {
    // makeObservable(this, {
    //     submit: action,
    //     reset: action,
    //     resetProperty: action,
    // })

    const result = schema.validate(model);
    if (!result.ok()) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Error model value: ', result.errors, model);
      }
      throw new Error('Error model value: ' + JSON.stringify(model));
    }

    const obModel = observable(model);
    const properties = (this[PROPERTIES] = {
      uuid: guid(),
      model,
      obModel,
      dirtyFields: [],
      schema,
    } as ModelProperties<T>);

    Object.keys(model).forEach(key => {
      defineProperty(this, obModel, key as keyof T);
    });

    deepObserve(obModel, (change, path, root) => {
      const name = (change.object === root
        ? (change as any).name
        : path[0]) as keyof T;
      if (typeof name !== 'string') return;

      const index = properties.dirtyFields.indexOf(name);

      if (change.type === 'update') {
        if (index !== -1) {
          if (change.newValue === properties.model[name]) {
            properties.dirtyFields.splice(index, 1);
          }
        } else {
          properties.dirtyFields.push(name);
        }
      } else if (index === -1) {
        properties.dirtyFields.push(name);
      }
    });

    deepIntercept(obModel, (change, path) => {
      if ('name' in change) {
        path = path.concat([change.name as string]);
      }
      if (change.type === 'add' && change.name === schema.primary) {
        return change;
      }
      if (schema.isReadOnly(path)) {
        return null;
      }
      if (change.type == 'update') {
        const result = schema.validate(change.newValue, path);
        if (! result.ok()) {
          console.warn('Error model value:', result, path);
          return null;
        }
      }

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
      fields[key] = properties.obModel[key];
    });

    return toJS(fields);
  }

  isDirty(): boolean {
    return this[PROPERTIES].dirtyFields.length > 0;
  }

  set(
    keys: keyof T | string | (string | keyof T)[] | Partial<T>,
    value?: any
  ): this {
    if (typeof keys === 'object') {
      if (!Array.isArray(keys)) {
        Object.entries(keys).forEach(([key, value]) => {
          this.set(key, value);
        });

        return this;
      }
    } else {
      keys = [keys as keyof T];
    }

    const model = this[PROPERTIES].obModel;
    const _keys = keys as string[];
    if (_keys.length === 1 && isSetter(this, _keys[0])) {
      this[_keys[0] as keyof this] = value;
      return this;
    }

    if (!(_keys[0] in this)) {
      defineProperty(this, model, _keys[0]);
    }

    runInAction(() => {
      let target: Record<any, any> = model;
      const lastKey = _keys.pop()!;
      _keys.forEach(key => {
        if (target[key] === undefined || target[key] === null) {
          target[key] = {};
        }
        target = target[key];
      });

      target[lastKey] = value;
    });

    return this;
  }

  get(key: string | keyof T): T[keyof T] {
    return this[PROPERTIES].obModel[key as keyof T];
  }

  isPropertyDirty(key: keyof T): boolean {
    return this[PROPERTIES].dirtyFields.indexOf(key) !== -1;
  }

  submit(): this {
    const properties = this[PROPERTIES];
    properties.model = this.toJS();

    this[PROPERTIES].dirtyFields = [];
    return this;
  }

  reset(): this {
    const properties = this[PROPERTIES];

    properties.dirtyFields.forEach(key => {
      if (key in properties.model) {
        properties.obModel[key] = properties.model[key];
      } else {
        delete properties.obModel[key];
      }
    });
    this[PROPERTIES].dirtyFields = [];

    return this;
  }

  resetProperty(key: keyof T): this {
    const { dirtyFields, model, obModel } = this[PROPERTIES];
    const index = dirtyFields.indexOf(key);

    if (index !== -1) {
      if (key in model) {
        obModel[key] = model[key];
      } else {
        delete obModel[key];
      }

      dirtyFields.splice(index, 1);
    }

    return this;
  }

  isNew(): boolean {
    return !this.get(this[PROPERTIES].schema.primary);
  }

  toJS(uuid?: boolean) {
    const obj: T & { __uuid?: string } = toJS(this[PROPERTIES].obModel);

    if (uuid) {
      obj.__uuid = this.getUuid();
    }

    return obj;
  }

  getKey() {
    return this.get(this[PROPERTIES].schema.primary) as string | number;
  }

  observe(listener: Parameters<typeof deepObserve>[1]) {
    return deepObserve(this[PROPERTIES].obModel, listener);
  }
}

export function createModel<T extends object>(
  obj: T,
  schema?: Schema
): IModelT<T> {
  return new Model<T>(obj, schema) as any;
}
