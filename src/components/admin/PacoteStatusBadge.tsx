import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente_identificacao: 'Pendente ID',
  aguardando_retirada: 'Aguardando',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
};

const STATUS_CLASSES: Record<string, string> = {
  rascunho: 'bg-muted text-text-secondary',
  pendente_identificacao: 'bg-warning/15 text-warning',
  aguardando_retirada: 'bg-info/15 text-info',
  retirado: 'bg-success/15 text-success',
  cancelado: 'bg-danger/10 text-danger',
};

export function PacoteStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status] ?? 'bg-muted text-text-secondary',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
