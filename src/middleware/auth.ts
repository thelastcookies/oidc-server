import type { Context, Next } from 'koa';
import { verifyAccessToken } from '../service/auth.ts';

const authMiddleware = async (ctx: Context, next: Next) => {
  const authorization = ctx.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { msg: '未提供认证令牌' };
    return;
  }

  const token = authorization.slice(7);

  try {
    ctx.state.user = verifyAccessToken(token);
    await next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      ctx.status = 401;
      ctx.body = { msg: '认证令牌已过期', code: 'TOKEN_EXPIRED' };
      return;
    }
    ctx.status = 401;
    ctx.body = { msg: '无效的认证令牌' };
  }
};

export default authMiddleware;
