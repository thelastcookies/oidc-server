import Router from '@koa/router';
import auth from './auth.ts';

const router = new Router({
  prefix: '/api',
});

router.get('/', async (ctx) => {
  ctx.type = 'html';
  ctx.body = '<h1>hello world!</h1>';
});

router.use(auth.routes(), auth.allowedMethods());

export default router;
