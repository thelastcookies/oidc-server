import type { Context } from 'koa';
import { authService } from '../service';

export const register = async (ctx: Context) => {
  const { username, password } = ctx.request.body as { username?: string; password?: string };

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { msg: '用户名和密码不能为空' };
    return;
  }

  try {
    const result = await authService.register(username, password);
    ctx.status = 201;
    ctx.body = result;
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = { msg: err.message };
  }
};

export const login = async (ctx: Context) => {
  const { username, password } = ctx.request.body as { username?: string; password?: string };

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { msg: '用户名和密码不能为空' };
    return;
  }

  try {
    ctx.body = await authService.login(username, password);
  } catch (err: any) {
    ctx.status = 401;
    ctx.body = { msg: err.message };
  }
};

export const logout = async (ctx: Context) => {
  const userId = ctx.state.user.userId;
  await authService.logout(userId);
  ctx.body = { msg: '登出成功' };
};

export const refresh = async (ctx: Context) => {
  const { refreshToken } = ctx.request.body as { refreshToken?: string };

  if (!refreshToken) {
    ctx.status = 400;
    ctx.body = { msg: 'Refresh Token 不能为空' };
    return;
  }

  try {
    ctx.body = await authService.refreshAccessToken(refreshToken);
  } catch (err: any) {
    ctx.status = 401;
    ctx.body = { msg: err.message };
  }
};
