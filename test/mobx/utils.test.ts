import { observable } from 'mobx';
import { deepIntercept, deepObserve } from '../../src/mobx/utils';
import { expect, describe, it, vi } from 'vitest'

describe('mobx/utils', () => {
  it('deepObserve', () => {
    const obj = { a: 1, b: 2, c: { c1: 'c1', c2: [1, 2, 3] } };
    const obObj = observable(obj);

    const mockCall = vi.fn((change, path, root) => {});

    deepObserve(obObj, mockCall);

    obObj.a = 2;
    obObj.c.c1 = 'c2';
    obObj.c.c2.push(4);
    obObj.c.c2[0] = 3;
    obObj.c = { c1: 'cc2', c2: [] };
    obObj.c.c1 = 'c3';

    expect(mockCall.mock.calls.length).toBe(6);
    expect(mockCall.mock.calls[0][0].type).toBe('update');
    expect(mockCall.mock.calls[0][0].newValue).toBe(2);

    expect(mockCall.mock.calls[1][0].type).toBe('update');
    expect(mockCall.mock.calls[1][0].newValue).toBe('c2');
    expect(mockCall.mock.calls[1][1]).toEqual(['c']);

    expect(mockCall.mock.calls[2][0].type).toBe('splice');
    expect(mockCall.mock.calls[2][1]).toEqual(['c', 'c2']);

    expect(mockCall.mock.calls[3][0].type).toBe('update');
    expect(mockCall.mock.calls[3][1]).toEqual(['c', 'c2']);

    expect(mockCall.mock.calls[5][0].type).toBe('update');
    expect(mockCall.mock.calls[5][1]).toEqual(['c']);
  });

  it('deepIntercept', function() {
    const obj = { a: 1, b: 2, c: { c1: 'c1', c2: [1, 2, 3] } };
    const obObj = observable(obj);

    const mockCall = vi.fn((change, path: string[], root: object) => {
      if (change.newValue === 2) {
        return null;
      }

      return change;
    });

    deepIntercept(obObj, mockCall as any);

    obObj.a = 2;
    obObj.c.c1 = 'c2';
    obObj.c.c2.push(4);
    obObj.c.c2[0] = 3;
    obObj.c = { c1: 'cc2', c2: [] };
    obObj.c.c1 = 'c3';

    expect(obObj.a).toBe(1);

    expect(mockCall.mock.calls.length).toBe(6);
    expect(mockCall.mock.calls[0][0].type).toBe('update');
    expect(mockCall.mock.calls[0][0].newValue).toBe(2);
    expect(mockCall.mock.results[0].value).toBeNull();

    expect(mockCall.mock.calls[1][0].type).toBe('update');
    expect(mockCall.mock.calls[1][0].newValue).toBe('c2');
    expect(mockCall.mock.calls[1][1]).toEqual(['c']);

    expect(mockCall.mock.calls[2][0].type).toBe('splice');
    expect(mockCall.mock.calls[2][1]).toEqual(['c', 'c2']);

    expect(mockCall.mock.calls[3][0].type).toBe('update');
    expect(mockCall.mock.calls[3][1]).toEqual(['c', 'c2']);

    expect(mockCall.mock.calls[5][0].type).toBe('update');
    expect(mockCall.mock.calls[5][1]).toEqual(['c']);
  });
});
