import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaClient } from '@rma/db';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CLERK_TOKEN_VERIFIER, type ClerkTokenVerifier } from '../src/auth/clerk-token-verifier.js';
import { escapeFormula } from '../src/import-export/escape-formula.js';
import { MAX_IMPORT_BYTES } from '../src/import-export/types.js';

const adminDb = createPrismaClient(process.env.DIRECT_URL);

describe('formula escaping', () => {
  it('prefixes cells that Excel would treat as formulas', () => {
    expect(escapeFormula('=1+1')).toBe("'=1+1");
    expect(escapeFormula('+1')).toBe("'+1");
    expect(escapeFormula('-1')).toBe("'-1");
    expect(escapeFormula('@cmd')).toBe("'@cmd");
    expect(escapeFormula('EPP')).toBe('EPP');
  });
});

describe('warehouse and location import/export', () => {
  const suffix = `${Date.now()}`;
  const orgA = `org_imp_a_${suffix}`;
  const orgB = `org_imp_b_${suffix}`;
  let tenantA = '';
  let tenantB = '';
  let adminUser = '';
  let staffUser = '';
  let merchantUser = '';
  let http: INestApplication;

  const warehouseHeader = '仓库代码,仓库名称,地址,状态';
  const locationHeader = '仓库代码,库位代码,类型,状态';

  beforeAll(async () => {
    const tenant = await adminDb.tenant.create({ data: { name: '导入租户 A', clerkOrgId: orgA } });
    const other = await adminDb.tenant.create({ data: { name: '导入租户 B', clerkOrgId: orgB } });
    tenantA = tenant.id;
    tenantB = other.id;
    const merchant = await adminDb.merchant.create({
      data: { tenantId: tenantA, name: '货主', code: `imp-${suffix}` },
    });
    const users = await Promise.all([
      adminDb.user.create({
        data: { clerkUserId: `imp_admin_${suffix}`, name: '=1+1', email: 'admin@example.com' },
      }),
      adminDb.user.create({ data: { clerkUserId: `imp_staff_${suffix}`, name: '员工' } }),
      adminDb.user.create({ data: { clerkUserId: `imp_merchant_${suffix}`, name: '货主用户' } }),
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
      data: {
        userId: merchantUser,
        tenantId: tenantA,
        merchantId: merchant.id,
        role: 'merchant_user',
      },
    });
    await adminDb.warehouse.create({
      data: { tenantId: tenantB, name: 'B仓', code: 'SHARED' },
    });

    const verifier: ClerkTokenVerifier = {
      verify: async (token: string) => {
        if (token === 'admin') return { clerkUserId: `imp_admin_${suffix}`, clerkOrgId: orgA };
        if (token === 'staff') return { clerkUserId: `imp_staff_${suffix}`, clerkOrgId: orgA };
        if (token === 'merchant')
          return { clerkUserId: `imp_merchant_${suffix}`, clerkOrgId: orgA };
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
  });

  function sheet(lines: string[]): Buffer {
    return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
  }

  function upload(path: string, token: string, body: Buffer, filename: string) {
    return request(http.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', body, filename);
  }

  it('reports each invalid row and writes nothing when any row is wrong', async () => {
    const file = sheet([warehouseHeader, 'NEW1,新仓库,地址,启用', ',缺代码,地址,启用']);
    const preview = await upload('/warehouses/import/preview', 'admin', file, 'warehouses.csv');
    expect(preview.status).toBe(201);
    expect(preview.body.counts).toEqual({ created: 1, updated: 0, errors: 1 });
    expect(preview.body.errors).toEqual([
      expect.objectContaining({ row: 3, field: '仓库代码', reason: '不能为空' }),
    ]);

    const committed = await upload('/warehouses/import/commit', 'admin', file, 'warehouses.csv');
    expect(committed.status).toBe(400);
    expect(committed.body.message).toBe('有错误，没有导入任何数据');
    expect(await adminDb.warehouse.count({ where: { tenantId: tenantA, code: 'NEW1' } })).toBe(0);
  });

  it('upserts by warehouse code and repeats cleanly', async () => {
    const created = sheet([warehouseHeader, 'A1,甲仓,,启用', 'A2,乙仓,,启用']);
    const first = await upload('/warehouses/import/commit', 'admin', created, 'warehouses.csv');
    expect(first.status).toBe(201);
    expect(first.body.counts).toEqual({ created: 2, updated: 0, errors: 0 });

    const second = await upload('/warehouses/import/commit', 'admin', created, 'warehouses.csv');
    expect(second.status).toBe(201);
    expect(second.body.counts).toEqual({ created: 0, updated: 2, errors: 0 });
    expect(
      await adminDb.warehouse.count({ where: { tenantId: tenantA, code: { in: ['A1', 'A2'] } } }),
    ).toBe(2);

    const renamed = sheet([warehouseHeader, 'A1,甲仓改名,,停用']);
    await upload('/warehouses/import/commit', 'admin', renamed, 'warehouses.csv').expect(201);
    const row = await adminDb.warehouse.findFirst({ where: { tenantId: tenantA, code: 'A1' } });
    expect(row?.name).toBe('甲仓改名');
    expect(row?.active).toBe(false);
  });

  it('treats a code owned by another tenant as a new row in this tenant', async () => {
    const file = sheet([warehouseHeader, 'SHARED,A仓,,启用']);
    const result = await upload('/warehouses/import/commit', 'admin', file, 'warehouses.csv');
    expect(result.status).toBe(201);
    expect(result.body.counts.created).toBe(1);

    const other = await adminDb.warehouse.findFirst({
      where: { tenantId: tenantB, code: 'SHARED' },
    });
    const own = await adminDb.warehouse.findFirst({ where: { tenantId: tenantA, code: 'SHARED' } });
    expect(other?.name).toBe('B仓');
    expect(own?.name).toBe('A仓');

    const exported = await request(http.getHttpServer())
      .get('/warehouses/export?format=csv')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    expect(exported.text).not.toContain('B仓');
    expect(exported.text.charCodeAt(0)).toBe(0xfeff);
  });

  it('refuses duplicate codes in one file without writing the first row', async () => {
    const file = sheet([warehouseHeader, 'DUP,一,,启用', 'DUP,二,,启用']);
    const result = await upload('/warehouses/import/commit', 'admin', file, 'warehouses.csv');
    expect(result.status).toBe(400);
    expect(result.body.errors).toHaveLength(2);
    expect(await adminDb.warehouse.count({ where: { tenantId: tenantA, code: 'DUP' } })).toBe(0);
  });

  it('lets staff export but not import, and blocks merchant users', async () => {
    await upload(
      '/warehouses/import/preview',
      'staff',
      sheet([warehouseHeader, 'STAFF,员工仓,,启用']),
      'warehouses.csv',
    ).expect(403);
    await request(http.getHttpServer())
      .get('/warehouses/export')
      .set('Authorization', 'Bearer staff')
      .expect(200);
    await request(http.getHttpServer())
      .get('/warehouses/export')
      .set('Authorization', 'Bearer merchant')
      .expect(403);
    await upload(
      '/locations/import/preview',
      'merchant',
      sheet([locationHeader, 'A1,L1,收货区,启用']),
      'locations.csv',
    ).expect(403);
  });

  it('escapes formula text in csv and xlsx exports', async () => {
    await adminDb.warehouse.create({
      data: { tenantId: tenantA, name: '=1+1', code: 'FORM', address: '+1' },
    });
    const csv = await request(http.getHttpServer())
      .get('/warehouses/export?format=csv&q=FORM')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    expect(csv.text).toContain("'=1+1");
    expect(csv.text).toContain("'+1");

    const xlsx = await request(http.getHttpServer())
      .get('/warehouses/export?format=xlsx&q=FORM')
      .set('Authorization', 'Bearer admin')
      .responseType('blob')
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(xlsx.body) as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    const values = sheet?.getRow(2).values;
    expect(JSON.stringify(values)).toContain("'=1+1");

    const staff = await request(http.getHttpServer())
      .get('/staff/export?format=csv')
      .set('Authorization', 'Bearer staff')
      .expect(200);
    expect(staff.text).toContain("'=1+1");
    expect(staff.text).toContain('租户管理员');
    expect(staff.text.charCodeAt(0)).toBe(0xfeff);
  });

  it('imports locations by Chinese type labels and rolls back the whole file', async () => {
    const bad = sheet([locationHeader, 'A1,L1,收货区,启用', 'A1,L2,不是类型,启用']);
    const failed = await upload('/locations/import/commit', 'admin', bad, 'locations.csv');
    expect(failed.status).toBe(400);
    expect(failed.body.errors).toEqual([expect.objectContaining({ row: 3, field: '类型' })]);
    expect(await adminDb.location.count({ where: { tenantId: tenantA, code: 'L1' } })).toBe(0);

    const good = sheet([locationHeader, 'A1,L1,收货区,启用']);
    const created = await upload('/locations/import/commit', 'admin', good, 'locations.csv');
    expect(created.status).toBe(201);
    const location = await adminDb.location.findFirst({ where: { tenantId: tenantA, code: 'L1' } });
    expect(location?.type).toBe('receiving');

    const updated = sheet([locationHeader, 'A1,L1,待检区,停用']);
    const again = await upload('/locations/import/commit', 'admin', updated, 'locations.csv');
    expect(again.body.counts).toEqual({ created: 0, updated: 1, errors: 0 });
    const changed = await adminDb.location.findFirst({ where: { tenantId: tenantA, code: 'L1' } });
    expect(changed?.type).toBe('inspection');
    expect(changed?.active).toBe(false);

    const missing = await upload(
      '/locations/import/preview',
      'admin',
      sheet([locationHeader, 'NOPE,L9,收货区,启用']),
      'locations.csv',
    );
    expect(missing.body.errors[0].reason).toContain('找不到仓库 NOPE');
  });

  it('serves a Chinese template and rejects oversized files', async () => {
    const template = await request(http.getHttpServer())
      .get('/warehouses/import/template')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    expect(template.text.charCodeAt(0)).toBe(0xfeff);
    expect(template.text).toContain('仓库代码,仓库名称,地址,状态');
    expect(template.text).toContain('二号仓');
    await request(http.getHttpServer())
      .get('/warehouses/import/template')
      .set('Authorization', 'Bearer staff')
      .expect(403);

    const oversized = Buffer.alloc(MAX_IMPORT_BYTES + 1, 97);
    const rejected = await upload(
      '/warehouses/import/preview',
      'admin',
      oversized,
      'warehouses.csv',
    );
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toBe('文件太大，请小于 5MB');
  });
});
