import { redirect, notFound } from 'next/navigation';
import { requireAdminAny } from '@/lib/api/admin-guard';
import { loadPacoteForOrganizar } from '@/lib/db/pacote-organizar';
import { listPalavrasChavePendentes } from '@/lib/db/palavra-chave';
import { OrganizarForm } from '@/components/portaria/OrganizarForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Story 10.5: tela admin pra organizar pacote em condomínio com administração.
 * Reusa o `OrganizarForm` da portaria — mesma lógica, contexto admin.
 */
export default async function AdministracaoOrganizarPacotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAdminAny();
  const pacote = await loadPacoteForOrganizar(ctx, id);

  if (!pacote) notFound();
  if (pacote.ja_organizado) redirect('/administracao/organizar');
  if (!pacote.unidade_id) {
    redirect('/administracao/organizar');
  }

  // Story 7.4: buscar palavras-chave pendentes pra unidade do pacote
  const palavrasChave = await listPalavrasChavePendentes(ctx, {
    unidade_id: pacote.unidade_id,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <OrganizarForm pacote={pacote} palavrasChave={palavrasChave} />
    </div>
  );
}
