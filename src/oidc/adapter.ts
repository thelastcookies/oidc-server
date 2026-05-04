/**
 * OIDC Prisma 适配器
 *
 * oidc-provider 默认将数据存储在内存中，服务重启后数据会丢失。
 * 本适配器实现了 oidc-provider 的 Adapter 接口，将数据持久化到 MySQL。
 *
 * oidc-provider 需要存储 7 种类型的数据，每种生命周期不同：
 * - Client: 客户端应用配置（永久）
 * - AuthorizationCode: 授权码，一次性使用（10 分钟）
 * - AccessToken: 访问令牌（1 小时）
 * - RefreshToken: 刷新令牌（7 天）
 * - Session: 用户会话（7 天）
 * - Interaction: 交互状态（1 小时）
 * - Grant: 授权记录（7 天）
 *
 * 存储策略：
 * - Client 类型单独存在 oidc_client 表（永久数据，不需要过期时间）
 * - 其他类型存在 oidc_payload 表，用 type 字段区分，expiresAt 控制过期
 * - grantId 索引支持通过 deleteMany 批量撤销同一授权下的所有令牌
 * - consume 机制确保授权码只能使用一次，防止重放攻击
 */
import prisma from '../prisma.ts';
import type { OidcPayloadData, PayloadRecord } from '../types/oidc.d.ts';

// 包含 grantId 的数据类型，撤销授权时需要按 grantId 批量删除
const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

class PrismaAdapter {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  // 生成复合主键：类型名:ID，如 "AccessToken:xxx"，避免不同类型 ID 冲突
  key = (id: string): string => `${this.name}:${id}`;

  /**
   * 写入/更新数据
   *
   * oidc-provider 在以下场景调用此方法：
   * - 用户授权后保存 AuthorizationCode
   * - 令牌签发后保存 AccessToken / RefreshToken
   * - 创建/更新 Session
   *
   * @param id - 数据标识
   * @param payload - oidc-provider 传入的完整数据对象
   * @param expiresIn - 过期时间（秒），用于计算 expiresAt
   */
  upsert = async (id: string, payload: OidcPayloadData, expiresIn?: number): Promise<void> => {
    const key = this.key(id);
    const data = JSON.stringify(payload);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    const record: PayloadRecord = {
      id: key,
      type: this.name,
      data,
      expiresAt,
    };

    // grantId 用于关联同一授权下的所有令牌，用户登出时可批量撤销
    if (grantable.has(this.name) && payload.grantId) {
      record.grantId = payload.grantId;
    }

    // userCode 用于设备码流程（Device Code Flow）
    if (payload.userCode) {
      record.userCode = payload.userCode;
    }

    // uid 用于关联交互会话（Interaction）
    if (payload.uid) {
      record.uid = payload.uid;
    }

    if (this.name === 'Client') {
      // 客户端配置是永久数据，不需要 expiresAt 和 grantId
      await prisma.oidcClient.upsert({
        where: { id: key },
        update: { data },
        create: { id: key, data },
      });
    } else {
      await prisma.oidcPayload.upsert({
        where: { id: key },
        update: record,
        create: record,
      });
    }
  };

  /**
   * 查找数据
   *
   * oidc-provider 在以下场景调用此方法：
   * - 令牌端点验证 AuthorizationCode
   * - 验证 AccessToken（UserInfo 端点）
   * - 刷新令牌时查找 RefreshToken
   *
   * 过期数据会在查询时自动清理（惰性删除策略）
   */
  find = async (id: string): Promise<OidcPayloadData | undefined> => {
    const key = this.key(id);

    if (this.name === 'Client') {
      const client = await prisma.oidcClient.findUnique({ where: { id: key } });
      if (!client) return undefined;
      return JSON.parse(client.data) as OidcPayloadData;
    }

    const payload = await prisma.oidcPayload.findUnique({ where: { id: key } });
    if (!payload) return undefined;

    // 惰性删除：查询时发现已过期则删除
    if (payload.expiresAt && payload.expiresAt < new Date()) {
      await prisma.oidcPayload.delete({ where: { id: key } }).catch(() => {});
      return undefined;
    }

    const data: OidcPayloadData = JSON.parse(payload.data);

    // 已消费的授权码标记 consumed=true，oidc-provider 会拒绝二次使用
    if (payload.consumedAt) {
      data.consumed = true;
    }

    return data;
  };

  /**
   * 删除数据
   *
   * 用于令牌撤销、客户端删除等场景
   */
  destroy = async (id: string): Promise<void> => {
    const key = this.key(id);

    if (this.name === 'Client') {
      await prisma.oidcClient.delete({ where: { id: key } });
    } else {
      await prisma.oidcPayload.delete({ where: { id: key } });
    }
  };

  /**
   * 按用户码查找（设备码流程）
   *
   * Device Code Flow 中，用户在另一台设备上输入 userCode 完成授权
   */
  findByUserCode = async (userCode: string): Promise<OidcPayloadData | undefined> => {
    const payload = await prisma.oidcPayload.findFirst({ where: { userCode } });
    if (!payload) return undefined;

    if (payload.expiresAt && payload.expiresAt < new Date()) {
      await prisma.oidcPayload.delete({ where: { id: payload.id } }).catch(() => {});
      return undefined;
    }

    const data: OidcPayloadData = JSON.parse(payload.data);
    if (payload.consumedAt) {
      data.consumed = true;
    }
    return data;
  };

  /**
   * 按 UID 查找（交互会话）
   *
   * 用户在登录/授权交互过程中，oidc-provider 通过 uid 关联交互状态
   */
  findByUid = async (uid: string): Promise<OidcPayloadData | undefined> => {
    const payload = await prisma.oidcPayload.findFirst({ where: { uid } });
    if (!payload) return undefined;

    if (payload.expiresAt && payload.expiresAt < new Date()) {
      await prisma.oidcPayload.delete({ where: { id: payload.id } }).catch(() => {});
      return undefined;
    }

    const data: OidcPayloadData = JSON.parse(payload.data);
    if (payload.consumedAt) {
      data.consumed = true;
    }
    return data;
  };

  /**
   * 按授权 ID 批量撤销
   *
   * 核心安全机制：当用户登出或撤销授权时，该授权下的所有令牌
   * （AccessToken、RefreshToken 等）都需要同时失效。
   * grantId 将同一授权的多种令牌关联在一起，一次 deleteMany 即可全部撤销。
   */
  revokeByGrantId = async (grantId: string): Promise<void> => {
    await prisma.oidcPayload.deleteMany({ where: { grantId } });
  };

  /**
   * 标记为已消费
   *
   * 授权码（AuthorizationCode）只能使用一次。
   * 当令牌端点用授权码换取令牌后，oidc-provider 调用此方法标记已消费，
   * 后续再次使用同一授权码会被拒绝，防止重放攻击。
   */
  consume = async (id: string): Promise<void> => {
    const key = this.key(id);
    await prisma.oidcPayload.update({
      where: { id: key },
      data: { consumedAt: new Date() },
    });
  };
}

export default PrismaAdapter;
