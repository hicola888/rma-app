import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createPrismaClient } from './index.js';
import {
  bootstrapMembership,
  BootstrapError,
  membershipRoles,
  type BootstrapRole,
} from './bootstrap.js';

type Flags = {
  clerkUserId?: string;
  clerkOrgId?: string;
  tenantName?: string;
  merchantName?: string;
  role?: string;
};

function readFlags(argv: string[]): Flags {
  const flags: Flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    const take = (key: keyof Flags) => {
      if (!next || next.startsWith('--')) {
        throw new BootstrapError(`参数 ${arg} 后面需要一个值。`);
      }
      flags[key] = next;
      index += 1;
    };

    if (arg === '--user-id') take('clerkUserId');
    else if (arg === '--org-id') take('clerkOrgId');
    else if (arg === '--tenant-name') take('tenantName');
    else if (arg === '--merchant-name') take('merchantName');
    else if (arg === '--role') take('role');
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new BootstrapError(`不认识的参数：${arg}。运行 pnpm db:bootstrap -- --help 查看用法。`);
    }
  }
  return flags;
}

function printHelp(): void {
  console.log(`用法：
  pnpm db:bootstrap
  pnpm db:bootstrap -- --user-id user_xxx --org-id org_xxx

可选参数：
  --tenant-name    租户名称，默认「Epping 仓库」
  --merchant-name  货主名称。角色是 merchant_user 时必填
  --role           tenant_admin、tenant_staff 或 merchant_user，默认 tenant_admin

User ID 和 Organization ID 可在登录后打开 http://localhost:3000/me 复制。`);
}

async function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

function isRole(value: string): value is BootstrapRole {
  return membershipRoles.includes(value as BootstrapRole);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flags = readFlags(argv);
  const interactive = argv.length === 0 && Boolean(input.isTTY);
  let clerkUserId = flags.clerkUserId?.trim() ?? '';
  let clerkOrgId = flags.clerkOrgId?.trim() ?? '';
  let tenantName = flags.tenantName?.trim() ?? '';
  let merchantName = flags.merchantName?.trim() ?? '';
  let roleText = flags.role?.trim() ?? '';

  if (interactive) {
    clerkUserId = await ask('请输入 Clerk User ID：');
    clerkOrgId = await ask('请输入 Clerk Organization ID：');
    tenantName = (await ask('租户名称（直接回车使用 Epping 仓库）：')) || 'Epping 仓库';
    merchantName = await ask('货主名称（可留空；merchant_user 必填）：');
    roleText =
      (await ask(
        '角色 tenant_admin / tenant_staff / merchant_user（直接回车使用 tenant_admin）：',
      )) || 'tenant_admin';
  } else if (!clerkUserId || !clerkOrgId) {
    printHelp();
    throw new BootstrapError('缺少 --user-id 或 --org-id。');
  }

  const role = (roleText || 'tenant_admin') as BootstrapRole;
  if (!isRole(role)) {
    throw new BootstrapError('角色只能是 tenant_admin、tenant_staff 或 merchant_user。');
  }

  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    throw new BootstrapError(
      '没有找到 DIRECT_URL。请在仓库根目录的 .env 里设置迁移用的数据库连接串，并确认 Docker 里的 Postgres 已启动。',
    );
  }

  const prisma = createPrismaClient(connectionString);
  try {
    const result = await bootstrapMembership(prisma, {
      clerkUserId,
      clerkOrgId,
      tenantName: tenantName || undefined,
      merchantName: merchantName || undefined,
      role,
    });

    console.log('写入成功。这个账号现在可以进入该租户。');
    console.log(`租户：${result.tenant.name}（${result.tenant.clerkOrgId}）`);
    console.log(`用户：${result.user.clerkUserId}`);
    console.log(`角色：${result.role}`);
    console.log(
      result.merchant ? `货主：${result.merchant.name}（${result.merchant.code}）` : '货主：未创建',
    );
    console.log('再执行一次同样的命令不会产生重复数据。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '未知错误';
  const friendly =
    message.includes('ECONNREFUSED') || message.includes("Can't reach database")
      ? '连不上数据库。请先执行 docker compose up -d，并确认根目录 .env 的 DIRECT_URL 指向本机 Postgres。'
      : message;
  console.error(`失败：${friendly}`);
  process.exit(1);
});
