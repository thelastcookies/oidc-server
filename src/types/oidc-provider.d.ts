declare module 'oidc-provider' {
  interface AdapterPayload {
    [key: string]: any;
  }

  interface Adapter {
    upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void>;
    find(id: string): Promise<AdapterPayload | undefined>;
    destroy(id: string): Promise<void>;
    findByUserCode(userCode: string): Promise<AdapterPayload | undefined>;
    findByUid(uid: string): Promise<AdapterPayload | undefined>;
    revokeByGrantId(grantId: string): Promise<void>;
    consume(id: string): Promise<void>;
  }

  interface AdapterConstructor {
    new (name: string): Adapter;
  }

  interface Configuration {
    adapter?: AdapterConstructor;
    clients?: Record<string, any>[];
    jwks?: { keys: any[] };
    findAccount?: (ctx: any, sub: string, token?: any) => any;
    interactions?: {
      url?: (ctx: any, interaction: any) => Promise<string> | string;
    };
    cookies?: {
      keys?: string[];
      long?: Record<string, any>;
      short?: Record<string, any>;
    };
    claims?: Record<string, any>;
    scopes?: string[];
    features?: Record<string, any>;
    ttl?: Record<string, any>;
    renderError?: (ctx: any, out: any, error: any) => any;
    [key: string]: any;
  }

  class Provider {
    constructor(issuer: string, configuration?: Configuration);
    app: any;
    callback(): any;
    use(middleware: any): Provider;
    interactionDetails(req: any, res: any): Promise<any>;
    interactionFinished(req: any, res: any, result: any, options?: { mergeWithLastSubmission?: boolean }): Promise<void>;
    interactionResult(req: any, res: any, result: any, options?: { mergeWithLastSubmission?: boolean }): Promise<string>;
  }

  export default Provider;
  export { Provider, Configuration, Adapter, AdapterPayload, AdapterConstructor };
}
