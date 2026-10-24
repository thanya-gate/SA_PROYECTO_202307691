import { Suspense } from 'react';
import { LoadingState } from '@/components/Feedback';
import { EventDetailClient } from '@/components/pages/EventDetailClient';

export default function EventDetailPage() {
  return (
    <Suspense fallback={<LoadingState label="Cargando detalle…" />}>
      <EventDetailClient />
    </Suspense>
  );
}
