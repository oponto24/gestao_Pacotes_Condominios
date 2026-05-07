import { redirect, notFound } from 'next/navigation';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { loadPacoteForOrganizar } from '@/lib/db/pacote-organizar';
import { OrganizarForm } from '@/components/portaria/OrganizarForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OrganizarPacotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requirePorteiro();
  const pacote = await loadPacoteForOrganizar(ctx, id);

  if (!pacote) notFound();

  // Se já organizado, redireciona pra /chegada (ciclo recomeça)
  if (pacote.ja_organizado) redirect('/chegada');

  if (!pacote.unidade_id) {
    redirect(`/chegada/confirmar/${id}`);
  }

  return <OrganizarForm pacote={pacote} />;
}
