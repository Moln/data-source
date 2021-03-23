import {JSONSchema7} from "json-schema";
import Ajv, {ValidateFunction} from "ajv";
import defineKeywords from "ajv-keywords";

export interface BaseRootSchema extends JSONSchema7 {
    type: "object";
    primaryKey: string;
}

export const DEFAULT_SCHEMA: BaseRootSchema = {
    type: "object",
    "primaryKey": "id",
};

export default class Schema<T extends object = object> {

    public readonly validate: ValidateFunction;
    // public readonly validate: <T2 extends object>(obj: T2) => (T & T2) | false;

    public readonly schema: BaseRootSchema;

    constructor(schema: Partial<BaseRootSchema> = DEFAULT_SCHEMA) {
        this.schema = Object.assign({}, DEFAULT_SCHEMA, schema);
        const ajv = new Ajv({
            useDefaults: true,
            coerceTypes: true,
        });
        ajvKeywordTransformToDate(ajv);
        ajvKeywordReadOnly(ajv);
        ajvKeywordPrimaryKey(ajv);
        defineKeywords(ajv as any, 'instanceof');
        const validate = ajv.compile(schema);

        this.validate = validate;
        // this.validate = <T2 extends object>(obj: T2) : (T & T2) | false => {
        //     if (! validate(obj)) {
        //         return false;
        //     }
        //     return obj as T & T2;
        // }
    }

    get primary(): keyof T & string {
        return this.schema.primaryKey as keyof T & string;
    }

    toScalar(model: Partial<T>) {
        // TODO to scalar data
        return model;
    }
}

function isPlanObject(obj: object) {
    return Object.keys(obj).length === 0
}

export function schemaDefaultValues(schema: JSONSchema7): object {
    const values: { [key: string]: any } = {};
    const properties = schema.properties as { [key: string]: JSONSchema7 };
    if (properties) {
        Object.entries(properties).forEach(([key, item]) => {
            switch (item.type) {
                case "object":
                    const subValues = schemaDefaultValues(item);
                    if (! isPlanObject(subValues)) {
                        values[key] = subValues;
                    }
                    break;
                default:
                    if (item.default !== undefined) {
                        values[key] = item.default
                    }
                    break;
            }
        })
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

function ajvKeywordPrimaryKey(ajv: Ajv.Ajv) {

    ajv.addKeyword('primaryKey', {
        type: "object",
        errors: false,
        valid: true,
        metaSchema: {
            type: 'string',
            default: 'id',
        },
    })
}

function ajvKeywordReadOnly(ajv: Ajv.Ajv) {
    ajv.removeKeyword('readOnly');
    ajv.addKeyword('readOnly', {
        errors: false,
        modifying: true,
        valid: true,
        metaSchema: {
            type: 'boolean',
            default: false,
        },
        compile(): ValidateFunction {

            return (_, _1, object, key) => {
                Object.defineProperty(object, key as string, {
                    writable: false,
                });

                return true;
            };
        },
    });
}

function ajvKeywordTransformToDate(ajv: Ajv.Ajv) {
    ajv.addKeyword('transform', {
        errors: false,
        modifying: true,
        valid: true,
        metaSchema: {
            type: 'array',
            items: {
                type: 'string',
                enum: [
                    'stringToDate',
                    'secToDate',
                    'msecToDate',
                ]
            }
        },
        compile(schema): ValidateFunction {

            return (data, dataPath, object, key) => {
                if (data instanceof Date) {
                    return true;
                } else if (typeof data === "string") {
                    (object as { [x: string]: any })[key as string] = new Date(data);
                } else if (typeof data === "number" && schema === "secToDate") {
                    (object as { [x: string]: any })[key as string] = new Date(data * 1000);
                } else if (typeof data === "number" && schema === "msecToDate") {
                    (object as { [x: string]: any })[key as string] = new Date(data);
                } else {
                    return false;
                }
                return true;
            };
        },
    });
}
