# 实体分析与风险预警原型系统

项目中的真实账号、密码和私钥已替换为 `********`。首次启动前，请按下列说明填入本机测试环境的值。

## 一、启动前需要填写的内容

### 1. Node 后端配置：`server/.env`

打开 `server/.env`，将其中的 `********` 替换为自己的配置：

| 变量 | 应填写的内容 |
| --- | --- |
| `DB_HOST` | MySQL 地址，本机通常为 `localhost` |
| `DB_USER` | MySQL 用户名 |
| `DB_PASS` | MySQL 密码 |
| `DB_NAME` | 已创建的数据库名，默认使用 `blockchain_shop` |
| `JWT_SECRET` | 自定义随机字符串，Node 后端签发和校验登录令牌时使用 |
| `EMAIL_USER` | 用于发送验证码的邮箱地址 |
| `EMAIL_PASS` | 邮箱 SMTP 授权码，不是网页登录密码 |
| `PORT` | Node 后端端口，默认 `3000` |
| `ADMIN_PRIVATE_KEY` | Ganache 中平台管理员测试账户的私钥，通常以 `0x` 开头 |
| `CONTRACT_ADDRESS` | 执行 `truffle migrate` 后得到的智能合约部署地址 |
| `RPC_URL` | Ganache RPC 地址，当前配置使用 `http://127.0.0.1:7545` |
| `ADMIN_INVITE_CODE` | 自定义的管理员注册邀请码 |

MySQL 中需提前创建与 `DB_NAME` 一致的数据库。

### 2. Session 密钥：`server/routes/auth.js`

将 Session 配置中的：

```js
secret: '********'
```

替换为一段自定义随机字符串。JWT 的主要配置来自 `server/.env` 中的 `JWT_SECRET`；只要该变量已填写，代码中的 `********` 回退值无需修改。

### 3. SM2 密钥对

在 `server` 目录生成一对新的 SM2 测试密钥：

```powershell
cd server
node generateKeys.js
```

把输出的私钥填入 `server/utils/smCrypto.js` 的 `PRIVATE_KEY`，把对应公钥填入 `chain-vue-front/src/utils/smCrypto.ts` 的 `PUBLIC_KEY`。两者必须来自同一密钥对。

### 4. HTTPS 测试证书

`server/server.key` 已被替换为占位符。启动 Node 后端前，在 `server` 目录重新生成本机自签名证书：

```powershell
cd server
node create-cert.js
```

该命令会重新生成 `server.key` 和 `server.cert`。

### 5. Java 示例后端（仅在使用 `demo` 模块时）

`demo/src/main/resources/application.yml` 中的数据库、邮箱、JWT 和管理员邀请码默认值也已替换为 `********`。运行该模块前设置以下环境变量：

- `DB_HOST`、`DB_NAME`、`DB_USER`、`DB_PASS`
- `EMAIL_USER`、`EMAIL_PASS`
- `JWT_SECRET`、`ADMIN_INVITE_CODE`

不要直接修改 `demo/target/classes/application.yml`；它是构建生成的副本。

## 二、安装依赖

### Node 后端

```powershell
cd server
npm install
```

### 前端

```powershell
cd chain-vue-front
npm install
```

### 算法服务

进入现有 Conda 环境后安装或确认依赖：

```powershell
conda activate block-chain
pip install flask flask-cors pandas lightgbm
```

## 三、开发环境启动顺序

### 1. 启动 MySQL

确认 `server/.env` 中配置的数据库已经创建且可以连接。

### 2. 启动 Ganache

```powershell
ganache -p 7545 -e 1000000
```

### 3. 部署智能合约

在项目根目录执行：

```powershell
truffle migrate
```

首次部署或重新部署后，把新合约地址写入 `server/.env` 的 `CONTRACT_ADDRESS`。

### 4. 启动算法接口

```powershell
cd algorithm
conda activate block-chain
python .\Interface.py
```

### 5. 启动 Node 后端

确认已填写 `server/.env`、SM2 私钥并生成 HTTPS 证书，然后执行：

```powershell
cd server
npx nodemon app.js
```

默认服务地址为 `https://localhost:3000`；未启用有效证书时按程序提示使用 HTTP。

### 6. 启动前端

```powershell
cd chain-vue-front
npm run dev
```

### 7. 可选：启动 Java 示例后端

```powershell
cd demo
.\mvnw.cmd spring-boot:run
```

默认端口为 `8080`。

## 四、PM2 启动

项目根目录下执行：

```powershell
pm2 start ecosystem.config.js
pm2 list
pm2 logs
```

`ecosystem.config.js` 中的 Python 解释器路径需要与本机 `block-chain` 环境的实际路径一致。

常用命令：

```powershell
pm2 restart all
pm2 stop all
pm2 delete all
```

