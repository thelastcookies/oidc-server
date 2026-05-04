/**
 * OIDC 控制器
 *
 * 处理两类请求：
 * 1. 交互流程：重定向到 Vue 登录页、提交登录、注册、确认授权、取消授权
 * 2. 客户端管理：CRUD 操作
 *
 * 交互流程是 SSO 登录的核心，涉及以下步骤：
 *
 * 步骤 1 — 重定向到 Vue 登录页（getInteraction）
 *   用户访问子系统 → 子系统重定向到 /auth →
 *   oidc-provider 发现用户未登录 → 调用 interactions.url 配置 →
 *   重定向到 /sso/oidc/interaction/:uid → 302 重定向到 Vue 登录页
 *
 * 步骤 2 — 提交登录（login）或注册（register）
 *   登录：验证凭证 → 构造 login result → provider 签发令牌
 *   注册：创建账号 → 自动完成登录流程 → provider 签发令牌
 *
 * 步骤 3 — 确认授权（confirm）
 *   如果配置了需要用户确认授权（类似"是否允许 XX 应用访问你的信息？"），会进入这一步。
 *   当前实现自动确认。
 */
import type { Context } from 'koa';
import { oidcService } from '../service';

/**
 * 重定向到 Vue 登录页
 *
 * 当 oidc-provider 检测到用户未登录时，会重定向到此接口。
 * 此接口不再返回 HTML，而是 302 重定向到 Vue 登录页，
 * 将交互上下文（uid、prompt、client_id 等）作为 URL 参数传递。
 *
 * Vue 登录页根据这些参数：
 * - 展示登录/注册表单
 * - 调用 /sso/oidc/interaction/:uid/login 或 /sso/oidc/interaction/:uid/register
 * - 获取 redirect 地址后跳转回子系统
 *
 * 环境变量 SSO_LOGIN_PAGE 指定 Vue 登录页的完整 URL，
 * 例如 https://sso.example.com/login
 */
export const getInteraction = async (ctx: Context) => {
  const provider = ctx.app.context.oidc;
  if (!provider) {
    ctx.status = 500;
    ctx.body = { msg: 'OIDC Provider 未初始化' };
    return;
  }

  try {
    const details = await provider.interactionDetails(ctx.req, ctx.res);
    const { uid, prompt, params } = details;

    const loginPageUrl = process.env.SSO_LOGIN_PAGE || 'http://localhost:5173/login';
    const redirectUrl = new URL(loginPageUrl);
    redirectUrl.searchParams.set('uid', uid);
    redirectUrl.searchParams.set('prompt', prompt.name);
    if (params.client_id) {
      redirectUrl.searchParams.set('client_id', String(params.client_id));
    }
    if (params.scope) {
      redirectUrl.searchParams.set('scope', String(params.scope));
    }

    ctx.redirect(redirectUrl.toString());
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { msg: err.message };
  }
};

/**
 * 提交登录凭证
 *
 * 流程：
 * 1. 验证用户名密码
 * 2. 获取交互详情（oidc-provider 维护的状态）
 * 3. 构造 login result（告诉 provider 是哪个用户登录了）
 * 4. 调用 provider.interactionResult() 提交结果
 *    provider 内部会：创建会话 → 生成授权码 → 拼接 redirect_uri?code=xxx
 * 5. 返回重定向地址，前端 JS 跳转回子系统
 */
export const login = async (ctx: Context) => {
  const provider = ctx.app.context.oidc;
  if (!provider) {
    ctx.status = 500;
    ctx.body = { msg: 'OIDC Provider 未初始化' };
    return;
  }

  const { username, password } = ctx.request.body as { username?: string; password?: string };

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { msg: '用户名和密码不能为空' };
    return;
  }

  try {
    const user = await oidcService.verifyUserCredentials(username, password);

    const details = await provider.interactionDetails(ctx.req, ctx.res);
    const { prompt } = details;

    const result: Record<string, any> = {
      login: {
        accountId: String(user.id),
        remember: true,
      },
    };

    if (prompt.name === 'consent') {
      result.consent = {
        rejected: false,
      };
    }

    const redirect = await provider.interactionResult(ctx.req, ctx.res, result, {
      mergeWithLastSubmission: false,
    });

    ctx.body = { redirect };
  } catch (err: any) {
    ctx.status = 401;
    ctx.body = { msg: err.message };
  }
};

/**
 * 注册新用户并自动登录
 *
 * 流程：
 * 1. 创建用户账号
 * 2. 获取交互详情
 * 3. 构造 login result（注册后自动完成 OIDC 登录，无需再次输入密码）
 * 4. 提交结果给 provider，获取重定向地址
 */
export const register = async (ctx: Context) => {
  const provider = ctx.app.context.oidc;
  if (!provider) {
    ctx.status = 500;
    ctx.body = { msg: 'OIDC Provider 未初始化' };
    return;
  }

  const { username, password } = ctx.request.body as { username?: string; password?: string };

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { msg: '用户名和密码不能为空' };
    return;
  }

  try {
    const user = await oidcService.register(username, password);

    const details = await provider.interactionDetails(ctx.req, ctx.res);
    const { prompt } = details;

    const result: Record<string, any> = {
      login: {
        accountId: String(user.id),
        remember: true,
      },
    };

    if (prompt.name === 'consent') {
      result.consent = {
        rejected: false,
      };
    }

    const redirect = await provider.interactionResult(ctx.req, ctx.res, result, {
      mergeWithLastSubmission: false,
    });

    ctx.body = { redirect };
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { msg: err.message };
  }
};

/**
 * 确认授权
 *
 * 当 oidc-provider 需要用户明确同意授权时（prompt.name === 'consent'），
 * 用户点击"同意"后调用此接口。
 * 当前实现自动确认，未来可扩展为展示授权确认页面。
 */
export const confirm = async (ctx: Context) => {
  const provider = ctx.app.context.oidc;
  if (!provider) {
    ctx.status = 500;
    ctx.body = { msg: 'OIDC Provider 未初始化' };
    return;
  }

  try {
    const details = await provider.interactionDetails(ctx.req, ctx.res);
    const { prompt } = details;

    let result: Record<string, any> = {};

    if (prompt.name === 'consent') {
      result = {
        consent: {
          rejected: false,
        },
      };
    }

    const redirect = await provider.interactionResult(ctx.req, ctx.res, result, {
      mergeWithLastSubmission: true,
    });

    ctx.body = { redirect };
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { msg: err.message };
  }
};

/**
 * 取消授权
 *
 * 用户拒绝授权时调用，返回 access_denied 错误给子系统。
 * 子系统会收到 error=access_denied，可以展示"用户拒绝授权"提示。
 */
export const abort = async (ctx: Context) => {
  const provider = ctx.app.context.oidc;
  if (!provider) {
    ctx.status = 500;
    ctx.body = { msg: 'OIDC Provider 未初始化' };
    return;
  }

  try {
    const result = {
      error: 'access_denied',
      error_description: '用户拒绝授权',
    };

    const redirect = await provider.interactionResult(ctx.req, ctx.res, result, {
      mergeWithLastSubmission: false,
    });

    ctx.body = { redirect };
  } catch (err: any) {
    ctx.status = 500;
    ctx.body = { msg: err.message };
  }
};

/** 创建 OIDC 客户端（需 OIDC 认证） */
export const createClient = async (ctx: Context) => {
  const body = ctx.request.body as {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
    client_name?: string;
    post_logout_redirect_uris?: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
  };

  if (!body.client_id || !body.client_secret || !body.redirect_uris?.length) {
    ctx.status = 400;
    ctx.body = { msg: 'client_id、client_secret 和 redirect_uris 为必填项' };
    return;
  }

  try {
    const result = await oidcService.createClient({
      client_id: body.client_id!,
      client_secret: body.client_secret!,
      redirect_uris: body.redirect_uris!,
      client_name: body.client_name,
      post_logout_redirect_uris: body.post_logout_redirect_uris,
      grant_types: body.grant_types,
      response_types: body.response_types,
      token_endpoint_auth_method: body.token_endpoint_auth_method,
    });
    ctx.status = 201;
    ctx.body = result;
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { msg: err.message };
  }
};

/** 获取客户端列表（需 OIDC 认证） */
export const getClientList = async (ctx: Context) => {
  const result = await oidcService.getClientList();
  ctx.body = result;
};

/** 获取客户端详情（需 OIDC 认证） */
export const getClient = async (ctx: Context) => {
  const { clientId } = ctx.params as { clientId: string };

  try {
    const result = await oidcService.getClient(clientId);
    ctx.body = result;
  } catch (err: any) {
    ctx.status = 404;
    ctx.body = { msg: err.message };
  }
};

/** 更新客户端配置（需 OIDC 认证） */
export const updateClient = async (ctx: Context) => {
  const { clientId } = ctx.params as { clientId: string };
  const body = ctx.request.body as {
    client_name?: string;
    redirect_uris?: string[];
    post_logout_redirect_uris?: string[];
    grant_types?: string[];
    response_types?: string[];
  };

  try {
    const result = await oidcService.updateClient(clientId, body);
    ctx.body = result;
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { msg: err.message };
  }
};

/** 删除客户端（需 OIDC 认证） */
export const deleteClient = async (ctx: Context) => {
  const { clientId } = ctx.params as { clientId: string };

  try {
    await oidcService.deleteClient(clientId);
    ctx.body = { msg: '删除成功' };
  } catch (err: any) {
    ctx.status = 404;
    ctx.body = { msg: err.message };
  }
};
