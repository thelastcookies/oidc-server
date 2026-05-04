/**
 * OIDC Provider 配置
 *
 * 定义 SSO 认证中心的行为规则，相当于"政策"文档。
 * 包括：支持的权限范围、用户声明、交互流程、Cookie 策略、令牌有效期等。
 */
import type { Context } from 'koa';
import type { Configuration } from 'oidc-provider';
import prisma from '../prisma.ts';

const OIDC_ISSUER = process.env.OIDC_ISSUER || 'http://localhost:8190';

const configuration: Configuration = {
  /**
   * 支持的 scope（权限范围）
   * - openid: 必须，表示这是 OIDC 而非纯 OAuth2，请求时会返回 ID Token
   * - profile: 请求用户基本信息（name, username）
   * - email: 请求用户邮箱
   * - offline_access: 请求 refresh_token，实现长期登录（离线访问）
   */
  scopes: ['openid', 'profile', 'email', 'offline_access'],

  /**
   * 每个 scope 对应返回哪些用户属性
   * 子系统请求 scope 时，oidc-provider 根据此映射决定 ID Token 和 UserInfo 中包含哪些字段
   */
  claims: {
    openid: ['sub'],          // sub = 用户唯一标识（Subject），OIDC 规范必须
    profile: ['name', 'username'],
    email: [],
  },

  /**
   * 交互 URL 配置
   *
   * 当用户需要登录或授权时，oidc-provider 需要知道跳转到哪里。
   * interaction.uid 是 oidc-provider 生成的临时会话 ID，
   * 用于关联"谁在请求授权"和"登录结果"。
   *
   * 流程：子系统 → /auth → oidc-provider 发现未登录 → 重定向到此 URL
   */
  interactions: {
    url: (_ctx: Context, interaction: { uid: string }) => {
      return `/oidc/interaction/${interaction.uid}`;
    },
  },

  /**
   * Cookie 配置
   *
   * OIDC 依赖 Cookie 维持用户与认证中心之间的会话（SSO 的核心）。
   * 用户在系统 A 登录后，认证中心写入 Session Cookie；
   * 访问系统 B 时，浏览器自动带上此 Cookie，认证中心识别已登录，直接签发令牌。
   *
   * - keys: Cookie 签名密钥，防止篡改。多个 key 支持密钥轮换（新签名用第一个，验证时依次尝试）
   * - long: 长期 Cookie（如"记住我"），默认 24 小时
   * - short: 短期 Cookie（如交互会话），默认 1 小时
   */
  cookies: {
    keys: process.env.COOKIE_KEYS ? process.env.COOKIE_KEYS.split(',') : ['oidc-cookie-key-1', 'oidc-cookie-key-2'],
    long: { path: '/', signed: true, maxAge: 86400000 },
    short: { path: '/', signed: true, maxAge: 3600000 },
  },

  /**
   * 账号查找函数
   *
   * oidc-provider 通过 sub（用户 ID）查找用户信息。
   * 当需要生成 ID Token 或响应 UserInfo 请求时，调用此函数获取用户 claims。
   *
   * claims() 的返回值会写入 ID Token 的 payload 和 /me 的响应体
   */
  findAccount: async (_ctx: Context, id: string) => {
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return undefined;

    return {
      accountId: id,
      async claims() {
        return {
          sub: id,
          name: user.username,
          username: user.username,
        };
      },
    };
  },

  /**
   * 功能开关
   *
   * - devInteractions: 开发模式内置交互页面，生产环境必须禁用
   * - rpInitiatedLogout: RP 发起的登出（Relaying Party = 子系统），支持登出后重定向
   * - resourceIndicators: 资源指示器，限制令牌只能访问指定资源
   */
  features: {
    devInteractions: { enabled: false },
    rpInitiatedLogout: {
      enabled: true,
      // 登出后默认重定向地址，子系统可通过 post_logout_redirect_uri 参数覆盖
      postLogoutRedirectUri: process.env.POST_LOGOUT_REDIRECT_URI || 'http://localhost:3000',
    },
    resourceIndicators: {
      defaultResource: (_ctx: Context) => OIDC_ISSUER,
      enabled: true,
      getResource: (_ctx: Context, _client: unknown, _clientUri: string) => OIDC_ISSUER,
    },
  },

  /**
   * 令牌有效期（TTL，单位：秒）
   *
   * 各类型令牌的有效期需要在安全性和用户体验之间平衡：
   * - AccessToken 时间短，减少被盗用的风险
   * - RefreshToken 时间长，避免用户频繁重新登录
   * - AuthorizationCode 时间很短且一次性使用，防止截获重放
   */
  ttl: {
    AccessToken: 60 * 60,            // 1 小时
    AuthorizationCode: 10 * 60,      // 10 分钟
    IdToken: 60 * 60,                // 1 小时（与 AccessToken 一致）
    DeviceCode: 10 * 60,             // 10 分钟
    RefreshToken: 7 * 24 * 60 * 60,  // 7 天
    Interaction: 60 * 60,            // 1 小时
    Session: 7 * 24 * 60 * 60,       // 7 天
    Grant: 7 * 24 * 60 * 60,         // 7 天
  },

  // 错误渲染：开发阶段输出到控制台便于调试
  renderError: (_ctx: Context, out: Record<string, unknown>, error: Error) => {
    console.error('OIDC Error:', error);
    return out;
  },
};

export default configuration;
export { OIDC_ISSUER };
