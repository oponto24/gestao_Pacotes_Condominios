import { redirect, notFound } from 'next/navigation';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { loadPacoteForConfirmar } from '@/lib/db/pacote-confirmar';
import { IAExtractionForm } from '@/components/portaria/IAExtractionForm';
import { IAProcessingState } from '@/components/portaria/IAProcessingState';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ConfirmarPacotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requirePorteiro();
  const pacote = await loadPacoteForConfirmar(ctx, id);

  if (!pacote) notFound();

  // Idempotência UX: se já confirmado, segue pra organizar (3.9)
  if (pacote.ja_confirmado) {
    redirect(`/chegada/organizar/${id}`);
  }

  // Worker BullMQ pode levar 1-3s pra extrair etiqueta. Enquanto `ia_confianca`
  // for null, exibe loading com auto-refresh — evita usuário ver "0%" + campos
  // vazios e achar que o sistema bugou.
  if (pacote.ia_confianca === null) {
    return <IAProcessingState fotoPath={pacote.foto_storage_path} />;
  }

  return <IAExtractionForm pacote={pacote} />;
}
