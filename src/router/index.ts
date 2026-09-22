/**
 * SSO 路由定义
 *
 * 分为三组：
 *
 * 1. 交互接口（无需认证）
 *    处理 SSO 登录的交互流程：重定向到 Vue 登录页、提交登录、注册、确认/取消授权
 *    这些接口由浏览器直接访问，不需要 Access Token 认证
 *
 * 2. 管理接口（需 OIDC 认证 + admin 角色）
 *    客户端管理与用户/角色管理，通过 oidcAuthMiddleware 验证 Bearer Token，
 *    requireAdmin 校验管理员角色
 *
 * 3. 自助接口（需 OIDC 认证）
 *    用户操作自己的账号信息（查询资料、修改密码），仅需自身的 Access Token
 */
import Router from '@koa/router';
import type { Context } from 'koa';
import * as controller from '../controller/index.ts';
import * as adminController from '../controller/admin.ts';
import * as meController from '../controller/me.ts';
import oidcAuthMiddleware from '../middleware/oidc-auth.ts';
import requireAdmin from '../middleware/admin-auth.ts';

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

// 客户端管理接口：需 OIDC Access Token 认证 + admin 角色，供管理员操作
router.get('/client', oidcAuthMiddleware, requireAdmin, controller.getClientList);
router.get('/client/:clientId', oidcAuthMiddleware, requireAdmin, controller.getClient);
router.post('/client', oidcAuthMiddleware, requireAdmin, controller.createClient);
router.put('/client/:clientId', oidcAuthMiddleware, requireAdmin, controller.updateClient);
router.delete('/client/:clientId', oidcAuthMiddleware, requireAdmin, controller.deleteClient);

// 用户/角色管理接口：需 OIDC Access Token 认证 + admin 角色
router.get('/admin/users', oidcAuthMiddleware, requireAdmin, adminController.getUsers);
router.get('/admin/users/:id', oidcAuthMiddleware, requireAdmin, adminController.getUser);
router.post('/admin/users', oidcAuthMiddleware, requireAdmin, adminController.createUser);
router.put('/admin/users/:id', oidcAuthMiddleware, requireAdmin, adminController.updateUser);
router.put('/admin/users/:id/password', oidcAuthMiddleware, requireAdmin, adminController.resetUserPassword);
router.delete('/admin/users/:id', oidcAuthMiddleware, requireAdmin, adminController.deleteUser);
router.get('/admin/roles', oidcAuthMiddleware, requireAdmin, adminController.getRoles);
router.post('/admin/roles', oidcAuthMiddleware, requireAdmin, adminController.createRole);
router.put('/admin/roles/:id', oidcAuthMiddleware, requireAdmin, adminController.updateRole);
router.delete('/admin/roles/:id', oidcAuthMiddleware, requireAdmin, adminController.deleteRole);

// 自助接口：需用户自身的 OIDC Access Token 认证
router.get('/me', oidcAuthMiddleware, meController.getCurrentUser);
router.put('/me/password', oidcAuthMiddleware, meController.changePassword);

export default router;
