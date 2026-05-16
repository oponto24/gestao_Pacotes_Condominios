import { listBlocos } from '@/lib/db/bloco';
import {
  BlocosListClient,
  type BlocoRow,
} from '@/components/admin/BlocosListClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ inativos?: string }>;
}

export default async function BlocosPage({ searchParams }: Props) {
  // AdminLayout (story 2.7) ja garantiu role=admin + tenant context.
  const sp = await searchParams;
  const includeInativos = sp.inativos === 'true';

  const result = await listBlocos({
    page: 1,
    pageSize: 100, // sem paginacao real nesta tela ainda
    includeInativos,
  });

  const rows = result.items as unknown as BlocoRow[];

  return (
    <BlocosListClient
      rows={rows}
      total={result.total}
      includeInativos={includeInativos}
    />
  );
}
