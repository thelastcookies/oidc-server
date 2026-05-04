import prisma from '../prisma.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret-key';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key';
const ACCESS_TOKEN_EXPIRES = '30m';
const REFRESH_TOKEN_EXPIRES = '7d';

const generateAccessToken = (userId: number, username: string) => {
  return jwt.sign({ userId, username }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
};

const generateRefreshToken = (userId: number, username: string) => {
  return jwt.sign({ userId, username, type: 'refresh' }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
};

export const register = async (username: string, password: string) => {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new Error('用户名已存在');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashedPassword },
  });

  const accessToken = generateAccessToken(user.id, user.username);
  const refreshToken = generateRefreshToken(user.id, user.username);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return {
    id: user.id,
    username: user.username,
    accessToken,
    refreshToken,
  };
};

export const login = async (username: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('用户名或密码错误');
  }

  const accessToken = generateAccessToken(user.id, user.username);
  const refreshToken = generateRefreshToken(user.id, user.username);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return {
    id: user.id,
    username: user.username,
    accessToken,
    refreshToken,
  };
};

export const logout = async (userId: number) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
};

export const refreshAccessToken = async (token: string) => {
  const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as {
    userId: number;
    username: string;
    type: string;
  };

  if (decoded.type !== 'refresh') {
    throw new Error('无效的 Refresh Token');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || user.refreshToken !== token) {
    throw new Error('Refresh Token 已失效，请重新登录');
  }

  const accessToken = generateAccessToken(user.id, user.username);
  const refreshToken = generateRefreshToken(user.id, user.username);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return {
    accessToken,
    refreshToken,
  };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as {
    userId: number;
    username: string;
  };
};
