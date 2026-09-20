import type { CredentialStatus, ReservationStatus } from '@/lib/types';

type Status = ReservationStatus | CredentialStatus | 'DISPONIBLE' | 'SIN_CUPO';

const statusLabels: Record<Status, string> = {
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  RECHAZADA: 'RECHAZADA',
  SIN_CUPO: 'SIN_CUPO',
  VÁLIDA: 'VÁLIDA',
  INVÁLIDA: 'INVÁLIDA',
  NO_ENCONTRADA: 'NO_ENCONTRADA',
  DISPONIBLE: 'DISPONIBLE',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-badge--${status.toLocaleLowerCase('es').replace('_', '-')}`}>{statusLabels[status]}</span>;
}
