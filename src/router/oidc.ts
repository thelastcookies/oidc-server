/**
 * OIDC 路由定义
 *
 * 分为两组：
 *
 * 1. 交互接口（无需认证）
 *    处理 SSO 登录的交互流程：展示登录/注册页、提交登录、注册、确认/取消授权
 *    这些接口由浏览器直接访问，不需要 Access Token 认证
 *
 * 2. 客户端管理接口（需 OIDC 认证）
 *    管理接入 SSO 的子系统（Client），需要 OIDC Access Token 认证
 *    通过 oidcAuthMiddleware 验证 Bearer Token
 */
import Router from '@koa/router';
import { oidcController } from '../controller';
import oidcAuthMiddleware from '../middleware/oidc-auth.ts';

const router = new Router({
  prefix: '/oidc',
});

// 交互接口：由浏览器在 SSO 登录流程中直接访问
router.get('/interaction/:uid', oidcController.getInteraction);
router.post('/interaction/:uid/login', oidcController.login);
router.post('/interaction/:uid/register', oidcController.register);
router.post('/interaction/:uid/confirm', oidcController.confirm);
router.post('/interaction/:uid/abort', oidcController.abort);

// 客户端管理接口：需 OIDC Access Token 认证，供管理员操作
router.post('/client', oidcAuthMiddleware, oidcController.createClient);
router.get('/client', oidcAuthMiddleware, oidcController.getClientList);
router.get('/client/:clientId', oidcAuthMiddleware, oidcController.getClient);
router.put('/client/:clientId', oidcAuthMiddleware, oidcController.updateClient);
router.delete('/client/:clientId', oidcAuthMiddleware, oidcController.deleteClient);

export default router;
