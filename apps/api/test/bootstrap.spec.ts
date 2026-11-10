import { bootstrapMembership, BootstrapError, createPrismaClient } from '@rma/db';
import { afterAll, describe, expect, it } from 'vitest';

const admin = createPrismaClient(process.env.DIRECT_URL);

describe('db bootstrap', () => {
  const suffix = `${Date.now()}`;
  const clerkUserId = `user_boot_${suffix}`;
  const clerkOrgId = `org_boot_${suffix}`;
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await admin.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
    }
    if (createdUserIds.length > 0) {
      await admin.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await admin.$disconnect();
  });

  it('upserts the same tenant and user when run twice', async () => {
    const first = await bootstrapMembership(admin, {
      clerkUserId,
      clerkOrgId,
      tenantName: 'Epping 仓库',
    });
    createdTenantIds.push(first.tenant.id);
    createdUserIds.push(first.user.id);

    const second = await bootstrapMembership(admin, {
      clerkUserId,
      clerkOrgId,
    });

    expect(second.tenant.id).toBe(first.tenant.id);
    expect(second.user.id).toBe(first.user.id);
    expect(second.role).toBe('tenant_admin');
    expect(second.merchant).toBeNull();
    expect(await admin.tenant.count({ where: { clerkOrgId } })).toBe(1);
    expect(
      await admin.membership.count({ where: { userId: first.user.id, tenantId: first.tenant.id } }),
    ).toBe(1);
  });

  it('requires a merchant name for merchant_user', async () => {
    await expect(
      bootstrapMembership(admin, {
        clerkUserId: `user_merchant_${suffix}`,
        clerkOrgId: `org_merchant_${suffix}`,
        role: 'merchant_user',
      }),
    ).rejects.toBeInstanceOf(BootstrapError);
  });

  it('creates a merchant and scopes the membership when a merchant name is given', async () => {
    const result = await bootstrapMembership(admin, {
      clerkUserId: `user_scoped_${suffix}`,
      clerkOrgId: `org_scoped_${suffix}`,
      role: 'merchant_user',
      merchantName: '示例货主',
    });
    createdTenantIds.push(result.tenant.id);
    createdUserIds.push(result.user.id);

    expect(result.merchant?.code).toBe('示例货主');
    expect(result.membership.merchantId).toBe(result.merchant?.id);
    expect(result.membership.role).toBe('merchant_user');
  });
});
