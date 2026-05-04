import type { Context, Next } from 'koa';

const responseMiddleware = async (ctx: Context, next: Next) => {
  try {
    await next();
    const code = ctx.status;
    if (String(code).startsWith('2') || String(code).startsWith('3')) {
      ctx.body = {
        success: true,
        code,
        msg: 'success',
        data: ctx.body ?? null,
      };
    } else if (String(code).startsWith('4') || String(code).startsWith('5')) {
      ctx.body = {
        success: false,
        code,
        msg: (ctx.body as any)?.msg ?? '',
        detail: (ctx.body as any)?.detail || null,
      };
    } else {
      ctx.body = {
        success: false,
        code: 500,
        msg: (ctx.body as any)?.msg || 'Internal Server Error',
        detail: (ctx.body as any)?.detail || null,
      };
    }
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      code: 500,
      msg: err.message || 'Internal Server Error',
      detail: err.detail || null,
    };
  }
};

export default responseMiddleware;
