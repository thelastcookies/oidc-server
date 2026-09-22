/**
 * 自助接口控制器（/oidc/me）
 *
 * 身份来自 oidcAuthMiddleware 解析的用户 Access Token；
 * 改密页面由各业务系统自主实现，IdP 仅提供接口。
 */
import type { Context } from 'koa';
import * as service from '../service/me.ts';
import type { ChangePasswordRequest } from '../types/admin.d.ts';

/** 获取当前用户信息（id、username、roles） */
export const getCurrentUser = async (ctx: Context) => {
  const { userId } = ctx.state.user as { userId: number };
  ctx.body = await service.getCurrentUser(userId);
};

/**
 * 自助修改密码
 *
 * 成功后保留当前会话（sessionUid 来自令牌记录），撤销其他会话，
 * 其他端下一次访问 SSO 时需要重新登录。
 */
export const changePassword = async (ctx: Context) => {
  const { userId, sessionUid } = ctx.state.user as { userId: number; sessionUid?: string };
  const body = ctx.request.body as ChangePasswordRequest;

  if (!body.oldPassword || !body.newPassword) {
    ctx.status = 400;
    ctx.body = { msg: '旧密码和新密码不能为空' };
    return;
  }
  if (body.oldPassword === body.newPassword) {
    ctx.status = 400;
    ctx.body = { msg: '新密码不能与旧密码相同' };
    return;
  }

  try {
    await service.changePassword(userId, body.oldPassword, body.newPassword, sessionUid);
    ctx.body = { msg: '密码修改成功' };
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { msg: (err as Error).message };
  }
};
