/**
 * 数据库种子脚本：初始化内置角色和管理员账号
 *
 * 用法：pnpm seed
 * - 创建内置角色：admin（管理员）、user（普通用户，注册默认角色）
 * - 创建初始管理员账号（用户名/密码从环境变量读取，避免硬编码）
 *
 * 脚本可重复执行（幂等）：已存在的角色/账号会跳过，不做覆盖。
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/prisma.ts';

/** 内置管理员角色编码 */
const ADMIN_ROLE_CODE = 'admin';
/** 注册用户默认角色编码 */
const DEFAULT_ROLE_CODE = 'user';

const main = async () => {
  // 1. 初始化内置角色
  await prisma.role.upsert({
    where: { code: ADMIN_ROLE_CODE },
    update: {},
    create: {
      code: ADMIN_ROLE_CODE,
      name: '管理员',
      remark: '内置角色：拥有 SSO 管理端全部权限',
    },
  });
  await prisma.role.upsert({
    where: { code: DEFAULT_ROLE_CODE },
    update: {},
    create: {
      code: DEFAULT_ROLE_CODE,
      name: '普通用户',
      remark: '内置角色：自助注册用户的默认角色',
    },
  });
  console.log('内置角色已就绪：admin / user');

  // 2. 初始化管理员账号
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn('未设置 ADMIN_PASSWORD 环境变量，使用默认密码 admin123（仅限开发环境）');
  }
  const rawPassword = password || 'admin123';

  const existing = await prisma.user.findUnique({
    where: { username },
    include: { roles: { include: { role: true } } },
  });
  if (existing) {
    // 已存在则确保绑定 admin 角色（不覆盖密码）
    const hasAdminRole = existing.roles.some((ur) => ur.role.code === ADMIN_ROLE_CODE);
    if (!hasAdminRole) {
      const adminRole = await prisma.role.findUnique({ where: { code: ADMIN_ROLE_CODE } });
      if (adminRole) {
        await prisma.userRole.create({ data: { userId: existing.id, roleId: adminRole.id } });
        console.log(`已为账号 ${username} 补充 admin 角色绑定`);
      }
    }
    console.log(`管理员账号 ${username} 已存在，跳过创建`);
  } else {
    const adminRole = await prisma.role.findUnique({ where: { code: ADMIN_ROLE_CODE } });
    const user = await prisma.user.create({
      data: {
        username,
        password: await bcrypt.hash(rawPassword, 10),
        roles: adminRole
          ? { create: [{ roleId: adminRole.id }] }
          : undefined,
      },
    });
    console.log(`已创建管理员账号 ${username}（id: ${user.id}），请立即登录修改密码`);
  }

  await prisma.$disconnect();
};

main().catch(async (err: unknown) => {
  console.error('Seed 执行失败:', (err as Error).message);
  await prisma.$disconnect();
  process.exit(1);
});
