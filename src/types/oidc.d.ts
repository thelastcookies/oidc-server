/**
 * OIDC 交互相关类型
 *
 * 这些类型用于 controller 和 oidc-provider 之间的交互。
 * oidc-provider 的类型系统比较复杂，这里只提取我们实际使用的部分。
 */

/** OIDC 交互详情（provider.interactionDetails 返回值） */
export interface InteractionDetails {
  uid: string;
  prompt: {
    name: 'login' | 'consent';
    reasons?: string[];
    details?: Record<string, unknown>;
  };
  params: {
    client_id?: string;
    scope?: string;
    response_type?: string;
    redirect_uri?: string;
    [key: string]: unknown;
  };
}

/** 提交给 provider 的登录结果 */
export interface LoginResult {
  login: {
    accountId: string;
    remember: boolean;
  };
  consent?: {
    rejected: boolean;
  };
}

/** 提交给 provider 的确认授权结果 */
export interface ConsentResult {
  consent: {
    rejected: boolean;
  };
}

/** 提交给 provider 的取消授权结果 */
export interface AbortResult {
  error: string;
  error_description: string;
}

/** oidc-provider 存储的客户端数据（JSON 格式） */
export interface OidcClientData {
  client_id: string;
  client_secret: string;
  client_name: string;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
}

/** oidc-provider 存储的载荷数据（JSON 格式） */
export interface OidcPayloadData {
  grantId?: string;
  userCode?: string;
  uid?: string;
  consumed?: boolean;
  [key: string]: unknown;
}

/** oidc_payload 表的写入记录结构 */
export interface PayloadRecord {
  id: string;
  type: string;
  data: string;
  expiresAt: Date | null;
  grantId?: string;
  userCode?: string;
  uid?: string;
}

/** JWK 格式的 RSA 密钥 */
export interface JwkKey {
  kid: string;
  use: string;
  alg: string;
  kty: string;
  n: string;
  e: string;
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
}
