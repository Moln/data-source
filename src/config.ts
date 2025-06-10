import type RestProvider from "./data-providers/RestProvider";

interface CommonConfig {
    restProvider: NonNullable<ConstructorParameters<typeof RestProvider<any>>[2]>
}
export const commonConfigs: CommonConfig = {
    restProvider: {
        normalizeParams: (params) => ({
            filter: params?.filter,
            sort: params?.sort,
            page: params?.page,
            cursor: params?.cursor,
            page_size: params?.pageSize,
        }),
        normalizeCollectionResponse: (response)=> response.data,
        normalizeEntityResponse: (response) => response.data
    }
}

export const config  = (override: Partial<CommonConfig>) => {
    (Object.entries(override) as [keyof CommonConfig, any][])
        .forEach(([key, configs]) => {
            commonConfigs[key] = {
                ...commonConfigs[key],
                ...configs,
            }
        })
}