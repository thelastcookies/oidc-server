import type { Context, Next } from 'koa';
import type { ErrorBody } from '../types/api.d.ts';

/**
 * 统一响应格式中间件
 *
 * 将所有自定义 API 响应包装为统一格式：
 * - 成功：{ success: true, code, msg: 'success', data }
 * - 失败：{ success: false, code, msg, detail }
 * - 404：{ success: false, code: 404, msg: 'Not Found', detail }
 *
 * 此中间件仅处理自定义路由的响应。
 * OIDC Provider 路由（/auth、/token 等）由 provider 的路由器直接处理，
 * 不会经过此中间件，因此无需额外跳过逻辑。
 */
const responseMiddleware = async (ctx: Context, next: Next) => {
  try {
    await next();

    // 跳过重定向响应
    if (String(ctx.status).startsWith('3')) {
      return;
    }

    // 处理 404：所有下游中间件执行后仍为 404，说明路由未匹配
    if (ctx.status === 404 && !ctx.body) {
      ctx.body = {
        msg: 'Not Found',
        detail: `The api path ${ctx.path} does not exist`,
      };
    }

    const code = ctx.status;
    if (String(code).startsWith('2') || String(code).startsWith('3')) {
      ctx.body = {
        success: true,
        code,
        msg: 'success',
        data: ctx.body ?? null,
      };
    } else if (String(code).startsWith('4') || String(code).startsWith('5')) {
      const body = ctx.body as ErrorBody | undefined;
      ctx.body = {
        success: false,
        code,
        msg: body?.msg ?? '',
        detail: body?.detail || null,
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
