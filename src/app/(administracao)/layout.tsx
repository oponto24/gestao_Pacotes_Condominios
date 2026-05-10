import { redirect } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { db } from '@/lib/db';
import { requireAdminAny } from '@/lib/api/admin-guard';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError } from '@/server/errors';
import { UserMenu } from '@/components/admin/UserMenu';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  // Header mínimo provisório (achado U3 no handoff UX). PR2 vai introduzir
  // AdministracaoLayoutClient próprio com nav, breadcrumbs e identidade visual.
  const ctx = await getTenantContext();
  const userId = ctx.kind === 'tenant' ? ctx.userId : null;
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { nome: true, email: true },
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold text-foreground">Administração</span>
        </div>
        <UserMenu nome={user?.nome ?? 'Admin'} email={user?.email} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
