import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaClient, withTenantSession } from '@rma/db';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CLERK_TOKEN_VERIFIER, type ClerkTokenVerifier } from '../src/auth/clerk-token-verifier.js';

const admin = createPrismaClient(process.env.DIRECT_URL);
const appDb = createPrismaClient(process.env.DATABASE_URL);

describe('tenant isolation', () => {
  const suffix = `${Date.now()}`;
  const clerkOrgA = `org_a_${suffix}`;
  const clerkOrgB = `org_b_${suffix}`;
  const clerkUserAdmin = `user_admin_${suffix}`;
  const clerkUserMerchant = `user_merchant_${suffix}`;

  let tenantAId = '';
  let tenantBId = '';
  let merchantXId = '';
  let merchantYId = '';
  let merchantBId = '';
  let userAdminId = '';
  let userMerchantId = '';
  let http: INestApplication;

  beforeAll(async () => {
    const tenantA = await admin.tenant.create({
      data: { name: '租户 A', clerkOrgId: clerkOrgA },
    });
    const tenantB = await admin.tenant.create({
      data: { name: '租户 B', clerkOrgId: clerkOrgB },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const merchantX = await admin.merchant.create({
      data: { tenantId: tenantAId, name: '货主 X', code: `x-${suffix}` },
    });
    const merchantY = await admin.merchant.create({
      data: { tenantId: tenantAId, name: '货主 Y', code: `y-${suffix}` },
    });
    const merchantB = await admin.merchant.create({
      data: { tenantId: tenantBId, name: '货主 B', code: `b-${suffix}` },
    });
    merchantXId = merchantX.id;
    merchantYId = merchantY.id;
    merchantBId = merchantB.id;

    const userAdmin = await admin.user.create({
      data: { clerkUserId: clerkUserAdmin, name: '管理员 A' },
    });
    const userMerchant = await admin.user.create({
      data: { clerkUserId: clerkUserMerchant, name: '货主用户 X' },
    });
    userAdminId = userAdmin.id;
    userMerchantId = userMerchant.id;

    await admin.membership.create({
      data: { userId: userAdminId, tenantId: tenantAId, role: 'tenant_admin' },
    });
    await admin.membership.create({
      data: {
        userId: userMerchantId,
        tenantId: tenantAId,
        merchantId: merchantXId,
        role: 'merchant_user',
      },
    });

    const verifier: ClerkTokenVerifier = {
      verify: async (token: string) => {
        if (token === 'admin-a') {
          return { clerkUserId: clerkUserAdmin, clerkOrgId: clerkOrgA };
        }
        if (token === 'merchant-x') {
          return { clerkUserId: clerkUserMerchant, clerkOrgId: clerkOrgA };
        }
        throw new Error('invalid token');
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLERK_TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();

    http = moduleRef.createNestApplication();
    await http.init();
  });

  afterAll(async () => {
    await http.close();
    await admin.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await admin.user.deleteMany({ where: { id: { in: [userAdminId, userMerchantId] } } });
    await admin.$disconnect();
    await appDb.$disconnect();
  });

  it('hides tenant B from a tenant A session', async () => {
    const names = await withTenantSession(
      appDb,
      { tenantId: tenantAId, merchantId: null, userId: userAdminId },
      async (db) => {
        const rows = await db.merchant.findMany();
        const updated = await db.merchant.updateMany({
          where: { id: merchantBId },
          data: { name: '被改掉了' },
        });
        expect(updated.count).toBe(0);
        return rows.map((row) => row.name);
      },
    );

    expect(names).toEqual(expect.arrayContaining(['货主 X', '货主 Y']));
    expect(names).not.toContain('货主 B');

    const untouched = await admin.merchant.findUnique({ where: { id: merchantBId } });
    expect(untouched?.name).toBe('货主 B');
  });

  it('hides another merchant from a merchant_user in the same tenant', async () => {
    const ids = await withTenantSession(
      appDb,
      { tenantId: tenantAId, merchantId: merchantXId, userId: userMerchantId },
      async (db) => {
        const rows = await db.merchant.findMany();
        return rows.map((row) => row.id);
      },
    );

    expect(ids).toEqual([merchantXId]);
  });

  it('returns 401 when the API call has no token', async () => {
    await request(http.getHttpServer()).get('/merchants').expect(401);
    await request(http.getHttpServer()).get('/health').expect(200);
  });

  it('returns only the scoped merchants through the API', async () => {
    const adminResponse = await request(http.getHttpServer())
      .get('/merchants')
      .set('Authorization', 'Bearer admin-a')
      .expect(200);
    const adminIds = (adminResponse.body as Array<{ id: string }>).map((row) => row.id);
    expect(adminIds).toEqual(expect.arrayContaining([merchantXId, merchantYId]));
    expect(adminIds).not.toContain(merchantBId);

    const merchantResponse = await request(http.getHttpServer())
      .get('/merchants')
      .set('Authorization', 'Bearer merchant-x')
      .expect(200);
    const merchantIds = (merchantResponse.body as Array<{ id: string }>).map((row) => row.id);
    expect(merchantIds).toEqual([merchantXId]);
  });
});
