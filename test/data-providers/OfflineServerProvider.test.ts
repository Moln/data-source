import {OfflineServerProvider, RestProvider} from "../../src";
import Axios from "axios";
import MockAdapter from "axios-mock-adapter";

describe('OfflineServerProvider', () => {
    it('OfflineServerProvider', async () => {
        const http = Axios.create()

        const mock = new MockAdapter(http);
        mock.onGet('/users').reply((config) => {
            const data = []
            for (let i = 1; i <= 10; i++) {
                data.push({
                    id: i,
                    name: 'name' + i
                })
            }
            return [
                200,
                {
                    total: 10,
                    data,
                },
            ]
        })
        mock.onPost('/users').reply((config) => {
            const data = JSON.parse(config.data)
            return [
                200,
                {
                    id: 11,
                    name: data.name
                },
            ]
        })
        // mock.onGet('/users/2').reply(200, bar)
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

        const ds = new OfflineServerProvider(new RestProvider<{id:number, name: string}>('/users', http))

        const rs = await ds.fetch();
        expect(rs.data.length).toBe(10)

        const rs2 = await ds.get(2)
        expect(rs2).toEqual({id: 2, name: 'name2'})

        const rs3 = await ds.update(2, {name: 'bar2'})
        expect(rs3).toEqual({id: 2, name: 'bar2'})

        const rs4 = await ds.create({name: 'foo'})
        expect(rs4).toEqual({id: 11, name: 'foo'})

        await ds.remove({id: 2})
    });
});
