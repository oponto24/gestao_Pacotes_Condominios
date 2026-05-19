import { Suspense } from 'react';
import { listAuditLogs } from '@/lib/db/audit-list';
import { db } from '@/lib/db';
import { AuditLogList } from '@/components/super-admin/AuditLogList';
import { AuditFilters } from '@/components/super-admin/AuditFilters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{
    acao?: string;
    condominio_id?: string;
    entidade_tipo?: string;
    user_q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

// Guard centralizado em /super-admin/layout.tsx
export default async function AuditLogPage({ searchParams }: Props) {
  const sp = await searchParams;

  const [data, condominios] = await Promise.all([
    listAuditLogs({
      acao: sp.acao,
      condominio_id: sp.condominio_id,
      entidade_tipo: sp.entidade_tipo,
      user_q: sp.user_q,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to) : undefined,
      page: sp.page ? Number(sp.page) : undefined,
      limit: 20,
    }),
    db.condominio.findMany({
      where: { deleted_at: null },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ]);

  const spRecord: Record<string, string | undefined> = {
    acao: sp.acao,
    condominio_id: sp.condominio_id,
    entidade_tipo: sp.entidade_tipo,
    user_q: sp.user_q,
    from: sp.from,
    to: sp.to,
    page: sp.page,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <span className="text-sm text-text-secondary">{data.total} eventos</span>
      </header>

      <Suspense fallback={null}>
        <AuditFilters condominios={condominios} />
      </Suspense>

      <AuditLogList data={data} searchParams={spRecord} />
    </div>
  );
}
