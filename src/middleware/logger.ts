// koa-logger-middleware.js
import log4js, { Logger } from 'log4js';
import { Context, Next } from 'koa';
import logger from '../utils/log.ts';

const koaLogger = (logger: Logger, options: any) => {
  const connectLogger = log4js.connectLogger(logger, options);

  return async (ctx: Context, next: Next) => {
    const start = Date.now();
    const req = ctx.req;
    const res = ctx.res;

    await next();
    // 手动调用 connectLogger 中间件
    await new Promise<void>((resolve, reject) => {
      connectLogger(req, res, (err: Error) => {
        if (err) return reject(err);
        resolve();
      });
    });
    const responseTime = Date.now() - start;
    console.log(`Response Time: ${responseTime / 1000}s`);
  };
};
const format = (req: any, res: any, formatter: (str: string) => string) => {
  return formatter(`:remote-addr - HTTP/:http-version :method :url :status`);
};

const loggerMiddleware = koaLogger(logger.access, {
  level: 'auto',
  format: format,
});

export default loggerMiddleware;
