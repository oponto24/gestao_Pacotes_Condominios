import { redirect } from 'next/navigation';
import { Crown } from 'lucide-react';
import { db } from '@/lib/db';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError } from '@/server/errors';
import { SuperAdminNav } from '@/components/super-admin/SuperAdminNav';
import { UserMenu } from '@/components/admin/UserMenu';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Layout dedicado super-admin (story 8.1).
 * Guard centralizado: só super_admin acessa /super-admin/*.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userId: string | null = null;
  try {
    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') redirect('/');
    userId = ctx.userId;
  } catch (err) {
    if (isTenantError(err)) redirect('/');
    throw err;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { nome: true, email: true },
  });

  return (
    <div className="flex min-h-screen flex-col">
      {/* Banner topo: contexto super-admin (escuro pra diferenciar de tenant admin) */}
      <div className="flex items-center justify-between border-b border-brand-ink/30 bg-brand-ink px-4 py-2 text-sm text-white">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-primary" aria-hidden />
          <span className="font-semibold">Super Admin</span>
          <span className="text-white/60">·</span>
          <span className="font-extrabold uppercase tracking-tight text-white/80">PONTO24</span>
        </div>
        <UserMenu nome={user?.nome ?? 'Super Admin'} email={user?.email} />
      </div>
      <SuperAdminNav />
      <div className="border-b border-border/50 bg-background/60 px-4 py-1.5 md:px-6">
        <Breadcrumbs homeHref="/super-admin" homeLabel="Visão geral" />
      </div>
      <main className="flex-1 px-4 py-4 md:px-6">{children}</main>
    </div>
  );
}
