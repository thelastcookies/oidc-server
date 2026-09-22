/**
 * 用户/角色管理控制器（/oidc/admin/*）
 *
 * 所有接口需 OIDC Access Token 认证（oidcAuthMiddleware）+ admin 角色（requireAdmin）。
 * 响应由 responseMiddleware 统一包装为 ApiSuccessResponse / ApiErrorResponse 格式。
 */
import type { Context } from 'koa';
import * as service from '../service/admin.ts';
import type {
  CreateRoleRequest,
  CreateUserRequest,
  ResetPasswordRequest,
  UpdateRoleRequest,
  UpdateUserRequest,
  UserListQuery,
} from '../types/admin.d.ts';

/** 解析路径参数 ID（用户/角色通用），非法时返回 NaN */
const parseId = (ctx: Context): number => parseInt((ctx.params as { id: string }).id, 10);

/** 用户分页列表 */
export const getUsers = async (ctx: Context) => {
  const query = ctx.query as UserListQuery;
  ctx.body = await service.getUserList(query);
};

/** 用户详情 */
export const getUser = async (ctx: Context) => {
  const id = parseId(ctx);
  if (!id) {
    ctx.status = 400;
    ctx.body = { msg: '无效的用户 ID' };
    return;
  }

  try {
    ctx.body = await service.getUser(id);
  } catch (err: unknown) {
    ctx.status = 404;
    ctx.body = { msg: (err as Error).message };
  }
};

/** 创建用户 */
export const createUser = async (ctx: Context) => {
  const body = ctx.request.body as CreateUserRequest;

  if (!body.username || !body.password) {
    ctx.status = 400;
    ctx.body = { msg: '用户名和密码不能为空' };
    return;
  }

  try {
    const user = await service.createUser(body);
    ctx.status = 201;
    ctx.body = user;
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { msg: (err as Error).message };
  }
};

/** 更新用户（启停、角色分配；username 不允许修改） */
export const updateUser = async (ctx: Context) => {
  const id = parseId(ctx);
  if (!id) {
    ctx.status = 400;
    ctx.body = { msg: '无效的用户 ID' };
    return;
  }

  const body = ctx.request.body as UpdateUserRequest;

  try {
    ctx.body = await service.updateUser(id, body);
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { msg: (err as Error).message };
  }
};

/** 管理员重置密码（免旧密码，重置后撤销该用户全部会话） */
export const resetUserPassword = async (ctx: Context) => {
  const id = parseId(ctx);
  if (!id) {
    ctx.status = 400;
    ctx.body = { msg: '无效的用户 ID' };
    return;
  }

  const body = ctx.request.body as ResetPasswordRequest;
  if (!body.password) {
    ctx.status = 400;
    ctx.body = { msg: '密码不能为空' };
    return;
  }

  try {
    await service.resetPassword(id, body.password);
    ctx.body = { msg: '重置成功' };
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { msg: (err as Error).message };
  }
};

/** 删除用户 */
export const deleteUser = async (ctx: Context) => {
  const id = parseId(ctx);
  if (!id) {
    ctx.status = 400;
    ctx.body = { msg: '无效的用户 ID' };
    return;
  }

  try {
    await service.deleteUser(id);
    ctx.body = { msg: '删除成功' };
  } catch (err: unknown) {
    ctx.status = 404;
    ctx.body = { msg: (err as Error).message };
  }
};

/** 角色列表（含各角色用户数） */
export const getRoles = async (ctx: Context) => {
  ctx.body = await service.getRoleList();
};

/** 创建角色 */
export const createRole = async (ctx: Context) => {
  const body = ctx.request.body as CreateRoleRequest;

  if (!body.code || !body.name) {
    ctx.status = 400;
    ctx.body = { msg: '角色编码和名称不能为空' };
    return;
  }

  try {
    const role = await service.createRole(body);
    ctx.status = 201;
    ctx.body = role;
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { msg: (err as Error).message };
  }
};

/** 更新角色（仅 name / remark，code 不允许修改） */
export const updateRole = async (ctx: Context) => {
  const id = parseId(ctx);
  if (!id) {
    ctx.status = 400;
    ctx.body = { msg: '无效的角色 ID' };
    return;
  }

  const body = ctx.request.body as UpdateRoleRequest;

  try {
    ctx.body = await service.updateRole(id, body);
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { msg: (err as Error).message };
  }
};

/** 删除角色（内置 admin 角色不允许删除） */
export const deleteRole = async (ctx: Context) => {
  const id = parseId(ctx);
  if (!id) {
    ctx.status = 400;
    ctx.body = { msg: '无效的角色 ID' };
    return;
  }

  try {
    await service.deleteRole(id);
    ctx.body = { msg: '删除成功' };
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { msg: (err as Error).message };
  }
};
