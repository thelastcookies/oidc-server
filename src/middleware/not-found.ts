import type { Context, Next } from 'koa';

const notFoundMiddleware = async (ctx: Context, next: Next) => {
  await next();
  if (ctx.status === 404) {
    ctx.status = 404;
    ctx.body = {
      msg: 'Not Found',
      detail: `The api path ${ctx.path} does not exist`,
    };
  }
};

export default notFoundMiddleware;
