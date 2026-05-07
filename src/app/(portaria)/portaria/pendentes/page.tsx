import { requirePorteiro } from '@/lib/api/portaria-guard';
import { listPendentes } from '@/lib/db/pacote-pendentes';
import { PendentesList } from '@/components/portaria/PendentesList';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PendentesPage() {
  const ctx = await requirePorteiro();
  const itens = await listPendentes(ctx);
  return <PendentesList itens={itens} />;
}
