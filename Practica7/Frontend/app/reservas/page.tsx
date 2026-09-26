import { Suspense } from 'react';
import { LoadingState } from '@/components/Feedback';
import { ReservationStatusClient } from '@/components/pages/ReservationStatusClient';

export default function ReservationsPage() {
  return (
    <Suspense fallback={<LoadingState label="Cargando consulta…" />}>
      <ReservationStatusClient />
    </Suspense>
  );
}
