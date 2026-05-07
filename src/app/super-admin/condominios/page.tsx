import { redirect } from 'next/navigation';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError } from '@/server/errors';
import { listCondominios } from '@/lib/db/condominio';
import {
  CondominiosListClient,
  type CondominioRow,
} from '@/components/super-admin/CondominiosListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ page?: string; arquivados?: string }>;
}

export default async function CondominiosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const includeArquivados = sp.arquivados === 'true';

  let isSuperAdmin = false;
  try {
    const ctx = await getTenantContext();
    isSuperAdmin = ctx.kind === 'super_admin';
  } catch (err) {
    if (isTenantError(err)) redirect('/');
    throw err;
  }
  if (!isSuperAdmin) redirect('/');

  const result = await listCondominios({
    page,
    pageSize: 20,
    includeArquivados,
  });

  const rows = result.items as unknown as CondominioRow[];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <CondominiosListClient
        rows={rows}
        total={result.total}
        page={page}
        pageSize={20}
        includeArquivados={includeArquivados}
      />
    </div>
  );
}
