import { expect, describe, it } from 'vitest'
import Schema from '../../src/schema/Schema';

describe('DataSource/Schema', () => {
  it('should object readOnly', () => {
    const schema = new Schema(require('../test.json'));

    const obj1 = { id: '123', name: 'Test' };
    schema.validate(obj1);
    const rs = obj1 as typeof obj1 & { created_at: Date };

    expect(rs).not.toBeFalsy();
    expect(rs).toBe(obj1);

    if (!rs) return;

    // expect(() => {
    //     rs.name = "haha";
    // }).toThrowError(TypeError)
    expect(schema.primary).toBe('id');
    expect(rs.name).toBe('Test');
    expect(rs.id).toBe(123);
    expect(rs.created_at).toBeNull();
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
