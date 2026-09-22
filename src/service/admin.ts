/**
 * 用户/角色管理业务逻辑（/oidc/admin/*）
 *
 * 权限模型：IdP 管理用户 + 全局角色（多对多），claims 下发角色编码，
 * 各接入子系统自行完成"角色 → 细粒度权限"的映射与裁决。
 */
import prisma from '../prisma.ts';
import bcrypt from 'bcryptjs';
import { revokeUserSessions } from './session.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import type {
  CreateRoleRequest,
  CreateUserRequest,
  RoleInfo,
  UpdateRoleRequest,
  UpdateUserRequest,
  UserListQuery,
  UserInfo,
  UserListResult,
} from '../types/admin.d.ts';

/** 内置管理员角色编码（与其他端约定一致，用于删除保护） */
const ADMIN_ROLE_CODE = 'admin';

/** 含角色关联的用户记录类型 */
type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: { include: { role: true } } } }>;

/** 用户记录 → 响应 DTO（脱敏：不含密码哈希） */
const toUserInfo = (user: UserWithRoles): UserInfo => ({
  id: user.id,
  username: user.username,
  enabled: user.enabled,
  roles: user.roles.map((ur) => ({ id: ur.role.id, code: ur.role.code, name: ur.role.name })),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/** 校验角色 ID 是否全部存在，避免外键错误直接抛给调用方 */
const assertRolesExist = async (roleIds: number[]): Promise<void> => {
  if (!roleIds.length) return;
  const count = await prisma.role.count({ where: { id: { in: roleIds } } });
  if (count !== roleIds.length) {
    throw new Error('存在无效的角色 ID');
  }
};

/**
 * 用户分页列表
 *
 * @param query - page / pageSize / keyword（按用户名模糊匹配）
 */
export const getUserList = async (query: UserListQuery): Promise<UserListResult> => {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20));
  const where = query.keyword ? { username: { contains: query.keyword } } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { roles: { include: { role: true } } },
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { list: users.map(toUserInfo), total, page, pageSize };
};

/** 用户详情（含角色） */
export const getUser = async (id: number): Promise<UserInfo> => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (!user) {
    throw new Error('用户不存在');
  }
  return toUserInfo(user);
};

/** 创建用户（可同时分配初始角色） */
export const createUser = async (data: CreateUserRequest): Promise<UserInfo> => {
  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) {
    throw new Error('用户名已存在');
  }
  if (data.roleIds?.length) {
    await assertRolesExist(data.roleIds);
  }

  const user = await prisma.user.create({
    data: {
      username: data.username,
      password: await bcrypt.hash(data.password, 10),
      enabled: data.enabled ?? true,
      // 写入角色绑定
      roles: data.roleIds?.length
        ? { create: data.roleIds.map((roleId) => ({ roleId })) }
        : undefined,
    },
    include: { roles: { include: { role: true } } },
  });
  return toUserInfo(user);
};

/**
 * 更新用户（启停、角色整体替换）
 * username 不允许修改：用户名是各子系统的展示标识，变更会导致下游对不上
 */
export const updateUser = async (id: number, updates: UpdateUserRequest): Promise<UserInfo> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new Error('用户不存在');
  }
  if (updates.roleIds) {
    await assertRolesExist(updates.roleIds);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      enabled: updates.enabled,
      // 传入 roleIds 时整体替换角色绑定（先删后建，原子操作）
      ...(updates.roleIds
        ? { roles: { deleteMany: {}, create: updates.roleIds.map((roleId) => ({ roleId })) } }
        : {}),
    },
    include: { roles: { include: { role: true } } },
  });
  return toUserInfo(updated);
};

/**
 * 管理员重置密码（免旧密码）
 * 重置后撤销该用户全部会话与刷新令牌，强制所有端重新登录
 */
export const resetPassword = async (id: number, password: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new Error('用户不存在');
  }

  await prisma.user.update({
    where: { id },
    data: { password: await bcrypt.hash(password, 10) },
  });
  await revokeUserSessions(id);
};

/** 删除用户（数据库级联删除角色绑定），并撤销会话 */
export const deleteUser = async (id: number): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new Error('用户不存在');
  }

  await prisma.user.delete({ where: { id } });
  await revokeUserSessions(id);
};

/** 角色列表（含各角色用户数） */
export const getRoleList = async (): Promise<RoleInfo[]> => {
  const roles = await prisma.role.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { users: true } } },
  });

  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    remark: role.remark,
    userCount: role._count.users,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }));
};

/** 创建角色（code 唯一，创建后不允许修改） */
export const createRole = async (data: CreateRoleRequest): Promise<RoleInfo> => {
  const existing = await prisma.role.findUnique({ where: { code: data.code } });
  if (existing) {
    throw new Error('角色编码已存在');
  }

  const role = await prisma.role.create({
    data: { code: data.code, name: data.name, remark: data.remark },
  });
  return { ...role, userCount: 0 };
};

/** 更新角色（仅 name / remark，code 不允许修改以保证 claim 语义稳定） */
export const updateRole = async (id: number, updates: UpdateRoleRequest): Promise<RoleInfo> => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new Error('角色不存在');
  }

  const updated = await prisma.role.update({
    where: { id },
    data: { name: updates.name, remark: updates.remark },
    include: { _count: { select: { users: true } } },
  });
  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    remark: updated.remark,
    userCount: updated._count.users,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
};

/** 删除角色（级联解除用户绑定）；内置 admin 角色不允许删除，防止锁死管理能力 */
export const deleteRole = async (id: number): Promise<void> => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new Error('角色不存在');
  }
  if (role.code === ADMIN_ROLE_CODE) {
    throw new Error('内置 admin 角色不允许删除');
  }

  await prisma.role.delete({ where: { id } });
};
