/**
 * OIDC 会话撤销
 *
 * oidc_payload 表中没有 accountId 列，用户标识存储在 data JSON 字段中
 * （Session / RefreshToken 的 payload 均包含 "accountId":"<userId>"），
 * 因此通过字符串包含匹配定位目标数据，再逐类批量删除。
 */
import prisma from '../prisma.ts';

/**
 * 撤销指定用户的所有 OIDC 会话与刷新令牌
 *
 * - Session：逐条解析 uid，支持保留当前会话（自助改密场景）
 * - RefreshToken：全部撤销（跨所有授权），阻止其他端的离线续签
 * - AccessToken 不主动删除：有效期仅 1 小时，自然过期即可
 *
 * @param userId - 用户 ID
 * @param exceptSessionUid - 需要保留的会话 UID（缺省撤销全部）
 */
export const revokeUserSessions = async (userId: number, exceptSessionUid?: string): Promise<void> => {
  // JSON 序列化后的 accountId 为字符串形式，闭合引号保证精确匹配（"1" 不会误中 "12"）
  const needle = `"accountId":"${userId}"`;

  // 撤销会话：解析 payload 中的 uid，排除需要保留的当前会话
  const sessions = await prisma.oidcPayload.findMany({
    where: { type: 'Session', data: { contains: needle } },
    select: { id: true, data: true },
  });
  const staleSessionIds = sessions
    .filter((s) => {
      if (!exceptSessionUid) return true;
      try {
        return (JSON.parse(s.data) as { uid?: string }).uid !== exceptSessionUid;
      } catch {
        return true;
      }
    })
    .map((s) => s.id);

  if (staleSessionIds.length) {
    await prisma.oidcPayload.deleteMany({ where: { id: { in: staleSessionIds } } });
  }

  // 撤销全部刷新令牌
  await prisma.oidcPayload.deleteMany({
    where: { type: 'RefreshToken', data: { contains: needle } },
  });
};
