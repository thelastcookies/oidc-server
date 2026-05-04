/**
 * OIDC 业务逻辑层
 *
 * 分为两部分：
 * 1. 客户端管理（CRUD）：每个想接入 SSO 的子系统都需要先注册为 OIDC Client
 * 2. 用户凭证验证：交互登录时验证用户名密码
 *
 * 客户端注册是"白名单"机制：
 * - client_id + client_secret 标识子系统身份
 * - redirect_uris 白名单防止开放重定向攻击（如果没有白名单，攻击者可构造 redirect_uri=http://evil.com 偷走授权码）
 * - client_secret 使用 bcrypt 哈希存储，即使数据库泄露也无法获取原始密钥
 */
import prisma from '../prisma.ts';
import bcrypt from 'bcryptjs';
import type {
  CreateClientRequest,
  UpdateClientRequest,
  ClientInfo,
  ClientDetail,
  UserCredentials,
} from '../types/api.d.ts';
import type { OidcClientData } from '../types/oidc.d.ts';

/**
 * 创建 OIDC 客户端
 *
 * 注册一个新的子系统，使其能够接入 SSO。
 * 客户端数据以 JSON 格式存储在 oidc_client.data 字段中，
 * oidc-provider 通过 Adapter.find() 读取并解析。
 */
export const createClient = async (data: CreateClientRequest) => {
  const existing = await prisma.oidcClient.findUnique({ where: { id: `Client:${data.client_id}` } });
  if (existing) {
    throw new Error('客户端 ID 已存在');
  }

  const clientData: OidcClientData = {
    client_id: data.client_id,
    client_secret: await bcrypt.hash(data.client_secret, 10),  // 哈希存储，和密码一样不能明文
    redirect_uris: data.redirect_uris,
    client_name: data.client_name || data.client_id,
    post_logout_redirect_uris: data.post_logout_redirect_uris || [],
    grant_types: data.grant_types || ['authorization_code', 'refresh_token'],
    response_types: data.response_types || ['code'],
    token_endpoint_auth_method: data.token_endpoint_auth_method || 'client_secret_post',
  };

  // 存入 oidc_client 表，id 格式为 "Client:client_id"，与 Adapter.key() 生成的 key 一致
  await prisma.oidcClient.create({
    data: {
      id: `Client:${data.client_id}`,
      data: JSON.stringify(clientData),
    },
  });

  return {
    client_id: data.client_id,
    client_name: clientData.client_name,
    redirect_uris: data.redirect_uris,
    grant_types: clientData.grant_types,
    response_types: clientData.response_types,
  };
};

/** 获取所有客户端列表 */
export const getClientList = async (): Promise<ClientInfo[]> => {
  const clients = await prisma.oidcClient.findMany();
  return clients.map((c): ClientInfo => {
    const data: OidcClientData = JSON.parse(c.data);
    return {
      client_id: data.client_id,
      client_name: data.client_name,
      redirect_uris: data.redirect_uris,
      grant_types: data.grant_types,
      response_types: data.response_types,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  });
};

/** 获取单个客户端详情 */
export const getClient = async (clientId: string): Promise<ClientDetail> => {
  const client = await prisma.oidcClient.findUnique({ where: { id: `Client:${clientId}` } });
  if (!client) {
    throw new Error('客户端不存在');
  }
  const data: OidcClientData = JSON.parse(client.data);
  return {
    client_id: data.client_id,
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    post_logout_redirect_uris: data.post_logout_redirect_uris,
    grant_types: data.grant_types,
    response_types: data.response_types,
    token_endpoint_auth_method: data.token_endpoint_auth_method,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
};

/** 更新客户端配置 */
export const updateClient = async (
  clientId: string,
  updates: UpdateClientRequest,
) => {
  const client = await prisma.oidcClient.findUnique({ where: { id: `Client:${clientId}` } });
  if (!client) {
    throw new Error('客户端不存在');
  }

  const existingData: OidcClientData = JSON.parse(client.data);
  const updatedData: OidcClientData = { ...existingData };

  if (updates.client_name) updatedData.client_name = updates.client_name;
  if (updates.redirect_uris) updatedData.redirect_uris = updates.redirect_uris;
  if (updates.post_logout_redirect_uris) updatedData.post_logout_redirect_uris = updates.post_logout_redirect_uris;
  if (updates.grant_types) updatedData.grant_types = updates.grant_types;
  if (updates.response_types) updatedData.response_types = updates.response_types;

  await prisma.oidcClient.update({
    where: { id: `Client:${clientId}` },
    data: { data: JSON.stringify(updatedData) },
  });

  return {
    client_id: clientId,
    client_name: updatedData.client_name,
    redirect_uris: updatedData.redirect_uris,
  };
};

/** 删除客户端 */
export const deleteClient = async (clientId: string) => {
  const client = await prisma.oidcClient.findUnique({ where: { id: `Client:${clientId}` } });
  if (!client) {
    throw new Error('客户端不存在');
  }

  await prisma.oidcClient.delete({ where: { id: `Client:${clientId}` } });
};

/**
 * 用户注册
 *
 * 在 OIDC 交互流程中使用，新用户通过 SSO 登录页面注册账号。
 * 注册成功后返回用户信息，由 controller 继续完成 OIDC 登录流程。
 */
export const register = async (username: string, password: string): Promise<UserCredentials> => {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new Error('用户名已存在');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashedPassword },
  });

  return { id: user.id, username: user.username };
};

/**
 * 验证用户凭证
 *
 * 在 OIDC 交互登录流程中使用。
 * 用户在 SSO 登录页面输入用户名密码后，此函数验证凭证是否正确。
 */
export const verifyUserCredentials = async (username: string, password: string): Promise<UserCredentials> => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('用户名或密码错误');
  }

  return { id: user.id, username: user.username };
};
