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

  // Story 10.4: pacote em condomínio com administração saiu da fila do porteiro.
  // Story 10.5 vai criar /administracao/organizar — por enquanto redirect pra /chegada.
  if (pacote.status === 'aguardando_organizacao') redirect('/chegada?msg=enviado_administracao');

  if (!pacote.unidade_id) {
    redirect(`/chegada/confirmar/${id}`);
  }

  return <OrganizarForm pacote={pacote} />;
}
