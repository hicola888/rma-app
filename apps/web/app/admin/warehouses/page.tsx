import { Suspense } from 'react';
import { WarehousesScreen } from '@/components/admin/warehouses-screen';

export default function WarehousesPage() {
  return (
    <Suspense fallback={<p>正在加载仓库…</p>}>
      <WarehousesScreen />
    </Suspense>
  );
}
