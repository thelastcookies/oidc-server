/**
 * 自助接口业务逻辑（/oidc/me）
 *
 * 身份认定：请求方携带用户自己的 OIDC Access Token（Bearer），
 * 服务端从令牌记录中解析用户，无需再传 username。
 */
import prisma from '../prisma.ts';
import bcrypt from 'bcryptjs';
import { revokeUserSessions } from './session.ts';
import type { CurrentUserInfo } from '../types/admin.d.ts';

/** 获取当前用户信息（角色编码数组与 claims 中的 roles 一致） */
export const getCurrentUser = async (userId: number): Promise<CurrentUserInfo> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) {
    throw new Error('用户不存在');
  }

  return {
    id: user.id,
    username: user.username,
    realName: user.realName,
    roles: user.roles.map((ur) => ur.role.code),
  };
};

/**
 * 自助修改密码
 *
 * - 旧密码必填且必须验证：防止令牌被盗后直接改密接管账号
 * - 成功后撤销"其他"会话（保留当前会话）与全部刷新令牌，
 *   其他端下一次请求 SSO 时需要重新登录
 */
export const changePassword = async (
  userId: number,
  oldPassword: string,
  newPassword: string,
  exceptSessionUid?: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('用户不存在');
  }

  const isValid = await bcrypt.compare(oldPassword, user.password);
  if (!isValid) {
    throw new Error('旧密码错误');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });

  await revokeUserSessions(userId, exceptSessionUid);
};
