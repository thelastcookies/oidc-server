# Changelog

## 1.0.0 (2026-05-08)


### Features

* 初步完成 OIDC 认证功能 ([167f5a6](https://github.com/thelastcookies/oidc-server/commit/167f5a6da4c3bc947a0a9677e760190f38cc0345))
* 新增冷启动时的 Client 种子 ([b176612](https://github.com/thelastcookies/oidc-server/commit/b1766127df5f9a6084910626f5356e48f91b3362))
* 新增统一的错误输出格式 ([a65297a](https://github.com/thelastcookies/oidc-server/commit/a65297ab0b3223db49d04443ba1cd4d3068b8402))


### Bug Fixes

* 修复 OIDC 登录、注册、认证接口的问题 ([4ac6044](https://github.com/thelastcookies/oidc-server/commit/4ac6044b76555bc217d9127340b08706d9997115))
* 修复 provider 没有在上下文中被正确获取的问题 ([7e140d9](https://github.com/thelastcookies/oidc-server/commit/7e140d9c2cfa9837a6442b7d0685a748f29060e2))
* 修复默认 Client 的初始化问题 ([fc5ac78](https://github.com/thelastcookies/oidc-server/commit/fc5ac78dc6c90db458d364c843c741cab2449d42))
* 修改跨域处理方式，解决内部路由间无法识别的问题 ([8b5cecb](https://github.com/thelastcookies/oidc-server/commit/8b5cecb446796b89e208f1f25146c15bed6ef41e))
* 修改返回格式中间件，解决返回格式包装后客户端无法识别的问题 ([32aae36](https://github.com/thelastcookies/oidc-server/commit/32aae36a2dab6979e1ce4a1ce13080a3cfbb3815))
