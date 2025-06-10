# data-source

[![GitHub Actions: Run tests](https://github.com/moln/data-source/workflows/main/badge.svg)](https://github.com/moln/data-source/actions?query=workflow%3A%22main%22)
[![Coverage Status](https://coveralls.io/repos/github/Moln/data-source/badge.svg?branch=master)](https://coveralls.io/github/Moln/data-source?branch=master)
[![GitHub license](https://img.shields.io/github/license/Moln/data-source)](https://github.com/Moln/data-source)
[![npm](https://img.shields.io/npm/v/@moln/data-source.svg)](https://www.npmjs.com/@moln/data-source)

便捷性管理集合数据状态操作，用于 vue, react 等视图应用库

## 依赖 

- mobx
- axios

## 安装

```
npm install @moln/data-source
```

或者使用 `yarn`

```
yarn add @moln/data-source
```


## 使用

```
const resources = new Resources()
const dataSource = resources.create("/api/users")

dataSource.fetch();  // GET /api/users
console.log(dataSource.data) // Response collections

const item = dataSource.get(1) // Get item by primary 
item.name = "foo"

// Sync changes 
dataSource.sync()
// PATCH /api/users/1
// Body: {"name":"foo"}
```

### React + Mobx

```js
import {Table, Button} from 'antd'
import {observer} from "mobx-react-lite"
const useDataSource = (resource) => {
    /// Request restful resource
    return useMemo(() => (new Resources()).createDataSource(`/api/${resource}`), []);
    
    // Array data source
    // return useMemo(() => (new Resources()).createDataSourceByArray([
    //     {id: 1, name: 'Tom', score: 3},
    //     {id: 2, name: 'Jerry', score: 4},
    // ]), []);
}
const App = observer(() => {
    const ds = useDataSource("users")
    const handleDelete = (row) => {
        ds.remove(row)
        ds.sync() // Sync data source changes, request `DELETE /users/{id}`
    }
    const handleIncrScore = (row) => {
        row.score++
        ds.sync() // Sync data source changes, request `PATCH /users/{id}`, body: `{"score": 3}`
    }
    return (
        <Table
            rowKey={ds.primary}
            dataSource={ds.data}
            loading={ds.loading}
            columns={[
                {
                    dataIndex: 'id',
                    title: '#',
                },
                {
                    dataIndex: 'name',
                    title: 'Name',
                },
                {
                    dataIndex: 'score',
                    title: 'score',
                },
                {
                    render: (row) => {
                        return <Button onClick={() => handleIncrScore(row)}>Incr</Button>
                        return <Button loading={ds.loadings.syncing} onClick={() => handleDelete(row)}>Delete</Button>
                    }
                },
            ]}
        />
    )
})
```