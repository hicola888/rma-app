import { Suspense } from 'react';
import { StaffScreen } from '@/components/admin/staff-screen';

export default function StaffPage() {
  return (
    <Suspense fallback={<p>正在加载员工…</p>}>
      <StaffScreen />
    </Suspense>
  );
}
