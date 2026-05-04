import type Provider from 'oidc-provider';

declare module 'koa' {
  interface DefaultContext {
    oidc: Provider;
  }
}
