import { redirect } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { db } from '@/lib/db';
import { requireAdminAny } from '@/lib/api/admin-guard';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError } from '@/server/errors';
import { UserMenu } from '@/components/admin/UserMenu';
import { AdministracaoNav } from '@/components/administracao/AdministracaoNav';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Chrome próprio da rota /administracao (story 10.5 + achado UX U3).
 *
 * Distinção visual vs /admin:
 *  - Ícone Briefcase no lugar de Building2 (admin) ou Crown (super-admin)
 *  - Sem sidebar (só 2 abas — nav horizontal mais leve)
 *  - Mesma família de tipografia + UserMenu compartilhado pra coesão
 */
export default async function AdministracaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Story 10.5: rota /administracao acessível apenas pra admin_master e admin_funcionario.
  // Porteiro e super_admin têm áreas dedicadas.
  try {
    await requireAdminAny();
  } catch (err) {
    if (isTenantError(err)) redirect('/');
    throw err;
  }

  const ctx = await getTenantContext();
  const userId = ctx.kind === 'tenant' ? ctx.userId : null;
  const condominioId = ctx.kind === 'tenant' ? ctx.condominioId : null;

  const [user, condominio] = await Promise.all([
    userId
      ? db.user.findUnique({
          where: { id: userId },
          select: { nome: true, email: true },
        })
      : Promise.resolve(null),
    condominioId
      ? db.condominio.findUnique({
          where: { id: condominioId },
          select: { nome: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex flex-col border-b border-border bg-background">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Briefcase className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Administração</div>
              {condominio && (
                <div className="truncate text-xs text-text-secondary">{condominio.nome}</div>
              )}
            </div>
          </div>
          <UserMenu nome={user?.nome ?? 'Admin'} email={user?.email} />
        </div>
      </header>
      <AdministracaoNav />
      <div className="hidden border-b border-border/50 px-4 py-1.5 md:block md:px-6">
        <Breadcrumbs homeHref="/administracao/organizar" homeLabel="Início" />
      </div>
      <main className="flex-1 px-4 py-4 md:px-6">{children}</main>
    </div>
  );
}
