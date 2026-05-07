import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError, PendingProvisioningError } from '@/server/errors';
import { AdminLayoutClient } from '@/components/admin/AdminLayoutClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
    if (isTenantError(err)) redirect('/');
    throw err;
  }

  // super_admin não tem AdminLayout — vai para sua área dedicada
  if (ctx.kind === 'super_admin') redirect('/super-admin/condominios');

  // Apenas admin passa. Porteiro vai pra raiz (futuro `/portaria`).
  if (ctx.role !== 'admin') redirect('/');

  const condominio = await db.condominio.findUnique({
    where: { id: ctx.condominioId },
    select: { nome: true, cidade: true, estado: true },
  });

  if (!condominio) {
    // Edge case: condomínio do user foi arquivado/deletado entre login e nav
    redirect('/');
  }

  // Carrega user pra mostrar nome/email no header
  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { nome: true, email: true },
  });

  return (
    <AdminLayoutClient
      condominioNome={condominio.nome}
      condominioCidadeUf={`${condominio.cidade}/${condominio.estado}`}
      userNome={user?.nome ?? 'Admin'}
      userEmail={user?.email}
    >
      {children}
    </AdminLayoutClient>
  );
}
