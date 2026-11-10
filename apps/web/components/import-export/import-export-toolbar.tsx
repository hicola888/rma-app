'use client';

import { useAuth } from '@clerk/nextjs';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiBase } from '@/components/admin/api';

export type ImportPreview = {
  counts: { created: number; updated: number; errors: number };
  errors: Array<{ row: number; field: string; reason: string }>;
  message?: string | string[];
};

type ToolbarProps = {
  canImport: boolean;
  filename: string;
  query: string;
  onQueryChange: (value: string) => void;
  exportPath: string;
  templatePath?: string;
  previewPath?: string;
  commitPath?: string;
  onCommitted?: () => void;
};

export function matchesFilter(query: string, values: Array<string | null | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return values.some((value) => (value ?? '').toLowerCase().includes(needle));
}

export function ImportExportToolbar({
  canImport,
  filename,
  query,
  onQueryChange,
  exportPath,
  templatePath,
  previewPath,
  commitPath,
  onCommitted,
}: ToolbarProps) {
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<'export' | 'template' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
    const token = await getToken();
    if (!token) {
      throw new Error('未登录');
    }
    return fetch(`${apiBase}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
  }

  async function download(path: string, format: 'csv' | 'xlsx', downloadName: string) {
    setMenu(null);
    setNotice('');
    const response = await authorizedFetch(
      `${path}?format=${format}&q=${encodeURIComponent(query)}`,
    );
    if (response.status === 403) {
      setNotice('没有权限');
      return;
    }
    if (!response.ok) {
      setNotice('下载失败');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function previewFile(next: File) {
    if (!previewPath) {
      return;
    }
    setBusy(true);
    setNotice('');
    setFile(next);
    try {
      const body = new FormData();
      body.append('file', next);
      const response = await authorizedFetch(previewPath, { method: 'POST', body });
      const payload = (await response.json()) as ImportPreview;
      if (response.status === 403) {
        setPreview(null);
        setNotice('只有租户管理员可以导入');
        return;
      }
      if (!response.ok && !payload.errors) {
        setPreview(null);
        setNotice(messageOf(payload) || '文件无法读取');
        return;
      }
      setPreview(payload);
    } catch {
      setNotice('API 没有启动或连不上（应该在 http://localhost:3001）');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!commitPath || !file) {
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await authorizedFetch(commitPath, { method: 'POST', body });
      const payload = (await response.json()) as ImportPreview;
      if (!response.ok) {
        setPreview(payload.errors ? payload : preview);
        setNotice(messageOf(payload) || '有错误，没有导入任何数据');
        return;
      }
      setPreview(null);
      setFile(null);
      setNotice(`已导入。新增 ${payload.counts.created}，更新 ${payload.counts.updated}。`);
      onCommitted?.();
    } catch {
      setNotice('API 没有启动或连不上（应该在 http://localhost:3001）');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="h-8 rounded-lg border border-[#d5dee6] px-3 text-sm"
        placeholder="筛选当前列表"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {canImport ? (
        <>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = '';
              if (next) {
                void previewFile(next);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            导入
          </Button>
        </>
      ) : null}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          onClick={() => setMenu(menu === 'export' ? null : 'export')}
        >
          导出
        </Button>
        {menu === 'export' ? (
          <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-[#d5dee6] bg-white p-1 shadow">
            <button
              type="button"
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[#f4f6f8]"
              onClick={() => void download(exportPath, 'csv', `${filename}.csv`)}
            >
              导出 CSV
            </button>
            <button
              type="button"
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[#f4f6f8]"
              onClick={() => void download(exportPath, 'xlsx', `${filename}.xlsx`)}
            >
              导出 Excel
            </button>
          </div>
        ) : null}
      </div>
      {canImport && templatePath ? (
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMenu(menu === 'template' ? null : 'template')}
          >
            下载模板
          </Button>
          {menu === 'template' ? (
            <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-[#d5dee6] bg-white p-1 shadow">
              <button
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[#f4f6f8]"
                onClick={() => void download(templatePath, 'csv', `${filename}-template.csv`)}
              >
                CSV 模板
              </button>
              <button
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[#f4f6f8]"
                onClick={() => void download(templatePath, 'xlsx', `${filename}-template.xlsx`)}
              >
                Excel 模板
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {notice ? <p className="text-sm text-[#3d4d5c]">{notice}</p> : null}
      {preview ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#122033]/40 p-6">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6">
            <h2 className="text-lg font-semibold">导入预览</h2>
            <p className="mt-3 text-sm">
              新增 {preview.counts?.created ?? 0} · 更新 {preview.counts?.updated ?? 0} · 错误{' '}
              {preview.counts?.errors ?? 0}
            </p>
            {preview.errors?.length ? (
              <ul className="mt-4 space-y-2 text-sm text-[#9a3b2f]">
                {preview.errors.slice(0, 50).map((issue) => (
                  <li key={`${issue.row}-${issue.field}-${issue.reason}`}>
                    第 {issue.row} 行，{issue.field}：{issue.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[#3d4d5c]">没有错误。确认后会一次性写入。</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPreview(null)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={busy || (preview.counts?.errors ?? 1) > 0}
                onClick={() => void commit()}
              >
                确认导入
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function messageOf(payload: ImportPreview): string {
  if (Array.isArray(payload.message)) {
    return payload.message.join(' ');
  }
  return payload.message ?? '';
}
