'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ImportExportToolbar,
  matchesFilter,
} from '@/components/import-export/import-export-toolbar';
import { roleLabels, useAdminLoad, type AdminRequest, type MeInfo, type StaffMember } from './api';

export function StaffScreen() {
  const [me, setMe] = useState<MeInfo | null>(null);
  const [rows, setRows] = useState<StaffMember[]>([]);
  const [forbidden, setForbidden] = useState(false);
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
      setRows(await request<StaffMember[]>('/staff'));
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
  if (forbidden) return <p>货主账号不能查看员工。</p>;

  const canEdit = me?.role === 'tenant_admin';
  const visible = rows.filter((row) =>
    matchesFilter(query, [row.user.name, row.user.email, roleLabels[row.role] ?? row.role]),
  );

  async function changeRole(row: StaffMember, role: string) {
    try {
      await request(`/staff/${row.id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      reload();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : '修改失败');
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">员工</h1>
        <div className="flex flex-wrap items-center gap-2">
          {formError ? <p className="text-sm text-[#9a3b2f]">{formError}</p> : null}
          <ImportExportToolbar
            canImport={false}
            filename="staff"
            query={query}
            onQueryChange={setQuery}
            exportPath="/staff/export"
          />
          {canEdit ? null : <p className="text-sm text-[#3d4d5c]">只读</p>}
        </div>
      </div>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-[#3d4d5c]">
          <tr>
            <th className="py-2">姓名</th>
            <th>邮箱</th>
            <th>角色</th>
            {canEdit ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} className="border-t border-[#d5dee6]">
              <td className="py-3">{row.user.name ?? row.user.clerkUserId}</td>
              <td>{row.user.email ?? '—'}</td>
              <td>{roleLabels[row.role] ?? row.role}</td>
              {canEdit ? (
                <td className="text-right">
                  {row.role === 'merchant_user' ? (
                    <span className="text-[#3d4d5c]">货主账号暂不在这里调整</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void changeRole(
                          row,
                          row.role === 'tenant_admin' ? 'tenant_staff' : 'tenant_admin',
                        )
                      }
                    >
                      {row.role === 'tenant_admin' ? '改为仓库员工' : '改为租户管理员'}
                    </Button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
