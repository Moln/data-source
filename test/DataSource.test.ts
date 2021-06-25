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
});
