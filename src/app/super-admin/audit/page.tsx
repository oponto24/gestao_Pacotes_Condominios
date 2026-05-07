import { listAuditLogs } from '@/lib/db/audit-list';
import { AuditLogList } from '@/components/super-admin/AuditLogList';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{
    acao?: string;
    condominio_id?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

// Guard centralizado em /super-admin/layout.tsx
export default async function AuditLogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const data = await listAuditLogs({
    acao: sp.acao,
    condominio_id: sp.condominio_id,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    page: sp.page ? Number(sp.page) : undefined,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <span className="text-sm text-text-secondary">{data.total} eventos</span>
      </header>
      <p className="text-sm text-text-secondary">
        Histórico de ações sensíveis (impersonate, criação/edição/arquivamento de condomínios).
      </p>
      <AuditLogList items={data.items} />
    </div>
  );
}
