import {DataSource} from "../DataSource";
import Model from "../CreateModel";

describe('DataSource', () => {
    it('DataSource add model', () => {
        const ds = DataSource.factory('test');
        const m = ds.add({name: 'test'});
        expect(ds.data.length).toBe(1);
        expect(m.isNew()).toBeTruthy();

        const m2 = ds.insert(0, {name: 'test2'});
        expect(ds.data.length).toBe(2);
        expect(m2.isNew()).toBeTruthy();

        expect(ds.data[0].name).toBe('test2');
    });

    it('should cancelChanges', function () {
        const ds = DataSource.factory('test');
        const m = ds.add({name: 'test'});
        const m2 = ds.insert(0, {name: 'test0'});

        ds.cancelChanges();

        expect(ds.data.length).toBe(0);
    });

    it('DataSource get model', () => {
        const ds = DataSource.factory<{id: number, name: string}>('test');
        ds.add({id: 123, name: 'test'});
        const m = ds.get(123);
        expect(m).toBeInstanceOf(Model);
        if (!m) return ;

        expect(m.id).toBe(123);
        expect(m.name).toBe('test');
    });

    it('DataSource remove model', () => {
        const ds = DataSource.factory('test');
        const m = ds.add({name: 'test'});
        ds.remove(m);
        expect(ds.data.length).toBe(0);
    });
});
