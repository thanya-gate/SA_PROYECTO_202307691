export function LoadingState({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <div className="feedback feedback--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="feedback feedback--error" role="alert">
      <strong>No se pudo completar la consulta.</strong>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="button button--secondary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="feedback feedback--empty" role="status">
      <strong>No hay resultados</strong>
      <span>{message}</span>
    </div>
  );
}
