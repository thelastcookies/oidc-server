import dotenv from 'dotenv';
import fs from 'node:fs';
import http from 'node:http';
import type { ServerOptions } from 'node:https';
import https from 'node:https';
import bodyParser from '@koa/bodyparser';
import ip from 'ip';
import router from './router';
import loggerMiddleware from './middleware/logger.ts';
import responseMiddleware from './middleware/response.ts';
import initProvider from './oidc/provider.ts';

dotenv.config({
  path: ['.env/.env', '.env/.env.development', '.env/.env.production'],
});

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
 * 架构：OIDC Provider 本身就是主应用，自定义路由作为附加中间件。
 *
 * 请求处理流程：
 * - OIDC 路由（/auth、/token、/me、/jwks 等）：
 *   Provider 的内部路由器直接处理，不经过我们的中间件
 * - 自定义路由（/oidc/interaction/* 等）：
 *   Provider 的路由器不匹配，调用 next()，我们的中间件接管
 *
 * CORS 处理：
 *   由于 Provider 内部路由在自定义中间件之前执行，
 *   通过 @koa/cors 添加的 CORS 头不会应用到 OIDC 内部路由。
 *   因此使用 http 模块包装，在所有响应（包括 OIDC 内部路由）前添加 CORS 头。
 */
const start = async () => {
  const provider = await initProvider();

  // 自定义中间件：添加在 Provider 内部中间件之后，仅处理非 OIDC 路由
  provider.use(responseMiddleware);
  provider.use(loggerMiddleware);
  // provider.use(cors());
  provider.use(bodyParser());
  provider.use(router.routes()).use(router.allowedMethods());

  // 屏蔽默认错误输出
  provider.silent = true;

  const handler = provider.callback();

  // 全局 CORS 处理，委托给 oidc-provider 的请求处理器
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

    // 委托给 oidc-provider 处理
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
    - Local:   ${protocol}://localhost:${PORT}/.well-known/openid-configuration
    - Network: ${protocol}://${ipAddr}:${PORT}/.well-known/openid-configuration`,
    ),
  );
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
