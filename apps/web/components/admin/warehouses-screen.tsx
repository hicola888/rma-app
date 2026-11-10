'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ImportExportToolbar,
  matchesFilter,
} from '@/components/import-export/import-export-toolbar';
import { useAdminLoad, type AdminRequest, type MeInfo, type Warehouse } from './api';

const emptyForm = { name: '', code: '', address: '' };

export function WarehousesScreen() {
  const [me, setMe] = useState<MeInfo | null>(null);
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async (request: AdminRequest) => {
    try {
      const profile = await request<MeInfo>('/me');
      setMe(profile);
      if (profile.role === 'merchant_user' || !profile.role) {
        setForbidden(true);
        return;
      }
      setForbidden(false);
      setRows(await request<Warehouse[]>('/warehouses'));
    } catch (caught) {
      if (caught instanceof Error && caught.message === 'FORBIDDEN') {
        setForbidden(true);
        return;
      }
      throw caught;
    }
  }, []);
  const { isLoaded, isSignedIn, request, error, reload } = useAdminLoad(load);

  if (!isLoaded) {
    return <p>正在加载…</p>;
  }
  if (!isSignedIn) {
    return <p>请先登录。</p>;
  }
  if (error) {
    return <p className="text-sm text-[#9a3b2f]">{error}</p>;
  }
  if (forbidden) {
    return <p>货主账号不能管理仓库资料。</p>;
  }

  const canEdit = me?.role === 'tenant_admin';
  const visible = rows.filter((row) =>
    matchesFilter(query, [row.code, row.name, row.address, row.active ? '启用' : '停用']),
  );

  function openCreate() {
    setForm(emptyForm);
    setEditing('new');
  }

  function openEdit(row: Warehouse) {
    setForm({ name: row.name, code: row.code, address: row.address ?? '' });
    setEditing(row);
  }

  async function save() {
    try {
      if (editing === 'new') {
        await request('/warehouses', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await request(`/warehouses/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
      }
      setEditing(null);
      reload();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : '保存失败');
    }
  }

  async function deactivate(row: Warehouse) {
    await request(`/warehouses/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !row.active }),
    });
    reload();
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">仓库</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ImportExportToolbar
            canImport={canEdit}
            filename="warehouses"
            query={query}
            onQueryChange={setQuery}
            exportPath="/warehouses/export"
            templatePath="/warehouses/import/template"
            previewPath="/warehouses/import/preview"
            commitPath="/warehouses/import/commit"
            onCommitted={reload}
          />
          {canEdit ? (
            <Button type="button" onClick={openCreate}>
              新建仓库
            </Button>
          ) : (
            <p className="text-sm text-[#3d4d5c]">只读</p>
          )}
        </div>
      </div>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-[#3d4d5c]">
          <tr>
            <th className="py-2">代码</th>
            <th>名称</th>
            <th>地址</th>
            <th>状态</th>
            {canEdit ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} className="border-t border-[#d5dee6]">
              <td className="py-3 font-mono">{row.code}</td>
              <td>{row.name}</td>
              <td>{row.address ?? '—'}</td>
              <td>{row.active ? '启用' : '停用'}</td>
              {canEdit ? (
                <td className="space-x-2 text-right">
                  <Button type="button" variant="outline" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void deactivate(row)}>
                    {row.active ? '停用' : '启用'}
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {editing ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-[#122033]/40 p-6">
          <form
            className="w-full max-w-md rounded-xl bg-white p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2 className="text-lg font-semibold">{editing === 'new' ? '新建仓库' : '编辑仓库'}</h2>
            {formError ? <p className="mt-3 text-sm text-[#9a3b2f]">{formError}</p> : null}
            <label className="mt-4 block text-sm">
              名称
              <input
                className="mt-1 w-full rounded-lg border border-[#d5dee6] px-3 py-2"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label className="mt-3 block text-sm">
              代码
              <input
                className="mt-1 w-full rounded-lg border border-[#d5dee6] px-3 py-2"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                required
              />
            </label>
            <label className="mt-3 block text-sm">
              地址（可选）
              <input
                className="mt-1 w-full rounded-lg border border-[#d5dee6] px-3 py-2"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
