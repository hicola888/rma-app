import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ImportColumn,
  type UploadedSheet,
} from './types.js';

export type SheetRecord = {
  row: number;
  values: Record<string, string>;
};

export type ReadSheetResult =
  { ok: true; records: SheetRecord[] } | { ok: false; row: number; field: string; reason: string };

export async function readSheet(
  file: UploadedSheet | undefined,
  columns: ImportColumn[],
): Promise<ReadSheetResult> {
  if (!file?.buffer || file.buffer.length === 0) {
    return { ok: false, row: 1, field: '文件', reason: '请选择 CSV 或 Excel 文件' };
  }
  if (file.buffer.length > MAX_IMPORT_BYTES || (file.size ?? 0) > MAX_IMPORT_BYTES) {
    return { ok: false, row: 1, field: '文件', reason: '文件太大，请小于 5MB' };
  }

  const format = detectFormat(file);
  if (!format) {
    return { ok: false, row: 1, field: '文件', reason: '只支持 CSV 或 Excel（.xlsx）' };
  }

  try {
    const table = format === 'csv' ? readCsv(file.buffer) : await readXlsx(file.buffer);
    if ('reason' in table) {
      return { ok: false, row: 1, field: '文件', reason: table.reason };
    }
    const missing = columns.filter((column) => !table.headers.includes(column.header));
    if (missing.length > 0) {
      return {
        ok: false,
        row: 1,
        field: '表头',
        reason: `缺少列：${missing.map((column) => column.header).join('、')}。请用下载的模板。`,
      };
    }
    if (table.records.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        row: MAX_IMPORT_ROWS + 1,
        field: '文件',
        reason: `一次最多导入 ${MAX_IMPORT_ROWS} 行`,
      };
    }
    return { ok: true, records: table.records };
  } catch {
    return {
      ok: false,
      row: 1,
      field: '文件',
      reason: '文件无法读取，请确认是 CSV（UTF-8）或 .xlsx',
    };
  }
}

function detectFormat(file: UploadedSheet): 'csv' | 'xlsx' | null {
  const name = (file.originalname ?? '').toLowerCase();
  if (name.endsWith('.csv')) {
    return 'csv';
  }
  if (name.endsWith('.xlsx')) {
    return 'xlsx';
  }
  const mime = (file.mimetype ?? '').toLowerCase();
  if (mime.includes('csv')) {
    return 'csv';
  }
  if (mime.includes('spreadsheetml')) {
    return 'xlsx';
  }
  return null;
}

function readCsv(
  buffer: Buffer,
): { headers: string[]; records: SheetRecord[] } | { reason: string } {
  const parsed = parse(buffer, {
    columns: (headers: string[]) => headers.map((header) => header.trim()),
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
    trim: true,
  }) as Array<Record<string, string | undefined>>;

  if (!Array.isArray(parsed)) {
    return { reason: '文件无法读取，请确认是 CSV（UTF-8）或 .xlsx' };
  }

  const headers = parsed.length > 0 ? Object.keys(parsed[0] ?? {}) : headersFromCsv(buffer);
  const records: SheetRecord[] = [];
  parsed.forEach((record, index) => {
    const values = normalizeRecord(record);
    if (Object.values(values).every((value) => value === '')) {
      return;
    }
    records.push({ row: index + 2, values });
  });
  return { headers, records };
}

function headersFromCsv(buffer: Buffer): string[] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.split(',').map((header) => header.trim());
}

async function readXlsx(
  buffer: Buffer,
): Promise<{ headers: string[]; records: SheetRecord[] } | { reason: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { reason: 'Excel 里没有工作表' };
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let col = 1; col <= headerRow.cellCount; col += 1) {
    headers.push(headerRow.getCell(col).text.trim());
  }
  while (headers.length > 0 && headers[headers.length - 1] === '') {
    headers.pop();
  }

  const records: SheetRecord[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) {
        return;
      }
      values[header] = row.getCell(index + 1).text.trim();
    });
    if (Object.values(values).every((value) => value === '')) {
      continue;
    }
    records.push({ row: rowNumber, values });
  }
  return { headers, records };
}

function normalizeRecord(record: Record<string, string | undefined>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    values[key.trim()] = (value ?? '').trim();
  }
  return values;
}
