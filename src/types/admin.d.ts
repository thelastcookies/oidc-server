/**
 * 用户/角色管理与自助接口类型
 *
 * 与 api.d.ts（客户端管理/交互流程）按业务拆分：
 * - 管理组：/oidc/admin/users、/oidc/admin/roles，需 admin 角色
 * - 自助组：/oidc/me，仅需用户自身 Access Token
 */

/**
 * 用户与角色管理
 */

/** 创建角色请求体 */
export interface CreateRoleRequest {
  // 角色编码：下发到 claims 的值，创建后不允许修改
  code: string;
  // 展示名称：如 "管理员"
  name: string;
  remark?: string;
}

/** 更新角色请求体（code 不允许修改） */
export interface UpdateRoleRequest {
  name?: string;
  remark?: string;
}

/** 角色摘要（用户信息内嵌） */
export interface RoleBrief {
  id: number;
  code: string;
  name: string;
}

/** 角色信息（含用户数统计） */
export interface RoleInfo extends RoleBrief {
  remark: string | null;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建用户请求体 */
export interface CreateUserRequest {
  username: string;
  password: string;
  // 初始角色，缺省不分配
  roleIds?: number[];
  // 默认启用
  enabled?: boolean;
}

/** 更新用户请求体（username 不允许修改） */
export interface UpdateUserRequest {
  enabled?: boolean;
  // 传入则整体替换角色绑定
  roleIds?: number[];
}

/** 管理员重置密码请求体（免旧密码） */
export interface ResetPasswordRequest {
  password: string;
}

/** 用户信息 */
export interface UserInfo {
  id: number;
  username: string;
  enabled: boolean;
  roles: RoleBrief[];
  createdAt: Date;
  updatedAt: Date;
}

/** 用户分页列表响应 */
export interface UserListResult {
  list: UserInfo[];
  total: number;
  page: number;
  pageSize: number;
}

/** 用户分页查询参数 */
export interface UserListQuery {
  page?: string;
  pageSize?: string;
  // 按用户名模糊匹配
  keyword?: string;
}

/**
 * 自助接口
 */

/** 自助修改密码请求体 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/** 当前用户信息（含角色编码数组，与 claims 中的 roles 一致） */
export interface CurrentUserInfo {
  id: number;
  username: string;
  roles: string[];
}
