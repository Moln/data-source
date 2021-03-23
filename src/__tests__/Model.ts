import {extendObservable, observable} from "mobx";
import {createModel} from "../";

describe('DataSource/Model', () => {
    it('starts at 0', () => {

        const m = createModel({id: 123, name: 'Test', isDirty: 222, sub: {a: [{a2: 1}], b:2}});

        m.observe(change => console.log(change))

        expect(m.isDirty()).toBeFalsy();

        // const m = new Model({id: 123, name: 'Test'});
        m.sub.a.push({a2: 2})
        m.set("isDirty", 333)
        m.name = 'test2'

        expect(m.isDirty()).toBeTruthy();
        expect(m.get("isDirty")).toBe(333);
        expect(m.isNew()).toBeFalsy();
        expect(m.name).toBe('test2');
    });

    it('should model success', function () {

        const obj2 = {id: 123, name: 'Test', get age() {return 34}, job: 'sexy'};

        Object.defineProperty(obj2, 'job', {
            writable: false,
        });
        const m = createModel(obj2);

        m.job = "342";
        m.name = "ss";
        expect(m.id).toBe(obj2.id);
        expect(m.isDirty()).toBeTruthy();
        expect(m.job).toBe("sexy");
    });

    it('should init model', function () {
        const obj = {id: 123, name: 'Test', get model2() {return "889"}};
        const obj2 = {id: 123, name: 'Test', get model2() {return "888"}};

        const obj1 = createModel(obj);
        const a = createModel(obj) as any;

        const obj3 = observable(obj2);
        const obj4 = createModel(obj3);
        a.test = 444;
        // obj1.aaa = "ddd";
        (obj3 as any).aaa = "ddd";
        extendObservable(obj4, {
            age: 353
        })
        // expect(obj).toBe(obj1);

        obj1.name = 'Test123';

        expect(obj1.dirtyFields()).toBe({name: 'Test'});
    });
});
