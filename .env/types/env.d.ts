interface ImportMetaEnv {
    readonly NODE_ENV: string;
    // 端口号
    readonly PORT: string;
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
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
