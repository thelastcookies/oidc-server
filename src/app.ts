import dotenv from 'dotenv';
import cors from '@koa/cors';
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
 * 启动认证服务
 *
 * 架构：OIDC Provider 本身就是主应用，自定义路由作为附加中间件。
 *
 * 请求处理流程：
 * - OIDC 路由（/auth、/token、/me、/jwks 等）：
 *   Provider 的内部路由器直接处理，不经过我们的中间件
 * - 自定义路由（/oidc/interaction/* 等）：
 *   Provider 的路由器不匹配，调用 next()，我们的中间件接管
 */
const start = async () => {
  const provider = await initProvider();

  // 将 provider 实例存入 app context，供 controller 通过 ctx.oidc 访问
  provider.context.oidc = provider;

  // 自定义中间件：添加在 Provider 内部中间件之后，仅处理非 OIDC 路由
  provider.use(responseMiddleware);
  provider.use(loggerMiddleware);
  provider.use(cors());
  provider.use(bodyParser());
  provider.use(router.routes()).use(router.allowedMethods());

  // 屏蔽默认错误输出
  provider.silent = true;

  provider.listen(PORT, () => console.log(`
🚀 Server ready at:
   - Local:   http://localhost:${PORT}
   - Network: http://${ipAddr}:${PORT}
📖 OIDC Discovery: http://localhost:${PORT}/.well-known/openid-configuration`));
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
