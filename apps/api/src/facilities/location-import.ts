import { z } from 'zod';
import type { ImportIssue, ImportModule } from '../import-export/types.js';
import { matchesQuery } from './warehouse-import.js';

export const locationTypeByLabel = {
  收货区: 'receiving',
  待检区: 'inspection',
  隔离区: 'quarantine',
  上架库位: 'storage',
  'Floor Stock': 'floor_stock',
  配件库位: 'parts',
} as const;

const locationTypeLabels = Object.keys(locationTypeByLabel);
const labelByType = Object.fromEntries(
  Object.entries(locationTypeByLabel).map(([label, type]) => [type, label]),
);

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

const locationSchema = z.object({
  warehouseCode: z
    .string()
    .trim()
    .min(1, '不能为空')
    .max(64, '不能超过 64 个字符')
    .transform((value) => value.toUpperCase()),
  code: z
    .string()
    .trim()
    .min(1, '不能为空')
    .max(64, '不能超过 64 个字符')
    .transform((value) => value.toUpperCase()),
  type: z
    .string()
    .trim()
    .refine((value) => value in locationTypeByLabel, `请填写：${locationTypeLabels.join('、')}`),
  active: activeText,
});

export type LocationImportRow = z.infer<typeof locationSchema>;

export const locationImport: ImportModule<LocationImportRow> = {
  filename: 'locations',
  columns: [
    { field: 'warehouseCode', header: '仓库代码', example: 'EPP' },
    { field: 'code', header: '库位代码', example: 'R-01' },
    { field: 'type', header: '类型', example: '收货区' },
    { field: 'active', header: '状态', example: '启用' },
  ],
  schema: locationSchema,
  keyOf: (row) => `${row.warehouseCode}\t${row.code}`,
  duplicateField: '库位代码',
  async resolve(db, rows) {
    const warehouseCodes = [...new Set(rows.map((row) => row.value.warehouseCode))];
    const warehouses = await db.warehouse.findMany({
      where: { code: { in: warehouseCodes } },
      select: { id: true, code: true },
    });
    const warehouseIdByCode = new Map(warehouses.map((row) => [row.code, row.id]));
    const issues: ImportIssue[] = [];
    for (const row of rows) {
      if (!warehouseIdByCode.has(row.value.warehouseCode)) {
        issues.push({
          row: row.row,
          field: '仓库代码',
          reason: `找不到仓库 ${row.value.warehouseCode}`,
        });
      }
    }
    const warehouseIds = [...warehouseIdByCode.values()];
    const locations =
      warehouseIds.length === 0
        ? []
        : await db.location.findMany({
            where: { warehouseId: { in: warehouseIds } },
            select: { code: true, warehouseId: true },
          });
    const codeById = new Map(warehouses.map((row) => [row.id, row.code]));
    const existingKeys = new Set(
      locations.map((row) => `${codeById.get(row.warehouseId) ?? ''}\t${row.code}`),
    );
    return { existingKeys, issues };
  },
  async apply(db, rows, tenantId) {
    for (const row of rows) {
      const warehouse = await db.warehouse.findFirst({
        where: { code: row.warehouseCode },
        select: { id: true },
      });
      if (!warehouse) {
        throw new Error(`找不到仓库 ${row.warehouseCode}`);
      }
      const type = locationTypeByLabel[row.type as keyof typeof locationTypeByLabel];
      const found = await db.location.findFirst({
        where: { warehouseId: warehouse.id, code: row.code },
        select: { id: true },
      });
      const data = { type, active: row.active === '启用' };
      if (!found) {
        await db.location.create({
          data: { ...data, tenantId, warehouseId: warehouse.id, code: row.code },
        });
      } else {
        await db.location.update({ where: { id: found.id }, data });
      }
    }
  },
  async list(db, query) {
    const rows = await db.location.findMany({
      orderBy: { code: 'asc' },
      include: { warehouse: { select: { code: true } } },
    });
    return rows
      .map((row) => ({
        warehouseCode: row.warehouse.code,
        code: row.code,
        type: labelByType[row.type] ?? row.type,
        active: row.active ? '启用' : '停用',
      }))
      .filter((row) => matchesQuery(query, Object.values(row)));
  },
};
