import { listUnidades } from '@/lib/db/unidade';
import {
  UnidadesListClient,
  type UnidadeRow,
} from '@/components/admin/UnidadesListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ inativas?: string }>;
}

export default async function UnidadesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const includeInativas = sp.inativas === 'true';

  const result = await listUnidades({
    page: 1,
    pageSize: 100,
    includeInativas,
  });

  const rows = result.items as unknown as UnidadeRow[];

  return (
    <UnidadesListClient
      rows={rows}
      total={result.total}
      includeInativas={includeInativas}
    />
  );
}
