import { ArrayProvider } from '../../src';

describe('ArrayProvider', () => {
  it('ArrayProvider', async () => {
    const foo = { id: 1, name: 'foo' };
    const bar = { id: 2, name: 'bar' };

    const ds = new ArrayProvider([foo]);

    const rs = await ds.create(bar);
    expect(rs).toBe(bar);

    const rs2 = await ds.get(2);
    expect(rs2).toBe(bar);

    const rs3 = await ds.update(2, { name: 'bar2' });
    expect(rs3).toBe(bar);
    expect(rs3.name).toBe('bar2');

    await ds.remove({ id: 2 });

    const rs4 = await ds.get(2);
    expect(rs4).toBeUndefined();
  });

  it('fetch', async () => {
    const data = [
      {id: 1, name: 'foo'},
      {id: 2, name: 'bar'},
      {id: 3, name: 'baz'},
    ];

    const ds = new ArrayProvider(data);
    const rs = await ds.fetch({
      filter: {filters: [{field: 'name', operator: 'contains', value: 'ba'}]},
      sort: [{field: 'id', dir: 'desc'}]
    })

    expect(rs.data.length).toBe(2)
    expect(rs.data[0].id).toBe(3)

    const rs2 = await ds.fetch({
      page: 1,
      pageSize: 2,
    })

    expect(rs2.data.length).toBe(2)
  })
});
