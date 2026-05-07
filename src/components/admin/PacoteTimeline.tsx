import {
  Sparkles,
  PackagePlus,
  CheckCircle2,
  PackageCheck,
  AlertTriangle,
  Send,
  XCircle,
} from 'lucide-react';
import type { PacoteDetailEvento } from '@/lib/db/pacote-admin-detail';

const TIPO_LABEL: Record<string, string> = {
  criado: 'Pacote criado',
  ia_processou: 'IA processou foto',
  confirmado: 'Dados confirmados',
  notificado: 'WhatsApp enviado',
  notificacao_falhou: 'Falha ao notificar',
  retirado: 'Pacote retirado',
  cancelado: 'Cancelado',
  pendencia_resolvida: 'Pendência resolvida',
  reenvio_notificacao: 'Reenvio WhatsApp',
};

const TIPO_ICON: Record<string, typeof Sparkles> = {
  criado: PackagePlus,
  ia_processou: Sparkles,
  confirmado: CheckCircle2,
  notificado: Send,
  notificacao_falhou: AlertTriangle,
  retirado: PackageCheck,
  cancelado: XCircle,
  pendencia_resolvida: CheckCircle2,
  reenvio_notificacao: Send,
};

const TIPO_COLOR: Record<string, string> = {
  criado: 'text-text-secondary',
  ia_processou: 'text-accent',
  confirmado: 'text-success',
  notificado: 'text-info',
  notificacao_falhou: 'text-warning',
  retirado: 'text-success',
  cancelado: 'text-danger',
  pendencia_resolvida: 'text-success',
  reenvio_notificacao: 'text-info',
};

function formatTimestamp(d: Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PacoteTimeline({ eventos }: { eventos: PacoteDetailEvento[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-text-secondary">Nenhum evento registrado ainda.</p>
    );
  }
  return (
    <ol className="space-y-3">
      {eventos.map((e) => {
        const Icon = TIPO_ICON[e.tipo] ?? Sparkles;
        const color = TIPO_COLOR[e.tipo] ?? 'text-text-secondary';
        const label = TIPO_LABEL[e.tipo] ?? e.tipo;
        return (
          <li key={e.id} className="flex gap-3">
            <div className={`mt-0.5 ${color}`}>
              <Icon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-text-secondary">
                {formatTimestamp(e.created_at)}
                {e.user_nome && ` · ${e.user_nome}`}
              </p>
              {(() => {
                if (!e.metadata || typeof e.metadata !== 'object') return null;
                const metaStr: string = JSON.stringify(e.metadata, null, 2) ?? '';
                return (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-text-secondary">
                      Metadata
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                      {metaStr}
                    </pre>
                  </details>
                );
              })()}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
