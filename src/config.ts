import type RestProvider from "./data-providers/RestProvider";

export const commonConfigs = {
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
    } as NonNullable<ConstructorParameters<typeof RestProvider<any>>[2]>,
    pagination: {
        defaultPageSize: 20,
    }
}

type CommonConfig = typeof commonConfigs

export const config  = (override: {[P in keyof CommonConfig]?: Partial<CommonConfig[P]>} ) => {
    (Object.entries(override) as [keyof CommonConfig, any][])
        .forEach(([key, configs]) => {
            Object.assign(commonConfigs[key], configs)
        })
}