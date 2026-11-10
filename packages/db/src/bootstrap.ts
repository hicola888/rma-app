import { MembershipRole, PrismaClient } from './generated/prisma/client.js';

export const membershipRoles = ['tenant_admin', 'tenant_staff', 'merchant_user'] as const;

export type BootstrapRole = (typeof membershipRoles)[number];

export type BootstrapInput = {
  clerkUserId: string;
  clerkOrgId: string;
  tenantName?: string;
  merchantName?: string;
  role?: BootstrapRole;
};

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootstrapError';
  }
}

export function merchantCodeFromName(name: string): string {
  const code = name.trim().replace(/\s+/g, '-');
  if (!code) {
    throw new BootstrapError('货主名称不能是空的。');
  }
  return code;
}

export async function bootstrapMembership(prisma: PrismaClient, input: BootstrapInput) {
  const clerkUserId = input.clerkUserId.trim();
  const clerkOrgId = input.clerkOrgId.trim();
  const tenantName = input.tenantName?.trim() || 'Epping 仓库';
  const merchantName = input.merchantName?.trim() ?? '';
  const role = input.role ?? 'tenant_admin';

  if (!clerkUserId || !clerkOrgId) {
    throw new BootstrapError('请提供 Clerk User ID 和 Organization ID。');
  }
  if (!membershipRoles.includes(role)) {
    throw new BootstrapError('角色只能是 tenant_admin、tenant_staff 或 merchant_user。');
  }
  if (role === 'merchant_user' && !merchantName) {
    throw new BootstrapError('角色是 merchant_user 时必须提供货主名称（--merchant-name）。');
  }

  const tenant = await prisma.tenant.upsert({
    where: { clerkOrgId },
    create: { name: tenantName, clerkOrgId },
    update: { name: tenantName },
  });
  const user = await prisma.user.upsert({
    where: { clerkUserId },
    create: { clerkUserId },
    update: {},
  });

  const merchant = merchantName
    ? await prisma.merchant.upsert({
        where: {
          tenantId_code: { tenantId: tenant.id, code: merchantCodeFromName(merchantName) },
        },
        create: {
          tenantId: tenant.id,
          name: merchantName,
          code: merchantCodeFromName(merchantName),
        },
        update: { name: merchantName },
      })
    : null;

  const membership = await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: role as MembershipRole,
      merchantId: role === 'merchant_user' ? merchant?.id : null,
    },
    update: {
      role: role as MembershipRole,
      merchantId: role === 'merchant_user' ? merchant?.id : null,
    },
  });

  return { tenant, user, merchant, membership, role, tenantName, merchantName };
}
