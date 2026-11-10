import { Suspense } from 'react';
import { AdminNav } from '@/components/admin/admin-nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl">
      <Suspense fallback={<div className="w-44 shrink-0 border-r border-[#d5dee6] bg-white" />}>
        <AdminNav />
      </Suspense>
      <div className="min-w-0 flex-1 p-6">{children}</div>
    </div>
  );
}
