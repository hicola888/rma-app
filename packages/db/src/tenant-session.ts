import { PrismaClient } from './generated/prisma/client.js';

export type MembershipRoleName = 'tenant_admin' | 'tenant_staff' | 'merchant_user';

export type ResolvedMembership = {
  userId: string;
  tenantId: string;
  merchantId: string | null;
  role: MembershipRoleName;
};

export type TenantSession = {
  tenantId: string;
  merchantId: string | null;
  userId: string;
};

type MembershipRow = {
  user_id: string;
  tenant_id: string;
  merchant_id: string | null;
  role: MembershipRoleName;
};

export async function findMembershipByClerk(
  prisma: PrismaClient,
  clerkUserId: string,
  clerkOrgId: string,
): Promise<ResolvedMembership | null> {
  const rows = await prisma.$queryRaw<MembershipRow[]>`
    SELECT user_id, tenant_id, merchant_id, role
    FROM app_find_membership(${clerkUserId}, ${clerkOrgId})
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    merchantId: row.merchant_id,
    role: row.role,
  };
}

export async function withTenantSession<T>(
  prisma: PrismaClient,
  session: TenantSession,
  run: (db: TenantTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (db) => {
      await db.$executeRaw`SELECT set_config('app.tenant_id', ${session.tenantId}, true)`;
      await db.$executeRaw`SELECT set_config('app.merchant_id', ${session.merchantId ?? ''}, true)`;
      await db.$executeRaw`SELECT set_config('app.user_id', ${session.userId}, true)`;
      return run(db);
    },
    // Bulk import writes every row in this same transaction. The default 5s
    // limit is too small once a sheet has thousands of rows.
    { maxWait: 5_000, timeout: 60_000 },
  );
}

export type TenantTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
