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
});
