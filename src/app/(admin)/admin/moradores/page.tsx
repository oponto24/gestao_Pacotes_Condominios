import { listMoradores } from '@/lib/db/morador';
import { listUnidades } from '@/lib/db/unidade';
import {
  MoradoresListClient,
  type MoradorRow,
} from '@/components/admin/MoradoresListClient';
import type { UnidadeOption } from '@/components/admin/MoradorForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ arquivados?: string }>;
}

export default async function MoradoresPage({ searchParams }: Props) {
  const sp = await searchParams;
  const includeArquivados = sp.arquivados === 'true';

  // Lista moradores + unidades ativas (para dropdown do form)
  const [moradoresResult, unidadesResult] = await Promise.all([
    listMoradores({
      page: 1,
      pageSize: 200,
      includeInativos: false,
      includeArquivados,
    }),
    listUnidades({ page: 1, pageSize: 500, includeInativas: false }),
  ]);

  const rows = moradoresResult.items as unknown as MoradorRow[];
  const unidades: UnidadeOption[] = unidadesResult.items.map((u) => ({
    id: u.id,
    identificador: u.identificador,
    bloco: (u as unknown as { bloco_ref: { nome: string } | null }).bloco_ref?.nome ?? u.bloco,
  }));

  return (
    <MoradoresListClient
      rows={rows}
      total={moradoresResult.total}
      unidades={unidades}
      includeArquivados={includeArquivados}
    />
  );
}
