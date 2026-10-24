import { Suspense } from 'react';
import { LoadingState } from '@/components/Feedback';
import { CatalogClient } from '@/components/pages/CatalogClient';

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingState label="Cargando catálogo…" />}>
      <CatalogClient />
    </Suspense>
  );
}
