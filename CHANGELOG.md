# Changelog

## 1.0.0 (2026-09-23)


### Features

* 初步完成 OIDC 认证功能 ([167f5a6](https://github.com/thelastcookies/oidc-server/commit/167f5a6da4c3bc947a0a9677e760190f38cc0345))
* 启用本地 https 服务，便于开发时调试 ([9e45d90](https://github.com/thelastcookies/oidc-server/commit/9e45d906e50af2d86b95f5c09ce512e585b218e5))
* 新增 user 的 realName 字段 ([ad4222f](https://github.com/thelastcookies/oidc-server/commit/ad4222fb9c6a79eefb8ab9f2bedea5b1c709ad6c))
* 新增冷启动时的 Client 种子 ([b176612](https://github.com/thelastcookies/oidc-server/commit/b1766127df5f9a6084910626f5356e48f91b3362))
* 新增用户、角色、超管 prisma 配置与超管的初始化 seed 脚本 ([63909d2](https://github.com/thelastcookies/oidc-server/commit/63909d26378e9595700a8f2b38643780a91f2c86))
* 新增用户、角色管理，密码修改接口以及部分接口的超管权限认证 ([590ca94](https://github.com/thelastcookies/oidc-server/commit/590ca947691403a07687fc826502ae409800928e))
* 新增统一的错误输出格式 ([a65297a](https://github.com/thelastcookies/oidc-server/commit/a65297ab0b3223db49d04443ba1cd4d3068b8402))


### Bug Fixes

* 修复 OIDC 登录、注册、认证接口的问题 ([4ac6044](https://github.com/thelastcookies/oidc-server/commit/4ac6044b76555bc217d9127340b08706d9997115))
* 修复 provider 没有在上下文中被正确获取的问题 ([7e140d9](https://github.com/thelastcookies/oidc-server/commit/7e140d9c2cfa9837a6442b7d0685a748f29060e2))
* 修复默认 Client 的初始化问题 ([fc5ac78](https://github.com/thelastcookies/oidc-server/commit/fc5ac78dc6c90db458d364c843c741cab2449d42))
* 修改跨域处理方式，解决内部路由间无法识别的问题 ([8b5cecb](https://github.com/thelastcookies/oidc-server/commit/8b5cecb446796b89e208f1f25146c15bed6ef41e))
* 修改返回格式中间件，解决返回格式包装后客户端无法识别的问题 ([32aae36](https://github.com/thelastcookies/oidc-server/commit/32aae36a2dab6979e1ce4a1ce13080a3cfbb3815))
* 移除无用的 claims 字段 ([2639dba](https://github.com/thelastcookies/oidc-server/commit/2639dba6c84132b95c5f6324a84b27fb458e697e))
* 解决登出失败的问题 ([8f7ca5f](https://github.com/thelastcookies/oidc-server/commit/8f7ca5fdcf8bcbe205b688c92c81bd5f2574579c))
