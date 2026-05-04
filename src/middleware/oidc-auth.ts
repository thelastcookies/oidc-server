/**
 * OIDC Access Token 认证中间件
 *
 * 替代原有的 JWT 认证中间件，使用 OIDC Provider 签发的 Access Token 保护管理接口。
 *
 * 验证流程：
 * 1. 从 Authorization 头提取 Bearer Token
 * 2. 通过 PrismaAdapter 在数据库中查找 AccessToken 记录
 * 3. 适配器的 find 方法已包含过期检查（惰性删除），过期令牌返回 undefined
 * 4. 从令牌数据中提取 accountId 作为用户标识
 */
import type { Context, Next } from 'koa';
import PrismaAdapter from '../oidc/adapter.ts';

const oidcAuthMiddleware = async (ctx: Context, next: Next) => {
  const authorization = ctx.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { msg: '未提供认证令牌' };
    return;
  }

  const token = authorization.slice(7);

  try {
    const adapter = new PrismaAdapter('AccessToken');
    const tokenData = await adapter.find(token);

    if (!tokenData) {
      ctx.status = 401;
      ctx.body = { msg: '无效或已过期的认证令牌' };
      return;
    }

    ctx.state.user = {
      userId: parseInt(tokenData.accountId),
    };

    await next();
  } catch (err: any) {
    ctx.status = 401;
    ctx.body = { msg: '无效的认证令牌' };
  }
};

export default oidcAuthMiddleware;
