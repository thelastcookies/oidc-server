interface ImportMetaEnv {
    readonly NODE_ENV: string;
    readonly PORT: string;
    readonly DATABASE_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
