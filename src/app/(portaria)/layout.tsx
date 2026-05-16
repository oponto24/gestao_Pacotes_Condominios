import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError, PendingProvisioningError, CondominioSuspendedError } from '@/server/errors';
import { PortariaLayout } from '@/components/portaria/PortariaLayout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Layout server da portaria (story 3.1).
 *
 * Aceita roles `porteiro` e `admin` (decisão @po).
 * `super_admin` é redirecionado para sua área dedicada.
 * Anônimos ou pending caem na raiz / sign-in.
 */
export default async function PortariaServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (err) {
    if (err instanceof PendingProvisioningError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold">Configurando sua conta…</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Aguarde alguns segundos e atualize a página.
            </p>
          </div>
        </div>
      );
    }
    if (err instanceof CondominioSuspendedError) redirect('/suspended');
    if (isTenantError(err)) redirect('/');
    throw err;
  }

  if (ctx.kind === 'super_admin') redirect('/super-admin/condominios');
  if (
    ctx.role !== 'porteiro' &&
    ctx.role !== 'admin_master' &&
    ctx.role !== 'admin_funcionario'
  )
    redirect('/');

  const condominio = await db.condominio.findUnique({
    where: { id: ctx.condominioId },
    select: { nome: true },
  });
  if (!condominio) redirect('/');

  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { nome: true, email: true },
  });

  return (
    <PortariaLayout
      condominioNome={condominio.nome}
      userNome={user?.nome ?? 'Porteiro'}
      userEmail={user?.email ?? null}
    >
      {children}
    </PortariaLayout>
  );
}
