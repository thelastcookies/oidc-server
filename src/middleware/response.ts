import type { Context, Next } from 'koa';
import type { ErrorBody } from '../types/api.d.ts';

/**
 * 统一响应格式中间件
 *
 * 处理规则：
 * - 重定向（3xx）：跳过
 * - 自定义路由（/oidc/ 前缀）：成功和失败都包装为统一格式
 * - OIDC 内部路由（/auth、/token、/.well-known 等）：保持 OIDC 封装的原始格式
 */
const responseMiddleware = async (ctx: Context, next: Next) => {
  try {
    await next();

    // 跳过重定向响应
    if (String(ctx.status).startsWith('3')) {
      return;
    }

    // 跳过 OIDC 内部路由（/.well-known、/auth、/token 等）
    if (!ctx.path.startsWith('/oidc/')) {
      return;
    }

    // 处理 404：路由未匹配时 Koa 默认 status=404，但 router 匹配前缀后可能设 body 导致 status 变 200
    if (ctx.status === 404 || (ctx.status === 200 && !ctx._matchedRoute)) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        code: 404,
        msg: 'Not Found',
        detail: `The api path ${ctx.path} does not exist`,
      };
      return;
    }

    const code = ctx.status;
    if (String(code).startsWith('2')) {
      ctx.body = {
        success: true,
        code,
        msg: 'success',
        data: ctx.body ?? null,
      };
    } else if (String(code).startsWith('4') || String(code).startsWith('5')) {
      const body = ctx.body as Record<string, unknown> | undefined;
      const msg = (body?.msg as string) || 'Internal Server Error';
      const detail = body?.detail as string || null;
      ctx.body = {
        success: false,
        code,
        msg,
        detail,
      };
    } else {
      const body = ctx.body as ErrorBody | undefined;
      ctx.body = {
        success: false,
        code: 500,
        msg: body?.msg || 'Internal Server Error',
        detail: body?.detail || null,
      };
    }
  } catch (err: unknown) {
    const error = err as Error & { detail?: string };
    ctx.status = 500;
    ctx.body = {
      success: false,
      code: 500,
      msg: error.message || 'Internal Server Error',
      detail: error.detail || null,
    };
  }
};

export default responseMiddleware;
