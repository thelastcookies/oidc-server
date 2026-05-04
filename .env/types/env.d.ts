interface ImportMetaEnv {
    readonly NODE_ENV: string;
    readonly PORT: string;
    readonly DATABASE_URL: string;
    readonly OIDC_ISSUER: string;
    readonly SSO_LOGIN_PAGE: string;
    readonly COOKIE_KEYS: string;
    readonly POST_LOGOUT_REDIRECT_URI: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
