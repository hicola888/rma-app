import { z } from 'zod';
import type { ImportModule } from '../import-export/types.js';

const activeText = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === '' || value === '启用') {
      return '启用';
    }
    if (value === '停用') {
      return '停用';
    }
    context.addIssue({ code: z.ZodIssueCode.custom, message: '请填写“启用”或“停用”' });
    return z.NEVER;
  });

const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, '不能为空')
    .max(64, '不能超过 64 个字符')
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, '不能为空').max(200, '不能超过 200 个字符'),
  address: z.string().trim().max(500, '不能超过 500 个字符'),
  active: activeText,
});

export type WarehouseImportRow = z.infer<typeof warehouseSchema>;

export const warehouseImport: ImportModule<WarehouseImportRow> = {
  filename: 'warehouses',
  columns: [
    { field: 'code', header: '仓库代码', example: 'EPP2' },
    { field: 'name', header: '仓库名称', example: '二号仓' },
    { field: 'address', header: '地址', example: 'Epping NSW' },
    { field: 'active', header: '状态', example: '启用' },
  ],
  schema: warehouseSchema,
  keyOf: (row) => row.code,
  duplicateField: '仓库代码',
  async resolve(db, rows) {
    const existing = await db.warehouse.findMany({
      where: { code: { in: rows.map((row) => row.value.code) } },
      select: { code: true },
    });
    return { existingKeys: new Set(existing.map((row) => row.code)), issues: [] };
  },
  async apply(db, rows, tenantId) {
    for (const row of rows) {
      const found = await db.warehouse.findFirst({
        where: { code: row.code },
        select: { id: true },
      });
      const data = {
        name: row.name,
        address: row.address || null,
        active: row.active === '启用',
      };
      if (!found) {
        await db.warehouse.create({ data: { ...data, tenantId, code: row.code } });
      } else {
        await db.warehouse.update({ where: { id: found.id }, data });
      }
    }
  },
  async list(db, query) {
    const rows = await db.warehouse.findMany({ orderBy: { code: 'asc' } });
    return rows
      .map((row) => ({
        code: row.code,
        name: row.name,
        address: row.address ?? '',
        active: row.active ? '启用' : '停用',
      }))
      .filter((row) => matchesQuery(query, Object.values(row)));
  },
};

export function matchesQuery(query: string, values: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return values.some((value) => value.toLowerCase().includes(needle));
}
