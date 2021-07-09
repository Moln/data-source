import { Query } from '../src';
import { GroupItem } from '../src/interfaces';

describe('Query', () => {
  function genData() {
    const rs = [];
    for (let i = 1; i <= 20; i++) {
      rs.push({ id: i, name: i > 10 ? 'bbb' : 'aaa', gen: i % 2, age: 10 * i });
    }

    return rs;
  }

  it('should select ok', function() {
    const data = genData();
    const q = new Query(data);
    const rs = q
      .select(item => {
        item.age += 1;
        return item;
      })
      .toArray();
    expect(rs[0].age).toBe(11);
    expect(rs[1].age).toBe(21);
  });

  it('should range ok', function() {
    const data = genData();
    const q = new Query(data);
    const rs = q.range(10, 5).toArray();
    expect(rs.length).toBe(5);
    expect(rs[0].id).toBe(11);
  });

  it('should take ok', function() {
    const data = genData();
    const q = new Query(data);
    const rs = q.take(10).toArray();
    expect(rs.length).toBe(10);
    expect(rs[0].id).toBe(1);
    expect(rs[rs.length - 1].id).toBe(10);
  });

  it('should order ok', function() {
    const data = genData();
    const q = new Query(data);
    const q2 = q.order('id', 'desc');
    expect(q2.toArray()[0].id).toBe(20);

    const q3 = q2.order({ field: 'id' });
    expect(q3.toArray()[0].id).toBe(1);

    const q4 = q3.order({ field: 'id', dir: 'desc' });
    expect(q4.toArray()[0].id).toBe(20);

    const q5 = q3.order({ field: 'id' }, 'desc');
    expect(q5.toArray()[0].id).toBe(20);
  });

  it('should orderBy ok', function() {
    const data = genData();
    const q = new Query(data);
    const q2 = q.order('id', 'desc').orderBy('id');
    expect(q2.toArray()[0].id).toBe(1);
  });

  it('should orderByDescending ok', function() {
    const data = genData();
    const q = new Query(data);
    const q2 = q.orderByDescending('id');
    expect(q2.toArray()[0].id).toBe(20);
  });

  it('should filter ok', function() {
    const data = genData();
    const q = new Query(data);
    const q2 = q.filter({ field: 'age', value: 20 });
    expect(q2.toArray().length).toBe(1);
    expect(q2.toArray()[0].age).toBe(20);

    const q3 = q.filter({ field: 'id', operator: '<=', value: 10 });
    expect(q3.toArray().length).toBe(10);
    expect(q3.orderByDescending('id').toArray()[0].id).toBe(10);

    const q4 = q.filter({ field: 'age', operator: '>', value: 10 });
    expect(q4.toArray().length).toBe(19);
    expect(q4.orderByDescending('id').toArray()[0].id).toBe(20);

    const q5 = q.filter({ field: 'id', operator: '>', value: 10 });
    expect(q5.toArray().length).toBe(10);
    expect(q5.orderByDescending('id').toArray()[0].id).toBe(20);

    const q6 = q.filter([
      { field: 'id', operator: '>', value: 2 },
      { field: 'id', operator: '<=', value: 4 },
    ]);
    expect(q6.toArray().length).toBe(2);
    expect(q6.toArray()[0].id).toBe(3);
    expect(q6.toArray()[1].id).toBe(4);

    const q7 = q.filter({
      logic: 'or',
      filters: [
        { field: 'id', value: 2 },
        { field: 'id', value: 4 },
      ],
    });
    expect(q7.toArray().length).toBe(2);
    expect(q7.toArray()[0].id).toBe(2);
    expect(q7.toArray()[1].id).toBe(4);

    const qIn = q.filter({field: 'id', operator: 'in', value: [7, 9]})
    expect(qIn.toArray().length).toBe(2);
  });

  it('should group ok', function() {
    const data = genData();
    const q = new Query(data);
    const q2 = q.group({ field: 'name' });
    expect(q2.toArray().length).toBe(2);
    expect(q2.toArray()[0].field).toBe('name');
    expect(q2.toArray()[0].value).toBe('aaa');
    expect(q2.toArray()[0].items[0].id).toBe(1);
    expect(q2.toArray()[1].items[0].id).toBeGreaterThan(10);

    const q3 = q.group([{ field: 'name' }, { field: 'gen' }]);
    expect(q3.toArray().length).toBe(2);
    expect('field' in q3.toArray()[0].items[0]).toBeTruthy();
    expect('items' in q3.toArray()[0].items[0]).toBeTruthy();
    expect(
      ((q3.toArray()[0].items[0] as GroupItem<typeof data[0]>)
        .items as typeof data)[0].id
    ).toBeLessThan(11);
  });

  it('should groupBy', function() {
    const data = genData();
    const q = new Query(data);
    const q2 = q.groupBy('name');
    expect(q2.toArray().length).toBe(2);
    expect(q2.toArray()[0].field).toBe('name');
    expect(q2.toArray()[0].value).toBe('aaa');
    expect(q2.toArray()[0].items[0].id).toBe(1);
    expect(q2.toArray()[1].items[0].id).toBeGreaterThan(10);
  });

  it('should aggregate', function() {
    const data = genData();
    const q = new Query(data);
    const rs = q.aggregate([
      { field: 'name', aggregate: 'count' },
      { field: 'age', aggregate: 'max' },
    ]);

    expect(rs.name.count).toBe(20);
    expect(rs.age.max).toBe(200);
  });
});
