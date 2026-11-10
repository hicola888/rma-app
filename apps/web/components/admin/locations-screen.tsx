'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  locationTypeLabels,
  useAdminLoad,
  type AdminRequest,
  type Location,
  type MeInfo,
  type Warehouse,
} from './api';

const emptyForm = { warehouseId: '', code: '', type: 'receiving' };

export function LocationsScreen() {
  const [me, setMe] = useState<MeInfo | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rows, setRows] = useState<Location[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<Location | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const load = useCallback(async (request: AdminRequest) => {
    try {
      const profile = await request<MeInfo>('/me');
      setMe(profile);
      if (profile.role === 'merchant_user' || !profile.role) {
        setForbidden(true);
        return;
      }
      setForbidden(false);
      const [warehouseRows, locationRows] = await Promise.all([
        request<Warehouse[]>('/warehouses'),
        request<Location[]>('/locations'),
      ]);
      setWarehouses(warehouseRows);
      setRows(locationRows);
    } catch (caught) {
      if (caught instanceof Error && caught.message === 'FORBIDDEN') {
        setForbidden(true);
        return;
      }
      throw caught;
    }
  }, []);
  const { isLoaded, isSignedIn, request, error, reload } = useAdminLoad(load);

  if (!isLoaded) return <p>正在加载…</p>;
  if (!isSignedIn) return <p>请先登录。</p>;
  if (error) return <p className="text-sm text-[#9a3b2f]">{error}</p>;
  if (forbidden) return <p>货主账号不能管理库位。</p>;

  const canEdit = me?.role === 'tenant_admin';
  const warehouseName = new Map(warehouses.map((row) => [row.id, `${row.code} ${row.name}`]));

  async function save() {
    try {
      if (editing === 'new') {
        await request('/locations', { method: 'POST', body: JSON.stringify(form) });
      } else if (editing) {
        await request(`/locations/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ code: form.code, type: form.type }),
        });
      }
      setEditing(null);
      reload();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : '保存失败');
    }
  }

  async function deactivate(row: Location) {
    await request(`/locations/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !row.active }),
    });
    reload();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">库位</h1>
        {canEdit ? (
          <Button
            type="button"
            onClick={() => {
              setForm({ ...emptyForm, warehouseId: warehouses[0]?.id ?? '' });
              setEditing('new');
            }}
          >
            新建库位
          </Button>
        ) : (
          <p className="text-sm text-[#3d4d5c]">只读</p>
        )}
      </div>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-[#3d4d5c]">
          <tr>
            <th className="py-2">仓库</th>
            <th>代码</th>
            <th>类型</th>
            <th>状态</th>
            {canEdit ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#d5dee6]">
              <td className="py-3">{warehouseName.get(row.warehouseId) ?? row.warehouseId}</td>
              <td className="font-mono">{row.code}</td>
              <td>{locationTypeLabels[row.type] ?? row.type}</td>
              <td>{row.active ? '启用' : '停用'}</td>
              {canEdit ? (
                <td className="space-x-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForm({ warehouseId: row.warehouseId, code: row.code, type: row.type });
                      setEditing(row);
                    }}
                  >
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
            <h2 className="text-lg font-semibold">{editing === 'new' ? '新建库位' : '编辑库位'}</h2>
            {formError ? <p className="mt-3 text-sm text-[#9a3b2f]">{formError}</p> : null}
            {editing === 'new' ? (
              <label className="mt-4 block text-sm">
                仓库
                <select
                  className="mt-1 w-full rounded-lg border border-[#d5dee6] px-3 py-2"
                  value={form.warehouseId}
                  onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
                >
                  {warehouses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} {row.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
              类型
              <select
                className="mt-1 w-full rounded-lg border border-[#d5dee6] px-3 py-2"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              >
                {Object.entries(locationTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
