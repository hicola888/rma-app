'use client';

import { useAuth } from '@clerk/nextjs';

export function MeDetails() {
  const { isLoaded, isSignedIn, userId, orgId } = useAuth();

  if (!isLoaded) {
    return <p>正在读取登录信息…</p>;
  }

  if (!isSignedIn) {
    return <p>请先登录，再回到这个页面复制 ID。</p>;
  }

  return (
    <div className="space-y-6">
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
    </div>
  );
}
