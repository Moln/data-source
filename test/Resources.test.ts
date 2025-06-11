import {CacheServerProvider, Resources, RestProvider} from '../src';
import Axios from 'axios';
import { expect, describe, it, vi } from 'vitest'
import MockAdapter from "axios-mock-adapter";

describe('Resources', () => {
  it('get resource', () => {
    const http = Axios.create();
    const resources = new Resources(http);
    const provider = resources.create('users');

    expect(provider).toBeInstanceOf(RestProvider);

    const u = resources.create('user/users/{user_id}/attrs/{key}', {
      user_id: 123,
      key: 'name',
    });

    expect((u as any).url).toBe('/user/users/123/attrs/name');
  });

  const data = [
    {
      id: 1,
      name: 'Tom',
    },
    {
      id: 2,
      name: 'Jerry',
    },
  ]
  it('should create DataSource', async () => {

    const http = Axios.create();
    const mock = new MockAdapter(http);
    mock.onGet('/users').reply(config => {
      return [
        200,
        {
          data,
        }
      ];
    });
    const resources = new Resources(http);
    const ds = resources.createDataSource("users")
    await ds.fetch()

    expect(ds.data.length).toBe(2);
  });

  it('should create cacheable DataSource', async () => {

    const http = Axios.create();
    const mock = new MockAdapter(http);
    mock.onGet('/users').reply(config => {
      return [
        200,
        {
          data,
        }
      ];
    });
    const httpGetSpy = vi.spyOn(http, 'get')
    const resources = new Resources(http);
    const ds = resources.createDataSource("users", {}, {cacheable: true})
    await ds.fetch()
    expect(ds.dataProvider).toBeInstanceOf(CacheServerProvider)
    expect(ds.data.length).toBe(2);
    await ds.fetch()
    expect(ds.data.length).toBe(2);
    expect(httpGetSpy).toHaveBeenCalledOnce()
  });

  it('should create Array DataSource', async () => {

    const resources = new Resources();
    const ds = resources.createDataSourceByArray(data)
    await ds.fetch()

    expect(ds.data.length).toBe(2);
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
