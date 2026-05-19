import {
  ArchiveX,
  Building2,
  CheckCircle2,
  Edit3,
  Home,
  Layers,
  MapPin,
  ScrollText,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ListAuditLogsResult } from '@/lib/db/audit-list';
import { AuditDiffViewer } from './AuditDiffViewer';

const ACAO_LABEL: Record<string, string> = {
  impersonate_start: 'Impersonate iniciado',
  impersonate_stop: 'Impersonate encerrado',
  condominio_created: 'Condomínio criado',
  condominio_updated: 'Condomínio atualizado',
  condominio_archived: 'Condomínio arquivado',
  condominio_restored: 'Condomínio restaurado',
  condominio_deleted: 'Condomínio excluído',
  bloco_created: 'Bloco criado',
  bloco_updated: 'Bloco atualizado',
  bloco_deleted: 'Bloco excluído',
  morador_created: 'Morador criado',
  morador_updated: 'Morador atualizado',
  morador_deleted: 'Morador excluído',
  setor_created: 'Setor criado',
  setor_updated: 'Setor atualizado',
  setor_deleted: 'Setor excluído',
  unidade_created: 'Unidade criada',
  unidade_updated: 'Unidade atualizada',
  unidade_deleted: 'Unidade excluída',
  user_created: 'Usuário criado',
  user_updated: 'Usuário atualizado',
  user_deleted: 'Usuário excluído',
};

const ACAO_ICON: Record<string, typeof ScrollText> = {
  impersonate_start: UserPlus,
  impersonate_stop: UserMinus,
  condominio_created: Building2,
  condominio_updated: Building2,
  condominio_archived: ArchiveX,
  condominio_restored: CheckCircle2,
  condominio_deleted: Trash2,
  bloco_created: Layers,
  bloco_updated: Layers,
  bloco_deleted: Layers,
  morador_created: Users,
  morador_updated: Users,
  morador_deleted: Users,
  setor_created: MapPin,
  setor_updated: MapPin,
  setor_deleted: MapPin,
  unidade_created: Home,
  unidade_updated: Home,
  unidade_deleted: Home,
  user_created: UserPlus,
  user_updated: Edit3,
  user_deleted: UserMinus,
};

const ACAO_COLOR: Record<string, string> = {
  impersonate_start: 'text-warning',
  impersonate_stop: 'text-text-secondary',
  condominio_created: 'text-success',
  condominio_updated: 'text-info',
  condominio_archived: 'text-danger',
  condominio_restored: 'text-success',
  condominio_deleted: 'text-danger',
};

function getAcaoColor(acao: string): string {
  if (ACAO_COLOR[acao]) return ACAO_COLOR[acao];
  if (acao.endsWith('_created')) return 'text-success';
  if (acao.endsWith('_updated')) return 'text-info';
  if (acao.endsWith('_deleted')) return 'text-danger';
  return 'text-text-secondary';
}

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

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  baseUrl: string;
  searchParams: Record<string, string | undefined>;
}

function Pagination({ page, total, limit, baseUrl, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  function buildUrl(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== 'page') params.set(k, v);
    }
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between text-sm text-text-secondary">
      <span>
        Mostrando {from}–{to} de {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <a
            href={buildUrl(page - 1)}
            className="rounded border border-border px-3 py-1 hover:bg-muted"
          >
            Anterior
          </a>
        ) : (
          <span className="rounded border border-border px-3 py-1 opacity-40">Anterior</span>
        )}
        <span className="px-2 py-1">
          Página {page} de {totalPages}
        </span>
        {page < totalPages ? (
          <a
            href={buildUrl(page + 1)}
            className="rounded border border-border px-3 py-1 hover:bg-muted"
          >
            Próxima
          </a>
        ) : (
          <span className="rounded border border-border px-3 py-1 opacity-40">Próxima</span>
        )}
      </div>
    </div>
  );
}

interface AuditLogListProps {
  data: ListAuditLogsResult;
  searchParams?: Record<string, string | undefined>;
}

export function AuditLogList({ data, searchParams = {} }: AuditLogListProps) {
  const { items, total, page, limit } = data;

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-8 text-center text-sm text-text-secondary">
        Nenhum evento registrado ainda.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Pagination
        page={page}
        total={total}
        limit={limit}
        baseUrl="/super-admin/audit"
        searchParams={searchParams}
      />
      <ul className="space-y-2">
        {items.map((e) => {
          const Icon = ACAO_ICON[e.acao] ?? ScrollText;
          const color = getAcaoColor(e.acao);
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
                <MetadataViewer metadata={e.metadata} />
              </div>
            </li>
          );
        })}
      </ul>
      <Pagination
        page={page}
        total={total}
        limit={limit}
        baseUrl="/super-admin/audit"
        searchParams={searchParams}
      />
    </div>
  );
}

function MetadataViewer({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== 'object') return null;
  const meta = metadata as Record<string, unknown>;

  const hasDiff = 'before' in meta && 'after' in meta;
  const hasSnapshot = ('before' in meta && !('after' in meta)) || ('after' in meta && !('before' in meta));

  if (hasDiff || hasSnapshot) {
    return (
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-text-secondary">Detalhes da alteração</summary>
        <div className="mt-1">
          <AuditDiffViewer metadata={meta} />
        </div>
      </details>
    );
  }

  const raw = JSON.stringify(metadata, null, 2);
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-text-secondary">Detalhes</summary>
      <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px]">{raw}</pre>
    </details>
  );
}
