/**
 * 请求日志中间件
 *
 * 记录每个请求的方法、路径、状态码和响应时间。
 * 使用 log4js 的 access 分类输出到 access.log 和 stdout。
 */
import type { Context, Next } from 'koa';
import logger from '../utils/log.ts';

const loggerMiddleware = async (ctx: Context, next: Next) => {
  const start = Date.now();
  await next();
  const responseTime = Date.now() - start;
  logger.access.info(`${ctx.method} ${ctx.url} ${ctx.status} - ${responseTime}ms`);
};

export default loggerMiddleware;
