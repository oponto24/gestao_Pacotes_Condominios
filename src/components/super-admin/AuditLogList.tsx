import {
  ArchiveX,
  Building2,
  CheckCircle2,
  ScrollText,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import type { AuditLogItem } from '@/lib/db/audit-list';

const ACAO_LABEL: Record<string, string> = {
  impersonate_start: 'Impersonate iniciado',
  impersonate_stop: 'Impersonate encerrado',
  condominio_created: 'Condomínio criado',
  condominio_updated: 'Condomínio atualizado',
  condominio_archived: 'Condomínio arquivado',
  condominio_restored: 'Condomínio restaurado',
};

const ACAO_ICON: Record<string, typeof ScrollText> = {
  impersonate_start: UserPlus,
  impersonate_stop: UserMinus,
  condominio_created: Building2,
  condominio_updated: Building2,
  condominio_archived: ArchiveX,
  condominio_restored: CheckCircle2,
};

const ACAO_COLOR: Record<string, string> = {
  impersonate_start: 'text-warning',
  impersonate_stop: 'text-text-secondary',
  condominio_created: 'text-success',
  condominio_updated: 'text-info',
  condominio_archived: 'text-danger',
  condominio_restored: 'text-success',
};

function formatTs(d: Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditLogList({ items }: { items: AuditLogItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-8 text-center text-sm text-text-secondary">
        Nenhum evento registrado ainda.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((e) => {
        const Icon = ACAO_ICON[e.acao] ?? ScrollText;
        const color = ACAO_COLOR[e.acao] ?? 'text-text-secondary';
        const label = ACAO_LABEL[e.acao] ?? e.acao;
        return (
          <li
            key={e.id}
            className="flex gap-3 rounded-lg border border-border bg-background p-3"
          >
            <div className={`mt-0.5 ${color}`}>
              <Icon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-text-secondary">{formatTs(e.created_at)}</p>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {e.user_nome ?? '—'}
                {e.condominio_nome && ` · ${e.condominio_nome}`}
                {e.ip_address && ` · ${e.ip_address}`}
              </p>
              {(() => {
                if (!e.metadata || typeof e.metadata !== 'object') return null;
                const meta: string = JSON.stringify(e.metadata, null, 2) ?? '';
                return (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-text-secondary">
                      Detalhes
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                      {meta}
                    </pre>
                  </details>
                );
              })()}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
