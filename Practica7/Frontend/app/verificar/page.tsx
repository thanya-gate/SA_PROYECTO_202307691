import { Suspense } from 'react';
import { LoadingState } from '@/components/Feedback';
import { CredentialClient } from '@/components/pages/CredentialClient';

export default function CredentialPage() {
  return (
    <Suspense fallback={<LoadingState label="Cargando verificación…" />}>
      <CredentialClient />
    </Suspense>
  );
}
