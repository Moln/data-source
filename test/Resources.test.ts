import {Resources, RestProvider} from "../src";
import Axios from "axios";

describe('Resources', () => {
    it('get resource', () => {
        const http = Axios.create();
        const resources = new Resources(http);
        const provider = resources.create('users')

        expect(provider).toBeInstanceOf(RestProvider);
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
