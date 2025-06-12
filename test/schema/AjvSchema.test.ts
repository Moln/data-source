import { expect, describe, it } from 'vitest'
import AjvSchema from '../../src/schema/AjvSchema';
import Ajv from "ajv";
import addFormats from "ajv-formats"

describe('DataSource/Schema', () => {
    const ajv = new Ajv({
        strict: false,
        useDefaults: true,
        coerceTypes: true,
    });

    const userSchema = require('../test.json')
    addFormats(ajv)
    ajv.addSchema(userSchema, "users")

    it('should object readOnly', () => {
        const schema = new AjvSchema(ajv, 'users');

        const obj1 = { id: '123', name: 'Test' };
        const result = schema.validate(obj1);
        expect(result.ok()).toBeTruthy()
        const rs = obj1 as typeof obj1 & { created_at: Date };

        expect(schema.schema).toBe(userSchema);
        expect(rs).not.toBeFalsy();
        expect(rs).toBe(obj1);

        // expect(() => {
        //     rs.name = "haha";
        // }).toThrowError(TypeError)
        expect(schema.primary).toBe('id');
        expect(schema.isReadOnly('name')).toBeTruthy();
        expect(rs.name).toBe('Test');
        expect(rs.id).toBe(123);
        expect(rs.created_at).toBeNull();
    });

    it('should type error', () => {
        const schema = new AjvSchema(ajv, 'users');
        const obj1 = { id: '123', name: [] };
        const result = schema.validate(obj1);
        expect(result.ok()).toBeFalsy()
    });

    // it('should be `Date` object', () => {
    //     const schema = new Schema<Test2>(require('./test2.json'));
    //
    //     const strDate = '2020-06-19T08:30:06.283185Z';
    //     const obj1 = {id: "123", name: 'Test', created_at: strDate};
    //     const rs = schema.getSchema()!(obj1);
    //
    //     if (! rs) return ;
    //
    //     expect(obj1.created_at).toBeInstanceOf(Date);
    //     expect((obj1.created_at as any).getTime()).toBe(new Date(strDate).getTime());
    // });
});
