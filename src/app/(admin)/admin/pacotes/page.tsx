import { requireAdmin } from '@/lib/api/admin-guard';
import { listPacotesAdmin, type PacoteStatusFilter } from '@/lib/db/pacote-admin-list';
import { PacotesAdminListClient } from '@/components/admin/PacotesAdminListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_STATUS = new Set([
  'rascunho',
  'pendente_identificacao',
  'aguardando_retirada',
  'retirado',
  'cancelado',
]);

export default async function PacotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await requireAdmin();

  const statusRaw = typeof sp.status === 'string' ? sp.status : undefined;
  const status: PacoteStatusFilter | undefined =
    statusRaw && VALID_STATUS.has(statusRaw) ? (statusRaw as PacoteStatusFilter) : undefined;

  const data = await listPacotesAdmin(ctx, {
    status,
    unidade_id: typeof sp.unidade_id === 'string' ? sp.unidade_id : undefined,
    q: typeof sp.q === 'string' ? sp.q : undefined,
    page: typeof sp.page === 'string' ? Number(sp.page) : undefined,
  });

  return <PacotesAdminListClient data={data} />;
}
