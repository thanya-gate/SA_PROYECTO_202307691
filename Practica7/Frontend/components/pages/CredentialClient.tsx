'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell, MockContractNote, PageIntro } from '@/components/AppShell';
import { ErrorState, LoadingState } from '@/components/Feedback';
import { FormField } from '@/components/FormField';
import { StatusBadge } from '@/components/StatusBadge';
import { verifyCredential } from '@/lib/mock-api';
import type { CredentialVerification } from '@/lib/types';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Intenta nuevamente en unos momentos.';
}

export function CredentialClient() {
  const searchParams = useSearchParams();
  const queryIdentifier = searchParams.get('identifier') ?? '';
  const [identifier, setIdentifier] = useState(queryIdentifier);
  const [result, setResult] = useState<CredentialVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | undefined>();

  const verify = useCallback(async (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      setValidationError('Ingresa un identificador o hash.');
      setResult(null);
      return;
    }
    if (!/^[A-Z0-9-]{6,64}$/i.test(normalized)) {
      setValidationError('Usa entre 6 y 64 caracteres alfanuméricos, guiones o un hash válido.');
      setResult(null);
      return;
    }
    setValidationError(undefined);
    setLoading(true);
    setError(null);
    try {
      setResult(await verifyCredential(normalized));
    } catch (reason: unknown) {
      setResult(null);
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (queryIdentifier) void verify(queryIdentifier);
  }, [queryIdentifier, verify]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(identifier);
  }

  return (
    <AppShell>
      <section className="page-section">
        <PageIntro
          caseId="CU-P7-05"
          title="Verificar credencial"
          description="Consulta públicamente la validez de un diploma mediante su identificador o hash."
        />
        <form className="credential-query" onSubmit={submit} noValidate>
          <FormField
            id="credential-identifier"
            label="Identificador o hash"
            placeholder="CERT-2026-000742"
            value={identifier}
            onChange={(input) => setIdentifier(input.target.value)}
            error={validationError}
          />
          <button className="button button--primary" type="submit" disabled={loading}>
            {loading ? 'Verificando…' : 'Verificar'}
          </button>
        </form>

        {loading && <LoadingState label="Consultando el Servicio de Certificados…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && result && (
          <section className="panel result-card" aria-live="polite" aria-labelledby="credential-result-title">
            <StatusBadge status={result.status} />
            <h2 id="credential-result-title">
              {result.status === 'VÁLIDA' ? 'Credencial verificada' : result.title}
            </h2>
            <p>{result.message}</p>
            {result.status === 'VÁLIDA' && (
              <dl className="result-details">
                <div><dt>Actividad</dt><dd>{result.title}</dd></div>
                <div><dt>Titular</dt><dd>{result.holder}</dd></div>
                <div><dt>Emitido</dt><dd>{result.issuedAt}</dd></div>
              </dl>
            )}
            <hr />
            <p className="panel-note">Solo se muestran datos académicos públicos.</p>
            <button className="button button--secondary button--full" type="button" onClick={() => { setIdentifier(''); setResult(null); setError(null); setValidationError(undefined); }}>
              Nueva consulta
            </button>
          </section>
        )}

        <MockContractNote>La consulta utiliza GET /mock/credentials/verify?identifier=.</MockContractNote>
      </section>
    </AppShell>
  );
}
