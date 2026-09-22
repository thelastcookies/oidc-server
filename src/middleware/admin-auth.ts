/**
 * 管理员角色校验中间件
 *
 * 必须挂在 oidcAuthMiddleware 之后（依赖其解析的 ctx.state.user.userId）。
 * 每次请求实时查库校验 admin 角色，角色变更立即生效（不依赖令牌内容）。
 */
import type { Context, Next } from 'koa';
import prisma from '../prisma.ts';

const requireAdmin = async (ctx: Context, next: Next) => {
  const userId = (ctx.state.user as { userId?: number } | undefined)?.userId;
  if (!userId) {
    ctx.status = 401;
    ctx.body = { msg: '未提供认证令牌' };
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });

  if (!user?.roles.some((ur) => ur.role.code === 'admin')) {
    ctx.status = 403;
    ctx.body = { msg: '需要管理员权限' };
    return;
  }

  await next();
};

export default requireAdmin;
