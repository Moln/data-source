import { extendObservable, intercept, observable } from 'mobx';
import { BaseRootSchema, createModel, DEFAULT_SCHEMA, Model, PROPERTIES, Schema } from '../src';

const testSchema: BaseRootSchema = Object.assign(
  {
    properties: {
      id: {
        type: 'integer',
        readOnly: true,
      },
      name: {
        type: 'string',
        default: 'test',
      },
      role: {
        type: 'string',
        readOnly: true,
      },
    },
  },
  DEFAULT_SCHEMA
);

describe('DataSource/Model', () => {
  it('starts at 0', () => {
    const m = createModel({
      name: 'Test',
      isDirty: 222,
      sub: { a: [{ a2: 1 }], b: 2 },
    }, new Schema(testSchema));

    // m.observe(change => console.log(change))

    expect(m.isDirty()).toBeFalsy();

    // const m = new Model({id: 123, name: 'Test'});
    m.sub.a.push({ a2: 2 });
    m.set('isDirty', 333);
    m.name = 'test2';

    expect(m.isDirty()).toBeTruthy();
    expect(m.get('isDirty')).toBe(333);
    expect(m.isNew()).toBeTruthy();
    expect(m.name).toBe('test2');

    m.set('id', 1)
    m.submit()
    expect(m.isNew()).toBeFalsy();
    expect(m.isDirty()).toBeFalsy();

  });

  it('should model success', function() {
    const obj2 = {
      id: 123,
      name: 'Test',
      get age() {
        return 34;
      },
      role: 'Developer',
      o: { a: 1 },
    };

    const m = createModel(obj2, new Schema<typeof obj2>(testSchema));

    m.o.a = 2;
    // m.role = "tester";
    // m.name = "ss";
    expect(m.id).toBe(obj2.id);
    expect(m.isDirty()).toBeTruthy();
    expect(m.role).toBe('Developer');
  });

  it('should init model', function() {
    const obj = {
      id: 123,
      name: 'Test',
      get model2() {
        return '889';
      },
    };
    const obj2 = {
      id: 123,
      name: 'Test',
      get model2() {
        return '888';
      },
    };

    const obj1 = createModel(obj);
    const a = createModel(obj) as any;

    const obj3 = observable(obj2);
    const obj4 = createModel(obj3);
    a.test = 444;
    // obj1.aaa = "ddd";
    (obj3 as any).aaa = 'ddd';
    extendObservable(obj4, {
      age: 353,
    });
    // expect(obj).toBe(obj1);

    obj1.name = 'Test123';

    expect(obj1.dirtyFields()).toEqual({ name: 'Test123' });
  });


  it('should schema default values', function() {
    const m = createModel({}, new Schema(testSchema));

    expect(m.name).toBe('test');
    expect(m.isDirty()).toBeFalsy();
  });

  it('should extends setter', function () {
    const noop = () => {};
    class DateModel<T extends Record<any, any> = Record<any, any>> extends Model<T> {
      get date() {
        return new Date(this.get('time'))
      }
      set date(value: Date) {
        this.set('time', value.toISOString())
      }

      test = noop
    }

    const m = new DateModel({ time: '2021/01/02 00:00:00' }) as Record<any, any>
    // m.date = new Date('2021/01/01 00:00:00');
    const d1 = new Date('2021/01/01 00:00:00');

    m.set('date2', d1);
    expect(m.date2).toBe(d1)

    m.set('date', new Date('2021/01/01 00:00:00'));
    expect(m.time).toBe('2020-12-31T16:00:00.000Z')
    expect(m.date.toISOString()).toBe('2020-12-31T16:00:00.000Z')

    m.set('test', 'foo');
    expect(m.test).toBe(noop)
    expect(m.get('test')).toBe('foo')

  });
});
