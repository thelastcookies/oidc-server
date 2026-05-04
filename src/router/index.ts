import Router from '@koa/router';
import oidc from './oidc.ts';

const router = new Router({
  prefix: '/sso',
});

router.get('/', async (ctx) => {
  ctx.type = 'html';
  ctx.body = '<h1>hello world!</h1>';
});

router.use(oidc.routes(), oidc.allowedMethods());

export default router;
