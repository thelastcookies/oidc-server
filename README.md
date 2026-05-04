# OIDC Server — SSO 统一认证中心

基于 [oidc-provider](https://github.com/panva/node-oidc-provider) 实现的 OpenID Connect 认证服务器，提供 SSO 单点登录能力。

技术栈：Koa 3 + TypeScript + Prisma + MySQL + oidc-provider 9

---

## 第一部分：OIDC 原理与流转流程

### 什么是 OIDC？

OIDC（OpenID Connect）是建立在 OAuth 2.0 之上的身份认证协议。OAuth 2.0 解决的是"授权"问题（让第三方应用代替你访问资源），而 OIDC 在此基础上增加了"认证"能力（证明你是谁），通过 ID Token 标准化地传递用户身份信息。

### 核心角色

| 角色 | 本项目对应 | 说明 |
|------|-----------|------|
| OP（OpenID Provider） | 本认证服务 | 负责认证用户身份、签发令牌 |
| RP（Relying Party） | 接入的业务系统 | 依赖 OP 完成用户认证 |
| End-User | 用户 | 在 OP 完成登录的人 |

### Authorization Code Flow

本项目使用 OIDC 最安全、最推荐的授权码模式（Authorization Code Flow），完整流程如下：

```
┌───────────┐                                ┌──────────────┐     ┌──────────────┐
│ 用户浏览器  │                                │  SSO 认证中心 │     │  Vue 登录页   │
└─────┬─────┘                                └──────┬───────┘     └──────┬───────┘
      │                                             │                    │
      │ ① 访问受保护页面                              │                    │
      │─────────────────→ 子系统A                    │                    │
      │                                             │                    │
      │ ② 302 → /auth?client_id=A&redirect_uri=... │                    │
      │────────────────────────────────────────────→│                    │
      │                                             │                    │
      │ ③ 无会话 → 302 → /oidc/interaction/:uid     │                    │
      │─────────────────────────────────────────────────────────────────→│
      │                                             │                    │
      │ ④ 展示登录/注册页面                           │                    │
      │←─────────────────────────────────────────────────────────────────│
      │                                             │                    │
      │ ⑤ 提交登录 POST /oidc/interaction/:uid/login │                    │
      │─────────────────────────────────────────────────────────────────→│
      │                                             │  验证凭证           │
      │                                             │←───────────────────│
      │                                             │                    │
      │ ⑥ 返回 { redirect: "callback?code=xxx" }    │                    │
      │←─────────────────────────────────────────────────────────────────│
      │                                             │                    │
      │ ⑦ 跳转到 callback?code=xxx                  │                    │
      │─────────────────→ 子系统A                    │                    │
      │                                             │                    │
      │              ⑧ POST /token code=xxx        │                    │
      │              子系统A ───────────────────────→│                    │
      │                                             │                    │
      │              ⑨ { access_token, id_token }  │                    │
      │              子系统A ←───────────────────────│                    │
      │                                             │                    │
      │ ⑩ 登录成功                                  │                    │
      │←───────────────── 子系统A                    │                    │
      │                                             │                    │
      │ ═══════════════ SSO 生效 ══════════════════════                    │
      │                                             │                    │
      │ ⑪ 访问子系统B                                │                    │
      │─────────────────→ 子系统B                    │                    │
      │                                             │                    │
      │ ⑫ 302 → /auth?client_id=B                  │                    │
      │────────────────────────────────────────────→│                    │
      │                                             │                    │
      │ ⑬ 有会话 → 直接签发授权码（无需再登录！）        │                    │
      │←────────────────────────────────────────────│                    │
```

**步骤 ⑬ 就是 SSO 的核心**：用户在系统 A 登录后，认证中心已建立会话（Session Cookie），访问系统 B 时浏览器自动携带此 Cookie，认证中心识别到会话后直接签发授权码，用户无需再次输入密码。

### 令牌体系

| 令牌 | 用途 | 有效期 | 存储 |
|------|------|--------|------|
| Authorization Code | 一次性授权码，换取令牌 | 10 分钟 | oidc_payload 表 |
| Access Token | 访问受保护资源的凭证 | 1 小时 | oidc_payload 表 |
| ID Token | 用户身份证明（JWT 格式，RS256 签名） | 1 小时 | 不存储，按需签发 |
| Refresh Token | 续期 Access Token | 7 天 | oidc_payload 表 |

### 为什么用 RS256？

| 算法 | 密钥类型 | 验证方式 | 适用场景 |
|------|---------|---------|---------|
| HS256 | 对称密钥 | 需要共享密钥 | 单服务内部 |
| RS256 | 非对称密钥 | 公钥验证，私钥签名 | **多服务 SSO** ✅ |

RS256 的关键优势：认证中心用私钥签名，子系统只需通过 `/.well-known/jwks.json` 获取公钥验证，不需要共享密钥，更安全。

---

## 第二部分：项目结构与模块分析

### 目录结构

```
src/
├── app.ts              # 入口：OIDC Provider 即主应用，自定义路由作为附加中间件
├── prisma.ts           # Prisma Client 单例
├── controller/
│   └── index.ts        # 控制器：交互流程 + 客户端管理
├── service/
│   └── index.ts        # 业务逻辑：客户端 CRUD + 用户凭证验证
├── router/
│   └── index.ts        # 路由定义：交互接口 + 客户端管理接口
├── middleware/
│   ├── logger.ts       # 请求日志（log4js）
│   ├── oidc-auth.ts    # OIDC Access Token 认证中间件
│   └── response.ts     # 统一响应格式 + 404 处理
├── oidc/
│   ├── adapter.ts      # Prisma 适配器：将 oidc-provider 数据持久化到 MySQL
│   ├── config.ts       # OIDC 配置：scope、claims、TTL、Cookie 等
│   └── provider.ts     # Provider 初始化：RSA 密钥管理 + 全局错误处理
├── types/
│   ├── api.ts          # API 层类型：请求体、响应体、客户端信息
│   ├── oidc.ts         # OIDC 层类型：交互详情、密钥、载荷记录
│   ├── koa.d.ts        # Koa Context 扩展（添加 oidc 属性）
│   └── oidc-provider.d.ts  # oidc-provider 类型增强
└── utils/
    └── log.ts          # log4js 配置
```

### 架构设计

OIDC Provider 本身就是主应用（Koa 实例），自定义路由作为附加中间件挂载：

```
OIDC Provider App
├── Provider 内部中间件（错误处理、路由等）
│   ├── OIDC 路由 → 直接处理，不调用 next()
│   │   /auth, /token, /me, /jwks, /.well-known/openid-configuration
│   └── 非 OIDC 路由 → 调用 next()
├── responseMiddleware   ← 只处理自定义路由
├── loggerMiddleware
├── cors / bodyParser
└── router (/oidc/interaction/*, /oidc/client/*)
```

这种架构下，OIDC 路由由 Provider 的路由器直接处理，不会经过我们的中间件，因此响应格式中间件无需做路径跳过判断。

### 模块详解

#### 1. Prisma Adapter — `oidc/adapter.ts`

oidc-provider 默认将数据存储在内存中，服务重启后数据丢失。本适配器实现了 Adapter 接口，将数据持久化到 MySQL。

oidc-provider 需要存储 7 种类型的数据，按生命周期分为两类：

**永久数据** — `oidc_client` 表：

| 数据类型 | 说明 |
|---------|------|
| Client | 客户端应用配置（client_id、redirect_uris 等） |

**临时数据** — `oidc_payload` 表：

| 数据类型 | 说明 | 生命周期 |
|---------|------|---------|
| AuthorizationCode | 授权码（一次性使用） | 10 分钟 |
| AccessToken | 访问令牌 | 1 小时 |
| RefreshToken | 刷新令牌 | 7 天 |
| Session | 用户会话 | 7 天 |
| Interaction | 交互状态 | 1 小时 |
| Grant | 授权记录 | 7 天 |

关键机制：
- **惰性删除**：查询时发现过期数据自动清理，无需定时任务
- **grantId 批量撤销**：用户登出时，通过 `deleteMany({ grantId })` 一次性撤销该授权下的所有令牌
- **consume 防重放**：授权码使用后标记 `consumedAt`，二次使用会被拒绝

#### 2. OIDC 配置 — `oidc/config.ts`

定义 SSO 认证中心的行为规则：

```typescript
// 支持的权限范围
scopes: ['openid', 'profile', 'email', 'offline_access']

// 每个 scope 返回哪些用户属性
claims: {
  openid: ['sub'],           // sub = 用户唯一标识（必须）
  profile: ['name', 'username'],
}

// 交互 URL：未登录时重定向到自定义交互路由
interactions: {
  url: (_ctx, interaction) => `/oidc/interaction/${interaction.uid}`
}

// Cookie 配置：OIDC 依赖 Cookie 维持 SSO 会话
cookies: {
  keys: ['oidc-cookie-key-1', 'oidc-cookie-key-2'],  // 签名密钥
}

// 账号查找：通过 sub（用户 ID）查找用户信息
findAccount: async (_ctx, id) => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
  return { accountId: id, async claims() { return { sub: id, name: user.username }; } };
}
```

#### 3. Provider 初始化 — `oidc/provider.ts`

RSA 密钥管理是核心——密钥持久化到数据库，服务重启后不需要重新生成。如果重新生成，之前签发的所有令牌都会失效（公钥变了，子系统无法验证旧令牌）。

#### 4. 数据模型 — `prisma/schema.prisma`

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `user` | SSO 用户账号 | id, username, password(bcrypt) |
| `oidc_client` | 客户端应用配置 | id("Client:xxx"), data(JSON) |
| `oidc_payload` | 临时数据 | id("AccessToken:xxx"), type, grantId, expiresAt, consumedAt |
| `oidc_key` | RSA 签名密钥 | kid, data(JWK) |

#### 5. 认证中间件 — `middleware/oidc-auth.ts`

用 OIDC Provider 签发的 Access Token 保护客户端管理接口。验证流程：

1. 从 `Authorization: Bearer <token>` 提取令牌
2. 通过 PrismaAdapter 在数据库中查找 `AccessToken:<token>` 记录
3. 适配器的 `find` 方法已包含过期检查，过期令牌返回 `undefined`
4. 从令牌数据中提取 `accountId` 作为用户标识

### 路由总览

| 路由 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/auth` | GET | 无 | OIDC 授权端点（Provider 内置） |
| `/token` | POST | 无 | OIDC 令牌端点（Provider 内置） |
| `/me` | GET | Bearer | OIDC UserInfo 端点（Provider 内置） |
| `/jwks` | GET | 无 | OIDC JWKS 端点（Provider 内置） |
| `/.well-known/openid-configuration` | GET | 无 | OIDC Discovery 端点（Provider 内置） |
| `/session/end` | GET | 无 | OIDC 登出端点（Provider 内置） |
| `/oidc/interaction/:uid` | GET | 无 | 重定向到 Vue 登录页 |
| `/oidc/interaction/:uid/login` | POST | 无 | 提交登录凭证 |
| `/oidc/interaction/:uid/register` | POST | 无 | 注册新用户并自动登录 |
| `/oidc/interaction/:uid/confirm` | POST | 无 | 确认授权 |
| `/oidc/interaction/:uid/abort` | POST | 无 | 取消授权 |
| `/oidc/client` | POST | Bearer | 创建客户端 |
| `/oidc/client` | GET | Bearer | 获取客户端列表 |
| `/oidc/client/:clientId` | GET | Bearer | 获取客户端详情 |
| `/oidc/client/:clientId` | PUT | Bearer | 更新客户端配置 |
| `/oidc/client/:clientId` | DELETE | Bearer | 删除客户端 |

---

## 第三部分：前端登录页接入

### 概述

认证服务不再渲染登录页面，而是通过 302 重定向将用户引导至 Vue 登录页，将交互上下文（uid、client_id 等）作为 URL 参数传递。Vue 登录页根据这些参数调用认证服务的交互接口完成登录/注册。

### 重定向 URL 格式

当用户未登录时，认证服务会 302 重定向到：

```
https://sso.example.com/login?uid=xxx&prompt=login&client_id=my-app&scope=openid+profile
```

| 参数 | 说明 |
|------|------|
| `uid` | 交互会话 ID，调用交互接口时必须携带 |
| `prompt` | 交互类型：`login`（需要登录）或 `consent`（需要确认授权） |
| `client_id` | 请求授权的子系统标识（可选） |
| `scope` | 请求的权限范围（可选） |

### Vue 登录页实现示例

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

// 从 URL 获取交互上下文
const uid = route.query.uid as string;
const clientId = route.query.client_id as string;
const prompt = route.query.prompt as string;

const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const errorMsg = ref('');
const isRegisterMode = ref(false);

// 认证服务地址
const OIDC_SERVER = 'http://localhost:8190';

const submitLogin = async () => {
  errorMsg.value = '';
  try {
    const res = await fetch(`${OIDC_SERVER}/oidc/interaction/${uid}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await res.json();
    if (data.success && data.data?.redirect) {
      // 跳转回业务系统
      window.location.href = data.data.redirect;
    } else {
      errorMsg.value = data.msg || '登录失败';
    }
  } catch {
    errorMsg.value = '网络错误，请重试';
  }
};

const submitRegister = async () => {
  if (password.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的密码不一致';
    return;
  }
  errorMsg.value = '';
  try {
    const res = await fetch(`${OIDC_SERVER}/oidc/interaction/${uid}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await res.json();
    if (data.success && data.data?.redirect) {
      // 注册成功自动登录，跳转回业务系统
      window.location.href = data.data.redirect;
    } else {
      errorMsg.value = data.msg || '注册失败';
    }
  } catch {
    errorMsg.value = '网络错误，请重试';
  }
};
</script>

<template>
  <div class="login-container">
    <h1>统一认证</h1>
    <p v-if="clientId" class="client-info">应用: {{ clientId }}</p>

    <!-- 登录/注册切换 -->
    <div class="tabs">
      <span :class="{ active: !isRegisterMode }" @click="isRegisterMode = false">登录</span>
      <span :class="{ active: isRegisterMode }" @click="isRegisterMode = true">注册</span>
    </div>

    <!-- 登录表单 -->
    <form v-if="!isRegisterMode" @submit.prevent="submitLogin">
      <input v-model="username" placeholder="用户名" required />
      <input v-model="password" type="password" placeholder="密码" required />
      <button type="submit">登录</button>
    </form>

    <!-- 注册表单 -->
    <form v-else @submit.prevent="submitRegister">
      <input v-model="username" placeholder="用户名" required />
      <input v-model="password" type="password" placeholder="密码" required />
      <input v-model="confirmPassword" type="password" placeholder="确认密码" required />
      <button type="submit">注册</button>
    </form>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
  </div>
</template>
```

### 接口说明

#### 登录

```
POST /oidc/interaction/:uid/login
Content-Type: application/json

{ "username": "xxx", "password": "xxx" }

→ 成功: { "success": true, "data": { "redirect": "https://业务系统/callback?code=授权码" } }
→ 失败: { "success": false, "msg": "用户名或密码错误" }
```

#### 注册

```
POST /oidc/interaction/:uid/register
Content-Type: application/json

{ "username": "xxx", "password": "xxx" }

→ 成功: { "success": true, "data": { "redirect": "https://业务系统/callback?code=授权码" } }
→ 失败: { "success": false, "msg": "用户名已存在" }
```

注册成功后自动完成 OIDC 登录流程，无需再次输入密码。

#### 确认授权

```
POST /oidc/interaction/:uid/confirm

→ 成功: { "success": true, "data": { "redirect": "..." } }
```

#### 取消授权

```
POST /oidc/interaction/:uid/abort

→ 成功: { "success": true, "data": { "redirect": "..." } }
```

### 状态保持

SSO 的状态保持由认证服务器域下的 **Session Cookie** 自动管理，Vue 登录页不需要做任何额外工作。用户登录成功后，浏览器自动保存 Cookie；后续访问其他业务系统时，浏览器自动携带此 Cookie，认证服务器识别到会话后直接签发授权码。

### 登出

认证服务使用 OIDC 标准的 RP-Initiated Logout，Vue 前端只需重定向到：

```
/session/end?id_token_hint=xxx&post_logout_redirect_uri=https://业务系统
```

参数说明：
- `id_token_hint`：之前获取的 ID Token，用于标识要登出的会话
- `post_logout_redirect_uri`：登出后重定向的地址，必须在客户端的 `post_logout_redirect_uris` 白名单中

---

## 第四部分：业务系统接入

### 第一步：注册 OIDC 客户端

每个想接入 SSO 的业务系统都需要先注册为 OIDC Client。通过认证服务的客户端管理接口注册：

```
POST /oidc/client
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "client_id": "my-app",
  "client_secret": "my-secret",
  "redirect_uris": ["https://my-app.com/callback"],
  "post_logout_redirect_uris": ["https://my-app.com"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"]
}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `client_id` | 是 | 客户端标识，全局唯一 |
| `client_secret` | 是 | 客户端密钥，bcrypt 哈希后存储 |
| `redirect_uris` | 是 | 授权回调地址白名单，防止开放重定向攻击 |
| `post_logout_redirect_uris` | 否 | 登出后重定向地址白名单 |
| `grant_types` | 否 | 默认 `["authorization_code", "refresh_token"]` |
| `response_types` | 否 | 默认 `["code"]`（授权码模式） |

### 第二步：业务系统前端 — 发起登录/登出

#### 方式一：使用 oidc-client-ts（推荐）

```typescript
import { UserManager } from 'oidc-client-ts';

const userManager = new UserManager({
  authority: 'http://localhost:8190',           // 认证服务地址
  client_id: 'my-app',                          // 注册的 client_id
  redirect_uri: 'https://my-app.com/callback',  // 回调地址
  post_logout_redirect_uri: 'https://my-app.com',
  response_type: 'code',
  scope: 'openid profile offline_access',
});

// 发起登录 → 重定向到认证服务
await userManager.signinRedirect();

// 回调页面处理 → 用授权码换取令牌
const user = await userManager.signinRedirectCallback();
// user.profile.sub = 用户 ID
// user.profile.name = 用户名
// user.access_token = 访问令牌
// user.id_token = ID 令牌

// 发起登出 → 重定向到认证服务登出端点
await userManager.signoutRedirect();

// 获取当前用户（判断是否已登录）
const currentUser = await userManager.getUser();
```

#### 方式二：手动实现

```typescript
// 发起登录
const login = () => {
  const params = new URLSearchParams({
    client_id: 'my-app',
    redirect_uri: 'https://my-app.com/callback',
    response_type: 'code',
    scope: 'openid profile offline_access',
  });
  window.location.href = `http://localhost:8190/auth?${params}`;
};

// 发起登出
const logout = (idToken: string) => {
  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: 'https://my-app.com',
  });
  window.location.href = `http://localhost:8190/session/end?${params}`;
};
```

### 第三步：业务系统后端 — 用授权码换取令牌

```typescript
// 回调接口：接收授权码，换取令牌
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  const tokenResponse = await fetch('http://localhost:8190/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      client_id: 'my-app',
      client_secret: 'my-secret',
      redirect_uri: 'https://my-app.com/callback',
    }),
  });

  const tokens = await tokenResponse.json();
  // tokens = {
  //   access_token: "xxx",    // 访问令牌
  //   id_token: "xxx",        // ID 令牌（JWT 格式，包含用户信息）
  //   refresh_token: "xxx",   // 刷新令牌
  //   token_type: "Bearer",
  //   expires_in: 3600,
  // }

  // 用 access_token 获取用户信息
  const userInfo = await fetch('http://localhost:8190/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  // userInfo = { sub: "1", name: "admin", username: "admin" }

  // 建立业务系统自己的会话...
});
```

### 刷新令牌

Access Token 过期后，用 Refresh Token 续期，无需用户重新登录：

```typescript
const refreshResponse = await fetch('http://localhost:8190/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: storedRefreshToken,
    client_id: 'my-app',
    client_secret: 'my-secret',
  }),
});
const newTokens = await refreshResponse.json();
```

### 接入检查清单

- [ ] 在认证服务注册 Client（client_id、client_secret、redirect_uris）
- [ ] 前端配置 OIDC 客户端（authority、client_id、redirect_uri）
- [ ] 后端实现 `/callback` 接口（用授权码换取令牌）
- [ ] 后端实现会话管理（建立/销毁业务系统会话）
- [ ] 配置登出逻辑（重定向到 `/session/end`）
- [ ] （可选）配置 Refresh Token 续期逻辑

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `DATABASE_URL` | MySQL 连接字符串 | — |
| `OIDC_ISSUER` | OIDC Issuer URL | `http://localhost:8190` |
| `SSO_LOGIN_PAGE` | Vue 登录页 URL | `http://localhost:5173/login` |
| `COOKIE_KEYS` | Cookie 签名密钥（逗号分隔） | `oidc-cookie-key-1,oidc-cookie-key-2` |
| `POST_LOGOUT_REDIRECT_URI` | 登出后默认重定向地址 | `http://localhost:3000` |

## 开发

```bash
# 安装依赖
pnpm install

# 生成 Prisma Client
pnpm generate

# 启动开发服务器
pnpm dev

# 构建
pnpm build:esbuild
```
