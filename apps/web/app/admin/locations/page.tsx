import { Suspense } from 'react';
import { LocationsScreen } from '@/components/admin/locations-screen';

export default function LocationsPage() {
  return (
    <Suspense fallback={<p>正在加载库位…</p>}>
      <LocationsScreen />
    </Suspense>
  );
}
