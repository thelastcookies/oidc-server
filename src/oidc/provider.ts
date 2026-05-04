/**
 * OIDC Provider 初始化
 *
 * 创建 oidc-provider 实例，处理 RSA 密钥管理和全局错误处理。
 *
 * 使用 RS256 非对称加密，认证中心用私钥签名，子系统只需公钥验证
 */
import { generateKeyPairSync } from 'node:crypto';
import Provider from 'oidc-provider';
import PrismaAdapter from './adapter.ts';
import configuration from './config.ts';
import prisma from '../prisma.ts';

const OIDC_ISSUER = process.env.OIDC_ISSUER || 'http://localhost:8190';

/**
 * 生成 RSA 密钥对并导出为 JWK 格式
 *
 * JWK（JSON Web Key）的好处是可以通过 HTTP 端点（/oidc/jwks）分发公钥，
 * 子系统无需预先配置密钥，启动时从 JWKS 端点获取即可。
 */
const generateKeys = () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,  // RSA 2048 位，安全强度足够
  });

  const privateJwk = privateKey.export({ format: 'jwk' }) as Record<string, any>;
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
      keys: existingKeys.map((k) => JSON.parse(k.data)),
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
 * 初始化 OIDC Provider
 *
 * 将 Adapter、配置、密钥组合创建 Provider 实例，
 * 并添加全局错误处理中间件。
 */
const initProvider = async () => {
  const jwks = await loadOrGenerateKeys();

  const config: Record<string, any> = {
    ...configuration,
    adapter: PrismaAdapter,  // 用 Prisma 适配器替换默认的内存存储
    jwks,                    // RSA 签名密钥，用于签发和验证 JWT
  };

  const provider = new Provider(OIDC_ISSUER, config);

  // 全局错误处理：捕获 oidc-provider 内部未处理的异常
  provider.use(async (ctx: any, next: any) => {
    try {
      await next();
    } catch (err: any) {
      console.error('OIDC Provider Error:', err);
      ctx.status = err.status || 500;
      ctx.body = { error: err.error || 'server_error', message: err.message };
    }
  });

  return provider;
};

export default initProvider;
