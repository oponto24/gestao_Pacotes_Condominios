import { Suspense } from 'react';
import { getTenantContext } from '@/server/middleware/tenant';
import { redirect } from 'next/navigation';
import { listAuditLogs } from '@/lib/db/audit-list';
import { AuditLogList } from '@/components/super-admin/AuditLogList';
import { AuditFilters } from '@/components/super-admin/AuditFilters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{
    acao?: string;
    entidade_tipo?: string;
    user_q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

/**
 * Story 12.6: audit log pra admin_master — vê só do próprio condomínio.
 * Guard de admin_master no layout já garante acesso.
 */
export default async function AdminAuditPage({ searchParams }: Props) {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant' || ctx.role !== 'admin_master') {
    redirect('/admin');
  }

  const sp = await searchParams;

  const data = await listAuditLogs({
    acao: sp.acao,
    condominio_id: ctx.condominioId,
    entidade_tipo: sp.entidade_tipo,
    user_q: sp.user_q,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    page: sp.page ? Number(sp.page) : undefined,
    limit: 20,
  });

  const spRecord: Record<string, string | undefined> = {
    acao: sp.acao,
    entidade_tipo: sp.entidade_tipo,
    user_q: sp.user_q,
    from: sp.from,
    to: sp.to,
    page: sp.page,
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <span className="text-sm text-text-secondary">{data.total} eventos</span>
      </header>

      <Suspense fallback={null}>
        <AuditFilters condominios={[]} baseUrl="/admin/audit" />
      </Suspense>

      <AuditLogList data={data} searchParams={spRecord} baseUrl="/admin/audit" />
    </div>
  );
}
