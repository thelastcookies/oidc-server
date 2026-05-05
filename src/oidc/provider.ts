/**
 * OIDC Provider 初始化
 *
 * 创建 oidc-provider 实例，处理 RSA 密钥管理、默认 Client 种子和全局错误处理。
 *
 * 使用 RS256 非对称加密，认证中心用私钥签名，子系统只需公钥验证
 */
import { generateKeyPairSync } from 'node:crypto';
import Provider from 'oidc-provider';
import type { Context, Next } from 'koa';
import type { JWK, ClientMetadata } from 'oidc-provider';
import PrismaAdapter from './adapter.ts';
import configuration, { OIDC_ISSUER } from './config.ts';
import prisma from '../prisma.ts';
import bcrypt from 'bcryptjs';

/**
 * 生成 RSA 密钥对并导出为 JWK 格式
 *
 * JWK（JSON Web Key）的好处是可以通过 HTTP 端点（/jwks）分发公钥，
 * 子系统无需预先配置密钥，启动时从 JWKS 端点获取即可。
 */
const generateKeys = (): { kid: string; jwk: JWK } => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,  // RSA 2048 位，安全强度足够
  });

  const privateJwk = privateKey.export({ format: 'jwk' }) as JWK;
  const kid = `key-${Date.now()}`;  // 密钥 ID，用于 JWKS 端点匹配密钥
  privateJwk.kid = kid;
  privateJwk.use = 'sig';     // 用途：签名
  privateJwk.alg = 'RS256';   // 算法：RS256

  return { kid, jwk: privateJwk };
};

/**
 * 加载或生成签名密钥
 *
 * 密钥持久化到数据库，服务重启后不需要重新生成。
 * 如果重新生成，之前签发的所有令牌都会失效（因为公钥变了，子系统无法验证旧令牌）。
 */
const loadOrGenerateKeys = async () => {
  const existingKeys = await prisma.oidcKey.findMany();

  if (existingKeys.length > 0) {
    return {
      keys: existingKeys.map((k) => JSON.parse(k.data) as JWK),
    };
  }

  // 首次启动时生成新密钥
  const { kid, jwk } = generateKeys();

  await prisma.oidcKey.create({
    data: {
      kid,
      data: JSON.stringify(jwk),
    },
  });

  return { keys: [jwk] };
};

/**
 * 种子默认 Client
 *
 * 解决冷启动问题，首次启动时自动创建默认 Client，后续检测到已有 Client 则跳过。
 *
 * 默认 Client 的 client_id 和 client_secret 从环境变量读取，
 * 未配置时使用内置默认值（仅适用于开发环境）。
 */
const seedDefaultClient = async () => {
  const clientCount = await prisma.oidcClient.count();
  if (clientCount > 0) return null;

  const clientId = process.env.DEFAULT_CLIENT_ID || 'default-client';
  const clientSecret = process.env.DEFAULT_CLIENT_SECRET || 'default-secret';

  const clientData: ClientMetadata = {
    client_id: clientId,
    client_secret: await bcrypt.hash(clientSecret, 10),
    redirect_uris: [`${OIDC_ISSUER}/cb`],
    client_name: 'Default Client',
    post_logout_redirect_uris: [],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
  };

  await prisma.oidcClient.create({
    data: {
      id: `Client:${clientId}`,
      data: JSON.stringify(clientData),
    },
  });

  return { clientId, clientSecret };
};

/**
 * 初始化 OIDC Provider
 *
 * 将 Adapter、配置、密钥组合创建 Provider 实例，
 * 并添加全局错误处理中间件。
 */
const initProvider = async () => {
  const jwks = await loadOrGenerateKeys();

  const provider = new Provider(OIDC_ISSUER, {
    ...configuration,
    adapter: PrismaAdapter,  // 用 Prisma 适配器替换默认的内存存储
    jwks,                    // RSA 签名密钥，用于签发和验证 JWT
  });

  // 全局错误处理：捕获 oidc-provider 内部未处理的异常
  provider.use(async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (err: unknown) {
      const error = err as Error & { status?: number; error?: string };
      console.error('OIDC Provider Error:', error);
      ctx.status = error.status || 500;
      ctx.body = { error: error.error || 'server_error', message: error.message };
    }
  });

  // 种子默认 Client（首次启动时）
  const seeded = await seedDefaultClient();
  if (seeded) {
    console.log(`
🔑 Default Client seeded:
   - client_id:     ${seeded.clientId}
   - client_secret: ${seeded.clientSecret}
   ⚠️  Please change the default credentials in production!`);
  }

  return provider;
};

export default initProvider;
