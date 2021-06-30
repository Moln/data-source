import { ArrayProvider, Model } from '../src';
import { observable, observe } from "mobx";
import { deepObserve } from "../src/mobx/utils";

describe('DataSource', () => {
  it('DataSource add model', () => {
    const ds = new ArrayProvider<object>([]).createDataSource();
    const m = ds.add({ name: 'test' });

    expect((ds as any).changes.updated.length).toBe(0);
    expect(ds.data.length).toBe(1);
    expect(m.isNew()).toBeTruthy();

    const m2 = ds.insert(0, { name: 'test2' });
    expect(ds.data.length).toBe(2);
    expect(m2.isNew()).toBeTruthy();

    expect(ds.data[0].name).toBe('test2');
  });

  it('should cancelChanges', function() {
    const ds = new ArrayProvider<object>([]).createDataSource();
    ds.add({ name: 'test' });
    ds.insert(0, { name: 'test0' });

    expect(ds.hasChanges()).toBeTruthy();

    ds.cancelChanges();

    expect(ds.data.length).toBe(0);
  });

  it('DataSource get model', () => {
    const ds = new ArrayProvider<{ id: number; name: string }>(
      []
    ).createDataSource();
    ds.add({ id: 123, name: 'test' });
    const m = ds.get(123);
    expect(m).toBeInstanceOf(Model);
    if (!m) return;

    expect(m.id).toBe(123);
    expect(m.name).toBe('test');
  });

  it('DataSource remove model', () => {
    const ds = new ArrayProvider([]).createDataSource();
    const m = ds.add({ name: 'test' });
    ds.remove(m);
    expect(ds.data.length).toBe(0);
  });


  it('DataSource modelFactory', () => {
    class DateModel extends Model<Record<any, any>> {
      get date() {
        return new Date(this.get('time'))
      }
      set date(value: Date) {
        this.set('time', value.toISOString())
      }
      toJS(uuid?: boolean) {
        return super.toJS(uuid);
      }
    }

    const ds = new ArrayProvider<Record<any, any>>([]).createDataSource({modelFactory: (obj, schema) => new DateModel(obj, schema)});
    const m = ds.add({ name: 'test' });

    expect(m).toBeInstanceOf(DateModel)
  });

  it('should auto sync', async function () {
    const data = [
      {id: 1, name: 'foo'},
      {id: 2, name: 'bar'},
      {id: 3, name: 'baz'},
    ];
    const dp = new ArrayProvider<Record<any, any>>(data);
    const ds = dp.createDataSource({ autoSync: true });
    await ds.fetch()
    expect(ds.data.length).toBe(3)

    const m = ds.add({name: 'test'});

    expect(ds.data.length).toBe(4)
    expect(dp.data.length).toBe(4)
    expect(dp.data[3]).toMatchObject({name: 'test'})
  });
});
