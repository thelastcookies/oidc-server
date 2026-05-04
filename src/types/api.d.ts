/**
 * API 统一响应类型
 *
 * 所有自定义接口的响应都遵循此格式，由 responseMiddleware 自动包装。
 * OIDC Provider 路由（/auth、/token 等）不使用此格式。
 */

/** 成功响应 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  code: number;
  msg: 'success';
  data: T;
}

/** 错误响应 */
export interface ApiErrorResponse {
  success: false;
  code: number;
  msg: string;
  detail: string | null;
}

/**
 * 客户端管理
 */

/**
 * 创建客户端请求体
 **/

export interface CreateClientRequest {
  // 客户端标识（如 "my-app"）
  client_id: string;
  // 客户端密钥（bcrypt 哈希后存储）
  client_secret: string;
  // 授权回调地址白名单
  redirect_uris: string[];
  client_name?: string;
  post_logout_redirect_uris?: string[];
  // 允许的授权类型（默认 authorization_code + refresh_token）
  grant_types?: string[];
  // 允许的响应类型（默认 code，即授权码模式）
  response_types?: string[];
  // 令牌端点认证方式（默认 client_secret_post）
  token_endpoint_auth_method?: string;
}

/** 更新客户端请求体 */
export interface UpdateClientRequest {
  client_name?: string;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
}

/** 客户端列表项（不含敏感信息） */
export interface ClientInfo {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** 客户端详情（含完整配置，不含 client_secret） */
export interface ClientDetail extends ClientInfo {
  post_logout_redirect_uris: string[];
  token_endpoint_auth_method: string;
}

/**
 * 认证相关
 */

/** 登录请求体 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 注册请求体 */
export interface RegisterRequest {
  username: string;
  password: string;
}

/** 用户凭证验证结果 */
export interface UserCredentials {
  id: number;
  username: string;
}

/** 交互流程返回的重定向信息 */
export interface InteractionRedirect {
  redirect: string;
}

/** 错误响应体（controller 设置的中间格式，由 responseMiddleware 包装） */
export interface ErrorBody {
  msg: string;
  detail?: string | null;
}
