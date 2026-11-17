import fs from 'node:fs';
import http from 'node:http';
import type { ServerOptions } from 'node:https';
import https from 'node:https';
import bodyParser from '@koa/bodyparser';
import Koa from 'koa';
import ip from 'ip';
import mount from 'koa-mount';
import type { Provider } from 'oidc-provider';
import router from './router';
import loggerMiddleware from './middleware/logger.ts';
import responseMiddleware from './middleware/response.ts';
import initProvider from './oidc/provider.ts';

const ipAddr = ip.address();
const PORT = process.env.PORT || 3000;

/**
 * 加载 HTTPS 证书配置
 *
 * 通过 mkcert 生成本地受信证书后，配置 SSL_KEY_PATH / SSL_CERT_PATH 即启用 HTTPS。
 * 未配置时保持 HTTP。
 */
const loadHttpsOptions = (): ServerOptions | null => {
  const { SSL_KEY_PATH, SSL_CERT_PATH } = process.env;
  if (!SSL_KEY_PATH || !SSL_CERT_PATH) return null;

  return {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH),
  };
};

/**
 * 启动认证服务
 *
 * 架构：外层 Koa 应用承载自定义路由与通用中间件，
 * 通过 koa-mount 把 OIDC Provider 挂载到 /oidc 前缀下。
 *
 * 请求处理流程：
 * - 自定义路由（/oidc/interaction/*、/oidc/client 等）：
 *   外层 router 先匹配，由自定义中间件直接处理，不进入 Provider
 * - OIDC 内置路由（/oidc/auth、/oidc/token、/oidc/jwks、/oidc/.well-known/* 等）：
 *   外层 router 未命中后，koa-mount 剥掉 /oidc 前缀（/oidc/auth -> /auth），
 *   交给 Provider 内部路由处理，处理完成后还原路径
 *
 * CORS 处理：
 *   为统一覆盖所有响应（含 Provider 内部路由），
 *   使用 http 模块包装，在所有响应前添加 CORS 头。
 */
const start = async () => {
  // 初始化 OIDC Provider
  const provider = await initProvider();

  // 屏蔽默认错误输出
  provider.silent = true;

  // 信任反向代理的 X-Forwarded-* 请求头
  provider.proxy = process.env.TRUST_PROXY === 'true';

  // 外层 Koa 应用：把 provider 实例挂在应用上，供 controller 的 getProvider(ctx) 获取
  // （Provider 不再是主应用，ctx.app 指向外层 Koa 应用，而非 Provider 本身）
  const app = new Koa() as Koa & { provider?: Provider };
  app.provider = provider;
  // 同步 cookie 签名（ctx.app.keys）与代理信任（ctx.app.proxy）
  app.keys = provider.keys;
  app.proxy = provider.proxy;

  app.use(responseMiddleware);
  app.use(loggerMiddleware);
  // app.use(cors());
  app.use(bodyParser());
  // 自定义路由先匹配（/oidc/interaction/*、/oidc/client 等），未命中的才进入挂载的 Provider
  app.use(router.routes()).use(router.allowedMethods());
  // 把 Provider 挂载到 /oidc 前缀下（/oidc/auth -> /auth -> Provider 内部路由）
  // 前缀未命中的请求直接放行；Provider 内部未处理的 /oidc/* 请求会还原路径后继续外层链
  app.use(mount('/oidc', provider));

  // 全局 CORS 处理，委托给外层 Koa 应用的请求处理器
  const handler = app.callback();
  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    // 全局 CORS：在所有响应（包括 OIDC 内部路由）前添加 CORS 头
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    }

    // 处理 CORS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    handler(req, res);
  };

  // 配置了证书路径时启用 HTTPS
  const httpsOptions = loadHttpsOptions();
  const protocol = httpsOptions ? 'https' : 'http';
  const server = httpsOptions
    ? https.createServer(httpsOptions, requestHandler)
    : http.createServer(requestHandler);

  server.listen(PORT, () => console.log(`
🚀 Server ready at:
   - Local:   ${protocol}://localhost:${PORT}
   - Network: ${protocol}://${ipAddr}:${PORT}
📖 OIDC Discovery:
    - Local:   ${protocol}://localhost:${PORT}/oidc/.well-known/openid-configuration
    - Network: ${protocol}://${ipAddr}:${PORT}/oidc/.well-known/openid-configuration`,
    ),
  );
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
