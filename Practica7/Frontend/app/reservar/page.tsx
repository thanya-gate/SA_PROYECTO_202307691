import { Suspense } from 'react';
import { LoadingState } from '@/components/Feedback';
import { ReservationClient } from '@/components/pages/ReservationClient';

export default function ReservationPage() {
  return (
    <Suspense fallback={<LoadingState label="Preparando reserva…" />}>
      <ReservationClient />
    </Suspense>
  );
}
