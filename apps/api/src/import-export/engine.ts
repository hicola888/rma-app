import { BadRequestException } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import type { ZodError } from 'zod';
import { escapeFormula } from './escape-formula.js';
import { readSheet } from './parse-file.js';
import type {
  DownloadFile,
  ExportModule,
  ImportColumn,
  ImportIssue,
  ImportModule,
  ImportPreview,
  SheetDb,
  UploadedSheet,
} from './types.js';

type Analyzed<T> = ImportPreview & { rows: T[] };

export async function previewImport<T extends Record<string, string>>(
  spec: ImportModule<T>,
  db: SheetDb,
  file: UploadedSheet | undefined,
): Promise<ImportPreview> {
  const analyzed = await analyze(spec, db, file);
  return { counts: analyzed.counts, errors: analyzed.errors };
}

/**
 * Writes every valid row in the caller's current database transaction.
 * The tenant interceptor opens that transaction, so a thrown error rolls
 * the whole file back. Callers must not write before this returns.
 */
export async function commitImport<T extends Record<string, string>>(
  spec: ImportModule<T>,
  db: SheetDb,
  file: UploadedSheet | undefined,
  tenantId: string,
): Promise<ImportPreview> {
  const analyzed = await analyze(spec, db, file);
  if (analyzed.counts.errors > 0) {
    throw new BadRequestException({
      message: '有错误，没有导入任何数据',
      counts: analyzed.counts,
      errors: analyzed.errors,
    });
  }
  await spec.apply(db, analyzed.rows, tenantId);
  return { counts: analyzed.counts, errors: [] };
}

export async function renderExport(
  spec: ExportModule,
  db: SheetDb,
  format: string | undefined,
  query: string | undefined,
): Promise<DownloadFile> {
  const rows = await spec.list(db, query ?? '');
  return renderTable(spec.filename, spec.columns, rows, parseFormat(format), false);
}

export async function renderTemplate(
  spec: ExportModule,
  format: string | undefined,
): Promise<DownloadFile> {
  const example: Record<string, string> = {};
  for (const column of spec.columns) {
    example[column.field] = column.example;
  }
  return renderTable(spec.filename, spec.columns, [example], parseFormat(format), true);
}

async function analyze<T extends Record<string, string>>(
  spec: ImportModule<T>,
  db: SheetDb,
  file: UploadedSheet | undefined,
): Promise<Analyzed<T>> {
  const sheet = await readSheet(file, spec.columns);
  if (!sheet.ok) {
    return {
      counts: { created: 0, updated: 0, errors: 1 },
      errors: [{ row: sheet.row, field: sheet.field, reason: sheet.reason }],
      rows: [],
    };
  }

  const headerByField = new Map(spec.columns.map((column) => [column.field, column.header]));
  const parsed: Array<{ row: number; value: T }> = [];
  const errors: ImportIssue[] = [];

  for (const record of sheet.records) {
    const input: Record<string, string> = {};
    for (const column of spec.columns) {
      input[column.field] = record.values[column.header] ?? '';
    }
    const result = spec.schema.safeParse(input);
    if (!result.success) {
      errors.push(...issuesFromZod(result.error, record.row, headerByField));
      continue;
    }
    parsed.push({ row: record.row, value: result.data });
  }

  const unique: Array<{ row: number; value: T }> = [];
  const seen = new Map<string, number[]>();
  for (const item of parsed) {
    const key = spec.keyOf(item.value);
    const rows = seen.get(key) ?? [];
    rows.push(item.row);
    seen.set(key, rows);
  }
  for (const item of parsed) {
    const rows = seen.get(spec.keyOf(item.value)) ?? [];
    if (rows.length > 1) {
      const others = rows.filter((row) => row !== item.row).join('、');
      errors.push({
        row: item.row,
        field: spec.duplicateField,
        reason: `和本文件第 ${others} 行重复`,
      });
      continue;
    }
    unique.push(item);
  }

  const resolved =
    unique.length > 0
      ? await spec.resolve(db, unique)
      : { existingKeys: new Set<string>(), issues: [] };
  errors.push(...resolved.issues);
  const blocked = new Set(resolved.issues.map((issue) => issue.row));

  const rows: T[] = [];
  let created = 0;
  let updated = 0;
  for (const item of unique) {
    if (blocked.has(item.row)) {
      continue;
    }
    if (resolved.existingKeys.has(spec.keyOf(item.value))) {
      updated += 1;
    } else {
      created += 1;
    }
    rows.push(item.value);
  }

  return {
    counts: {
      created,
      updated,
      errors: new Set(errors.map((issue) => issue.row)).size,
    },
    errors: errors.sort((left, right) => left.row - right.row),
    rows,
  };
}

function issuesFromZod(
  error: ZodError,
  row: number,
  headerByField: Map<string, string>,
): ImportIssue[] {
  return error.issues.map((issue) => {
    const fieldKey = String(issue.path[0] ?? '');
    return {
      row,
      field: headerByField.get(fieldKey) ?? '这一行',
      reason: issue.message,
    };
  });
}

function parseFormat(format: string | undefined): 'csv' | 'xlsx' {
  const value = (format ?? 'csv').trim().toLowerCase();
  if (value === 'csv' || value === 'xlsx') {
    return value;
  }
  throw new BadRequestException('格式只能是 csv 或 xlsx');
}

async function renderTable(
  filename: string,
  columns: ImportColumn[],
  rows: Array<Record<string, string>>,
  format: 'csv' | 'xlsx',
  template: boolean,
): Promise<DownloadFile> {
  const headers = columns.map((column) => column.header);
  const bodyRows = rows.map((row) =>
    columns.map((column) => escapeFormula(row[column.field] ?? '')),
  );
  if (format === 'csv') {
    const csv = stringify([headers, ...bodyRows]);
    const suffix = template ? '-template.csv' : '.csv';
    return {
      filename: `${filename}${suffix}`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.concat([Buffer.from('\uFEFF', 'utf8'), Buffer.from(csv, 'utf8')]),
    };
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('数据');
  sheet.addRow(headers);
  for (const row of bodyRows) {
    sheet.addRow(row);
  }
  const raw = await workbook.xlsx.writeBuffer();
  const suffix = template ? '-template.xlsx' : '.xlsx';
  return {
    filename: `${filename}${suffix}`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: Buffer.from(raw),
  };
}
