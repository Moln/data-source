import Axios from "axios";
import {RestProvider} from "../../src";
import MockAdapter from "axios-mock-adapter";
// This sets the mock adapter on the default instance

describe('RestProvider', () => {
    it('RestProvider', async () => {
        const foo = {name: 'foo'};
        const bar = {id: 2, name: 'bar'};
        const http = Axios.create()
        let i = 0;

        const mock = new MockAdapter(http);
        mock.onPost('/users').reply((config) => {
            const data = JSON.parse(config.data)
            return [
                200,
                {
                    id: ++i,
                    name: data.name
                },
            ]
        })
        mock.onGet('/users/2').reply(200, bar)
        mock.onPatch('/users/2').reply((config) => {
            const data = JSON.parse(config.data)
            return [
                200,
                {
                    id: 2,
                    name: data.name
                },
            ]
        })
        mock.onDelete('/users/2').reply(204)

        const ds = new RestProvider<{id:number, name: string}>('/users', http);

        const rs = await ds.create(foo)
        expect(rs).toEqual({id: 1, name: 'foo'})

        const rs2 = await ds.get(2)
        expect(rs2).toEqual(bar)

        const rs3 = await ds.update(2, {name: 'bar2'})
        expect(rs3).toEqual({id: 2, name: 'bar2'})

        await ds.remove({id: 2})
    });
});
