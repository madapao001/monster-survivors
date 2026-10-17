# Cloudflare Workers 部署指南

## 前提条件

1. 注册 Cloudflare 账号：https://dash.cloudflare.com/sign-up
2. 安装 Node.js：https://nodejs.org/
3. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```

## 部署步骤

### 1. 登录 Wrangler

```bash
wrangler login
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create coupon-draw-db
```

记录返回的 `database_id`，稍后会用到。

### 3. 更新 wrangler.toml

把 `wrangler.toml` 中的 `database_id` 替换为上一步得到的真实 ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "coupon-draw-db"
database_id = "你的真实-database-id"
```

### 4. 初始化数据库表

```bash
wrangler d1 execute coupon-draw-db --file=./schema.sql
```

### 5. 部署 Workers

```bash
cd coupon-draw-worker
wrangler deploy
```

部署成功后会输出 Workers URL，例如：
```
https://coupon-draw-api.your-account.workers.dev
```

### 6. 更新前端 API 地址

修改 `coupon-draw/index.html` 中的 `API_BASE`：

```javascript
const API_BASE = 'https://coupon-draw-api.your-account.workers.dev';
```

把 `your-account` 替换为你的实际子域名。

## 免费额度

- Workers：10 万次请求/天
- D1：500 万行读取/天，10 万次写入/天
- 完全够用，**不会过期**

## 管理后台

默认管理员密码：`cyber888`

进入管理员面板后可以：
- 批量导入优惠券编码
- 查看剩余数量
- 导出数据
- 修改密码
