import type { TenantTransaction } from '@rma/db';
import type { ZodError } from 'zod';

/** One import file can contain at most this many data rows. */
export const MAX_IMPORT_ROWS = 5000;

/** Reject uploads larger than this before parsing. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type SheetDb = TenantTransaction;

/** A column future pages plug in. Headers shown to users are Simplified Chinese. */
export type ImportColumn = {
  field: string;
  header: string;
  example: string;
};

export type ImportIssue = {
  row: number;
  field: string;
  reason: string;
};

export type ImportCounts = {
  created: number;
  updated: number;
  errors: number;
};

export type ImportPreview = {
  counts: ImportCounts;
  errors: ImportIssue[];
};

export type UploadedSheet = {
  buffer: Buffer;
  originalname?: string;
  size?: number;
  mimetype?: string;
};

export type DownloadFile = {
  filename: string;
  contentType: string;
  body: Buffer;
};

/**
 * What one feature page provides. The shared engine parses, validates,
 * previews, and commits. `resolve` and `list` run under the caller's
 * tenant RLS session, so another tenant's rows are invisible.
 */
export type ImportModule<T extends Record<string, string>> = {
  filename: string;
  columns: ImportColumn[];
  /** A zod schema. `safeParse` is structural so each page can keep its own schema. */
  schema: {
    safeParse(data: unknown): { success: true; data: T } | { success: false; error: ZodError };
  };
  keyOf: (row: T) => string;
  duplicateField: string;
  resolve: (
    db: SheetDb,
    rows: Array<{ row: number; value: T }>,
  ) => Promise<{ existingKeys: Set<string>; issues: ImportIssue[] }>;
  apply: (db: SheetDb, rows: T[], tenantId: string) => Promise<void>;
  list: (db: SheetDb, query: string) => Promise<Array<Record<string, string>>>;
};

/** Export-only pages (for example staff) implement this smaller shape. */
export type ExportModule = {
  filename: string;
  columns: ImportColumn[];
  list: (db: SheetDb, query: string) => Promise<Array<Record<string, string>>>;
};
