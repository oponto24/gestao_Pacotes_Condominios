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

// Guard centralizado em src/app/super-admin/layout.tsx (story 8.1)
export default async function CondominiosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const includeArquivados = sp.arquivados === 'true';

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
