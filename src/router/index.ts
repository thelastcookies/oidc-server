/**
 * SSO 路由定义
 *
 * 分为两组：
 *
 * 1. 交互接口（无需认证）
 *    处理 SSO 登录的交互流程：重定向到 Vue 登录页、提交登录、注册、确认/取消授权
 *    这些接口由浏览器直接访问，不需要 Access Token 认证
 *
 * 2. 客户端管理接口（需 OIDC 认证）
 *    管理接入 SSO 的子系统（Client），需要 OIDC Access Token 认证
 *    通过 oidcAuthMiddleware 验证 Bearer Token
 */
import Router from '@koa/router';
import type { Context } from 'koa';
import * as controller from '../controller/index.ts';
import oidcAuthMiddleware from '../middleware/oidc-auth.ts';

const router = new Router({
  prefix: '/oidc',
});

router.get('/', async (ctx: Context) => {
  ctx.type = 'html';
  ctx.body = '<h1>hello world!</h1>';
});

// 交互接口：由浏览器在 SSO 登录流程中直接访问
router.get('/interaction/:uid', controller.getInteraction);
router.post('/interaction/:uid/login', controller.login);
router.post('/interaction/:uid/register', controller.register);
router.post('/interaction/:uid/confirm', controller.confirm);
router.post('/interaction/:uid/abort', controller.abort);

// 客户端管理接口：需 OIDC Access Token 认证，供管理员操作
router.get('/client', oidcAuthMiddleware, controller.getClientList);
router.get('/client/:clientId', oidcAuthMiddleware, controller.getClient);
router.post('/client', oidcAuthMiddleware, controller.createClient);
router.put('/client/:clientId', oidcAuthMiddleware, controller.updateClient);
router.delete('/client/:clientId', oidcAuthMiddleware, controller.deleteClient);

export default router;
