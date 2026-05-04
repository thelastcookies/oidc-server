import dotenv from 'dotenv';
import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from '@koa/bodyparser';
import router from './router';
import ip from 'ip';
import loggerMiddleware from './middleware/logger.ts';
import responseMiddleware from './middleware/response.ts';
import notFoundMiddleware from './middleware/not-found.ts';

dotenv.config({
  path: ['.env/.env', '.env/.env.development', '.env/.env.production'],
});

const ipAddr = ip.address();
const PORT = process.env.PORT || 3000;

const app = new Koa();

/*************
 * Middlewares
 */
// 统一返回结构
app.use(responseMiddleware);
// 处理 404
app.use(notFoundMiddleware);
// 日志记录
app.use(loggerMiddleware);
// 处理跨域
app.use(cors());
// 解析请求体
app.use(bodyParser({ jsonLimit: '250mb' }));
// 路由配置
app.use(router.routes()).use(router.allowedMethods());

app.listen(PORT, () => console.log(`
🚀 Server ready at: http://${ipAddr}:${PORT}`),
);

// 屏蔽默认错误输出
app.silent = true;
// 自定义错误处理
app.on('error', err => {
  // 屏蔽以下错误输出
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    // 用于屏蔽在客户端取消视频流连接时的错误输出
    return;
  }
  // 其他的错误正常输出
  console.error('Server error', err);
});
