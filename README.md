# data-source
Data source 


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
