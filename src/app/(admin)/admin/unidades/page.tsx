import { listUnidades } from '@/lib/db/unidade';
import { listBlocos } from '@/lib/db/bloco';
import {
  UnidadesListClient,
  type UnidadeRow,
} from '@/components/admin/UnidadesListClient';
import type { BlocoOption } from '@/components/admin/UnidadeForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ inativas?: string }>;
}

export default async function UnidadesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const includeInativas = sp.inativas === 'true';

  const [result, blocosResult] = await Promise.all([
    listUnidades({
      page: 1,
      pageSize: 100,
      includeInativas,
    }),
    listBlocos({ page: 1, pageSize: 200, includeInativos: false }),
  ]);

  const rows = result.items as unknown as UnidadeRow[];
  const blocos: BlocoOption[] = blocosResult.items.map((b) => ({
    id: b.id,
    nome: b.nome,
  }));

  return (
    <UnidadesListClient
      rows={rows}
      total={result.total}
      includeInativas={includeInativas}
      blocos={blocos}
    />
  );
}
