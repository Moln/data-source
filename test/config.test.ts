import { expect, describe, it } from 'vitest'
import {commonConfigs, config} from "../src/config";
import {ArrayProvider, DataSource} from "../src";

describe('DataSource', () => {
    it('DataSource add model', () => {
        config({
            pagination: {
                defaultPageSize: 200
            }
        })

        expect(commonConfigs.pagination.defaultPageSize).toBe(200)
        const ds = new DataSource(new ArrayProvider([]))
        expect(ds.pageSize).toBe(200)
    });
});