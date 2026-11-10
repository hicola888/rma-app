'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const roleLabels: Record<string, string> = {
  tenant_admin: '租户管理员',
  tenant_staff: '仓库员工',
  merchant_user: '商家用户',
};

type MeResponse = {
  clerkUserId: string;
  clerkOrgId: string;
  tenant: { id: string; name: string } | null;
  role: string | null;
  merchantId: string | null;
};

type DbState = { status: 'loading' } | { status: 'down' } | { status: 'ok'; body: MeResponse };

function DatabaseIdentity({ orgId }: { orgId: string }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<DbState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error('missing token');
        }
        const response = await fetch(`${apiBase}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const body = (await response.json()) as MeResponse;
        if (!cancelled) {
          setState({ status: 'ok', body });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'down' });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId]);

  if (state.status === 'loading') {
    return <p className="text-sm text-[#3d4d5c]">正在读取数据库里的身份…</p>;
  }

  if (state.status === 'down') {
    return (
      <p className="text-sm leading-6 text-[#9a3b2f]">
        API 没有启动或连不上（应该在 http://localhost:3001）
      </p>
    );
  }

  if (!state.body.tenant || !state.body.role) {
    return (
      <p className="text-sm leading-6 text-[#3d4d5c]">
        数据库里还没有这个账号。请在仓库根目录运行{' '}
        <span className="font-mono">pnpm db:bootstrap</span>
        ，把上面的 User ID 和 Organization ID 填进去。
      </p>
    );
  }

  const roleLabel = roleLabels[state.body.role] ?? state.body.role;

  return (
    <div className="space-y-4 text-sm">
      <p>
        <span className="text-[#3d4d5c]">所属租户</span>
        <span className="ml-3 font-medium">{state.body.tenant.name}</span>
      </p>
      <p>
        <span className="text-[#3d4d5c]">角色</span>
        <span className="ml-3 font-medium">
          {roleLabel}（{state.body.role}）
        </span>
      </p>
    </div>
  );
}

export function MeDetails() {
  const { isLoaded, isSignedIn, userId, orgId } = useAuth();

  if (!isLoaded) {
    return <p>正在读取登录信息…</p>;
  }

  if (!isSignedIn) {
    return <p>请先登录，再回到这个页面复制 ID。</p>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-[#3d4d5c]">Clerk User ID</h2>
        <p className="mt-2 break-all rounded-lg bg-[#f4f6f8] px-3 py-2 font-mono text-sm">
          {userId}
        </p>
      </section>
      <section>
        <h2 className="text-sm font-medium text-[#3d4d5c]">Clerk Organization ID</h2>
        <p className="mt-2 break-all rounded-lg bg-[#f4f6f8] px-3 py-2 font-mono text-sm">
          {orgId ?? '当前没有选中组织。请先在 Clerk 里进入一个 Organization，再刷新本页。'}
        </p>
      </section>
      <p className="text-sm leading-6 text-[#3d4d5c]">
        复制上面两个值后，在仓库根目录运行 <span className="font-mono">pnpm db:bootstrap</span>
        ，或带上参数：
      </p>
      <pre className="overflow-x-auto rounded-lg bg-[#122033] p-3 text-xs text-white">
        {`pnpm db:bootstrap -- --user-id ${userId ?? 'user_xxx'} --org-id ${orgId ?? 'org_xxx'}`}
      </pre>
      <section>
        <h2 className="text-base font-semibold">数据库里的身份</h2>
        <div className="mt-3">
          {orgId ? (
            <DatabaseIdentity orgId={orgId} />
          ) : (
            <p className="text-sm leading-6 text-[#3d4d5c]">
              还没有选中组织，所以还不能查询数据库里的租户。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
