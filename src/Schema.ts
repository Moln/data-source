import { JSONSchema7 } from 'json-schema';
import Ajv from 'ajv';
import { guid } from './utils';
import { AnyValidateFunction } from 'ajv/lib/types/index';

export interface BaseRootSchema extends JSONSchema7 {
  type: 'object';
  primaryKey?: string;
}

const defaultPrimaryKey = 'id';

export const DEFAULT_SCHEMA: BaseRootSchema = {
  type: 'object',
  primaryKey: defaultPrimaryKey,
};

export default class Schema<
  T extends Record<string, any> = Record<string, any>
> {
  public readonly validate: AnyValidateFunction<T>;

  public readonly schema: BaseRootSchema;

  public readonly ajv: Ajv;

  constructor(schema: Ajv, schemaName: string);
  constructor(schema?: Partial<BaseRootSchema>);
  constructor(
    schema: Ajv | Partial<BaseRootSchema> = DEFAULT_SCHEMA,
    private schemaName: string = guid()
  ) {
    let ajv: Ajv;
    if (schema instanceof Ajv) {
      ajv = schema;
    } else {
      ajv = new Ajv({
        strict: false,
        useDefaults: true,
        coerceTypes: true,
      });
      // ajvKeywordTransformToDate(ajv);
      // ajvKeywordReadOnly(ajv);
      ajvKeywordPrimaryKey(ajv);
      ajv.addSchema(schema, schemaName);
    }

    this.ajv = ajv;
    this.validate = ajv.getSchema<T>(schemaName)!;
    this.schema = this.validate.schema as BaseRootSchema;

    // const validate = ajv.compile(schema);
    // this.validate = validate;
    // this.validate = <T2 extends object>(obj: T2) : (T & T2) | false => {
    //     if (! validate(obj)) {
    //         return false;
    //     }
    //     return obj as T & T2;
    // }
  }

  get primary(): keyof T & string {
    return this.schema.primaryKey || defaultPrimaryKey;
  }

  isReadOnly(keys: string | string[]): boolean {
    const validator = this.getSchema(keys);
    return (validator?.schema as any)?.readOnly;
  }

  getSchema<T = unknown>(keys: string | string[] = []) {
    const path = buildPath(keys);
    return this.ajv.getSchema<T>(this.schemaName + path);
  }

  toScalar(model: Partial<T>) {
    // TODO to scalar data
    return model;
  }
}

function buildPath(keys: string | string[]) {
  if (typeof keys == 'string') {
    keys = [keys];
  }
  return keys.length ? '#/properties/' + keys.join('/properties/') : '';
}

function isPlanObject(obj: object) {
  return Object.keys(obj).length === 0;
}

export function schemaDefaultValues(schema: JSONSchema7): object {
  const values: { [key: string]: any } = {};
  const properties = schema.properties as { [key: string]: JSONSchema7 };
  if (properties) {
    Object.entries(properties).forEach(([key, item]) => {
      switch (item.type) {
        case 'object':
          const subValues = schemaDefaultValues(item);
          if (!isPlanObject(subValues)) {
            values[key] = subValues;
          }
          break;
        default:
          if (item.default !== undefined) {
            values[key] = item.default;
          }
          break;
      }
    });
  }

  return values;
}

// type Strings = (string | Strings)[];

// export function getSchemaItems(schema: JSONSchema7, keys: Strings) {
//     if (! schema.properties) {
//         return schema;
//     }
//
//     const obj = cloneDeep(schema);
//     const properties = obj.properties as { [key: string]: JSONSchema7 };
//     const newProperties = {} as { [key: string]: any };
//
//     keys.forEach((key) => {
//         if (Array.isArray(key)) {
//             const key1 = key[0] as string;
//             const subKeys = key.slice();
//             subKeys.shift();
//             newProperties[key1] = getSchemaItems(properties[key1] as JSONSchema7, subKeys)
//         } else {
//             newProperties[key] = properties[key]
//         }
//     })
//
//     obj.properties = newProperties;
//
//     return obj;
// }

function ajvKeywordPrimaryKey(ajv: Ajv) {
  ajv.addKeyword({
    keyword: 'primaryKey',
    type: 'object',
    errors: false,
    valid: true,
    metaSchema: {
      type: 'string',
      default: 'id',
    },
  });
}

// function ajvKeywordReadOnly(ajv: Ajv) {
//     ajv.removeKeyword('readOnly');
//     ajv.addKeyword({
//         keyword: "readOnly",
//         errors: false,
//         modifying: true,
//         valid: true,
//         metaSchema: {
//             type: 'boolean',
//             default: false,
//         },
//         compile: () => {
//             return () => {
//                 Object.defineProperty(object, key as string, {
//                     writable: false,
//                 });
//
//                 return true;
//             };
//         },
//     });
// }

// function ajvKeywordTransformToDate(ajv: Ajv) {
//     ajv.addKeyword({
//         keyword: 'transform',
//         errors: false,
//         modifying: true,
//         valid: true,
//         metaSchema: {
//             type: 'array',
//             items: {
//                 type: 'string',
//                 enum: [
//                     'stringToDate',
//                     'secToDate',
//                     'msecToDate',
//                 ]
//             }
//         },
//         compile(transform: string) {
//             return (data: string | number | Date) => {
//                 if (data instanceof Date) {
//                     return true;
//                 } else if (typeof data === "string") {
//                     (object as { [x: string]: any })[key as string] = new Date(data);
//                 } else if (typeof data === "number" && transform === "secToDate") {
//                     (object as { [x: string]: any })[key as string] = new Date(data * 1000);
//                 } else if (typeof data === "number" && transform === "msecToDate") {
//                     (object as { [x: string]: any })[key as string] = new Date(data);
//                 } else {
//                     return false;
//                 }
//                 return true;
//             };
//         },
//     });
// }
