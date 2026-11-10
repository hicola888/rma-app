import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaClient, withTenantSession } from '@rma/db';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CLERK_TOKEN_VERIFIER, type ClerkTokenVerifier } from '../src/auth/clerk-token-verifier.js';

const adminDb = createPrismaClient(process.env.DIRECT_URL);
const appDb = createPrismaClient(process.env.DATABASE_URL);

describe('warehouses, locations, and staff roles', () => {
  const suffix = `${Date.now()}`;
  const orgA = `org_fac_a_${suffix}`;
  const orgB = `org_fac_b_${suffix}`;
  let tenantA = '';
  let tenantB = '';
  let adminUser = '';
  let staffUser = '';
  let merchantUser = '';
  let merchantId = '';
  let warehouseB = '';
  let locationB = '';
  let http: INestApplication;

  beforeAll(async () => {
    const a = await adminDb.tenant.create({ data: { name: '仓库租户 A', clerkOrgId: orgA } });
    const b = await adminDb.tenant.create({ data: { name: '仓库租户 B', clerkOrgId: orgB } });
    tenantA = a.id;
    tenantB = b.id;
    const merchant = await adminDb.merchant.create({
      data: { tenantId: tenantA, name: '货主', code: `m-${suffix}` },
    });
    merchantId = merchant.id;
    const users = await Promise.all([
      adminDb.user.create({ data: { clerkUserId: `fac_admin_${suffix}`, name: '管理员' } }),
      adminDb.user.create({ data: { clerkUserId: `fac_staff_${suffix}`, name: '员工' } }),
      adminDb.user.create({ data: { clerkUserId: `fac_merchant_${suffix}`, name: '货主用户' } }),
    ]);
    adminUser = users[0].id;
    staffUser = users[1].id;
    merchantUser = users[2].id;
    await adminDb.membership.create({
      data: { userId: adminUser, tenantId: tenantA, role: 'tenant_admin' },
    });
    await adminDb.membership.create({
      data: { userId: staffUser, tenantId: tenantA, role: 'tenant_staff' },
    });
    await adminDb.membership.create({
      data: { userId: merchantUser, tenantId: tenantA, merchantId, role: 'merchant_user' },
    });
    const other = await adminDb.warehouse.create({
      data: { tenantId: tenantB, name: 'B仓', code: 'B1' },
    });
    warehouseB = other.id;
    const otherLocation = await adminDb.location.create({
      data: { tenantId: tenantB, warehouseId: warehouseB, code: 'B-01', type: 'quarantine' },
    });
    locationB = otherLocation.id;

    const verifier: ClerkTokenVerifier = {
      verify: async (token: string) => {
        if (token === 'admin') return { clerkUserId: `fac_admin_${suffix}`, clerkOrgId: orgA };
        if (token === 'staff') return { clerkUserId: `fac_staff_${suffix}`, clerkOrgId: orgA };
        if (token === 'merchant') {
          return { clerkUserId: `fac_merchant_${suffix}`, clerkOrgId: orgA };
        }
        throw new Error('invalid token');
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLERK_TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();
    http = moduleRef.createNestApplication();
    await http.init();
  });

  afterAll(async () => {
    await http.close();
    await adminDb.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await adminDb.user.deleteMany({ where: { id: { in: [adminUser, staffUser, merchantUser] } } });
    await adminDb.$disconnect();
    await appDb.$disconnect();
  });

  it('stops tenant A from reading or updating tenant B warehouses and locations', async () => {
    await request(http.getHttpServer())
      .get(`/warehouses/${warehouseB}`)
      .set('Authorization', 'Bearer admin')
      .expect(404);
    await request(http.getHttpServer())
      .patch(`/warehouses/${warehouseB}`)
      .set('Authorization', 'Bearer admin')
      .send({ name: '被改掉了' })
      .expect(404);
    await request(http.getHttpServer())
      .get(`/locations/${locationB}`)
      .set('Authorization', 'Bearer admin')
      .expect(404);

    const visible = await withTenantSession(
      appDb,
      { tenantId: tenantA, merchantId: null, userId: adminUser },
      (db) => db.warehouse.findMany(),
    );
    expect(visible.map((row) => row.id)).not.toContain(warehouseB);

    const unchanged = await adminDb.warehouse.findUnique({ where: { id: warehouseB } });
    expect(unchanged?.name).toBe('B仓');
  });

  it('lets staff read but not create, and blocks merchant users', async () => {
    await request(http.getHttpServer())
      .get('/warehouses')
      .set('Authorization', 'Bearer staff')
      .expect(200);
    await request(http.getHttpServer())
      .post('/warehouses')
      .set('Authorization', 'Bearer staff')
      .send({ name: '员工仓', code: 'STAFF' })
      .expect(403);
    await request(http.getHttpServer())
      .get('/warehouses')
      .set('Authorization', 'Bearer merchant')
      .expect(403);
    await request(http.getHttpServer())
      .get('/staff')
      .set('Authorization', 'Bearer merchant')
      .expect(403);
  });

  it('refuses to remove the last tenant admin', async () => {
    const listed = await request(http.getHttpServer())
      .get('/staff')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    const adminMembership = (listed.body as Array<{ id: string; role: string }>).find(
      (row) => row.role === 'tenant_admin',
    );
    expect(adminMembership).toBeTruthy();

    await request(http.getHttpServer())
      .patch(`/staff/${adminMembership?.id}`)
      .set('Authorization', 'Bearer admin')
      .send({ role: 'tenant_staff' })
      .expect(400);

    const created = await request(http.getHttpServer())
      .post('/warehouses')
      .set('Authorization', 'Bearer admin')
      .send({ name: 'A仓', code: 'A1', address: 'Epping' })
      .expect(201);
    const warehouseId = (created.body as { id: string }).id;

    await request(http.getHttpServer())
      .post('/locations')
      .set('Authorization', 'Bearer admin')
      .send({ warehouseId, code: 'R-01', type: 'quarantine' })
      .expect(201);

    await request(http.getHttpServer())
      .patch(`/warehouses/${warehouseId}`)
      .set('Authorization', 'Bearer admin')
      .send({ active: false })
      .expect(200);
  });
});
