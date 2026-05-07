import { listSetores } from '@/lib/db/setor';
import {
  SetoresListClient,
  type SetorRow,
} from '@/components/admin/SetoresListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ inativos?: string }>;
}

export default async function SetoresPage({ searchParams }: Props) {
  // AdminLayout (story 2.7) já garantiu role=admin + tenant context.
  const sp = await searchParams;
  const includeInativos = sp.inativos === 'true';

  const result = await listSetores({
    page: 1,
    pageSize: 100, // sem paginação real nesta tela ainda — admin típico tem <50 setores
    includeInativos,
  });

  const rows = result.items as unknown as SetorRow[];

  return (
    <SetoresListClient
      rows={rows}
      total={result.total}
      includeInativos={includeInativos}
    />
  );
}
