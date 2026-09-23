interface ImportMetaEnv {
    readonly NODE_ENV: string;
    // 端口号
    readonly PORT: string;
    // 调试过滤器（如 prisma 日志）
    readonly DEBUG: string;
    readonly DATABASE_URL: string;
    // OIDC Issuer URL
    readonly OIDC_ISSUER: string;
    // SSO 登录页 URL
    readonly SSO_LOGIN_URL: string;
    // Cookie 签名密钥（多个用逗号分隔）
    readonly COOKIE_KEYS: string;
    // 登出后重定向地址
    readonly POST_LOGOUT_REDIRECT_URI: string;
    // 默认 Client（首次启动时的 Client 种子，已有 Client 则跳过）
    readonly DEFAULT_CLIENT_ID: string;
    readonly DEFAULT_CLIENT_SECRET: string;
    // HTTPS 证书路径（仅开发环境）
    readonly SSL_KEY_PATH: string;
    readonly SSL_CERT_PATH: string;
    // 初始管理员账号（pnpm seed 使用）
    readonly ADMIN_USERNAME: string;
    readonly ADMIN_PASSWORD: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
